"use client";
import React from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
};

export default function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  return (
    <article className="card">
      <div className="h-44 w-full overflow-hidden rounded-md">
        <img src={product.image} alt={product.name} className="product-img" />
      </div>
      <h3 className="mt-3 text-lg font-medium">{product.name}</h3>
      <p className="mt-1 text-sm muted">{product.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-lg font-semibold">${product.price.toFixed(2)}</div>
        <button onClick={() => onAdd(product)} className="btn btn-primary">
          Add
        </button>
      </div>
    </article>
  );
}
