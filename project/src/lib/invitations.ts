import { supabase } from './supabase';

export interface Invitation {
  id: string;
  inviter_id: string;
  email: string;
  invitation_code: string;
  status: 'pending' | 'accepted' | 'expired';
  sent_at: string;
  accepted_at: string | null;
  expires_at: string;
  message: string | null;
}

export interface InvitationResult {
  invitation_code: string;
  email: string;
  invitation_url: string;
  inviter_name: string;
  message?: string;
}

export async function sendInvitation(email: string, message?: string): Promise<InvitationResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('You must be logged in to send invitations');
  }

  const userId = session.user.id;

  // Fetch rate limit from admin settings
  const { data: settingData, error: settingError } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'invitation_rate_limit')
    .maybeSingle();

  const rateLimit = settingData?.value ? parseInt(settingData.value as string) : 10;

  // Check how many invitations the user has sent today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', userId)
    .gte('sent_at', today.toISOString());

  if (countError) {
    throw new Error('Failed to check invitation rate limit');
  }

  if (count && count >= rateLimit) {
    throw new Error(`You have reached the daily invitation limit of ${rateLimit}`);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address');
  }

  // Check for duplicate pending invitations to the same email
  const { data: existingInvitation, error: existingError } = await supabase
    .from('invitations')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw new Error('Failed to check existing invitations');
  }

  if (existingInvitation) {
    throw new Error('An invitation has already been sent to this email address');
  }

  // Create the invitation
  const { data: invitation, error: invitationError } = await supabase
    .from('invitations')
    .insert({
      inviter_id: userId,
      email: email.toLowerCase(),
      message: message || null,
    })
    .select()
    .single();

  if (invitationError || !invitation) {
    throw new Error('Failed to create invitation');
  }

  // Fetch the inviter's display name
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();

  const inviterName = profileData?.display_name || 'A friend';

  // Generate invitation URL
  const baseUrl = window.location.origin;
  const invitationUrl = `${baseUrl}/signup?email=${encodeURIComponent(email)}&token=${invitation.invitation_code}`;

  return {
    invitation_code: invitation.invitation_code,
    email: invitation.email,
    invitation_url: invitationUrl,
    inviter_name: inviterName,
    message,
  };
}

export async function getMyInvitations() {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return data as Invitation[];
}

export async function verifyInvitationToken(email: string, token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, status, expires_at')
    .eq('email', email.toLowerCase())
    .eq('invitation_code', token)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  if (data.status !== 'pending') {
    return false;
  }

  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    return false;
  }

  return true;
}

export async function acceptInvitation(invitationCode: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to accept an invitation');
  }

  const { data, error } = await supabase.rpc('accept_invitation', {
    p_invitation_code: invitationCode,
    p_user_id: user.id,
  });

  if (error) throw error;
  return data;
}
