import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Award, Coins, Heart, Star, TrendingUp } from 'lucide-react';
import { getLeaderboard, type LeaderboardEntry } from '../lib/profiles';

type TimePeriod = 'all_time' | 'month' | 'week';

export default function TokenLeaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time');

  useEffect(() => {
    loadLeaderboard();
  }, [timePeriod]);

  async function loadLeaderboard() {
    try {
      setLoading(true);
      const data = await getLeaderboard(timePeriod, 100);
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
  };

  const getRankBgClass = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300';
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300';
    if (rank === 3) return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300';
    return 'bg-white border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">WishToken Leaderboard</h1>
              <p className="text-gray-600 mt-1">Top contributors and wish makers</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTimePeriod('all_time')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                timePeriod === 'all_time'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimePeriod('month')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                timePeriod === 'month'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimePeriod('week')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                timePeriod === 'week'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              This Week
            </button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No leaderboard data yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Start earning WishTokens to appear on the leaderboard
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={`border rounded-xl p-6 transition-all hover:shadow-lg ${getRankBgClass(
                  entry.rank
                )}`}
              >
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 w-16 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md">
                      {entry.display_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {entry.display_name || 'Anonymous'}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <span className="font-medium">{entry.current_balance.toLocaleString()}</span>
                        <span>WishTokens</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-blue-600" />
                        <span>{entry.wishes_created}</span>
                        <span>wishes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4 text-pink-600" />
                        <span>{entry.wishes_supported}</span>
                        <span>supported</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold text-gray-900">
                        {entry.current_balance.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">WishToken Balance</p>
                  </div>
                </div>

                {entry.rank <= 3 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Received</span>
                      <span className="font-semibold text-green-600">
                        +{entry.total_tokens_received.toLocaleString()} WishTokens
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">About the Leaderboard</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                The leaderboard ranks users by their current WishToken balance. Earn WishTokens by creating
                wishes, receiving support, and participating in the community.
              </p>
              <p className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">Top contributors are recognized for their impact!</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
