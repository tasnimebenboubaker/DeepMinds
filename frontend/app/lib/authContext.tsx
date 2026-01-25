'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize persistence
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
  }, []);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Set display name from fullName parameter
      if (fullName && userCredential.user) {
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(userCredential.user, { displayName: fullName });
      }
    } catch (err: any) {
      const message = err.code === 'auth/email-already-in-use'
        ? 'Cet email est déjà utilisé'
        : err.code === 'auth/weak-password'
        ? 'Le mot de passe doit contenir au moins 6 caractères'
        : err.code === 'auth/invalid-email'
        ? 'Format email invalide'
        : 'Erreur d\'inscription';
      setError(message);
      throw new Error(message);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = err.code === 'auth/user-not-found'
        ? 'Utilisateur non trouvé'
        : err.code === 'auth/wrong-password'
        ? 'Mot de passe incorrect'
        : err.code === 'auth/invalid-email'
        ? 'Format email invalide'
        : 'Erreur de connexion';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      setError('Erreur lors de la déconnexion');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
