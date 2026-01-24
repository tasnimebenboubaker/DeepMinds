import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../lib/mongodb';

const COLLECTION_NAME = 'orders';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, items, total, paymentMethod } = body;

    // Validate required fields
    if (!userId || !items || !total || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, items, total, paymentMethod' },
        { status: 400 }
      );
    }

    // Create order object
    const order = {
      userId,
      items,
      total,
      paymentMethod,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to MongoDB
    const db = await connectToDatabase();
    const ordersCollection = db.collection(COLLECTION_NAME);
    const result = await ordersCollection.insertOne(order);

    // Also record in user profile for recommendation system
    const usersCollection = db.collection('users');
    try {
      await fetch(new URL('/api/users/purchases', 'http://localhost:3000'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userId,
          items,
          total,
          paymentMethod,
        }),
      }).catch(() => {
        // If fetch fails (e.g., in server context), use direct MongoDB operation
        // This will be handled by the client-side call after order creation
      });
    } catch (error) {
      console.error('Error recording user purchase:', error);
      // Don't fail the order if this fails
    }

    return NextResponse.json(
      {
        success: true,
        orderId: result.insertedId.toString(),
        message: 'Order created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Query orders for the user
    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);
    const orders = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Map MongoDB _id to id field
    const mappedOrders = orders.map((order: any) => ({
      ...order,
      id: order._id.toString(),
    }));

    return NextResponse.json(mappedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
