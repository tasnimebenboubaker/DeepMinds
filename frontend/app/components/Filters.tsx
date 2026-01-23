
import React from 'react';
import { CATEGORIES } from '../constants';
import { Category, FilterState } from '../types';

interface FiltersProps {
  filter: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
}

const Filters: React.FC<FiltersProps> = ({ filter, onFilterChange }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-8 sticky top-24 h-fit">
      {/* Categories */}
      <div>
        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Categories</h4>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onFilterChange({ category: cat as Category })}
              className={`w-full text-left px-4 py-2 rounded-xl transition-all ${
                filter.category === cat 
                ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100' 
                : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Filter */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Max Budget</h4>
          <span className="text-indigo-600 font-bold">${filter.maxPrice}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2000"
          step="50"
          value={filter.maxPrice}
          onChange={(e) => onFilterChange({ maxPrice: parseInt(e.target.value) })}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
          <span>$0</span>
          <span>$2000+</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="pt-6 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Exclusive Member Deal</p>
          <p className="text-sm font-bold text-slate-800">Free shipping on all orders over $500!</p>
        </div>
      </div>
    </div>
  );
};

export default Filters;
