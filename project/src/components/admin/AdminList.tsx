import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import AdminBadge from './AdminBadge';
import { removeAdmin } from '../../lib/admin';
import { logAdminAction } from '../../lib/auditLog';
import type { AdminUser } from '../../lib/admin';

interface AdminListProps {
  admins: AdminUser[];
  currentUserEmail: string | null;
  onAdminRemoved: () => void;
}

export default function AdminList({ admins, currentUserEmail, onAdminRemoved }: AdminListProps) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(email: string) {
    if (!confirm(`Are you sure you want to remove ${email} as an admin?`)) {
      return;
    }

    try {
      setRemoving(email);
      setError(null);
      await removeAdmin(email);
      await logAdminAction('remove_admin', email, 'Admin access revoked');
      onAdminRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Current Admins</h3>
        <p className="text-sm text-gray-600 mt-1">
          {admins.length} admin{admins.length !== 1 ? 's' : ''} currently have access
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {admins.map((admin) => (
          <div key={admin.email} className="p-6 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-medium text-gray-900">{admin.email}</span>
                <AdminBadge role={admin.role} size="sm" />
                {admin.email === currentUserEmail && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    You
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <p>
                  Granted by: {admin.granted_by || 'System'} on{' '}
                  {new Date(admin.granted_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {admin.email !== currentUserEmail && (
              <button
                onClick={() => handleRemove(admin.email)}
                disabled={removing === admin.email}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {removing === admin.email ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
