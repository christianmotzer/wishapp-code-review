import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, AlertCircle } from 'lucide-react';
import { getWishWithStats } from '../lib/wishes';
import { getUserTokenBalance, sendTokensToWish } from '../lib/tokens';
import type { WishWithStats, UserTokens } from '../types/database';

export default function SendTokens() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wish, setWish] = useState<WishWithStats | null>(null);
  const [balance, setBalance] = useState<UserTokens | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (id) {
      Promise.all([getWishWithStats(id), getUserTokenBalance()])
        .then(([wishData, balanceData]) => {
          setWish(wishData);
          setBalance(balanceData);
        })
        .catch(() => setError('Failed to load data'));
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid whole number');
      return;
    }

    const currentBalance = balance?.balance || 0;
    if (amountNum > currentBalance) {
      setError(`You only have ${currentBalance.toLocaleString()} WishTokens available`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sendTokensToWish(id, amountNum, message || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send tokens');
    } finally {
      setLoading(false);
    }
  }

  if (!wish) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">WishTokens Sent!</h2>
            <p className="text-gray-600 mb-2">
              You sent <span className="font-semibold text-amber-600">{parseInt(amount, 10).toLocaleString()} WishTokens</span> to this wish.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              WishTokens have been distributed to creators up the wish hierarchy.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/wishes/${id}`)}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                View Wish
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Browse More Wishes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentBalance = balance?.balance || 0;

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
          <div className="flex items-center gap-3 mb-6">
            <Coins className="w-7 h-7 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">Send WishTokens</h1>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-1">{wish.title}</h2>
            {wish.description && <p className="text-blue-700 text-sm">{wish.description}</p>}
          </div>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-900">Your WishToken Balance</span>
              <span className="text-2xl font-bold text-amber-700">{currentBalance.toLocaleString()}</span>
            </div>
          </div>

          {currentBalance === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                You don't have any WishTokens yet. WishTokens are granted by administrators or earned through the wish hierarchy.
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
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                WishToken Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="1"
                min="1"
                max={currentBalance}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
                placeholder="0"
                required
                disabled={currentBalance === 0}
              />
              <p className="mt-2 text-sm text-gray-500">
                Available: {currentBalance.toLocaleString()} WishTokens
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Distribution Breakdown</h3>
              <p className="text-sm text-gray-600 mb-3">
                WishTokens will be distributed across the wish hierarchy:
              </p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex justify-between"><span>Direct Creator</span><span className="font-medium">60%</span></li>
                <li className="flex justify-between"><span>Parent Wish Creator</span><span className="font-medium">20%</span></li>
                <li className="flex justify-between"><span>Grandparent</span><span className="font-medium">10%</span></li>
                <li className="flex justify-between"><span>Great-Grandparent</span><span className="font-medium">5%</span></li>
                <li className="flex justify-between"><span>Great-Great-Grandparent</span><span className="font-medium">5%</span></li>
              </ul>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message (Optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Leave a message for the creator..."
                disabled={currentBalance === 0}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || currentBalance === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                <Coins className="w-5 h-5" />
                {loading ? 'Sending...' : 'Send WishTokens'}
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
