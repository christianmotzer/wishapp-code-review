import React, { useEffect, useState } from 'react';
import { getUserSubscription } from '../../lib/stripe';
import { useAuth } from '../auth/AuthProvider';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Subscription {
  subscription_status: string;
  price_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    try {
      const data = await getUserSubscription();
      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return null;
  }

  if (!subscription || subscription.subscription_status === 'not_started') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-500" />
          <span className="text-gray-700">No active subscription</span>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'canceled':
      case 'unpaid':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'trialing':
      case 'past_due':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'canceled':
      case 'unpaid':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'trialing':
      case 'past_due':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(subscription.subscription_status)}`}>
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon(subscription.subscription_status)}
        <span className="font-medium capitalize">
          {subscription.subscription_status.replace('_', ' ')} Subscription
        </span>
      </div>
      
      {subscription.current_period_end && (
        <p className="text-sm mb-2">
          {subscription.cancel_at_period_end ? 'Expires' : 'Renews'} on{' '}
          {formatDate(subscription.current_period_end)}
        </p>
      )}
      
      {subscription.payment_method_brand && subscription.payment_method_last4 && (
        <p className="text-sm">
          Payment method: {subscription.payment_method_brand.toUpperCase()} ending in{' '}
          {subscription.payment_method_last4}
        </p>
      )}
    </div>
  );
}