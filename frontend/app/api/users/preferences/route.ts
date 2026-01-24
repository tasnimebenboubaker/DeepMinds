import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';

const COLLECTION_NAME = 'users';

// GET user preferences and profile data for recommendation system
export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get('uid');

    if (!uid) {
      return NextResponse.json(
        { error: 'uid query parameter is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);
    const user = await collection.findOne({ uid });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build user profile for recommendation system
    const userProfile = {
      uid,
      email: user.email,
      displayName: user.displayName,
      // Favorite categories from wishlist + purchases
      preferences: {
        favoriteCategories: [...new Set(user.preferences?.favoriteCategories || [])],
      },
      // User purchase behavior
      purchaseHistory: {
        totalPurchases: user.purchases?.length || 0,
        categories: [...new Set(user.purchases?.map((p: any) => p.category) || [])],
        totalSpent: user.purchases?.reduce((sum: number, p: any) => sum + p.price, 0) || 0,
      },
      // Budget insight
      budgetRange: user.budgetRange || { min: 0, max: 0 },
      // Payment preference
      preferredPaymentMethod: user.preferredPaymentMethod,
      // Wishlist insight
      wishlistItems: user.wishlist?.length || 0,
      wishlistCategories: user.wishlist?.map((w: any) => w.category) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 }
    );
  }
}
