import React from "react";

export default function Footer() {
  return (
    <footer className="w-full border-t bg-white/60 py-8 dark:bg-black/60">
      <div className="container mx-auto px-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        © {new Date().getFullYear()} MyTeck — Simple e‑commerce demo
      </div>
    </footer>
  );
}
