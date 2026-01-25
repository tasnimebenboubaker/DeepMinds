'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/authContext';
import { getAzureBlobUrl, isValidBlobUrl } from '../lib/azure';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if not logged in 

    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Fetch orders 
    if (user?.uid) {
      fetchOrders();
    }
  }, [user, loading, router]);

  
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/orders?userId=${user?.uid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      setOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'pending':
        return '⏳';
      case 'shipped':
        return '📦';
      case 'delivered':
        return '✓✓';
      case 'cancelled':
        return '✕';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-indigo-600 font-semibold hover:underline mb-4 inline-block">
            ← Back to Store
          </Link>
          <h1 className="text-4xl font-black text-slate-800 mb-2">My Orders</h1>
          <p className="text-slate-500">Track and manage your purchases</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-semibold">Loading your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">No Orders Yet</h2>
            <p className="text-slate-500 mb-6">You haven't placed any orders yet. Start shopping to make your first purchase!</p>
            <Link
              href="/"
              className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-lg transition-shadow">
                {/* Order Header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <p className="text-slate-600">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)} {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <span className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Total</p>
                        <p className="text-2xl font-black text-indigo-600">
                          ${(order.total * 1.1).toFixed(2)}
                        </p>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Items</h4>
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                        <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={isValidBlobUrl(item.image) ? item.image : getAzureBlobUrl(item.image)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" fill="%2394a3b8" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800">{item.name}</h5>
                          <p className="text-sm text-slate-500">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500 mb-1">x{item.quantity}</p>
                          <p className="font-bold text-slate-800">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">
                      Payment Method: <span className="font-bold capitalize">{order.paymentMethod}</span>
                    </p>
                  </div>
                  <button className="text-indigo-600 font-bold hover:underline">
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
