import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Coins, ShieldPlus, User } from 'lucide-react';
import { getUserTransactions, getUserTokenBalance } from '../lib/tokens';
import type { TokenTransaction, UserTokens } from '../types/database';
import { supabase } from '../lib/supabase';

export default function TokenHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<TokenTransactionWithWish[]>([]);
  const [balance, setBalance] = useState<UserTokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [txData, balanceData] = await Promise.all([
        getUserTransactions(100),
        getUserTokenBalance(),
      ]);

      const txWithWish = await Promise.all(
        txData.map(async (tx) => {
          const enrichedTx: any = { ...tx, wish_title: null, admin_name: null };

          if (tx.wish_id) {
            const { data: wish } = await supabase
              .from('wishes')
              .select('title')
              .eq('id', tx.wish_id)
              .maybeSingle();
            enrichedTx.wish_title = wish?.title || 'Unknown Wish';
          }

          if (tx.admin_email) {
            const { data: adminUser } = await supabase
              .from('auth.users')
              .select('id')
              .eq('email', tx.admin_email)
              .maybeSingle();

            if (adminUser) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', adminUser.id)
                .maybeSingle();

              if (profile?.display_name) {
                enrichedTx.admin_name = profile.display_name;
              }
            }
          }

          return enrichedTx;
        })
      );

      setTransactions(txWithWish);
      setBalance(balanceData);
    } catch (error) {
      console.error('Failed to load token history:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

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

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Coins className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-gray-900">WishToken History</h1>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-amber-700">
                  {balance?.balance.toLocaleString() || 0}
                </p>
              </div>
              <Coins className="w-16 h-16 text-amber-400 opacity-50" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Transaction History ({transactions.length})
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Your WishToken activity will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TokenTransactionWithWish extends TokenTransaction {
  wish_title: string | null;
  admin_name: string | null;
}

function TransactionRow({ transaction }: { transaction: TokenTransactionWithWish }) {
  const isIncoming = transaction.direction === 'in';
  const amount = transaction.amount;

  let icon;
  let iconClass;
  let label;
  let description;

  if (transaction.transaction_type === 'admin_grant') {
    icon = <ShieldPlus className="w-5 h-5" />;
    iconClass = 'bg-blue-100 text-blue-600';
    label = 'Admin Grant';
    description = transaction.admin_name
      ? `From ${transaction.admin_name}`
      : transaction.admin_email
      ? `From ${transaction.admin_email}`
      : 'Admin grant';
  } else if (transaction.transaction_type === 'wish_support') {
    if (isIncoming) {
      icon = <ArrowDownLeft className="w-5 h-5" />;
      iconClass = 'bg-green-100 text-green-600';
      label = 'Received';
      description = transaction.wish_title
        ? `Support for "${transaction.wish_title}"`
        : 'Wish support received';
    } else {
      icon = <ArrowUpRight className="w-5 h-5" />;
      iconClass = 'bg-orange-100 text-orange-600';
      label = 'Sent';
      description = transaction.wish_title
        ? `Supported "${transaction.wish_title}"`
        : 'Sent to wish';
    }
  } else if (transaction.transaction_type === 'hierarchy_distribution') {
    icon = <ArrowDownLeft className="w-5 h-5" />;
    iconClass = 'bg-teal-100 text-teal-600';
    label = 'Distribution';
    description = transaction.wish_title
      ? `From hierarchy: "${transaction.wish_title}"`
      : 'Hierarchy distribution';
  } else {
    icon = <User className="w-5 h-5" />;
    iconClass = 'bg-gray-100 text-gray-600';
    label = transaction.transaction_type;
    description = 'WishToken transaction';
  }

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg flex-shrink-0 ${iconClass}`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-gray-900">{label}</p>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isIncoming ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}
            >
              {isIncoming ? '+' : '-'}{amount.toLocaleString()}
            </span>
          </div>

          <p className="text-sm text-gray-600 truncate">{description}</p>

          {transaction.message && (
            <p className="text-sm text-gray-500 italic mt-1">"{transaction.message}"</p>
          )}

          {transaction.wish_id && (
            <Link
              to={`/wishes/${transaction.wish_id}`}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
            >
              View wish →
            </Link>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p
            className={`text-lg font-semibold ${
              isIncoming ? 'text-green-600' : 'text-orange-600'
            }`}
          >
            {isIncoming ? '+' : '-'}{amount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(transaction.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
