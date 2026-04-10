import React, { useState, useMemo, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { Product, Store, User, UserRole, Sale, Expense, Supplier, Purchase } from '../types';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Package,
  Tag,
  ChevronDown,
  Zap,
  RotateCcw,
  CameraOff,
  Check,
  PackagePlus,
  ScanLine,
  CheckCircle2,
  LayoutDashboard,
  ArrowRight,
  Database,
  Printer,
  QrCode,
  Download,
  Truck,
  DollarSign,
  AlertTriangle,
  Clock,
  MapPin,
  Pill
} from 'lucide-react';

interface InventoryProps {
  products: Product[]; 
  suppliers: Supplier[];
  purchases: Purchase[]; 
  currentStore: Store; 
  currentUser: User; 
  categories: string[];
  sales: Sale[];
  expenses: Expense[];
  onUpdate: (id: string, updates: Partial<Product> & { linkedExpenseId?: string }) => void;
  onDelete: (id: string) => void;
  onAdd: (newProduct: Omit<Product, 'id' | 'lastUpdated'>) => Promise<any> | void; 
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => Promise<any> | any;
  onUpdateExpense: (id: string, updates: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => Promise<any> | any;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (name: string) => void;
  onUpdateSupplierDue: (id: string, amount: number) => void;
  onAddPurchase: (purchase: Omit<Purchase, 'id' | 'timestamp'>) => void;
  canEditPrices: boolean;
  canDelete: boolean;
}

const Inventory: React.FC<InventoryProps> = ({ 
  products, 
  suppliers,
  purchases, 
  currentStore, 
  currentUser, 
  categories,
  expenses,
  onUpdate, 
  onDelete,
  onAdd,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddCategory,
  onRemoveCategory,
  onUpdateSupplierDue,
  onAddPurchase,
  canEditPrices,
  canDelete
}) => {
  const [isRegistrationActive, setIsRegistrationActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [newCatName, setNewCatName] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scannedSku, setScannedSku] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const scannerRef = useRef<any>(null);

  // 🔴 Pharmacy Feature: Expiry Status Checker
  const getExpiryStatus = (dateStr?: string) => {
    if(!dateStr) return { status: 'UNKNOWN', label: 'No Expiry Set', color: 'text-slate-500', bg: 'bg-slate-800' };
    const today = new Date();
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'EXPIRED', label: 'Expired', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' };
    if (diffDays <= 90) return { status: 'NEAR_EXPIRY', label: `Expires in ${diffDays}d`, color: 'text-amber-500', bg: 'bg-amber-400/10 border-amber-400/30' };
    return { status: 'GOOD', label: new Date(dateStr).toLocaleDateString(), color: 'text-emerald-400', bg: 'bg-slate-800 border-slate-700' };
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.storeId === currentStore.id)
      .filter(p => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          p.name.toLowerCase().includes(searchLower) || 
          p.sku.toLowerCase().includes(searchLower) ||
          (p.genericName && p.genericName.toLowerCase().includes(searchLower));
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });
  }, [products, currentStore.id, searchTerm, selectedCategory]);

  const generateBarcodeID = (category: string) => {
    const prefix = category.substring(0, 2).toUpperCase();
    const random = Math.floor(10000000 + Math.random() * 90000000);
    return `${prefix}-${random}`;
  };

  const handleCreateBarcode = (product: Product) => {
    if (!product.barcodeId) {
      const newId = generateBarcodeID(product.category);
      onUpdate(product.id, { barcodeId: newId });
      setBarcodeProduct({ ...product, barcodeId: newId });
    } else {
      setBarcodeProduct(product);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    const headers = ['SKU', 'Brand Name', 'Generic Name', 'Category', 'Rack', 'Expiry', 'Quantity', 'Buying Price', 'Selling Price'];
    const data = filteredProducts.map(p => [
      p.sku,
      p.name.replace(/,/g, ';'),
      (p.genericName || '').replace(/,/g, ';'),
      p.category,
      p.rackLocation || 'N/A',
      p.expiryDate || 'N/A',
      p.quantity,
      p.buyingPrice.toFixed(2),
      p.price.toFixed(2)
    ]);
    
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pharmacy_inventory_${currentStore.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const safeStopScanner = async () => {
    if (scannerRef.current) {
      try {
        const currentState = scannerRef.current.getState();
        if (currentState === 2 || currentState === 3) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn("Scanner stop suppressed:", err);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setScannerError(null);
    await safeStopScanner();

    setTimeout(async () => {
      try {
        const html5QrCode = new (window as any).Html5Qrcode("reg-scanner-reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };
        const onScanSuccess = (decodedText: string) => {
          handleSkuLookup(decodedText, true);
          setIsScanning(false);
          safeStopScanner();
        };

        try {
          await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        } catch (err1) {
          try {
            await html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, () => {});
          } catch (err2) {
            const devices = await (window as any).Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await html5QrCode.start(devices[0].id, config, onScanSuccess, () => {});
            } else {
              throw new Error("No camera hardware detected.");
            }
          }
        }
      } catch (err: any) {
        setScannerError(err?.message || "Optical hardware initialization failed.");
        setIsScanning(false);
      }
    }, 350);
  };

  const handleSkuLookup = (sku: string, fromScanner: boolean = false) => {
    setScannedSku(sku);
    if (!sku) {
      setMatchedProduct(null);
      return;
    }

    const existing = products.find(p => p.sku === sku && p.storeId === currentStore.id);
    if (existing) {
      setMatchedProduct(existing);
    } else {
      setMatchedProduct(null);
    }
  };

  const resetFormState = () => {
    setEditingProduct(null);
    setScannedSku('');
    setMatchedProduct(null);
    setIsScanning(false);
    setScannerError(null);
  };

  const handleEditAsset = (product: Product) => {
    const hasUnpaidDues = purchases?.some(purchase => {
      if (purchase.productId === product.id && purchase.amountDue > 0) {
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        return supplier && supplier.totalDue > 0;
      }
      return false;
    });

    if (hasUnpaidDues) {
      alert("⚠️ অ্যাকশন বাতিল! এই প্রোডাক্টটির সাপ্লায়ারের বকেয়া এখনো সম্পূর্ণ পরিশোধ করা হয়নি। এডিট করার আগে সাপ্লায়ার প্যানেল থেকে বকেয়া ক্লিয়ার করুন।");
      return;
    }

    setEditingProduct(product);
    setScannedSku(product.sku);
    setIsRegistrationActive(true);
  };

  const handleDeleteAsset = async (product: Product & { linkedExpenseId?: string }) => {
    const hasUnpaidDues = purchases?.some(purchase => {
      if (purchase.productId === product.id && purchase.amountDue > 0) {
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        return supplier && supplier.totalDue > 0;
      }
      return false;
    });

    if (hasUnpaidDues) {
      alert("⚠️ অ্যাকশন বাতিল! এই প্রোডাক্টটির সাপ্লায়ারের বকেয়া এখনো সম্পূর্ণ পরিশোধ করা হয়নি। ডিলিট করার আগে সাপ্লায়ার প্যানেল থেকে বকেয়া ক্লিয়ার করুন।");
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete ${product.name}? Any associated financial expenses will also be reversed.`)) {
      try {
        if (product.linkedExpenseId) {
          await onDeleteExpense(product.linkedExpenseId);
        } else {
          const fallbackExpense = expenses.find(exp => 
            exp.storeId === currentStore.id && 
            exp.category === "Operational Cost" &&
            exp.description.includes(product.name)
          );
          if (fallbackExpense) {
            await onDeleteExpense(fallbackExpense.id);
          }
        }
        onDelete(product.id);
      } catch (error) {
        console.error("Failed to delete product or linked expense", error);
        alert("Warning: Could not reverse associated expenses automatically.");
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    
    const supplierId = form.pSupplier?.value;
    const amountPaid = parseFloat(form.pPaidAmount?.value || '0'); 
    const supplier = suppliers.find(s => s.id === supplierId);

    const quantity = matchedProduct ? parseInt(form.pNewQty.value) : parseInt(form.pQty.value);
    const buyingPrice = parseFloat(form.pBuyingPrice.value);
    const totalCost = quantity * buyingPrice;
    const dueAmount = totalCost - amountPaid;
    
    const productName = matchedProduct?.name || form.pName.value;
    let finalProductId = matchedProduct?.id; 

    if (matchedProduct) {
      onUpdate(matchedProduct.id, { 
        quantity: matchedProduct.quantity + quantity,
        buyingPrice: buyingPrice,
        // Update batch and expiry if new stock has different ones
        batchNumber: form.pBatch?.value || matchedProduct.batchNumber,
        expiryDate: form.pExpiry?.value || matchedProduct.expiryDate,
      });
    } else {
      const data = {
        name: productName,
        genericName: form.pGeneric?.value || '', // 🔴 Pharmacy Feature
        sku: scannedSku || form.pSku.value,
        category: form.pCat.value,
        quantity: quantity,
        piecesPerBox: parseInt(form.pBoxQty?.value || '1'),     // 🔴 Pharmacy Feature
        piecesPerStrip: parseInt(form.pStripQty?.value || '1'), // 🔴 Pharmacy Feature
        buyingPrice: buyingPrice,
        price: parseFloat(form.pPrice.value),
        minThreshold: parseInt(form.pMin.value),
        batchNumber: form.pBatch?.value || '',   // 🔴 Pharmacy Feature
        expiryDate: form.pExpiry?.value || '',   // 🔴 Pharmacy Feature
        rackLocation: form.pRack?.value || '',   // 🔴 Pharmacy Feature
      };
      
      if(editingProduct) {
        onUpdate(editingProduct.id, data);
        finalProductId = editingProduct.id;

        let expenseIdToUpdate = editingProduct.linkedExpenseId;
        
        if (!expenseIdToUpdate) {
          const fallbackExpense = expenses.find(exp => 
            exp.storeId === currentStore.id && 
            exp.category === "Operational Cost" &&
            exp.description.includes(editingProduct.name) 
          );
          
          if (fallbackExpense) {
            expenseIdToUpdate = fallbackExpense.id;
            onUpdate(editingProduct.id, { linkedExpenseId: fallbackExpense.id });
          }
        }

        if (expenseIdToUpdate) {
          const relatedExp = expenses.find(exp => exp.id === expenseIdToUpdate);
          if (relatedExp && relatedExp.category === "Operational Cost") {
            onUpdateExpense(expenseIdToUpdate, {
              amount: totalCost, 
              description: `Updated cash purchase: ${productName} (${quantity} units)`
            });
          }
        }

      } else {
        const result = await onAdd({...data, storeId: currentStore.id}) as any;
        if (result && result.id) {
            finalProductId = result.id;
        }
      }
    }

    let generatedExpenseId: string | null = null;

    if (supplier && finalProductId && !editingProduct) {
      if (amountPaid > 0) {
        const expResult = await onAddExpense({
          storeId: currentStore.id,
          category: "Inventory Purchase",
          amount: amountPaid,
          description: `Paid to ${supplier.name} for stock`
        });
        if (expResult && expResult.id) generatedExpenseId = expResult.id;
      }

      if (dueAmount > 0) {
        onUpdateSupplierDue(supplier.id, dueAmount);
      }

      onAddPurchase({
        poNumber: `${matchedProduct ? 'INV' : 'REG'}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        productId: finalProductId, 
        productName: productName,
        quantity: quantity,
        unitCost: buyingPrice,
        totalCost: totalCost,
        amountPaid: amountPaid,
        amountDue: dueAmount,
        batchNumber: form.pBatch?.value || '', // 🔴 Pharmacy Feature in Purchase
        expiryDate: form.pExpiry?.value || '', // 🔴 Pharmacy Feature in Purchase
        storeId: currentStore.id
      });
    } else {
      if (totalCost > 0 && !editingProduct) {
        const expResult = await onAddExpense({
          storeId: currentStore.id,
          category: "Operational Cost",
          amount: totalCost,
          description: `Cash purchase for new stock: ${productName} (${quantity} units)`
        });
        if (expResult && expResult.id) generatedExpenseId = expResult.id;
      } else if (matchedProduct && totalCost > 0) {
        const expResult = await onAddExpense({
          storeId: currentStore.id,
          category: "Operational Cost",
          amount: totalCost,
          description: `Restock cash purchase: ${productName} (+${quantity} units)`
        });
        if (expResult && expResult.id) generatedExpenseId = expResult.id;
      }
    }

    if (generatedExpenseId && finalProductId && !editingProduct) {
      onUpdate(finalProductId, { linkedExpenseId: generatedExpenseId });
    }
    
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
    resetFormState();
    form.reset();
  };

  const BarcodeModal = () => {
    if (!barcodeProduct) return null;
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl no-print">
        <div className="bg-slate-900 w-full max-w-md rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="p-8 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xl font-black text-white tracking-tight uppercase">Medicine Label</h3>
            <button onClick={() => setBarcodeProduct(null)} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          <div className="p-10 flex flex-col items-center">
            <div id="barcode-print-area" className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[250px]">
              <p className="text-slate-950 font-black text-sm mb-0.5 text-center leading-tight">{barcodeProduct.name}</p>
              {barcodeProduct.genericName && (
                <p className="text-slate-600 font-bold text-[9px] mb-2 text-center leading-tight">{barcodeProduct.genericName}</p>
              )}
              <div className="flex gap-4 mb-3">
                 <p className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">SKU: {barcodeProduct.sku}</p>
                 {barcodeProduct.batchNumber && <p className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">BCH: {barcodeProduct.batchNumber}</p>}
              </div>
              <Barcode 
                value={barcodeProduct.barcodeId || ''} 
                width={1.5} 
                height={40} 
                fontSize={12}
                background="#ffffff"
                lineColor="#000000"
                margin={0}
              />
              <div className="mt-2 w-full flex justify-between text-[8px] font-black uppercase text-slate-800 border-t border-slate-200 pt-2">
                 <span>{barcodeProduct.rackLocation || 'N/A'}</span>
                 <span>EXP: {barcodeProduct.expiryDate ? new Date(barcodeProduct.expiryDate).toLocaleDateString('en-GB') : 'N/A'}</span>
              </div>
            </div>

            <div className="w-full mt-10 space-y-4">
              <button 
                onClick={handlePrint}
                className="w-full bg-amber-400 text-slate-950 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/20"
              >
                <Printer className="w-5 h-5" /> Print Medical Label
              </button>
              <button 
                onClick={() => {
                  const newId = generateBarcodeID(barcodeProduct.category);
                  onUpdate(barcodeProduct.id, { barcodeId: newId });
                  setBarcodeProduct({ ...barcodeProduct, barcodeId: newId });
                }}
                className="w-full bg-slate-800 text-slate-300 py-4 rounded-[2rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] hover:text-white transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Regenerate Barcode ID
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isRegistrationActive) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Pharmacy Database</h1>
            <p className="text-slate-500 font-medium tracking-tight">Medical inventory for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button 
              onClick={exportToCSV}
              className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl"
            >
              <Download className="w-5 h-5" />
            </button>
            {currentUser.role !== UserRole.SALESMAN && (
              <>
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-900 border border-slate-800 text-slate-300 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:border-amber-400/50 transition-all shadow-xl">
                  <Tag className="w-4 h-4 text-amber-500" /> <span className="hidden md:inline uppercase tracking-widest text-[10px]">Categories</span>
                </button>
                <button 
                  onClick={() => setIsRegistrationActive(true)} 
                  className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:shadow-lg hover:shadow-amber-500/20 transition-all shadow-xl uppercase tracking-widest text-xs"
                >
                  <Plus className="w-5 h-5 stroke-[3px]" />
                  Add Medicine
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search by Brand Name, Generic or SKU..." 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 placeholder:text-slate-600 focus:border-amber-400/50 transition-all amber-glow" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <select 
              className="px-6 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-300 focus:border-amber-400 transition-all cursor-pointer shadow-xl appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%2394a3b8%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]" 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th className="px-6 py-5">Medicine Info</th>
                  <th className="px-6 py-5">Location & Expiry</th>
                  <th className="px-6 py-5">Pricing</th>
                  <th className="px-6 py-5 text-center">Stock</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredProducts.map((p, idx) => {
                  const expStatus = getExpiryStatus(p.expiryDate);
                  
                  return (
                  <tr key={p.id} className={`group transition-all duration-300 hover:bg-slate-800/40 ${idx % 2 === 0 ? 'bg-slate-900/10' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-700/50 group-hover:border-amber-400/30 group-hover:text-amber-400 transition-all duration-500">
                          <Pill className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-white leading-none mb-1 text-sm tracking-tight">{p.name}</p>
                          <p className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">{p.genericName || 'N/A'}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">SKU: {p.sku} {p.batchNumber ? `• BCH: ${p.batchNumber}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex flex-col gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-500" /> {p.rackLocation || 'Unassigned'}
                          </span>
                          <span className={`inline-flex w-fit items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${expStatus.bg} ${expStatus.color}`}>
                            {expStatus.status === 'EXPIRED' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {expStatus.label}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-400 text-xs italic tracking-tight mb-1">Cost: {currentUser.role === UserRole.SALESMAN ? '***' : `$${p.buyingPrice.toFixed(2)}`}</p>
                      <p className="font-black text-amber-400 text-sm tracking-tight">MRP: ${p.price.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className={`text-lg font-black tracking-tight ${p.quantity <= p.minThreshold ? 'text-rose-500' : 'text-emerald-400'}`}>
                         {p.quantity} 
                       </span>
                       <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Base Units</p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleCreateBarcode(p)} className="p-2.5 text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all" title="Create Label"><QrCode className="w-4 h-4" /></button>
                        {canEditPrices && (
                          <button onClick={() => handleEditAsset(p)} className="p-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDeleteAsset(p)} className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
        
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
               <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
               <h2 className="text-2xl font-black text-white mb-6 tracking-tight flex items-center gap-3">
                 <Tag className="w-6 h-6 text-amber-500" /> Medicine Categories
               </h2>
               <div className="space-y-6">
                  <div className="flex gap-3">
                     <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Tablet, Syrup, Injection..." className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 transition-all amber-glow" />
                     <button onClick={() => { if(newCatName.trim()) { onAddCategory(newCatName.trim()); setNewCatName(''); }}} className="bg-amber-400 text-slate-950 px-6 py-4 rounded-2xl font-black shadow-lg"><Plus className="w-6 h-6" /></button>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                     {categories.map(cat => (
                       <div key={cat} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 group hover:border-amber-400/30 transition-all">
                          <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">{cat}</span>
                          <button onClick={() => onRemoveCategory(cat)} className="text-slate-600 hover:text-rose-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                       </div>
                     ))}
                  </div>
               </div>
             </div>
          </div>
        )}
        
        <BarcodeModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row gap-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="lg:w-[500px] flex flex-col bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto custom-scrollbar relative">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              {editingProduct ? 'Update Medicine' : matchedProduct ? 'Restock Medicine' : 'New Registration'}
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Pharmacy Entry System</p>
          </div>
          <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        {showSuccessToast && (
          <div className="mb-6 bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-in slide-in-from-top-2">
            <Check className="w-5 h-5" />
            <p className="text-xs font-black uppercase tracking-widest">Saved Successfully.</p>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 text-amber-500">Scan Barcode / SKU</label>
            <div className="relative group">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
              <input 
                name="pSku" 
                required 
                readOnly={!!matchedProduct || !!editingProduct}
                value={scannedSku}
                autoFocus
                onChange={e => !editingProduct && handleSkuLookup(e.target.value)}
                placeholder="Scan or type identifier..." 
                className={`w-full pl-12 pr-14 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow ${ (matchedProduct || editingProduct) ? 'opacity-70 bg-slate-800/50' : ''}`} 
              />
              {(!matchedProduct && !editingProduct) && !isScanning && (
                <button type="button" onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 hover:text-amber-400 transition-colors"><ScanLine className="w-5 h-5" /></button>
              )}
            </div>
          </div>

          {isScanning && (
            <div className="mb-6 animate-in fade-in duration-300">
              <div className="relative aspect-video bg-slate-800 rounded-3xl overflow-hidden border-2 border-amber-400/50">
                <div id="reg-scanner-reader" className="w-full h-full"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-white/30 animate-scan pointer-events-none"></div>
                <button type="button" onClick={() => { setIsScanning(false); safeStopScanner(); }} className="absolute bottom-4 right-4 bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Cancel</button>
              </div>
            </div>
          )}

          {matchedProduct && !editingProduct && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-slate-950"><CheckCircle2 className="w-5 h-5" /></div>
              <div className="flex-1">
                 <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Database Match Found</p>
                 <p className="text-white font-bold text-xs truncate">{matchedProduct.name}</p>
              </div>
              <button type="button" onClick={() => { setMatchedProduct(null); setScannedSku(''); }} className="p-2 text-slate-500 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
            </div>
          )}

          <div className="space-y-6">
            {/* 🔴 Section: Core Info */}
            <div className="bg-slate-800/30 p-5 rounded-3xl border border-slate-700/50 space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700/50 pb-2 mb-4">Core Information</h4>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Brand Name</label>
                  <input 
                    name="pName" 
                    required 
                    readOnly={!!matchedProduct} 
                    value={matchedProduct ? matchedProduct.name : undefined} 
                    defaultValue={editingProduct?.name} 
                    placeholder="e.g. Napa Extend 665mg" 
                    className={`w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow ${matchedProduct ? 'opacity-70 cursor-not-allowed italic' : ''}`} 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500/80 uppercase tracking-[0.2em] ml-2">Generic / Group Name</label>
                  <input 
                    name="pGeneric" 
                    readOnly={!!matchedProduct} 
                    value={matchedProduct ? (matchedProduct.genericName || '') : undefined} 
                    defaultValue={editingProduct?.genericName} 
                    placeholder="e.g. Paracetamol" 
                    className={`w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow ${matchedProduct ? 'opacity-70 cursor-not-allowed italic' : ''}`} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Category (Type)</label>
                  <div className="relative">
                    <select 
                      name="pCat" 
                      disabled={!!matchedProduct} 
                      value={matchedProduct ? matchedProduct.category : undefined} 
                      defaultValue={editingProduct?.category} 
                      className={`w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400 appearance-none ${matchedProduct ? 'opacity-70 cursor-not-allowed italic' : ''}`}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {!matchedProduct && <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />}
                  </div>
                </div>
            </div>

            {/* 🔴 Section: Pharmacy Specifics (Batch, Expiry, Rack) */}
            <div className="bg-amber-400/5 p-5 rounded-3xl border border-amber-400/20 space-y-4">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/20 pb-2 mb-4 flex items-center gap-2"><MapPin className="w-3 h-3"/> Pharmacy Tracking</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Batch Number</label>
                    <input name="pBatch" defaultValue={editingProduct?.batchNumber} placeholder="BCH-XXXX" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white text-sm font-bold focus:border-amber-400" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] ml-2">Expiry Date</label>
                    <input name="pExpiry" type="date" defaultValue={editingProduct?.expiryDate} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-rose-400 text-sm font-bold focus:border-amber-400 uppercase" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Rack & Shelf Location</label>
                  <input name="pRack" defaultValue={editingProduct?.rackLocation} placeholder="e.g. Rack-B, Shelf-04" className="w-full px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white text-sm font-bold focus:border-amber-400" />
                </div>
            </div>

            {/* 🔴 Section: Supplier & Payment */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-1"><Truck className="w-3 h-3 text-amber-500" /> Supplier</label>
                  <div className="relative">
                    <select name="pSupplier" className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm font-bold focus:border-amber-400 appearance-none">
                      <option value="">(Cash Buy)</option>
                      {suppliers.filter(s => s.storeId === currentStore.id).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-500" /> Paid Amount</label>
                  <input name="pPaidAmount" type="number" step="0.01" defaultValue={0} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-emerald-400 text-sm font-black focus:border-amber-400" />
                </div>
              </div>
            </div>

            {/* 🔴 Section: Quantity, Units & Pricing */}
            <div className="bg-slate-800/30 p-5 rounded-3xl border border-slate-700/50 space-y-4">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700/50 pb-2 mb-4">Stock & Pricing (Base Unit)</h4>
               
               {!matchedProduct && (
                 <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-700/30">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Pieces Per Box</label>
                      <input name="pBoxQty" type="number" defaultValue={editingProduct?.piecesPerBox || 1} onWheel={(e) => (e.target as HTMLInputElement).blur()} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white text-sm font-bold focus:border-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Pieces Per Strip</label>
                      <input name="pStripQty" type="number" defaultValue={editingProduct?.piecesPerStrip || 1} onWheel={(e) => (e.target as HTMLInputElement).blur()} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white text-sm font-bold focus:border-amber-400" />
                    </div>
                 </div>
               )}

              {matchedProduct ? (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] ml-2">Add Stock (Base Units)</label>
                    <input name="pNewQty" type="number" required autoFocus placeholder="+Volume" onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-4 bg-slate-800 border border-rose-500/50 rounded-2xl outline-none text-white font-black focus:border-rose-500 amber-glow shadow-[0_0_20px_rgba(244,63,94,0.1)]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Cost Per Unit ($)</label>
                    <input name="pBuyingPrice" type="number" step="0.01" required defaultValue={matchedProduct.buyingPrice} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-amber-400" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Cost Per Unit ($)</label>
                       <input name="pBuyingPrice" type="number" step="0.01" required defaultValue={editingProduct?.buyingPrice || 0} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-emerald-400 text-sm font-black focus:border-amber-400" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Sell Price/Unit ($)</label>
                       <input name="pPrice" type="number" step="0.01" required defaultValue={editingProduct?.price || 0} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-amber-400 text-sm font-black focus:border-amber-400" />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Current Total Units</label>
                      <input name="pQty" type="number" required defaultValue={editingProduct?.quantity || 0} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm font-bold focus:border-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Low Stock Alert At</label>
                      <input name="pMin" type="number" required defaultValue={editingProduct?.minThreshold || 5} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={(e) => e.target.select()} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm font-bold focus:border-amber-400" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              type="submit" 
              className={`w-full py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs shadow-2xl ${matchedProduct ? 'bg-emerald-500 text-slate-950 shadow-emerald-900/20' : 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-amber-900/20'} hover:scale-[1.02]`}
            >
              {matchedProduct ? 'Confirm Restock' : editingProduct ? 'Commit Changes' : 'Register Medicine'}
              <Zap className="w-5 h-5" />
            </button>
            <button 
              type="button" 
              onClick={() => { setIsRegistrationActive(false); resetFormState(); }} 
              className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-[2rem] font-black hover:text-white transition-all text-[10px] uppercase tracking-[0.2em] shadow-xl"
            >
              cancel
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
           <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">Live Medical Ledger</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Synchronized Inventory Base</p>
           </div>
           <div className="p-3 bg-slate-800 rounded-2xl text-amber-500 border border-slate-700 shadow-xl">
              <Database className="w-5 h-5" />
           </div>
        </div>

        <div className="p-6 border-b border-slate-800/50">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Quick search medicines..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm focus:border-amber-400/50 transition-all" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th className="px-6 py-5">Medicine</th>
                  <th className="px-6 py-5 text-center">Base Stock</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredProducts.map((p) => {
                  const expStatus = getExpiryStatus(p.expiryDate);
                  return(
                  <tr key={p.id} className="group hover:bg-slate-800/40 transition-all">
                    <td className="px-6 py-5">
                      <p className="font-bold text-white text-sm truncate max-w-[150px]">{p.name}</p>
                      <div className="flex gap-2 mt-1">
                        <p className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter">{p.sku}</p>
                        {expStatus.status !== 'GOOD' && expStatus.status !== 'UNKNOWN' && (
                           <span className={`text-[8px] px-1 rounded-sm uppercase tracking-widest font-black ${expStatus.color} ${expStatus.bg}`}>EXP Alert</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`text-sm font-black ${p.quantity <= p.minThreshold ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-amber-400 text-sm">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          onClick={() => handleCreateBarcode(p)} 
                          className="p-2 text-slate-400 hover:text-amber-400 transition-colors" 
                          title="Generate Barcode"
                         >
                          <QrCode className="w-4 h-4" />
                         </button>
                         {canEditPrices && (
                          <button onClick={() => handleEditAsset(p)} className="p-2.5 text-slate-400 hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                         )}
                         {canDelete && (
                          <button 
                            onClick={() => handleDeleteAsset(p)} 
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                         )}
                      </div>
                      <span className="group-hover:hidden">${p.price.toFixed(2)}</span>
                    </td>
                  </tr>
                )})}
              </tbody>
           </table>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 1.5s ease-in-out infinite;
        }
      `}</style>

      <BarcodeModal />
    </div>
  );
};

export default Inventory;