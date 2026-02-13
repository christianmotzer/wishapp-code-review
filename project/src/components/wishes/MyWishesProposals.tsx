import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Bell, Loader2 } from 'lucide-react';
import { getUserWishesWithPendingProposals } from '../../lib/wishes';
import type { Wish } from '../../types/database';

export function MyWishesProposals() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ wish: Wish; proposals: Wish[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserWishesWithPendingProposals()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (data.length === 0) return null;

  const totalProposals = data.reduce((sum, d) => sum + d.proposals.length, 0);

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-sm mb-8">
      <div className="p-5 border-b border-blue-100 bg-blue-50/50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
            <Bell className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Your Wishes Need Attention</h2>
            <p className="text-sm text-gray-600">
              {totalProposals} pending {totalProposals === 1 ? 'proposal' : 'proposals'} across {data.length} {data.length === 1 ? 'wish' : 'wishes'}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {data.map(({ wish, proposals }) => (
          <div key={wish.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Link
                to={`/wishes/${wish.id}`}
                className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {wish.title}
              </Link>
              <span className="text-xs font-medium px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                {proposals.length} new
              </span>
            </div>

            <div className="space-y-2">
              {proposals.slice(0, 3).map((proposal) => (
                <div
                  key={proposal.id}
                  onClick={() => navigate(`/wishes/${proposal.id}`)}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{proposal.title}</span>
                    {proposal.settlement_type === 'full_settlement' && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">
                        Full
                      </span>
                    )}
                    {proposal.settlement_type === 'partial_contribution' && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded flex-shrink-0">
                        Partial
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/wishes/${proposal.id}/respond`);
                      }}
                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Respond
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                  </div>
                </div>
              ))}

              {proposals.length > 3 && (
                <Link
                  to={`/wishes/${wish.id}#proposals`}
                  className="block text-sm text-blue-600 hover:text-blue-700 font-medium pl-3 pt-1"
                >
                  View all {proposals.length} proposals
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
