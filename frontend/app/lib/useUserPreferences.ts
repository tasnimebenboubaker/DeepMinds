import { useState, useEffect } from 'react';
import { useAuth } from './authContext';
import { BudgetRange, UserPreferences } from './searchService';

export interface UserPreferenceData {
  budgetRange: BudgetRange;
  preferences: UserPreferences;
  preferredPaymentMethod: string;
  loading: boolean;
  error: string | null;
}

const DEFAULT_BUDGET: BudgetRange = {
  min: 0,
  max: 1000,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  categories: [],
  brands: [],
  materials: [],
};

/**
 * Hook to fetch and manage user preferences dynamically
 * Updates whenever user changes their preferences
 */
export function useUserPreferences(): UserPreferenceData {
  const { user } = useAuth();
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(DEFAULT_BUDGET);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchUserPreferences = async () => {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Sync preferences from wishlist and purchases (extract categories, brands, materials)
        const syncResponse = await fetch(`/api/users/sync-preferences?uid=${user.uid}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (!syncResponse.ok) {
          console.warn('Failed to sync preferences, will use existing data');
        }

        // Step 2: Fetch user preferences
        const response = await fetch(`/api/users/preferences?uid=${user.uid}`, {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user preferences');
        }

        const data = await response.json();
        
        setBudgetRange(data.budgetRange || DEFAULT_BUDGET);
        setPreferences(data.preferences || DEFAULT_PREFERENCES);
        setPreferredPaymentMethod(data.preferredPaymentMethod || 'card');
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
        // Use defaults on error
        setBudgetRange(DEFAULT_BUDGET);
        setPreferences(DEFAULT_PREFERENCES);
        setPreferredPaymentMethod('card');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPreferences();
  }, [user?.uid]);

  return {
    budgetRange,
    preferences,
    preferredPaymentMethod,
    loading,
    error,
  };
}
