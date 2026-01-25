'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/authContext';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!fullName.trim()) {
      setError('Le nom complet est requis');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, fullName);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative h-32 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -ml-20 -mt-20"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mb-16"></div>
            </div>
            <div className="relative z-10 text-center">
              <h1 className="text-4xl font-black text-white">ORBIT</h1>
              <p className="text-pink-100 text-sm font-semibold">Join Our Community</p>
            </div>
          </div>

          {/* Form Container */}
          <div className="p-8">
            <h2 className="text-3xl font-black text-slate-800 mb-2">Create Account</h2>
            <p className="text-slate-500 text-sm mb-8">Sign up to start shopping with us</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name Input */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-bold text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-slate-800 placeholder-slate-400"
                  disabled={isLoading}
                />
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-slate-800 placeholder-slate-400"
                  disabled={isLoading}
                />
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-slate-800 placeholder-slate-400"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M15.171 13.576l1.414 1.414A1 1 0 0018 13.414V11a1 1 0 10-2 0v2.414l-.829-.828a1 1 0 10-1.414 1.414z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-slate-800 placeholder-slate-400"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M15.171 13.576l1.414 1.414A1 1 0 0018 13.414V11a1 1 0 10-2 0v2.414l-.829-.828a1 1 0 10-1.414 1.414z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-xs font-semibold text-slate-400 uppercase">Or</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            {/* Sign In Link */}
            <p className="text-center text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-black text-purple-600 hover:text-purple-700 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            ← Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}
