import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Info } from 'lucide-react';
import { createWish, createProposal, getWishById } from '../lib/wishes';
import type { SettlementType, WishVisibility } from '../types/database';

export default function CreateWish() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parent');
  const typeParam = searchParams.get('type');
  const isProposal = typeParam === 'proposal';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<WishVisibility>('public');
  const [isPublished, setIsPublished] = useState(false);
  const [settlementType, setSettlementType] = useState<SettlementType>('full_settlement');
  const [expiresAt, setExpiresAt] = useState('');
  const [showCreatorName, setShowCreatorName] = useState(false);
  const [parentWish, setParentWish] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (parentId) {
      loadParentWish(parentId);
    }
  }, [parentId]);

  async function loadParentWish(id: string) {
    try {
      const wish = await getWishById(id);
      if (wish) {
        setParentWish({ id: wish.id, title: wish.title });
      }
    } catch (err) {
      console.error('Failed to load parent wish:', err);
    }
  }

  function getPageTitle() {
    if (isProposal) return 'Submit Proposal';
    if (parentWish) return 'Create Sub-Wish';
    return 'Create New Wish';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }

    if (isProposal && !parentId) {
      setError('Proposals must be linked to a parent wish');
      return;
    }

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      setError('Expiration date must be in the future');
      return;
    }

    try {
      setLoading(true);

      const wish = isProposal
        ? await createProposal({
            title,
            description: description || undefined,
            category: category || undefined,
            parent_wish_id: parentId!,
            is_published: isPublished,
            settlement_type: settlementType,
          })
        : await createWish({
            title,
            description: description || undefined,
            category: category || undefined,
            parent_wish_id: parentId || undefined,
            is_published: isPublished,
            visibility: visibility,
            show_creator_name: showCreatorName,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          });

      navigate(`/wishes/${wish.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{getPageTitle()}</h1>

          {isProposal && (
            <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg flex gap-3">
              <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-teal-900 font-medium mb-1">Submitting a Proposal</p>
                <p className="text-sm text-teal-800">
                  A proposal is a direct solution to the parent wish. The wish creator will
                  review it and can accept, reject, or put it to a community vote.
                </p>
              </div>
            </div>
          )}

          {parentWish && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                <span className="font-medium">Parent Wish:</span> {parentWish.title}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isProposal ? 'Describe your proposed solution' : 'Enter a clear, concise title'}
                required
                minLength={3}
                maxLength={200}
              />
              <p className="mt-1 text-sm text-gray-500">{title.length}/200 characters</p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isProposal ? 'Explain your solution in detail...' : 'Describe your wish in detail...'}
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Technology, Education, Health"
              />
            </div>

            {!isProposal && (
              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility
                </label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as WishVisibility)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="public">Public - Visible to everyone</option>
                  <option value="friends_only">Friends Only - Visible only to your friends</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Control who can see this wish
                </p>
              </div>
            )}

            {isProposal && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How does this proposal relate to the wish?
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="settlement_type"
                      value="full_settlement"
                      checked={settlementType === 'full_settlement'}
                      onChange={() => setSettlementType('full_settlement')}
                      className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Full Settlement</div>
                      <div className="text-sm text-gray-600">
                        This proposal completely fulfills the wish. Accepting it should close the wish.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="settlement_type"
                      value="partial_contribution"
                      checked={settlementType === 'partial_contribution'}
                      onChange={() => setSettlementType('partial_contribution')}
                      className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Partial Contribution</div>
                      <div className="text-sm text-gray-600">
                        This proposal contributes to the wish but doesn't fully resolve it. The wish stays open for more proposals.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {!isProposal && (
              <div>
                <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  id="expires_at"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  If set, this wish will stop accepting new proposals and WishTokens after this date.
                </p>
              </div>
            )}

            <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="show_creator_name"
                  checked={showCreatorName}
                  onChange={(e) => setShowCreatorName(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="show_creator_name" className="text-sm text-gray-700">
                  Show my name on this {isProposal ? 'proposal' : 'wish'}
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-7">
                When enabled, your display name will be visible to other users on this {isProposal ? 'proposal' : 'wish'}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_published"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_published" className="text-sm text-gray-700">
                Publish immediately (make visible to everyone)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-6 py-3 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  isProposal
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading
                  ? 'Creating...'
                  : isPublished
                    ? isProposal ? 'Submit Proposal' : 'Publish Wish'
                    : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
