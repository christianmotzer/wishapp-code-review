import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WishCard } from './WishCard';
import { WishFilters } from './WishFilters';
import { getPublishedWishes, toggleLike } from '../../lib/wishes';
import { useAdmin } from '../../hooks/useAdmin';
import type { WishWithStats } from '../../types/database';
import type { WishFilters as WishFiltersType } from '../../lib/wishes';
import { Loader2 } from 'lucide-react';

export function WishList() {
  const { isAdmin } = useAdmin();
  const [wishes, setWishes] = useState<WishWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WishFiltersType>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadWishes();
  }, [filters]);

  async function loadWishes() {
    try {
      setLoading(true);
      const data = await getPublishedWishes(filters);
      setWishes(data as WishWithStats[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wishes');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = useCallback((newFilters: WishFiltersType) => {
    setFilters(newFilters);
  }, []);

  async function handleLike(wishId: string) {
    try {
      await toggleLike(wishId);
      await loadWishes();
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  }

  return (
    <>
      <WishFilters onFilterChange={handleFilterChange} />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && wishes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No wishes found matching your filters.</p>
        </div>
      )}

      {!loading && !error && wishes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishes.map((wish) => (
            <WishCard
              key={wish.id}
              wish={wish}
              onLike={() => handleLike(wish.id)}
              onClick={() => navigate(`/wishes/${wish.id}`)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </>
  );
}
