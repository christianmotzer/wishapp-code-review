import { Heart, MessageCircle, TrendingUp, Clock, CheckCircle, XCircle, Vote, FileText, GitBranch, Coins, CalendarX, User } from 'lucide-react';
import { isWishExpired } from '../../lib/wishes';
import { useNavigate } from 'react-router-dom';
import type { WishWithStats } from '../../types/database';

interface WishCardProps {
  wish: WishWithStats;
  onLike?: () => void;
  onClick?: () => void;
  isAdmin?: boolean;
}

export function WishCard({ wish, onLike, onClick, isAdmin }: WishCardProps) {
  const navigate = useNavigate();
  const stats = wish.stats;

  const getStatusBadge = () => {
    const badges = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
      active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
      voting: { label: 'Voting', className: 'bg-amber-100 text-amber-700' },
      accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
      retracted: { label: 'Retracted', className: 'bg-orange-100 text-orange-700' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
      approved_by_vote: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
    };

    const badge = badges[wish.status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusIcon = () => {
    const iconClass = 'w-4 h-4';
    switch (wish.status) {
      case 'accepted':
      case 'approved_by_vote':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className={`${iconClass} text-red-600`} />;
      case 'voting':
        return <Vote className={`${iconClass} text-amber-600`} />;
      case 'active':
        return <Clock className={`${iconClass} text-blue-600`} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getStatusIcon()}
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
              {wish.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {wish.wish_type === 'proposal' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                <FileText className="w-3 h-3" />
                Proposal
              </span>
            )}
            {wish.category && (
              <span className="inline-block px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                {wish.category}
              </span>
            )}
            {(wish.show_creator_name || isAdmin) && wish.creator_display_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500">
                <User className="w-3 h-3" />
                {wish.creator_display_name}
                {isAdmin && !wish.show_creator_name && (
                  <span className="text-gray-400 ml-0.5">(hidden)</span>
                )}
              </span>
            )}
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {wish.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{wish.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
        {wish.token_count > 0 && (
          <div className="flex items-center gap-1 text-amber-600 font-semibold">
            <Coins className="w-4 h-4" />
            <span>{wish.token_count.toLocaleString()}</span>
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
          className="flex items-center gap-1 hover:text-red-500 transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${wish.user_has_liked ? 'fill-red-500 text-red-500' : ''}`}
          />
          <span>{stats?.like_count || 0}</span>
        </button>

        {wish.voting_enabled && (
          <div className="flex items-center gap-1">
            <Vote className="w-4 h-4" />
            <span>{stats?.total_votes || 0} votes</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <MessageCircle className="w-4 h-4" />
          <span>{stats?.donation_count || 0} supporters</span>
        </div>

        {stats && stats.proposal_count > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/wishes/${wish.id}#proposals`);
            }}
            className="flex items-center gap-1 hover:text-teal-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>{stats.proposal_count} {stats.proposal_count === 1 ? 'proposal' : 'proposals'}</span>
          </button>
        )}

        {stats && stats.sub_wish_count > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/wishes/${wish.id}#sub-wishes`);
            }}
            className="flex items-center gap-1 hover:text-purple-600 transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            <span>{stats.sub_wish_count} {stats.sub_wish_count === 1 ? 'sub-wish' : 'sub-wishes'}</span>
          </button>
        )}

        {stats && stats.total_donations > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>${stats.total_donations.toFixed(2)}</span>
          </div>
        )}
      </div>

      {(wish.voting_enabled && wish.voting_ends_at || wish.expires_at) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
          {wish.voting_enabled && wish.voting_ends_at && (
            <div className="text-xs text-gray-500">
              Voting ends: {new Date(wish.voting_ends_at).toLocaleDateString()}
            </div>
          )}
          {wish.expires_at && (
            <div className={`flex items-center gap-1 text-xs ${isWishExpired(wish) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              <CalendarX className="w-3.5 h-3.5" />
              {isWishExpired(wish) ? 'Expired' : `Expires ${new Date(wish.expires_at).toLocaleDateString()}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
