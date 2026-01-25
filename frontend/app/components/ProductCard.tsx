import React, { useState, useEffect } from 'react';
import { Product, Rating } from '../types';
import { getAzureBlobUrl, isValidBlobUrl } from '../lib/azure';
import { useAuth } from '../lib/authContext';
import { updateUserPreferences } from '../lib/userPreferencesSync';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onToggleWishlist }) => {
  const { user } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Check if product is in wishlist on mount
  useEffect(() => {
    const wishlist = JSON.parse(localStorage.getItem('orbitStore_wishlist') || '[]');
    setIsWishlisted(wishlist.some((item: any) => item.id === product.id));
  }, [product.id]);

  const handleToggleWishlist = async () => {
    const wishlist = JSON.parse(localStorage.getItem('orbitStore_wishlist') || '[]');
    
    if (isWishlisted) {
      // Remove from wishlist
      const updatedWishlist = wishlist.filter((item: any) => item.id !== product.id);
      localStorage.setItem('orbitStore_wishlist', JSON.stringify(updatedWishlist));
      
      // Remove from database if user is logged in
      if (user?.uid) {
        try {
          await fetch('/api/users/wishlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, productId: product.id }),
          });
          // Sync user preferences after wishlist change
          await updateUserPreferences(user.uid);
        } catch (error) {
          console.error('Failed to remove from wishlist in database:', error);
        }
      }
    } else {
      // Add to wishlist
      wishlist.push(product);
      localStorage.setItem('orbitStore_wishlist', JSON.stringify(wishlist));
      
      // Add to database if user is logged in
      if (user?.uid) {
        try {
          await fetch('/api/users/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, product }),
          });
          // Sync user preferences after wishlist change
          await updateUserPreferences(user.uid);
        } catch (error) {
          console.error('Failed to add to wishlist in database:', error);
        }
      }
    }
    
    setIsWishlisted(!isWishlisted);
    if (onToggleWishlist) {
      onToggleWishlist(product);
    }
  };

  // Construct the full image URL from Azure blob storage
  const imageUrl = isValidBlobUrl(product.image) 
    ? product.image 
    : getAzureBlobUrl(product.image);

  // Handle rating - can be a number or object with rate/count
  const getRatingInfo = () => {
    if (!product.rating) return null;
    if (typeof product.rating === 'number') {
      return { rate: product.rating, count: 0 };
    }
    return product.rating as Rating;
  };

  const ratingInfo = getRatingInfo();
  const displayTitle = product.title || product.name;
  const isAvailable = product.availability !== false;

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Image Section */}
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={displayTitle} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm border border-indigo-100">
          {product.category}
        </div>
        
        {/* Availability Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-sm border ${
            isAvailable 
              ? 'bg-green-100 text-green-700 border-green-300' 
              : 'bg-red-100 text-red-700 border-red-300'
          }`}>
            {isAvailable ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${
            isWishlisted
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white shadow-sm'
          }`}
        >
          <svg 
            className="w-5 h-5" 
            fill={isWishlisted ? 'currentColor' : 'none'} 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        {/* Title and Price */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors flex-1">
            {displayTitle}
          </h3>
          <span className="text-xl font-black text-indigo-600 whitespace-nowrap">
            ${product.price.toFixed(2)}
          </span>
        </div>

        {/* Rating Section */}
        {ratingInfo && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg 
                  key={i}
                  className={`w-4 h-4 ${i < Math.round(ratingInfo.rate) ? 'text-yellow-400' : 'text-slate-300'}`}
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {ratingInfo.rate.toFixed(1)}
            </span>
            {ratingInfo.count > 0 && (
              <span className="text-xs text-slate-500">
                ({ratingInfo.count} reviews)
              </span>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-slate-500 line-clamp-2 mb-4">
          {product.description}
        </p>

        {/* Specs */}
        {product.specs && Array.isArray(product.specs) && product.specs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {product.specs.slice(0, 2).map((spec, i) => (
              <span 
                key={i} 
                className="text-[10px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200"
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {/* Payment Methods */}
        {product.payment_methods && Array.isArray(product.payment_methods) && product.payment_methods.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500 font-semibold">Pays:</span>
            <div className="flex gap-2">
              {product.payment_methods.map((method, i) => (
                <span 
                  key={i}
                  className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200 capitalize font-medium"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add to Cart Button */}
        <div className="mt-auto pt-2">
          <button 
            onClick={() => onAddToCart(product)}
            disabled={!isAvailable}
            className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95 ${
              isAvailable
                ? 'bg-slate-900 text-white hover:bg-indigo-600'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 100-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            {isAvailable ? 'Add to Cart' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
