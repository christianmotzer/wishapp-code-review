import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { getWishById, updateWish } from '../lib/wishes';
import { useAdmin } from '../hooks/useAdmin';
import type { Wish } from '../types/database';

export default function EditWish() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAdmin();

  const [wish, setWish] = useState<Wish | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [showCreatorName, setShowCreatorName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminEdit, setIsAdminEdit] = useState(false);

  useEffect(() => {
    if (id) {
      loadWish(id);
    }
  }, [id, isAdmin]);

  async function loadWish(wishId: string) {
    try {
      const wishData = await getWishById(wishId);
      if (!wishData) {
        setError('Wish not found');
        setLoading(false);
        return;
      }

      if (wishData.status !== 'draft' && !isAdmin) {
        setError('Only draft wishes can be edited');
        setLoading(false);
        return;
      }

      if (wishData.status !== 'draft' && isAdmin) {
        setIsAdminEdit(true);
      }

      setWish(wishData);
      setTitle(wishData.title);
      setDescription(wishData.description || '');
      setCategory(wishData.category || '');
      setShowCreatorName(wishData.show_creator_name ?? false);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wish');
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }

    if (!id) {
      setError('Invalid wish ID');
      return;
    }

    try {
      setSubmitting(true);
      await updateWish(id, {
        title,
        description: description || undefined,
        category: category || undefined,
        show_creator_name: showCreatorName,
      });

      navigate(`/wishes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update wish');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading wish...</div>
      </div>
    );
  }

  if (error && !wish) {
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
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Wish</h1>

          {isAdminEdit && (
            <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                You are editing this wish as an administrator. The wish is currently <strong>{wish?.status}</strong>.
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
                placeholder="Enter a clear, concise title"
                required
                minLength={3}
                maxLength={200}
              />
              <p className="mt-1 text-sm text-gray-500">{title.length}/200 characters</p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe your wish in detail..."
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
                  Show creator name on this wish
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-7">
                When enabled, the creator's display name will be visible to other users.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/wishes/${id}`)}
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
