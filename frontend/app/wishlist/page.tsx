'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '../types';
import { getAzureBlobUrl , isValidBlobUrl } from '../lib/azure';

export default function WishlistPage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    setLoading(true);
    const savedWishlist = localStorage.getItem('orbitStore_wishlist');
    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist));
      } catch {
        setWishlist([]);
      }
    }
    setLoading(false);
  }, []);

  const handleRemoveFromWishlist = async (productId: string) => {
    const updatedWishlist = wishlist.filter((item) => item.id !== productId);
    setWishlist(updatedWishlist);
    localStorage.setItem('orbitStore_wishlist', JSON.stringify(updatedWishlist));

    // Update MongoDB
    try {
      const uid = localStorage.getItem('user_uid');
      if (uid) {
        const response = await fetch('/api/users/wishlist', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid, productId }),
        });

        if (!response.ok) {
          console.error('Failed to remove from wishlist in MongoDB');
        }
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  const handleAddToCart = (product: Product) => {
    const cart = JSON.parse(localStorage.getItem('orbitStore_cart') || '[]');
    const existingItem = cart.find((item: any) => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name || product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        quantity: 1,
      });
    }

    localStorage.setItem('orbitStore_cart', JSON.stringify(cart));
    // Optionally remove from wishlist after adding to cart
    // handleRemoveFromWishlist(product.id);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-indigo-600 font-semibold hover:underline mb-4 inline-block">
            ← Back to Store
          </Link>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-black text-slate-800">My Wishlist</h1>
            <span className="text-2xl font-bold text-indigo-600">{wishlist.length} items</span>
          </div>
          <p className="text-slate-600">Save your favorite products for later</p>
        </div>

        {wishlist.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Your wishlist is empty</h2>
            <p className="text-slate-600 mb-6">Start adding products to your wishlist by clicking the heart icon</p>
            <Link
              href="/"
              className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          // Wishlist Items Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((product) => {
              const imageUrl = isValidBlobUrl(product.image)
                ? product.image
                : getAzureBlobUrl(product.image);
              const isAvailable = product.availability !== false;

              return (
                <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                  {/* Image Section */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={product.title || product.name}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm border border-indigo-100">
                      {product.category}
                    </div>

                    {/* Availability Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-bold shadow-sm border ${
                          isAvailable
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : 'bg-red-100 text-red-700 border-red-300'
                        }`}
                      >
                        {isAvailable ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveFromWishlist(product.id)}
                      className="absolute bottom-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Title and Price */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <h3 className="text-lg font-bold text-slate-800 leading-tight flex-1">
                        {product.title || product.name}
                      </h3>
                      <span className="text-xl font-black text-indigo-600 whitespace-nowrap">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Rating */}
                    {product.rating && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => {
                            const rate = typeof product.rating === 'number' ? product.rating : (product.rating as any).rate;
                            return (
                              <svg
                                key={i}
                                className={`w-4 h-4 ${
                                  i < Math.round(rate) ? 'text-yellow-400' : 'text-slate-300'
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            );
                          })}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {typeof product.rating === 'number'
                            ? product.rating.toFixed(1)
                            : (product.rating as any).rate?.toFixed(1)}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                      {product.description}
                    </p>

                    {/* Payment Methods */}
                    {product.payment_methods && Array.isArray(product.payment_methods) && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs text-slate-500 font-semibold">Pays:</span>
                        <div className="flex gap-2">
                          {product.payment_methods.map((method, i) => (
                            <span
                              key={i}
                              className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200 capitalize font-medium"
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-auto pt-2">
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!isAvailable}
                        className={`flex-1 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                          isAvailable
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 100-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        {wishlist.length > 0 && (
          <div className="mt-12 flex gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-3 bg-slate-200 text-slate-800 rounded-lg font-bold hover:bg-slate-300 transition-colors"
            >
              Continue Shopping
            </Link>
            <button
              onClick={async () => {
                localStorage.removeItem('orbitStore_wishlist');
                setWishlist([]);

                // Update MongoDB to clear wishlist
                try {
                  const uid = localStorage.getItem('user_uid');
                  if (uid) {
                    await fetch('/api/users/wishlist/clear', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ uid }),
                    });
                  }
                } catch (error) {
                  console.error('Error clearing wishlist:', error);
                }
              }}
              className="px-8 py-3 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition-colors"
            >
              Clear Wishlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
