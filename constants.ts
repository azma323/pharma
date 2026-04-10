
import { Store, Product, User, UserRole } from './types';

export const INITIAL_STORES: Store[] = [
  { id: 'wh-1', name: 'Main Warehouse', location: 'Downtown, Seattle' },
  { id: 'wh-2', name: 'North Branch', location: 'Everett, WA' },
  { id: 'wh-3', name: 'South Distribution', location: 'Tacoma, WA' },
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', sku: '690123456789', name: 'Industrial Drill Bit', category: 'Hardware', quantity: 45, buyingPrice: 8.00, price: 12.50, minThreshold: 10, storeId: 'wh-1', lastUpdated: new Date().toISOString() },
  { id: '2', sku: '690123456790', name: 'Safety Goggles Pro', category: 'PPE', quantity: 8, buyingPrice: 15.00, price: 24.99, minThreshold: 15, storeId: 'wh-1', lastUpdated: new Date().toISOString() },
  { id: '3', sku: '690123456791', name: 'Heavy Duty Gloves', category: 'PPE', quantity: 120, buyingPrice: 3.00, price: 5.00, minThreshold: 20, storeId: 'wh-2', lastUpdated: new Date().toISOString() },
  { id: '4', sku: '690123456792', name: 'Steel Measuring Tape', category: 'Tools', quantity: 3, buyingPrice: 10.00, price: 15.75, minThreshold: 5, storeId: 'wh-1', lastUpdated: new Date().toISOString() },
  { id: '5', sku: '690123456793', name: 'WD-40 Lubricant', category: 'Chemicals', quantity: 50, buyingPrice: 5.50, price: 8.90, minThreshold: 12, storeId: 'wh-3', lastUpdated: new Date().toISOString() },
];

export const INITIAL_USER: User = {
  id: 'u-1',
  name: 'admin',
  role: UserRole.SUPER_ADMIN,
  avatar: 'https://picsum.photos/seed/admin/200',
  password: 'admin'
};

export const INITIAL_CATEGORIES = ['Hardware', 'PPE', 'Tools', 'Chemicals', 'Electrical', 'Plumbing'];
