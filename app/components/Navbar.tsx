"use client";
import React, { useState } from "react";

export default function Navbar({
  cartCount = 0,
  onCartToggle,
}: {
  cartCount?: number;
  onCartToggle?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
    // Add search functionality here
  };

  return (
    <header className="site-header w-full border-b">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a className="text-2xl font-bold" href="#">
          MyTeck
        </a>
        <nav className="flex items-center gap-6">
          <a className="text-sm muted" href="#">Home</a>
          <a className="text-sm muted" href="#products">Products</a>
          <a className="text-sm muted" href="#about">About</a>
          
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
            >
              Search
            </button>
          </form>

          <button
            aria-label="Open cart"
            onClick={onCartToggle}
            className="relative inline-flex items-center gap-2 btn btn-primary"
          >
            <span>Cart</span>
            <span className="ml-1 badge">
              {cartCount}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}
