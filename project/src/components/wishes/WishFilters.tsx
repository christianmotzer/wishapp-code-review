import { useState, useEffect } from 'react';
import { Search, Filter, X, Calendar, Users, Tag, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { WishFilters as WishFiltersType, VisibilityFilter } from '../../lib/wishes';

interface WishFiltersProps {
  onFilterChange: (filters: WishFiltersType) => void;
}

export function WishFilters({ onFilterChange }: WishFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minSupporters, setMinSupporters] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'supporters' | 'tokens'>('popular');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const filters: WishFiltersType = {
      searchQuery: searchQuery || undefined,
      category: category || undefined,
      status: status || undefined,
      visibility: visibility,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minSupporters: minSupporters ? parseInt(minSupporters) : undefined,
      sortBy,
    };
    onFilterChange(filters);
  }, [searchQuery, category, status, visibility, dateFrom, dateTo, minSupporters, sortBy]);

  async function loadCategories() {
    try {
      const { data } = await supabase
        .from('wishes')
        .select('category')
        .not('category', 'is', null)
        .eq('is_published', true);

      if (data) {
        const uniqueCategories = Array.from(new Set(data.map(w => w.category).filter(Boolean)));
        setCategories(uniqueCategories as string[]);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  function clearFilters() {
    setSearchQuery('');
    setCategory('');
    setStatus('');
    setVisibility('all');
    setDateFrom('');
    setDateTo('');
    setMinSupporters('');
    setSortBy('popular');
  }

  const hasActiveFilters = searchQuery || category || status || visibility !== 'all' || dateFrom || dateTo || minSupporters;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by title, description, or creator name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            isExpanded || hasActiveFilters
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {[searchQuery, category, status, dateFrom, dateTo, minSupporters].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4" />
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="voting">Voting</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Eye className="w-4 h-4" />
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Wishes</option>
              <option value="public">Public Only</option>
              <option value="friends">Friends Only</option>
              <option value="own">My Wishes</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4" />
              Min Supporters
            </label>
            <input
              type="number"
              placeholder="0"
              value={minSupporters}
              onChange={(e) => setMinSupporters(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="popular">Most Popular</option>
              <option value="recent">Most Recent</option>
              <option value="tokens">Most WishTokens</option>
              <option value="supporters">Most Supporters</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
