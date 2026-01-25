import { useEffect } from 'react';
import { useAuth } from './authContext';

export function useInitializeUserProfile() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      // Create/update user profile on login
      createUserProfile(user.uid, user.email || '', user.displayName || '');
    }
  }, [user?.uid]);
}

async function createUserProfile(uid: string, email: string, displayName: string) {
  try {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email, displayName }),
    });

    if (!response.ok) {
      console.error('Failed to create user profile');
    }
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}
