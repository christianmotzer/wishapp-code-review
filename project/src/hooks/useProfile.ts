import { useState, useEffect } from 'react';
import { getCurrentUserProfile, UserProfile } from '../lib/profiles';
import { useAuth } from '../components/auth/AuthProvider';

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
      setError(null);
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentUserProfile();
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = () => {
    return loadProfile();
  };

  return {
    profile,
    loading,
    error,
    refreshProfile
  };
}
