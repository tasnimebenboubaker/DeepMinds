'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/authContext';
import { getAzureBlobUrl, isValidBlobUrl } from '../lib/azure';
import { updateUserPreferences } from '../lib/userPreferencesSync';
import Link from 'next/link';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  React.useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('orbitStore_cart');
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }

    // Redirect if not logged in
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Calculate available payment methods (intersection of all products)
  const getAvailablePaymentMethods = () => {
    if (cartItems.length === 0) {
      return ['card', 'cash'];
    }

    // Start with all methods
    const allMethods = ['card', 'cash'];
    
    // For each product, filter methods
    const availableMethods = allMethods.filter((method) => {
      return cartItems.every((item) => {
        // If product has payment_methods field (from MongoDB), check if method is supported
        if (item.payment_methods && Array.isArray(item.payment_methods)) {
          return item.payment_methods.includes(method);
        }
        // If no payment_methods specified, assume all methods are available
        return true;
      });
    });

    return availableMethods.length > 0 ? availableMethods : allMethods;
  };

  const availablePaymentMethods = getAvailablePaymentMethods();

  // Auto-select payment method if only one is available
  React.useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    // Prevent double submission
    if (isSubmittingRef.current || isProcessing) {
      return;
    }

    if (!user) {
      setError('You must be logged in to checkout');
      return;
    }

    if (cartItems.length === 0) {
      setError('Your cart is empty');
      return;
    }

    // Mark as submitting
    isSubmittingRef.current = true;
    setIsProcessing(true);
    setError('');

    try {
      // Create order items
      const orderItems = cartItems.map((item) => ({
        id: item.id,
        name: item.name || item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
      }));

      // Create order
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          items: orderItems,
          total,
          paymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const data = await response.json();
      const orderId = data.orderId;

      // Record purchase in user profile for recommendation system
      try {
        await fetch('/api/users/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            orderId,
            items: orderItems,
            total,
            paymentMethod,
          }),
        });
        // Sync user preferences after purchase
        await updateUserPreferences(user.uid);
      } catch (err) {
        console.error('Failed to record purchase in profile:', err);
        // Don't fail checkout if this fails
      }

      // Clear cart - set to empty array to maintain persistence
      localStorage.setItem('orbitStore_cart', JSON.stringify([]));
      setCartItems([]);
      setShowSuccess(true);

      // Redirect to orders page after 2 seconds
      setTimeout(() => {
        router.push('/orders');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
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
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-indigo-600 font-semibold hover:underline mb-4 inline-block">
            ← Back to Store
          </Link>
          <h1 className="text-4xl font-black text-slate-800 mb-2">Confirm Order</h1>
          <p className="text-slate-500">Review your items and confirm your purchase</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            {/* Order Summary */}
            <div className="bg-white rounded-2xl p-8 border border-slate-200 mb-8">
              <h2 className="text-2xl font-black text-slate-800 mb-6">Order Summary</h2>

              {cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-lg mb-4">Your cart is empty</p>
                  <Link
                    href="/"
                    className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
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
                        <h3 className="font-bold text-slate-800">{item.name || item.title}</h3>
                        <p className="text-sm text-slate-500">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Qty: {item.quantity}</p>
                        <p className="font-bold text-slate-800">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method */}
            {cartItems.length > 0 && (
              <div className="bg-white rounded-2xl p-8 border border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 mb-6">Payment Method</h2>

                {availablePaymentMethods.length === 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-800 font-semibold">
                      ❌ No compatible payment methods available for selected items
                    </p>
                  </div>
                ) : availablePaymentMethods.length === 1 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-slate-700 font-semibold mb-3">
                      ✓ Available payment method:
                    </p>
                    <div className="p-4 bg-white border-2 border-indigo-500 rounded-xl">
                      <span className="text-slate-700 font-bold">
                        {availablePaymentMethods[0] === 'card' && '💳 Credit/Debit Card'}
                        {availablePaymentMethods[0] === 'cash' && '💵 Cash on Delivery'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {['card', 'cash'].map((method) => {
                      const isAvailable = availablePaymentMethods.includes(method);
                      return (
                        <label
                          key={method}
                          className={`flex items-center p-4 border-2 rounded-xl transition-all ${
                            !isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          style={{
                            borderColor: paymentMethod === method && isAvailable ? '#4f46e5' : '#e2e8f0',
                            backgroundColor:
                              paymentMethod === method && isAvailable ? '#f0f4ff' : 'white',
                          }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method}
                            checked={paymentMethod === method}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            disabled={!isAvailable}
                            className="w-5 h-5"
                          />
                          <span className="ml-3 font-semibold text-slate-700 capitalize">
                            {method === 'card' && '💳 Credit/Debit Card'}
                            {method === 'cash' && '💵 Cash on Delivery'}
                          </span>
                          {!isAvailable && (
                            <span className="ml-auto text-xs text-red-600 font-semibold">
                              Not available for some items
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                {availablePaymentMethods.includes('card') && paymentMethod === 'card' && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm text-blue-800">
                      💳 For demo purposes, this is a test checkout. Enter any card details to complete.
                    </p>
                  </div>
                )}

                {availablePaymentMethods.length > 0 && cartItems.some((item) => item.payment_methods) && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800">
                      ⓘ Some products have payment restrictions. Only compatible methods are shown above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Order Total */}
          {cartItems.length > 0 && (
            <div className="md:col-span-1">
              <div className="bg-white rounded-2xl p-8 border border-slate-200 sticky top-20">
                <h3 className="text-xl font-black text-slate-800 mb-6">Order Total</h3>

                <div className="space-y-3 mb-6 pb-6 border-b border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className="text-green-600 font-semibold">Free</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>${(total * 0.1).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-black text-slate-800">Total</span>
                  <span className="text-3xl font-black text-indigo-600">
                    ${(total * 1.1).toFixed(2)}
                  </span>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-semibold">{error}</p>
                  </div>
                )}

                {showSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-semibold">✓ Order created! Redirecting...</p>
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || showSuccess}
                  className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : showSuccess ? (
                    <>✓ Order Confirmed</>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Confirm & Pay
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center mt-4">
                  By placing an order, you agree to our terms and conditions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
