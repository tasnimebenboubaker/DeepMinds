
import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Nebula Pro Smartphone',
    category: 'Smartphones',
    price: 899,
    description: 'The ultimate flagship experience with a 120Hz AMOLED display and pro-grade cameras.',
    image: 'https://picsum.photos/id/1/600/600',
    rating: 4.8,
    specs: ['Snapdragon 8 Gen 3', '12GB RAM', '256GB Storage']
  },
  {
    id: '2',
    name: 'ZenBook Elite 14',
    category: 'Laptops',
    price: 1299,
    description: 'Powerful performance meets portability in this sleek aluminum chassis.',
    image: 'https://picsum.photos/id/2/600/600',
    rating: 4.9,
    specs: ['Intel Core i7', '16GB RAM', '512GB SSD']
  },
  {
    id: '3',
    name: 'SonicWave ANC Headphones',
    category: 'Audio',
    price: 249,
    description: 'Industry-leading noise cancellation with spatial audio support.',
    image: 'https://picsum.photos/id/3/600/600',
    rating: 4.7,
    specs: ['40h Battery', 'Bluetooth 5.3', 'LDAC Support']
  },
  {
    id: '4',
    name: 'Titan Watch Series 5',
    category: 'Wearables',
    price: 399,
    description: 'Track your fitness, health, and stay connected on the go.',
    image: 'https://picsum.photos/id/4/600/600',
    rating: 4.6,
    specs: ['ECG Monitor', 'OLED Always-on', 'Water Resistant']
  },
  {
    id: '5',
    name: 'PixelTab Pro',
    category: 'Tablets',
    price: 649,
    description: 'Perfect for creators and entertainment on a stunning 12-inch display.',
    image: 'https://picsum.photos/id/5/600/600',
    rating: 4.5,
    specs: ['Stylus Included', 'Split Screen Support', 'Quad Speakers']
  },
  {
    id: '6',
    name: 'Lumina X Smartphone',
    category: 'Smartphones',
    price: 599,
    description: 'Exceptional camera quality in a compact, stylish design.',
    image: 'https://picsum.photos/id/6/600/600',
    rating: 4.4,
    specs: ['64MP Triple Cam', '8GB RAM', '128GB Storage']
  },
  {
    id: '7',
    name: 'Apex Gaming Laptop',
    category: 'Laptops',
    price: 1899,
    description: 'Dominate the competition with ultra-high frame rates and RGB lighting.',
    image: 'https://picsum.photos/id/7/600/600',
    rating: 4.9,
    specs: ['RTX 4080', '32GB RAM', '1TB NVMe']
  },
  {
    id: '8',
    name: 'Buds Pro Wireless',
    category: 'Audio',
    price: 129,
    description: 'True wireless freedom with punchy bass and clear vocals.',
    image: 'https://picsum.photos/id/8/600/600',
    rating: 4.3,
    specs: ['IPX7 Rating', 'Wireless Charging', '6h + 24h Case']
  },
  {
    id: '9',
    name: 'Urban Denim Jacket',
    category: 'Clothes',
    price: 89,
    description: 'Classic denim jacket with modern fit and premium quality stitching.',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop',
    rating: 4.6,
    specs: ['100% Cotton', 'Machine Washable', 'Slim Fit']
  },
  {
    id: '10',
    name: 'Athletic Performance Tee',
    category: 'Clothes',
    price: 29,
    description: 'Moisture-wicking fabric perfect for workouts and casual wear.',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop',
    rating: 4.4,
    specs: ['Polyester Blend', 'Quick Dry', 'UV Protection']
  },
  {
    id: '11',
    name: 'Premium Wool Sweater',
    category: 'Clothes',
    price: 149,
    description: 'Luxurious merino wool sweater with impeccable craftsmanship.',
    image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=600&fit=crop',
    rating: 4.8,
    specs: ['100% Merino Wool', 'Hand Wash', 'Regular Fit']
  },
  {
    id: '12',
    name: 'Casual Chinos',
    category: 'Clothes',
    price: 59,
    description: 'Versatile cotton chinos that transition seamlessly from office to weekend.',
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&h=600&fit=crop',
    rating: 4.5,
    specs: ['98% Cotton', 'Machine Washable', 'Straight Leg']
  }
];

export const CATEGORIES: string[] = ['All', 'Smartphones', 'Laptops', 'Audio', 'Wearables', 'Tablets', 'Clothes'];
