import { supabase } from './supabase';

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_tokens_received: number;
  current_balance: number;
  wishes_created: number;
  wishes_supported: number;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getProfile(user.id);
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function generateNewName(): Promise<string | null> {
  const { data, error } = await supabase.rpc('generate_lovely_name');

  if (error) {
    console.error('Error generating name:', error);
    return null;
  }

  return data;
}

export async function getLeaderboard(
  timePeriod: 'all_time' | 'month' | 'week' = 'all_time',
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_token_leaderboard', {
    time_period: timePeriod,
    limit_count: limit
  });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

export async function getAllUserProfiles(searchQuery?: string): Promise<UserProfile[]> {
  let query = supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (searchQuery) {
    query = query.or(`display_name.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user profiles:', error);
    return [];
  }

  return data || [];
}

export async function getUserProfileWithStats(userId: string) {
  const profile = await getProfile(userId);

  if (!profile) {
    return null;
  }

  const [tokensResult, wishesResult, supportsResult] = await Promise.all([
    supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('wishes')
      .select('id', { count: 'exact' })
      .eq('creator_id', userId),
    supabase
      .from('wish_support')
      .select('id', { count: 'exact' })
      .eq('supporter_id', userId)
  ]);

  return {
    ...profile,
    token_balance: tokensResult.data?.balance || 0,
    wishes_created: wishesResult.count || 0,
    wishes_supported: supportsResult.count || 0
  };
}
