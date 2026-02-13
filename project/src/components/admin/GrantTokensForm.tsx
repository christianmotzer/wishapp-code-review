import { useState } from 'react';
import { Coins, Send } from 'lucide-react';
import { adminGrantTokensByEmail } from '../../lib/tokens';
import { logAdminAction } from '../../lib/auditLog';

export default function GrantTokensForm() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid positive number');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a user email');
      return;
    }

    try {
      setLoading(true);
      await adminGrantTokensByEmail(email.trim(), amountNum, message || undefined);
      await logAdminAction(
        'grant_tokens',
        email.trim(),
        `Granted ${amountNum.toLocaleString()} tokens`,
        { amount: amountNum, message: message || null }
      );
      setSuccess(`Granted ${amountNum.toLocaleString()} WishTokens to ${email.trim()}`);
      setEmail('');
      setAmount('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant tokens');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
          <Coins className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Grant WishTokens</h3>
          <p className="text-sm text-gray-600">Award WishTokens to any registered user</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="grant-email" className="block text-sm font-medium text-gray-700 mb-1">
            User Email
          </label>
          <input
            type="email"
            id="grant-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            placeholder="user@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="grant-amount" className="block text-sm font-medium text-gray-700 mb-1">
            WishToken Amount
          </label>
          <input
            type="number"
            id="grant-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="1"
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            placeholder="100"
            required
          />
        </div>

        <div>
          <label htmlFor="grant-message" className="block text-sm font-medium text-gray-700 mb-1">
            Reason (Optional)
          </label>
          <input
            type="text"
            id="grant-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            placeholder="Welcome bonus, reward, etc."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Granting...' : 'Grant WishTokens'}
        </button>
      </form>
    </div>
  );
}
