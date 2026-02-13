import { useState, useEffect } from 'react';
import { getAdminRole } from '../lib/admin';
import { useAuth } from '../components/auth/AuthProvider';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminStatus() {
      if (!user?.email) {
        if (isMounted) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminRole(null);
          setLoading(false);
        }
        return;
      }

      try {
        const role = await getAdminRole(user.email);

        if (isMounted) {
          setAdminRole(role);
          setIsAdmin(role === 'admin' || role === 'super_admin');
          setIsSuperAdmin(role === 'super_admin');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (isMounted) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminRole(null);
          setLoading(false);
        }
      }
    }

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { isAdmin, isSuperAdmin, adminRole, loading };
}
