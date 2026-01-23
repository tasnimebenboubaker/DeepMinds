// app/layout.tsx
import './globals.css'; // ton CSS global (ex: Tailwind)
import React from 'react';

export const metadata = {
  title: 'OrbitStore - Premium Tech & Fashion',
  description: 'Evolution of Personal Tech & Style. Discover our curated collection of cutting-edge electronics and fashionable apparel, enhanced by AI insights to help you choose the perfect items for your lifestyle.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 font-inter">
        {children}
      </body>
    </html>
  );
}
