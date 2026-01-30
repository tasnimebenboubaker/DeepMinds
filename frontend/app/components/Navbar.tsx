
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/authContext';
import { useUserPreferences } from '../lib/useUserPreferences';
import { searchProducts } from '../lib/searchService';

interface NavbarProps {
  cartCount: number;
  onCartToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onCartToggle, searchQuery, onSearchChange }) => {
  const { user, logout, loading } = useAuth();
  const { budgetRange, preferences, preferredPaymentMethod, loading: prefsLoading } = useUserPreferences();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Only show cartCount after hydration
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsProfileOpen(false);
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if ('preventDefault' in e) {
      e.preventDefault();
    }
    
    if (!user) {
      setSearchError('Please sign in to search');
      setTimeout(() => setSearchError(null), 3000);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchError('Please enter a search query');
      setTimeout(() => setSearchError(null), 3000);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchProducts(
        searchQuery,
        user.uid,
        budgetRange,
        preferences,
        preferredPaymentMethod,
        10
      );
      
      
      // TODO: Display results to user (e.g., show modal or navigate to results page)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setTimeout(() => setSearchError(null), 3000);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 py-4">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl italic">
            OS
          </div>
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            OrbitStore
          </span>
        </Link>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl w-full">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
              placeholder={user ? "Search gadgets, specs, categories..." : "Sign in to search..."}
              disabled={isSearching || !user}
              className="w-full bg-slate-100 border-none rounded-full px-6 py-2 focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isSearching || !user}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-colors"
            >
              {isSearching ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
          {searchError && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-red-50 text-red-600 text-sm p-2 rounded-lg border border-red-200">
              {searchError}
            </div>
          )}
        </form>


        {/* Right Section - Cart & Auth */}
        <div className="flex items-center gap-4">
          {/* Cart Trigger */}
          <button 
            onClick={onCartToggle}
            className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {isMounted && cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                {cartCount}
              </span>
            )}
          </button>

          {/* Auth Section */}
          {!loading && (
            <>
              {user ? (
                // User Logged In - Profile Menu
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors group"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 hidden sm:inline max-w-[150px] truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      {/* User Info */}
                      <div className="px-4 py-4 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-800">
                          {user.displayName || 'User'}
                        </p>
                        <p className="text-xs text-slate-500 break-all">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <Link
                          href="/account"
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          📋 My Account
                        </Link>
                        <Link
                          href="/orders"
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          📦 My Orders
                        </Link>
                        <Link
                          href="/wishlist"
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          ❤️ Wishlist
                        </Link>
                      </div>

                      {/* Logout Button */}
                      <div className="px-4 py-2 border-t border-slate-100">
                        <button
                          onClick={handleLogout}
                          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // User Not Logged In - Auth Buttons
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-4 py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
