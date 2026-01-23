
export type Category = 'All' | 'Smartphones' | 'Laptops' | 'Audio' | 'Wearables' | 'Tablets';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  description: string;
  image: string;
  rating: number;
  specs: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface FilterState {
  category: Category;
  maxPrice: number;
  searchQuery: string;
}
