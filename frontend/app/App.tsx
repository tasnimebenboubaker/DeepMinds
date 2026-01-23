"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { PRODUCTS } from './constants';
import { FilterState, Product, CartItem, SortOption } from './types';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import Filters from './components/Filters';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';


const DEFAULT_FILTERS: FilterState = {
  category: 'All',
  maxPrice: 2000,
  searchQuery: '',
  sortBy: 'Featured',
};

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // -------------------------
  // Load cart safely from localStorage
  // -------------------------
  useEffect(() => {
    (async () => {
      try {
        const savedCart = localStorage.getItem('orbitStore_cart');
        if (savedCart) {
          // setState différé pour éviter les rendus synchrones
          setTimeout(() => setCart(JSON.parse(savedCart)), 0);
        }
      } catch {
        localStorage.removeItem('orbitStore_cart');
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('orbitStore_cart', JSON.stringify(cart));
  }, [cart]);

  // -------------------------
  // Derived state
  // -------------------------
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase();
    let products = PRODUCTS.filter((product) => {
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
        products.sort((a, b) => a.price - b.price);
        break;
      case 'Price: High to Low':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'Top Rated':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'Featured':
      default:
        // Keep original order for Featured
        break;
    }

    return products;
  }, [filters]);

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
                Shop Collection
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
                    ? 'Collection'
                    : `${filters.category}`}
                </h2>
                <p className="text-slate-400 text-sm">
                  Showing {filteredProducts.length} items
                </p>
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

            {filteredProducts.length ? (
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
