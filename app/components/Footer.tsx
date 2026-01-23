
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-16 mt-20">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic">
              MT
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              MyTech
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-70">
            Premium electronics for the modern professional. 
            Curated selection of high-performance tech with AI-guided shopping.
          </p>
          <div className="flex gap-4">
            {['Twitter', 'Instagram', 'Github'].map(icon => (
              <div key={icon} className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 cursor-pointer transition-colors">
                <span className="text-xs">{icon[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Explore</h4>
          <ul className="space-y-4 text-sm">
            <li><a href="#" className="hover:text-indigo-400 transition-colors">New Arrivals</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Best Sellers</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Deals & Offers</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">MyTech Pro</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Support</h4>
          <ul className="space-y-4 text-sm">
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Help Center</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Shipping Info</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Returns & Refunds</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Track Order</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Newsletter</h4>
          <p className="text-sm opacity-70 mb-4">Subscribe for early access to drops and AI insights.</p>
          <div className="flex gap-2">
            <input 
              type="email" 
              placeholder="Your email" 
              className="bg-slate-800 border-none rounded-lg px-4 py-2 text-sm w-full focus:ring-1 focus:ring-indigo-500"
            />
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-16 pt-8 border-t border-slate-800 text-xs text-center opacity-40">
        &copy; {new Date().getFullYear()} MyTech. All rights reserved. Built with love.
      </div>
    </footer>
  );
};

export default Footer;
