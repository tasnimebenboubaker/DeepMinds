"use client";

import React, { useMemo, useState } from "react";
import ProductCard from "./components/ProductCard";
import { products as sampleProducts } from "./data/products";

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  function addToCart(p: { id: string; name: string; price: number }) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  return (
    <div>
      <section className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="site-hero">
              <h1 className="text-3xl font-bold">Welcome to MyTeck</h1>
              <p className="mt-3 muted">
                A small, modern e‑commerce layout demo. Browse featured products
                and add them to your cart.
              </p>
              <div className="mt-6 flex gap-3">
                <button className="btn btn-primary">Shop Now</button>
                <button className="btn btn-ghost">Learn</button>
              </div>
            </div>

            <h2 id="products" className="mt-8 mb-4 text-2xl font-semibold">Featured Products</h2>
            <div className="products-grid">
              {sampleProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={(prod) => {
                    addToCart({ id: prod.id, name: prod.name, price: prod.price });
                    setCartOpen(true);
                  }}
                />
              ))}
            </div>
          </div>

          <aside>
            <div className="card">
              <h3 className="text-lg font-semibold">Cart Summary</h3>
              <p className="mt-2 text-sm muted">{items.length} item(s)</p>
              <div className="mt-4 flex flex-col gap-3">
                {items.length === 0 && <div className="text-sm muted">Your cart is empty.</div>}
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-sm muted">Qty: {it.qty}</div>
                    </div>
                    <div className="text-sm">
                      ${(it.price * it.qty).toFixed(2)}
                      <button
                        onClick={() => removeFromCart(it.id)}
                        className="ml-3 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="text-lg font-semibold">Total</div>
                <div className="text-lg font-semibold">${total.toFixed(2)}</div>
              </div>
              <div className="mt-4">
                <button className="w-full btn btn-primary">Checkout</button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* simple cart drawer for mobile or when add-to-cart triggers */}
      {cartOpen && (
        <div className="cart-drawer">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Cart</div>
            <button onClick={() => setCartOpen(false)} className="text-sm muted">Close</button>
          </div>
          <div className="mt-3">
            {items.length === 0 && <div className="text-sm muted">No items</div>}
            {items.map((it) => (
              <div key={it.id} className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-sm">{it.name}</div>
                  <div className="text-xs muted">Qty: {it.qty}</div>
                </div>
                <div className="text-sm">${(it.price * it.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
