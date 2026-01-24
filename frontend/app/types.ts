
export type Category = 'All' | 'Men\'s Clothing' | 'Women\'s Clothing' | 'Jewelery' | 'Electronics' | 'Home Appliances' | 'Sports & Outdoors';

export interface Rating {
  rate: number;
  count: number;
}

export interface Product {
  id: string;
  name: string;
  title?: string;
  category: Category;
  price: number;
  description: string;
  image: string;
  rating?: number | Rating;
  specs?: string[];
  payment_methods?: string[];
  availability?: boolean;
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
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: Category;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}