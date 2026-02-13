import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Search, ArrowLeft } from 'lucide-react';
import { sendFriendRequest } from '../lib/friends';
import { supabase } from '../lib/supabase';

interface UserProfile {
  user_id: string;
  display_name: string;
  account_status: string;
}

export default function AddFriend() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: searchError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, account_status')
        .ilike('display_name', `%${searchQuery}%`)
        .eq('account_status', 'active')
        .neq('user_id', user.id)
        .limit(20);

      if (searchError) throw searchError;

      const { data: existingFriendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendshipMap = new Map();
      (existingFriendships || []).forEach((f) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        friendshipMap.set(otherId, f.status);
      });

      const filtered = (data || []).filter((profile) => {
        const status = friendshipMap.get(profile.user_id);
        return !status || status === 'declined';
      });

      setSearchResults(filtered as UserProfile[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(userId: string, displayName: string) {
    setError('');
    setSuccess('');

    const { error } = await sendFriendRequest(userId);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(`Friend request sent to ${displayName}`);
      setSearchResults((prev) => prev.filter((u) => u.user_id !== userId));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <Link
              to="/friends"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <UserPlus className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Add Friend</h1>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by display name
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-700">
                Search Results ({searchResults.length})
              </h2>
              {searchResults.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{profile.display_name}</h3>
                  </div>
                  <button
                    onClick={() => handleSendRequest(profile.user_id, profile.display_name)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No users found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
