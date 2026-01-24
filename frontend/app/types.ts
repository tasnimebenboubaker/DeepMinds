
export type Category = 'All' | 'Men\'s Clothing' | 'Women\'s Clothing' | 'Jewelery' | 'Electronics' | 'Home Appliances' | 'Sports & Outdoors';

export interface Product {
  id: string;
  title: string;
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

export type SortOption = 'Featured' | 'Price: Low to High' | 'Price: High to Low' | 'Top Rated';

export interface FilterState {
  category: Category;
  maxPrice: number;
  searchQuery: string;
  sortBy: SortOption;
}
