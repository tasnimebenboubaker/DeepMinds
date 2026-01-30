import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';

const COLLECTION_NAME = 'users';

// GET user purchase history
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
    const user = await collection.findOne(
      { uid },
      { projection: { purchases: 1, budgetRange: 1, preferredPaymentMethod: 1 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      purchases: user.purchases || [],
      budgetRange: user.budgetRange || { min: 0, max: 0 },
      preferredPaymentMethod: user.preferredPaymentMethod || null,
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}

// ADD purchase (called after successful order)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, orderId, items, total, paymentMethod } = body;

    if (!uid || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'uid and items array are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // Check for duplicate purchase (prevent double submission)
    // Look for a purchase with the same orderId or same items+total within last 5 seconds
    const user = await collection.findOne({ uid });
    if (user?.purchases && user.purchases.length > 0) {
      const recentPurchases = user.purchases.filter((p: any) => {
        if (!p.purchasedAt) return false;
        const purchaseTime = new Date(p.purchasedAt);
        const now = new Date();
        const timeDiff = now.getTime() - purchaseTime.getTime();
        return timeDiff < 5000; // Within 5 seconds
      });

      // Check if this is a duplicate of a recent purchase
      for (const recentPurchase of recentPurchases) {
        if (orderId && recentPurchase.orderId === orderId) {
          // Same orderId - definitely a duplicate
          return NextResponse.json({
            success: false,
            message: 'Purchase already recorded',
            duplicate: true,
          }, { status: 200 });
        }

        // Check if items and total match (same purchase data)
        if (recentPurchase.total === total &&
            recentPurchase.items?.length === items.length &&
            recentPurchase.items?.every((item: any, idx: number) => 
              item.price === items[idx].price && 
              item.quantity === (items[idx].quantity || 1)
            )) {
          // Likely the same purchase submitted twice
          return NextResponse.json({
            success: false,
            message: 'Purchase already recorded',
            duplicate: true,
          }, { status: 200 });
        }
      }
    }

    // Add purchase first
    const result = await collection.updateOne(
      { uid },
      {
        $push: {
          purchases: {
            orderId: orderId || null,
            items: items.map((item: any) => ({
              productId: item.id,
              title: item.name || item.title,
              category: item.category,
              price: item.price,
              quantity: item.quantity || 1,
            })),
            total,
            paymentMethod,
            purchasedAt: new Date().toISOString(),
          },
        },
      } as any,
      { upsert: true }
    );

    // Recalculate budget range from ALL purchases (min/max of all purchased item prices)
    const updatedUser = await collection.findOne({ uid });
    if (updatedUser?.purchases && updatedUser.purchases.length > 0) {
      // Extract all item prices from all purchases
      const allItemPrices: number[] = [];
      for (const purchase of updatedUser.purchases) {
        if (purchase.items && Array.isArray(purchase.items)) {
          for (const item of purchase.items) {
            allItemPrices.push(item.price);
          }
        }
      }

      // Calculate actual min and max from all purchased items
      const budgetMin = allItemPrices.length > 0 ? Math.min(...allItemPrices) : 0;
      const budgetMax = allItemPrices.length > 0 ? Math.max(...allItemPrices) : 0;

      // Update payment method counts
      const paymentCounts = updatedUser.purchases.reduce((acc: any, p: any) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + 1;
        return acc;
      }, {});

      const preferredMethod = Object.keys(paymentCounts).reduce((a: string, b: string) =>
        paymentCounts[a] > paymentCounts[b] ? a : b
      );

      // Update both budget range and preferred payment method
      await collection.updateOne(
        { uid },
        {
          $set: {
            budgetRange: { min: budgetMin, max: budgetMax },
            preferredPaymentMethod: preferredMethod,
            updatedAt: new Date().toISOString(),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase recorded successfully',
    });
  } catch (error) {
    console.error('Error recording purchase:', error);
    return NextResponse.json(
      { error: 'Failed to record purchase' },
      { status: 500 }
    );
  }
}
