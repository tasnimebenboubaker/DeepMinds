
export interface BudgetRange {
  min: number;
  max: number;
}

export interface UserPreferences {
  categories?: string[];
  brands?: string[];
  materials?: string[];
  [key: string]: any; // Allow other preference fields
}

export interface UserSearchRequest {
  query: string;
  userId: string;
  budgetRange: BudgetRange;
  preferences: UserPreferences;
  preferredPaymentMethod: string;
  top_k?: number;
}

export interface SearchResult {
  product_id: string;  // ID pour retrouver le produit dans MongoDB
  score: number;       // Score de similarité (0-1)
}

export interface SearchResponse {
  recommendations: SearchResult[];
  personalization_applied: {
    availability_filtered: boolean;
    hybrid_search_applied: boolean;
    budget_filtered: boolean;
    category_filtered: boolean;
    brand_filtered: boolean;
    material_filtered: boolean;
    payment_method_matched: boolean;
  };
  timestamp: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Search products with dynamic user preferences
 * @param searchQuery - The search query (e.g., "cheap laptop")
 * @param userId - Current user's ID
 * @param budgetRange - User's current budget range {min, max}
 * @param preferences - User's current preferences (categories, etc)
 * @param preferredPaymentMethod - User's preferred payment method
 * @param topK - Number of results to return (default: 10)
 */
export async function searchProducts(
  searchQuery: string,
  userId: string,
  budgetRange: BudgetRange,
  preferences: UserPreferences,
  preferredPaymentMethod: string,
  topK: number = 10
): Promise<SearchResponse> {
  if (!searchQuery.trim()) {
    throw new Error('Search query cannot be empty');
  }

  const payload: UserSearchRequest = {
    query: searchQuery,
    userId,
    budgetRange,
    preferences,
    preferredPaymentMethod,
    top_k: topK,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/search/user-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `Search failed with status ${response.status}`);
    }

    const data: SearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Search service error:', error);
    throw error;
  }
}
