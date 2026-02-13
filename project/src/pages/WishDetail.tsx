import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  TrendingUp,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  MessageCircle,
  Shield,
  Send,
  Undo2,
  Eye,
  FileText,
  GitBranch,
  Coins,
  CalendarX,
  X,
  Edit,
  Trash2,
  User,
} from 'lucide-react';
import {
  getWishWithStats,
  getWishHierarchy,
  getChildWishes,
  getProposalsForWish,
  toggleLike,
  cancelWish,
  publishWish,
  retractWish,
  isTerminalStatus,
  isWishExpired,
  closeWishWithChildren,
} from '../lib/wishes';
import type { Wish, WishWithStats } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import CancelWishModal from '../components/admin/CancelWishModal';
import { setWishSEO, resetDefaultSEO } from '../lib/seo';

export default function WishDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [wish, setWish] = useState<WishWithStats | null>(null);
  const [hierarchy, setHierarchy] = useState<Wish[]>([]);
  const [childWishes, setChildWishes] = useState<Wish[]>([]);
  const [proposals, setProposals] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    loadWishData();
    loadCurrentUser();
  }, [id]);

  useEffect(() => {
    if (location.hash && !loading) {
      const elementId = location.hash.substring(1);
      const element = document.getElementById(elementId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.hash, loading]);

  useEffect(() => {
    if (wish) {
      setWishSEO({
        title: wish.title,
        description: wish.description || undefined,
        visibility: wish.visibility,
      });
    }

    return () => {
      resetDefaultSEO();
    };
  }, [wish]);

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  }

  async function loadWishData() {
    if (!id) return;

    try {
      setLoading(true);
      const [wishData, hierarchyData, childrenData, proposalData] = await Promise.all([
        getWishWithStats(id),
        getWishHierarchy(id),
        getChildWishes(id),
        getProposalsForWish(id),
      ]);

      setWish(wishData);
      setHierarchy(hierarchyData);
      setChildWishes(childrenData);
      setProposals(proposalData);
    } catch (error) {
      console.error('Failed to load wish:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLike() {
    if (!id) return;
    try {
      await toggleLike(id);
      await loadWishData();
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }

  async function handleAdminCancel(reason: string) {
    if (!id) return;
    try {
      await cancelWish(id, reason);
      await loadWishData();
    } catch (error) {
      console.error('Failed to cancel wish:', error);
      throw error;
    }
  }

  async function handlePublish() {
    if (!id) return;
    if (!confirm('Once published, this cannot be reverted to draft. Continue?')) return;
    try {
      setActionLoading('publish');
      setActionError(null);
      await publishWish(id);
      await loadWishData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to publish');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetract() {
    if (!id || !wish) return;
    const label = wish.wish_type === 'proposal' ? 'proposal' : 'wish';
    if (!confirm(`Are you sure you want to retract this ${label}?`)) return;
    try {
      setActionLoading('retract');
      setActionError(null);
      await retractWish(id);
      await loadWishData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to retract');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAdminDelete() {
    if (!id || !wish) return;
    const label = wish.wish_type === 'proposal' ? 'proposal' : 'wish';
    if (!confirm(`Are you sure you want to permanently delete this ${label}? This action cannot be undone.`)) return;
    try {
      setActionLoading('delete');
      setActionError(null);
      const { error } = await supabase.from('wishes').delete().eq('id', id);
      if (error) throw error;
      navigate('/dashboard');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete');
      setActionLoading(null);
    }
  }

  const isCreator = currentUserId && wish && wish.user_id === currentUserId;
  const isParentCreator =
    currentUserId &&
    wish?.parent_wish_id &&
    hierarchy.some((h) => h.id === wish.parent_wish_id && h.user_id === currentUserId);

  const parentWish = wish?.parent_wish_id
    ? hierarchy.find((h) => h.id === wish.parent_wish_id)
    : null;
  const parentIsClosed = parentWish ? isTerminalStatus(parentWish.status) : false;

  const canRetract =
    isCreator &&
    wish &&
    !isTerminalStatus(wish.status) &&
    !(wish.wish_type === 'proposal' && parentIsClosed);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!wish) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Wish not found</div>
      </div>
    );
  }

  const stats = wish.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {hierarchy.length > 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-gray-500">Path:</span>
              {hierarchy.map((h, index) => (
                <div key={h.id} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Link
                    to={`/wishes/${h.id}`}
                    className={`hover:text-blue-600 ${
                      h.id === wish.id ? 'font-semibold text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {h.title}
                  </Link>
                  {h.wish_type === 'proposal' && (
                    <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">
                      proposal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{wish.title}</h1>
                {wish.wish_type === 'proposal' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-800 text-sm font-medium rounded-full">
                    <FileText className="w-3.5 h-3.5" />
                    Proposal
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {wish.category && (
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                    {wish.category}
                  </span>
                )}
                {(wish.show_creator_name || isAdmin) && wish.creator_display_name && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    {wish.creator_display_name}
                    {isAdmin && !wish.show_creator_name && (
                      <span className="text-xs text-gray-400 ml-1">(hidden from public)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={wish.status} />
            </div>
          </div>

          {wish.description && (
            <div className="prose max-w-none mb-6">
              <p className="text-gray-700 whitespace-pre-wrap">{wish.description}</p>
            </div>
          )}

          {wish.wish_type === 'proposal' && wish.settlement_type && (
            <div className="mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                wish.settlement_type === 'full_settlement'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {wish.settlement_type === 'full_settlement' ? 'Full Settlement' : 'Partial Contribution'}
              </span>
            </div>
          )}

          {wish.expires_at && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
              isWishExpired(wish)
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-gray-50 border border-gray-200 text-gray-700'
            }`}>
              <CalendarX className="w-4 h-4 flex-shrink-0" />
              {isWishExpired(wish)
                ? `Expired on ${new Date(wish.expires_at).toLocaleDateString()}`
                : `Expires ${new Date(wish.expires_at).toLocaleDateString()} at ${new Date(wish.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              }
            </div>
          )}

          <div className="flex items-center gap-6 py-4 border-t border-b border-gray-200">
            {wish.token_count > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <Coins className="w-5 h-5" />
                <span className="font-semibold">{wish.token_count.toLocaleString()} WishTokens</span>
              </div>
            )}

            {wish.tokens_distributed > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <Coins className="w-5 h-5" />
                <span className="font-medium">{wish.tokens_distributed.toLocaleString()} distributed</span>
              </div>
            )}

            {wish.wish_type === 'proposal' && wish.tokens_received_on_acceptance > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <Coins className="w-5 h-5" />
                <span className="font-medium">Received {wish.tokens_received_on_acceptance.toLocaleString()} tokens</span>
              </div>
            )}

            <button
              onClick={handleLike}
              className="flex items-center gap-2 hover:text-red-500 transition-colors"
            >
              <Heart
                className={`w-5 h-5 ${wish.user_has_liked ? 'fill-red-500 text-red-500' : ''}`}
              />
              <span className="font-medium">{stats?.like_count || 0}</span>
            </button>

            <div className="flex items-center gap-2 text-gray-600">
              <MessageCircle className="w-5 h-5" />
              <span>{stats?.donation_count || 0} supporters</span>
            </div>

            {stats && stats.total_donations > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">${stats.total_donations.toFixed(2)}</span>
              </div>
            )}
          </div>

          {wish.voting_enabled && (
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-3">Voting in Progress</h3>
              <div className="flex items-center gap-6 mb-3">
                <div className="flex items-center gap-2 text-green-700">
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">{stats?.approve_votes || 0} Approve</span>
                </div>
                <div className="flex items-center gap-2 text-red-700">
                  <ThumbsDown className="w-5 h-5" />
                  <span className="font-medium">{stats?.reject_votes || 0} Reject</span>
                </div>
              </div>
              {wish.voting_ends_at && (
                <p className="text-sm text-gray-600">
                  Ends: {new Date(wish.voting_ends_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {wish.closure_reason && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Closure Reason</h3>
              <p className="text-gray-700">{wish.closure_reason}</p>
            </div>
          )}

          {actionError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {actionError}
            </div>
          )}

          <div className="mt-6 flex gap-3 flex-wrap">
            {isCreator && wish.status === 'draft' && (
              <>
                <button
                  onClick={() => navigate(`/wishes/${wish.id}/edit`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit {wish.wish_type === 'proposal' ? 'Proposal' : 'Wish'}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={actionLoading === 'publish'}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {actionLoading === 'publish' ? 'Publishing...' : 'Publish'}
                </button>
              </>
            )}

            {isParentCreator && wish.status === 'active' && (
              <button
                onClick={() => navigate(`/wishes/${wish.id}/respond`)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Respond to {wish.wish_type === 'proposal' ? 'Proposal' : 'Wish'}
              </button>
            )}

            {wish.status === 'active' && !isWishExpired(wish) && (
              <>
                <button
                  onClick={() => navigate(`/wishes/${wish.id}/send-tokens`)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  <Coins className="w-4 h-4" />
                  Send WishTokens
                </button>
                <button
                  onClick={() => navigate(`/wishes/${wish.id}/support`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Support This {wish.wish_type === 'proposal' ? 'Proposal' : 'Wish'}
                </button>
              </>
            )}

            {wish.status === 'active' && !isWishExpired(wish) && (
              <>
                <button
                  onClick={() => navigate(`/wishes/new?parent=${wish.id}&type=proposal`)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Send className="w-4 h-4" />
                  Submit Proposal
                </button>
                <button
                  onClick={() => navigate(`/wishes/new?parent=${wish.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <GitBranch className="w-4 h-4" />
                  Create Sub-Wish
                </button>
              </>
            )}

            {isCreator && wish.status === 'active' && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Close Wish
              </button>
            )}

            {canRetract && (
              <button
                onClick={handleRetract}
                disabled={actionLoading === 'retract'}
                className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" />
                {actionLoading === 'retract' ? 'Retracting...' : 'Retract'}
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  onClick={() => navigate(`/wishes/${wish.id}/edit`)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Admin: Edit
                </button>
                {wish.status === 'active' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Admin: Cancel
                  </button>
                )}
                <button
                  onClick={handleAdminDelete}
                  disabled={actionLoading === 'delete'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {actionLoading === 'delete' ? 'Deleting...' : 'Admin: Delete'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div id="proposals">
            <ChildSection
              title="Proposals"
              icon={<FileText className="w-5 h-5 text-teal-600" />}
              items={proposals}
              emptyMessage="No proposals submitted yet. Be the first to propose a solution."
              badgeClass="bg-teal-100 text-teal-700"
              badgeLabel="Proposal"
              currentUserId={currentUserId}
              parentWishStatus={wish.status}
              onRetract={async (childId) => {
                await retractWish(childId);
                await loadWishData();
              }}
              isParentCreator={!!isParentCreator}
              isAdmin={isAdmin}
              onDelete={async (childId) => {
                const { error } = await supabase.from('wishes').delete().eq('id', childId);
                if (error) throw error;
                await loadWishData();
              }}
            />
          </div>

          <div id="sub-wishes">
            <ChildSection
              title="Sub-Wishes"
              icon={<GitBranch className="w-5 h-5 text-blue-600" />}
              items={childWishes}
              emptyMessage="No sub-wishes created yet."
              badgeClass="bg-blue-100 text-blue-700"
              badgeLabel="Sub-Wish"
              currentUserId={currentUserId}
              parentWishStatus={wish.status}
              onRetract={async (childId) => {
                await retractWish(childId);
                await loadWishData();
              }}
              isParentCreator={!!isParentCreator}
              isAdmin={isAdmin}
              onDelete={async (childId) => {
                const { error } = await supabase.from('wishes').delete().eq('id', childId);
                if (error) throw error;
                await loadWishData();
              }}
            />
          </div>
        </div>
      </div>

      {showCancelModal && (
        <CancelWishModal
          wishTitle={wish.title}
          onConfirm={handleAdminCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showCloseModal && (
        <CloseWishModal
          wishTitle={wish.title}
          hasChildren={childWishes.length > 0 || proposals.length > 0}
          onConfirm={async (reason, closeChildren) => {
            await closeWishWithChildren(wish.id, reason, closeChildren);
            setShowCloseModal(false);
            await loadWishData();
          }}
          onClose={() => setShowCloseModal(false)}
        />
      )}
    </div>
  );
}

function ChildSection({
  title,
  icon,
  items,
  emptyMessage,
  badgeClass,
  badgeLabel,
  currentUserId,
  parentWishStatus,
  onRetract,
  isParentCreator,
  isAdmin,
  onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  items: Wish[];
  emptyMessage: string;
  badgeClass: string;
  badgeLabel: string;
  currentUserId: string | null;
  parentWishStatus: string;
  onRetract: (id: string) => Promise<void>;
  isParentCreator: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [retractingId, setRetractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleRetract(e: React.MouseEvent, childId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to retract this ${badgeLabel.toLowerCase()}?`)) return;
    try {
      setRetractingId(childId);
      await onRetract(childId);
    } catch (error) {
      console.error('Failed to retract:', error);
    } finally {
      setRetractingId(null);
    }
  }

  async function handleDelete(e: React.MouseEvent, childId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Admin: Permanently delete this ${badgeLabel.toLowerCase()}? This cannot be undone.`)) return;
    try {
      setDeletingId(childId);
      await onDelete(childId);
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-xl font-bold text-gray-900">
          {title} ({items.length})
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((child) => {
            const isChildCreator = currentUserId === child.user_id;
            const parentClosed = isTerminalStatus(parentWishStatus as any);
            const canRetractChild =
              isChildCreator && !isTerminalStatus(child.status) && !parentClosed;

            return (
              <Link
                key={child.id}
                to={`/wishes/${child.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{child.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                      {child.settlement_type === 'full_settlement' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          Full
                        </span>
                      )}
                      {child.settlement_type === 'partial_contribution' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">
                          Partial
                        </span>
                      )}
                      {child.status === 'accepted' && child.tokens_received_on_acceptance > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {child.tokens_received_on_acceptance} tokens
                        </span>
                      )}
                    </div>
                    {child.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                        {child.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {canRetractChild && (
                      <button
                        onClick={(e) => handleRetract(e, child.id)}
                        disabled={retractingId === child.id}
                        className="text-xs px-2 py-1 text-orange-600 border border-orange-200 rounded hover:bg-orange-50 disabled:opacity-50"
                      >
                        {retractingId === child.id ? '...' : 'Retract'}
                      </button>
                    )}
                    {isParentCreator && child.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/wishes/${child.id}/respond`);
                        }}
                        className="text-xs px-2 py-1 text-green-600 border border-green-200 rounded hover:bg-green-50"
                      >
                        Respond
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(e, child.id)}
                        disabled={deletingId === child.id}
                        className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingId === child.id ? '...' : 'Delete'}
                      </button>
                    )}
                    <StatusBadge status={child.status} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CloseWishModal({
  wishTitle,
  hasChildren,
  onConfirm,
  onClose,
}: {
  wishTitle: string;
  hasChildren: boolean;
  onConfirm: (reason: string, closeChildren: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [closeChildren, setCloseChildren] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError('Please provide a reason for closing');
      return;
    }
    try {
      setLoading(true);
      await onConfirm(reason, closeChildren);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close wish');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Close Wish</h3>
        <p className="text-sm text-gray-600 mb-4">
          Closing "<span className="font-medium">{wishTitle}</span>"
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Why are you closing this wish?"
          />
        </div>

        {hasChildren && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={closeChildren}
                onChange={(e) => setCloseChildren(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-amber-900">Also close all sub-wishes and proposals</span>
                <p className="text-xs text-amber-700 mt-0.5">
                  Active sub-wishes and proposals will be cancelled with a note that the parent wish was closed.
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Closing...' : 'Close Wish'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const badges: Record<string, { icon: any; label: string; className: string }> = {
    draft: { icon: Clock, label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    active: { icon: Clock, label: 'Active', className: 'bg-blue-100 text-blue-700' },
    voting: { icon: ThumbsUp, label: 'Voting', className: 'bg-amber-100 text-amber-700' },
    accepted: {
      icon: CheckCircle,
      label: 'Accepted',
      className: 'bg-green-100 text-green-700',
    },
    rejected: { icon: XCircle, label: 'Rejected', className: 'bg-red-100 text-red-700' },
    retracted: { icon: XCircle, label: 'Retracted', className: 'bg-orange-100 text-orange-700' },
    cancelled: { icon: XCircle, label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
    approved_by_vote: {
      icon: CheckCircle,
      label: 'Approved',
      className: 'bg-emerald-100 text-emerald-700',
    },
  };

  const badge = badges[status] || badges.draft;
  const Icon = badge.icon;

  return (
    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
      <Icon className="w-4 h-4" />
      {badge.label}
    </span>
  );
}
