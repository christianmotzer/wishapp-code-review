import { useState, useEffect } from 'react';
import { Shield, Ban, CheckCircle, Trash2, User, Mail } from 'lucide-react';
import { getAllUsers, blockAccount, unblockAccount, deleteUserAccount, type UserProfile } from '../../lib/admin';
import { supabase } from '../../lib/supabase';

interface UserManagementProps {
  adminEmail: string;
}

export function UserManagement({ adminEmail }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadUserEmails();
  }, []);

  async function loadUserEmails() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
      }
    } catch (err) {
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError('');

    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBlockUser(userId: string, displayName: string) {
    const reason = prompt(`Why are you blocking ${displayName}?`);
    if (!reason) return;

    setActionLoading(userId);
    setError('');
    setSuccess('');

    try {
      await blockAccount(userId, adminEmail, reason);
      setSuccess(`${displayName} has been blocked`);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnblockUser(userId: string, displayName: string) {
    const reason = prompt(`Why are you unblocking ${displayName}?`);
    if (!reason) return;

    setActionLoading(userId);
    setError('');
    setSuccess('');

    try {
      await unblockAccount(userId, adminEmail, reason);
      setSuccess(`${displayName} has been unblocked`);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteUser(userId: string, displayName: string) {
    const reason = prompt(`Why are you deleting ${displayName}'s account? Please provide a reason:`);
    if (!reason) return;

    if (!confirm(`Are you sure you want to delete ${displayName}'s account? Their personal data will be permanently removed.`)) {
      return;
    }

    setActionLoading(userId);
    setError('');
    setSuccess('');

    try {
      await deleteUserAccount(userId, adminEmail, reason);
      setSuccess(`${displayName}'s account has been deleted`);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
        </div>
        <span className="text-sm text-gray-600">{users.length} total users</span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Info
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{user.display_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.email ? (
                      <div className="flex items-center gap-1 text-gray-900">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {user.email}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.account_status === 'active' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    )}
                    {user.account_status === 'blocked' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Ban className="w-3 h-3" />
                        Blocked
                      </span>
                    )}
                    {user.account_status === 'deleted' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Trash2 className="w-3 h-3" />
                        Deleted
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.account_status === 'blocked' && user.blocked_at && (
                      <div>
                        <div className="text-xs">
                          Blocked: {new Date(user.blocked_at).toLocaleDateString()}
                        </div>
                        {user.blocked_by && (
                          <div className="text-xs text-gray-500">By: {user.blocked_by}</div>
                        )}
                      </div>
                    )}
                    {user.account_status === 'deleted' && user.deleted_at && (
                      <div className="text-xs">
                        Deleted: {new Date(user.deleted_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.account_status === 'active' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleBlockUser(user.user_id, user.display_name)}
                          disabled={actionLoading === user.user_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-4 h-4" />
                          Block
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.user_id, user.display_name)}
                          disabled={actionLoading === user.user_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                    {user.account_status === 'blocked' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleUnblockUser(user.user_id, user.display_name)}
                          disabled={actionLoading === user.user_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Unblock
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.user_id, user.display_name)}
                          disabled={actionLoading === user.user_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
