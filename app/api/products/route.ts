import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../lib/mongodb';

const COLLECTION_NAME = 'Products';

export async function GET(request: NextRequest) {
  try {
    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const products = await collection.find({}).toArray();

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const product = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'category', 'price', 'description', 'image'];
    for (const field of requiredFields) {
      if (!product[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Add default values for optional fields
    product.rating = product.rating || 0;
    product.specs = product.specs || [];

    const result = await collection.insertOne(product);

    return NextResponse.json(
      { ...product, id: result.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}