import { Shield } from 'lucide-react';

interface AdminBadgeProps {
  role: 'admin' | 'super_admin';
  size?: 'sm' | 'md';
}

export default function AdminBadge({ role, size = 'md' }: AdminBadgeProps) {
  const isSuperAdmin = role === 'super_admin';

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} font-medium rounded ${
        isSuperAdmin
          ? 'bg-orange-100 text-orange-800'
          : 'bg-blue-100 text-blue-800'
      }`}
    >
      <Shield className={iconSizes[size]} />
      {isSuperAdmin ? 'Super Admin' : 'Admin'}
    </span>
  );
}
