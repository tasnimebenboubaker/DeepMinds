import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';

const COLLECTION_NAME = 'users';

// Sync user preferences - calculate categories from wishlist + purchases
export async function POST(request: NextRequest) {
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

    // Fetch user document
    const user = await collection.findOne({ uid });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract unique categories from wishlist
    const wishlistCategories = user.wishlist?.map((item: any) => item.category) || [];

    // Extract unique categories from purchases (new structure: each purchase has items array)
    const purchaseCategories: string[] = [];
    if (user.purchases && Array.isArray(user.purchases)) {
      user.purchases.forEach((purchase: any) => {
        if (purchase.items && Array.isArray(purchase.items)) {
          purchase.items.forEach((item: any) => {
            if (item.category && !purchaseCategories.includes(item.category)) {
              purchaseCategories.push(item.category);
            }
          });
        }
      });
    }

    // Combine and get unique categories
    const allCategories = [...new Set([...wishlistCategories, ...purchaseCategories])];

    // Update user preferences with combined categories
    const result = await collection.updateOne(
      { uid },
      {
        $set: {
          'preferences.categories': allCategories,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'User preferences synchronized',
      categories: allCategories,
    });
  } catch (error) {
    console.error('Error syncing preferences:', error);
    return NextResponse.json(
      { error: 'Failed to sync preferences' },
      { status: 500 }
    );
  }
}
