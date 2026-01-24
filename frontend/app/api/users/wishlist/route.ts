import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';

const COLLECTION_NAME = 'users';

// GET user wishlist
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
    const user = await collection.findOne({ uid }, { projection: { wishlist: 1 } });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user.wishlist || []);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlist' },
      { status: 500 }
    );
  }
}

// ADD/UPDATE item in wishlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, product } = body;

    if (!uid || !product) {
      return NextResponse.json(
        { error: 'uid and product are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // Add product to wishlist if not already there
    const result = await collection.updateOne(
      { uid },
      {
        $addToSet: {
          wishlist: {
            id: product.id,
            name: product.name || product.title,
            category: product.category,
            price: product.price,
            image: product.image,
          },
        },
        $set: {
          updatedAt: new Date().toISOString(),
        },
      } as any,
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Product added to wishlist',
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to add to wishlist' },
      { status: 500 }
    );
  }
}

// REMOVE item from wishlist
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, productId } = body;

    if (!uid || !productId) {
      return NextResponse.json(
        { error: 'uid and productId are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.updateOne(
      { uid },
      {
        $pull: {
          wishlist: { id: productId },
        },
        $set: {
          updatedAt: new Date().toISOString(),
        },
      } as any
    );

    return NextResponse.json({
      success: true,
      message: 'Product removed from wishlist',
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to remove from wishlist' },
      { status: 500 }
    );
  }
}
