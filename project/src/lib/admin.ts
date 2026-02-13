import { supabase } from './supabase';

export interface AdminUser {
  email: string;
  role: 'admin' | 'super_admin';
  granted_by: string | null;
  granted_at: string;
  created_at: string;
}

export async function getAdminRole(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role;
}

export async function isAdmin(email: string): Promise<boolean> {
  const role = await getAdminRole(email);
  return role === 'admin' || role === 'super_admin';
}

export async function isSuperAdmin(email: string): Promise<boolean> {
  const role = await getAdminRole(email);
  return role === 'super_admin';
}

export async function getAllAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function addAdmin(
  email: string,
  role: 'admin' | 'super_admin',
  grantedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('admin_users')
    .insert({
      email,
      role,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export async function removeAdmin(email: string): Promise<void> {
  const { error } = await supabase
    .from('admin_users')
    .delete()
    .eq('email', email);

  if (error) {
    throw error;
  }
}

export async function blockAccount(
  userId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_block_account', {
    p_user_id: userId,
    p_admin_email: adminEmail,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }
}

export async function unblockAccount(
  userId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_unblock_account', {
    p_user_id: userId,
    p_admin_email: adminEmail,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }
}

export interface UserProfile {
  user_id: string;
  display_name: string;
  email?: string;
  account_status: 'active' | 'blocked' | 'deleted';
  blocked_at?: string;
  blocked_by?: string;
  deleted_at?: string;
  created_at: string;
}

export interface DeletionLog {
  id: string;
  user_id: string;
  deleted_by: string;
  deletion_type: 'self' | 'admin';
  reason?: string;
  status: 'pending' | 'completed';
  created_at: string;
  completed_at?: string;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createUser(email: string, adminEmail: string, displayName?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You must be logged in to create users');
  }

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { email, adminEmail, displayName },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create user');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to create user');
  }
}

export interface AdminSetting {
  key: string;
  value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAdminSetting(key: string): Promise<AdminSetting | null> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAllAdminSettings(): Promise<AdminSetting[]> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .order('key', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function updateAdminSetting(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from('admin_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) {
    throw error;
  }
}

export async function deleteUserAccount(
  targetUserId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You must be logged in to delete users');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_user_id: targetUserId,
      deletion_type: 'admin',
      reason,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete user account');
  }
}

export async function getDeletionLogs(): Promise<DeletionLog[]> {
  const { data, error } = await supabase
    .from('account_deletion_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}
