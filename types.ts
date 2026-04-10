export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  SALESMAN = 'SALESMAN' ,
  STORE_OWNER = 'STORE_OWNER'
}

export interface UserPermissions {
  inventory_edit: boolean;
  inventory_delete: boolean;
  sales_delete: boolean;
  purchase_delete: boolean;
  customers_edit: boolean;
  customers_delete: boolean;
  suppliers_edit: boolean;
  suppliers_delete: boolean;
  expenses_edit: boolean;
  expenses_delete: boolean;
  user_control_access: boolean;
  settings_access: boolean;
}

export interface User {
  id: string;
  name: string;
  phone?: string; 
  role: UserRole;
  avatar: string;
  assignedStoreId?: string; 
  password?: string;
  permissions?: UserPermissions;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  monthlyFee?: number; 
  billingStartMonth?: string;
}

export interface StorePayment {
  id: string;
  storeId: string;
  monthYear: string; 
  amountPaid: number;
  paymentDate: string;
  trxId?: string;
  status?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcodeId?: string;
  name: string;             // Brand Name (e.g., Napa Extend)
  genericName?: string;     // 🔴 Pharmacy Feature: Generic / Group Name (e.g., Paracetamol)
  category: string;         // Tablet, Syrup, Injection etc.
  quantity: number;         // Total pieces (Base Unit)
  
  piecesPerBox?: number;    // 🔴 Pharmacy Feature: Unit Conversion (1 Box = ? Pieces)
  piecesPerStrip?: number;  // 🔴 Pharmacy Feature: Unit Conversion (1 Strip = ? Pieces)
  
  buyingPrice: number;      // Cost per piece/unit
  price: number;            // Selling price per piece/unit
  minThreshold: number;
  
  batchNumber?: string;     // 🔴 Pharmacy Feature: Batch Tracking
  expiryDate?: string;      // 🔴 Pharmacy Feature: Expiry Date (ISO String)
  rackLocation?: string;    // 🔴 Pharmacy Feature: Rack & Shelf Position (e.g., Rack-A, Shelf-2)
  
  storeId: string;
  lastUpdated: string;
  linkedExpenseId?: string;
}

export interface Sale {
  id: string;
  invoiceId: string;
  customerId?: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  buyingPrice: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  amountPaid: number;
  amountDue: number;
  paymentMethod?: string; 
  prescriptionRef?: string; // 🔴 Pharmacy Feature: Doctor's Prescription Reference
  timestamp: string;
  storeId: string;
}

export interface Expense {
  id: string;
  storeId: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod?: string; 
  timestamp: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;
  regularMedicines?: string; // 🔴 Pharmacy Feature: JSON string of regular medication IDs
  medicalNotes?: string;     // 🔴 Pharmacy Feature: Blood group, allergies or patient notes
  storeId: string;
}

export interface Supplier {
  id: string;
  name: string;      // এটি কোম্পানির নাম হিসেবে কাজ করবে
  phone: string;     // কোম্পানির অফিসিয়াল নাম্বার (ঐচ্ছিক)
  address: string;
  totalDue: number;
  storeId: string;
  // নতুন যোগ করা ফিল্ড
  amName?: string;
  amPhone?: string;
  srName?: string;
  srPhone?: string;
}

export interface Purchase {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  amountPaid: number;
  amountDue: number;
  batchNumber?: string;      // 🔴 Pharmacy Feature: Batch recorded during purchase
  expiryDate?: string;       // 🔴 Pharmacy Feature: Expiry recorded during purchase
  timestamp: string;
  storeId: string;
}

// 🔴 Pharmacy Feature: নতুন ইন্টারফেস (কোম্পানিকে মেয়াদোত্তীর্ণ ওষুধ ফেরতের জন্য)
export interface PurchaseReturn {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  batchNumber?: string;
  quantity: number;
  returnAmount: number;      // সাপ্লায়ারের কাছে পাওনা টাকা
  reason: 'EXPIRY' | 'DAMAGE' | 'OTHER';
  timestamp: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  expiredCount?: number;     // 🔴 Pharmacy Feature: Expired drugs count
  nearExpiryCount?: number;  // 🔴 Pharmacy Feature: Drugs expiring in 3 months
  totalValue: number;
  outOfStock: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
}

export type TransactionType = 'BANK_DEPOSIT' | 'BANK_WITHDRAWAL' | 'CASH_OUT' | 'TRANSFER';
export type PaymentSource = 'CASH' | 'BANK' | 'CARD' | 'BKASH' | 'NAGAD';

export interface CashTransaction {
  id: string;
  storeId: string;
  type: TransactionType;
  source: PaymentSource | string;
  destination?: PaymentSource | string; 
  amount: number;
  description: string;
  timestamp: string;
}