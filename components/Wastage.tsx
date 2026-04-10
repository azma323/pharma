import React, { useState } from 'react';
import { Product, Store, Expense } from '../types';
import { Trash2, Search, AlertCircle, CheckCircle2, History, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WastageProps {
  products: Product[];
  currentStore: Store;
  expenses: Expense[];
  onUpdateStock: (id: string, updates: Partial<Product>) => void | Promise<void>;
  onAddExpense: (expense: any) => void | Promise<void>;
  onDeleteExpense: (id: string) => void | Promise<void>;
  canDelete?: boolean;
}

const Wastage: React.FC<WastageProps> = ({ 
  products, 
  currentStore, 
  expenses, 
  onUpdateStock, 
  onAddExpense,
  onDeleteExpense,
  canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wasteQuantity, setWasteQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const storeProducts = products.filter(p => p.storeId === currentStore.id);
  const searchResults = storeProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const wastageHistory = expenses
    .filter(e => e.category === 'Wastage' && e.storeId === currentStore.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !wasteQuantity || wasteQuantity <= 0) return;

    if (wasteQuantity > selectedProduct.quantity) {
      alert("Error: Wastage quantity cannot be greater than current stock!");
      return;
    }

    setIsLoading(true);

    try {
      const totalLoss = Number(wasteQuantity) * selectedProduct.buyingPrice;

      // ১. ডাটাবেসে স্টক আপডেট করা
      await onUpdateStock(selectedProduct.id, {
        quantity: selectedProduct.quantity - Number(wasteQuantity)
      });

      // ২. ডাটাবেসে খরচের (Wastage) হিসাব যুক্ত করা
      await onAddExpense({
        storeId: currentStore.id,
        amount: totalLoss,
        category: 'Wastage',
        description: `Wastage: ${selectedProduct.name} (${wasteQuantity} units due to: ${reason || 'Damaged/Lost'})`,
      });

      setSuccessMsg(`Successfully logged ${wasteQuantity} units of ${selectedProduct.name} as wastage.`);
      setSelectedProduct(null);
      setWasteQuantity('');
      setSearchTerm('');
      setReason('');
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      alert(`Wastage logging failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 ডিলিট এবং স্টক রিস্টোর করার নতুন ফাংশন 🔴
  const handleDeleteWastage = async (expenseId: string, description: string) => {
    if (!window.confirm("Are you sure you want to delete this record? The wasted stock will be restored to inventory.")) return;

    setIsLoading(true);
    try {
      // স্ট্রিং থেকে প্রোডাক্টের নাম এবং কোয়ান্টিটি বের করার লজিক
      const match = description.match(/Wastage: (.*?) \((\d+) units due to:/);
      if (match) {
        const productName = match[1];
        const qtyToRestore = parseInt(match[2]);
        
        const product = products.find(p => p.name === productName && p.storeId === currentStore.id);
        if (product) {
          await onUpdateStock(product.id, { quantity: product.quantity + qtyToRestore });
        } else {
          alert("Warning: Stock could not be restored because the original product was not found in inventory.");
        }
      }
      
      await onDeleteExpense(expenseId);
      setSuccessMsg("Wastage record deleted and stock restored successfully!");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      alert(`Deletion failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-500">
          <Trash2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Log Wastage</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Deduct damaged or lost products and view wastage history.</p>
        </div>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-bold">{successMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Search */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4">1. Select Product</h2>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by name or SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white focus:border-amber-400 outline-none transition-colors amber-glow"
            />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {searchTerm && searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${selectedProduct?.id === p.id ? 'bg-amber-400/10 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                <div>
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tighter">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">Stock: {p.quantity}</p>
                  <p className="text-[10px] text-slate-500">Buy: ${p.buyingPrice.toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4">2. Wastage Details</h2>
          {!selectedProduct ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl opacity-50">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Select a product first</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Target Asset</p>
                  <p className="text-sm font-black text-white">{selectedProduct.name}</p>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 text-slate-600 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Wasted Quantity</label>
                <input 
                  type="number" required min="1" max={selectedProduct.quantity}
                  value={wasteQuantity} onChange={(e) => setWasteQuantity(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white font-black focus:border-rose-500 outline-none mt-1 amber-glow"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Reason (Optional)</label>
                <input 
                  type="text" placeholder="e.g., Damaged, Expired, Lost"
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm focus:border-rose-500 outline-none mt-1"
                />
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Loss Value</p>
                  <p className="text-xl font-black text-rose-500">${(Number(wasteQuantity) * selectedProduct.buyingPrice || 0).toFixed(2)}</p>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Wastage History Table */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Wastage History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest">
                <th className="p-4 font-black">Date</th>
                <th className="p-4 font-black">Details</th>
                <th className="p-4 font-black text-right">Loss Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {wastageHistory.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500 font-bold text-xs uppercase tracking-widest opacity-30">No wastage recorded yet</td>
                </tr>
              ) : (
                wastageHistory.map(w => (
                  <tr key={w.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
                    <td className="p-4 font-medium text-slate-300">
                      {new Date(w.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-slate-400 text-xs italic">
                      {w.description}
                    </td>
                    <td className="p-4 font-black text-rose-500 text-right">
                      <div className="flex items-center justify-end gap-3">
                         <span>${w.amount.toFixed(2)}</span>
                         {canDelete && (
                           <button 
                             onClick={() => handleDeleteWastage(w.id, w.description)} 
                             className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                             title="Delete Record & Restore Stock"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Wastage;