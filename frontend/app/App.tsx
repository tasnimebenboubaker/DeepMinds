"use client";

import React, { useState, useMemo, useLayoutEffect, useEffect } from 'react';
import { FilterState, Product, CartItem, SortOption } from './types';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import Filters from './components/Filters';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import { useInitializeUserProfile } from './lib/useInitializeUserProfile';


const DEFAULT_FILTERS: FilterState = {
  category: 'All',
  maxPrice: 2000,
  searchQuery: '',
  sortBy: 'Featured',
};

// Helper function to load cart from localStorage safely
const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const savedCart = localStorage.getItem('orbitStore_cart');
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      if (Array.isArray(parsedCart)) {
        return parsedCart;
      }
    }
  } catch (error) {
    console.error('Failed to load cart from localStorage:', error);
  }
  return [];
};

const App: React.FC = () => {
  // Initialize user profile on login
  useInitializeUserProfile();

  // Initialize state directly from localStorage
  const [cart, setCart] = useState<CartItem[]>(loadCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -------------------------
  // Load cart from localStorage on mount with useLayoutEffect
  // This runs BEFORE the first paint
  // -------------------------
  useLayoutEffect(() => {
    const savedCart = loadCartFromStorage();
    if (savedCart.length > 0) {
      setCart(savedCart);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('orbitStore_cart', JSON.stringify(cart));
  }, [cart]);

  // Fetch products from MongoDB
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // -------------------------
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase();
    
    // Helper to extract numeric rating value
    const getRatingValue = (rating: Product['rating']): number => {
      if (!rating) return 0;
      if (typeof rating === 'number') return rating;
      return (rating as any).rate ?? 0;
    };

    const productsList = products.filter((product) => {
      const matchesCategory =
        filters.category === 'All' || product.category === filters.category;
      const matchesPrice = product.price <= filters.maxPrice;
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
      return matchesCategory && matchesPrice && matchesSearch;
    });

    // Apply sorting
    switch (filters.sortBy) {
      case 'Price: Low to High':
        productsList.sort((a, b) => a.price - b.price);
        break;
      case 'Price: High to Low':
        productsList.sort((a, b) => b.price - a.price);
        break;
      case 'Top Rated':
        productsList.sort((a, b) => getRatingValue(b.rating) - getRatingValue(a.rating));
        break;
      case 'Featured':
      default:
        // Keep original order for Featured
        break;
    }

    return productsList;
  }, [filters, products]);

  // -------------------------
  // Handlers
  // -------------------------
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFilterUpdate = (newFields: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFields }));
  };

  const scrollToProducts = () => {
    const el = document.getElementById('product-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        cartCount={cartCount}
        onCartToggle={() => setIsCartOpen(true)}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => handleFilterUpdate({ searchQuery: q })}
      />

      <main className="flex-1 container mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="mb-20">
          <div className="relative rounded-3xl overflow-hidden h-[400px] bg-slate-900 flex items-center px-12">
            <div className="absolute inset-0 opacity-40">
              <img
                src="https://picsum.photos/id/119/1200/600"
                alt="Hero"
                className="w-full h-full object-cover grayscale"
              />
            </div>
            <div className="relative z-10 max-w-2xl space-y-6">
              <span className="inline-block bg-indigo-600/20 text-indigo-400 font-bold px-4 py-1 rounded-full text-sm border border-indigo-500/30">
                LATEST RELEASES
              </span>
              <h1 className="text-5xl md:text-6xl font-black text-white">
                Evolution of <br />
                <span className="text-indigo-500 italic">Personal</span> Tech & Style.
              </h1>
              <p className="text-slate-300 text-lg">
                Discover our curated collection of cutting-edge electronics and fashionable apparel, enhanced by AI insights to help you choose the perfect items for your lifestyle.
              </p>
              <button
                onClick={scrollToProducts}
                className="bg-white text-slate-900 font-black px-8 py-4 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-xl shadow-white/5"
              >
                Explore Collections
              </button>
            </div>
          </div>
        </section>

        <div id="product-section" className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-72">
            <Filters filter={filters} onFilterChange={handleFilterUpdate} />
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  {filters.category === 'All'
                    ? 'Our Collections'
                    : `${filters.category}`}
                </h2>
               
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Sort By:
                </span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterUpdate({ sortBy: e.target.value as SortOption })}
                  className="bg-white border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>Featured</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Top Rated</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-32 bg-white rounded-3xl border border-slate-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Loading products...
                </h3>
                <p className="text-slate-400">
                  Fetching the latest products from our database.
                </p>
              </div>
            ) : error ? (
              <div className="text-center py-32 bg-white rounded-3xl border border-red-200">
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Failed to load products
                </h3>
                <p className="text-slate-400 mb-4">
                  {error}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filteredProducts.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-slate-300">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  No items found
                </h3>
                <p className="text-slate-400">
                  Try adjusting your budget or search keywords to find what
                  you re looking for.
                </p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-6 text-indigo-600 font-bold hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onRemove={handleRemoveFromCart}
        onUpdateQty={handleUpdateQty}
      />

      <Footer />
    </div>
  );
};

export default App;
