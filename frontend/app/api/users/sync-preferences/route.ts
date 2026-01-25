import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';

const COLLECTION_NAME = 'users';

/**
 * Extract brand from product title based on various formats
 * Clothing: "{brand} {product_type} in {material}" -> "Nike"
 * Jewelry: "{material} {product_type} by {brand}" -> "brand" (after " by ")
 * Electronics: "{brand} {product_type} with {material} finish" -> "Nike"
 * Home Appliances: "{brand} {product_type} with {material} design" -> "Brand"
 * Sports: "{brand} {product_type} for sports..." -> "Nike"
 */
function extractBrand(title: string, category?: string): string {
  if (!title) return '';
  
  // Jewelry format: "{material} {product_type} by {brand}"
  if (category === "Jewelery" || title.includes(' by ')) {
    const byIndex = title.indexOf(' by ');
    if (byIndex !== -1) {
      return title.substring(byIndex + 4).trim().split(' ')[0]; // First word after " by "
    }
  }
  
  // Default: first word is the brand (works for Clothing, Electronics, Home Appliances, Sports)
  const parts = title.split(' ');
  return parts[0];
}

/**
 * Extract material from product title based on various formats
 * Clothing: "{brand} {product_type} in {material}" -> "Leather"
 * Jewelry: "{material} {product_type} by {brand}" -> "Gold" (first word)
 * Electronics: "{brand} {product_type} with {material} finish" -> "Aluminum"
 * Home Appliances: "{brand} {product_type} with {material} design" -> "Stainless Steel"
 * Sports: "{brand} {product_type} for sports..." -> "" (no material)
 */
function extractMaterial(title: string, category?: string): string {
  if (!title) return '';
  
  // Jewelry format: "{material} {product_type} by {brand}" - material is first word
  if (category === "Jewelery" || (title.includes(' by ') && !title.includes(' in '))) {
    const parts = title.split(' ');
    return parts[0];
  }
  
  // Clothing format: "{brand} {product_type} in {material}"
  if (title.includes(' in ')) {
    const inIndex = title.indexOf(' in ');
    return title.substring(inIndex + 4).trim();
  }
  
  // Electronics/Home Appliances format: "{brand} {product_type} with {material} (finish|design)"
  if (title.includes(' with ')) {
    const withIndex = title.indexOf(' with ');
    const afterWith = title.substring(withIndex + 6).trim();
    
    // Remove trailing "finish" or "design"
    const finishIndex = afterWith.indexOf(' finish');
    const designIndex = afterWith.indexOf(' design');
    
    if (finishIndex !== -1) {
      return afterWith.substring(0, finishIndex).trim();
    } else if (designIndex !== -1) {
      return afterWith.substring(0, designIndex).trim();
    }
    
    return afterWith;
  }
  
  // Sports & Outdoors or other: no material
  return '';
}

// Sync user preferences - calculate categories, brands, and materials from wishlist + purchases
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

    // Extract categories, brands, and materials from wishlist
    const wishlistCategories: string[] = [];
    const wishlistBrands: string[] = [];
    const wishlistMaterials: string[] = [];

    if (user.wishlist && Array.isArray(user.wishlist)) {
      user.wishlist.forEach((item: any) => {
        if (item.category && !wishlistCategories.includes(item.category)) {
          wishlistCategories.push(item.category);
        }
        // Use 'name' field for wishlist items, or 'title' if available
        const itemTitle = item.name || item.title;
        if (itemTitle) {
          const brand = extractBrand(itemTitle, item.category);
          if (brand && !wishlistBrands.includes(brand)) {
            wishlistBrands.push(brand);
          }
          const material = extractMaterial(itemTitle, item.category);
          if (material && !wishlistMaterials.includes(material)) {
            wishlistMaterials.push(material);
          }
        }
      });
    }

    // Extract categories, brands, and materials from purchases
    const purchaseCategories: string[] = [];
    const purchaseBrands: string[] = [];
    const purchaseMaterials: string[] = [];

    if (user.purchases && Array.isArray(user.purchases)) {
      user.purchases.forEach((purchase: any) => {
        if (purchase.items && Array.isArray(purchase.items)) {
          purchase.items.forEach((item: any) => {
            // Extract category
            if (item.category && !purchaseCategories.includes(item.category)) {
              purchaseCategories.push(item.category);
            }
            // Extract brand and material from title
            if (item.title) {
              const brand = extractBrand(item.title, item.category);
              if (brand && !purchaseBrands.includes(brand)) {
                purchaseBrands.push(brand);
              }
              const material = extractMaterial(item.title, item.category);
              if (material && !purchaseMaterials.includes(material)) {
                purchaseMaterials.push(material);
              }
            }
          });
        }
      });
    }

    // Combine and get unique values
    const allCategories = [...new Set([...wishlistCategories, ...purchaseCategories])];
    const allBrands = [...new Set([...wishlistBrands, ...purchaseBrands])];
    const allMaterials = [...new Set([...wishlistMaterials, ...purchaseMaterials])];

    // Update user preferences with combined values
    const result = await collection.updateOne(
      { uid },
      {
        $set: {
          'preferences.categories': allCategories,
          'preferences.brands': allBrands,
          'preferences.materials': allMaterials,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'User preferences synchronized',
      categories: allCategories,
      brands: allBrands,
      materials: allMaterials,
    });
  } catch (error) {
    console.error('Error syncing preferences:', error);
    return NextResponse.json(
      { error: 'Failed to sync preferences' },
      { status: 500 }
    );
  }
}
