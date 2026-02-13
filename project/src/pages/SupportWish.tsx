import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, AlertCircle } from 'lucide-react';
import { getWishWithStats, trackDonation } from '../lib/wishes';
import type { WishWithStats } from '../types/database';

export default function SupportWish() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wish, setWish] = useState<WishWithStats | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadWish();
  }, [id]);

  async function loadWish() {
    if (!id) return;
    try {
      const data = await getWishWithStats(id);
      setWish(data);
    } catch (err) {
      setError('Failed to load wish');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum < 0.01) {
      setError('Minimum amount is $0.01');
      return;
    }

    if (amountNum > 10000) {
      setError('Maximum amount is $10,000');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await trackDonation(id, amountNum, message || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track donation');
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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-green-600 fill-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-6">
              Your support of ${amount} has been recorded and will be distributed according to
              the wish hierarchy.
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Support This Wish</h1>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-2">{wish.title}</h2>
            {wish.description && <p className="text-blue-700 text-sm">{wish.description}</p>}
          </div>

          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800">
                <strong>Stripe payments are currently disabled.</strong> Your support will be
                tracked in the system but no payment will be processed. This feature will be
                enabled in a future update.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Support Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0.01"
                  max="10000"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Minimum: $0.01 | Maximum: $10,000</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Distribution Breakdown</h3>
              <p className="text-sm text-gray-600 mb-3">
                Your support will be distributed across the wish hierarchy:
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex justify-between">
                  <span>Direct Creator</span>
                  <span className="font-medium">60%</span>
                </li>
                <li className="flex justify-between">
                  <span>Parent Wish</span>
                  <span className="font-medium">20%</span>
                </li>
                <li className="flex justify-between">
                  <span>Grandparent Wish</span>
                  <span className="font-medium">10%</span>
                </li>
                <li className="flex justify-between">
                  <span>Great-Grandparent</span>
                  <span className="font-medium">5%</span>
                </li>
                <li className="flex justify-between">
                  <span>Great-Great-Grandparent</span>
                  <span className="font-medium">5%</span>
                </li>
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
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Leave a message for the creator..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Recording...' : 'Record Support'}
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
