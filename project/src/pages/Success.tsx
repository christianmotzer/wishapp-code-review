import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Receipt } from 'lucide-react';
import { getUserOrders } from '../lib/stripe';

export function Success() {
  const [latestOrder, setLatestOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestOrder();
  }, []);

  const loadLatestOrder = async () => {
    try {
      const orders = await getUserOrders();
      if (orders.length > 0) {
        setLatestOrder(orders[0]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-600 mb-6">
              Thank you for your support. Your payment has been processed successfully.
            </p>

            {loading ? (
              <div className="flex justify-center mb-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : latestOrder ? (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Order Details</span>
                </div>
                <div className="text-left space-y-1 text-sm text-gray-600">
                  <p>Amount: {formatAmount(latestOrder.amount_total, latestOrder.currency)}</p>
                  <p>Status: {latestOrder.payment_status}</p>
                  <p>Date: {new Date(latestOrder.order_date).toLocaleDateString()}</p>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}