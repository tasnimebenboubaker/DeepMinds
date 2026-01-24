import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

const COLLECTION_NAME = 'users';

// GET user profile
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

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

// PUT/UPDATE user profile (create if doesn't exist)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, displayName } = body;

    if (!uid) {
      return NextResponse.json(
        { error: 'uid is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // Upsert user profile
    const result = await collection.updateOne(
      { uid },
      {
        $set: {
          uid,
          email: email || null,
          displayName: displayName || null,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          wishlist: [],
          preferences: { categories: [] },
          purchases: [],
          budgetRange: { min: 0, max: 0 },
          preferredPaymentMethod: null,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    const updatedUser = await collection.findOne({ uid });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
