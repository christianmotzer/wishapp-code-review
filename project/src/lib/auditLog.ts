import { supabase } from './supabase';

export interface AdminAction {
  id: string;
  admin_email: string;
  action_type: string;
  target_id: string;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export async function logAdminAction(
  actionType: string,
  targetId: string,
  reason?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.email) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase.from('admin_actions').insert({
    admin_email: user.user.email,
    action_type: actionType,
    target_id: targetId,
    reason: reason || null,
    metadata: metadata || null,
  });

  if (error) {
    console.error('Failed to log admin action:', error);
  }
}

export async function getAuditLog(
  limit: number = 50,
  actionType?: string
): Promise<AdminAction[]> {
  let query = supabase
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actionType) {
    query = query.eq('action_type', actionType);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getAdminActionsByAdmin(adminEmail: string, limit: number = 50): Promise<AdminAction[]> {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .eq('admin_email', adminEmail)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}
