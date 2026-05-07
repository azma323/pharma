import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, Customer, Supplier, Store, Sale, Purchase } from '../types';
import { 
  ArrowLeftRight, Users, Truck, Package, Search, DollarSign, 
  CheckCircle2, RefreshCcw, Hash, AlertTriangle, UserCheck
} from 'lucide-react';

interface ReturnsProps {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  currentStore: Store;
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  onAddPurchase: (purchase: Omit<Purchase, 'id' | 'timestamp'>) => void;
  onUpdateStock: (id: string, updates: Partial<Product>) => void;
  onUpdateCustomerDue: (id: string, amount: number) => void;
  onUpdateSupplierDue: (id: string, amount: number) => void;
}

const Returns: React.FC<ReturnsProps> = ({
  products,
  customers,
  suppliers,
  currentStore,
  onAddSale,
  onAddPurchase,
  onUpdateStock,
  onUpdateCustomerDue,
  onUpdateSupplierDue
}) => {
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  
  // Form States
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState(''); // Customer or Supplier ID
  const [returnQty, setReturnQty] = useState(1);
  const [refundAmount, setRefundAmount] = useState(0);

  const matchedProduct = products.find(p => p.id === selectedProductId);

  // Auto-calculate refund amount when product or qty changes
  useEffect(() => {
    if (matchedProduct) {
      if (activeTab === 'CUSTOMER') {
        setRefundAmount(matchedProduct.price * returnQty);
      } else {
        setRefundAmount(matchedProduct.buyingPrice * returnQty);
      }
    } else {
      setRefundAmount(0);
    }
  }, [selectedProductId, returnQty, activeTab, matchedProduct]);

  // Reset form when switching tabs
  useEffect(() => {
    setSelectedProductId('');
    setSelectedEntityId('');
    setReturnQty(1);
    setRefundAmount(0);
  }, [activeTab]);

  const handleCustomerReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedProduct) return alert('দয়া করে একটি প্রোডাক্ট সিলেক্ট করুন।');
    if (returnQty <= 0) return alert('রিটার্ন কোয়ান্টিটি সঠিক নয়।');

    let dueAdjustment = 0;
    let cashRefund = refundAmount;

    if (selectedEntityId) {
       const customer = customers.find(c => c.id === selectedEntityId);
       if (customer && customer.totalDue > 0) {
           dueAdjustment = Math.min(refundAmount, customer.totalDue);
           cashRefund = refundAmount - dueAdjustment;
       }
    }

    // 1. Record as Negative Sale
    onAddSale({
        invoiceId: `RET-C-${Date.now().toString().slice(-6)}`,
        customerId: selectedEntityId || undefined,
        customerName: selectedEntityId ? (customers.find(c => c.id === selectedEntityId)?.name || 'Walk-in') : 'Cash Customer (Return)',
        productId: matchedProduct.id,
        productName: `[RETURNED] ${matchedProduct.name}`,
        quantity: -returnQty,
        buyingPrice: matchedProduct.buyingPrice,
        unitPrice: matchedProduct.price,
        discount: 0,
        totalPrice: -refundAmount,
        amountPaid: -cashRefund,
        amountDue: -dueAdjustment,
        paymentMethod: 'Cash',
        storeId: currentStore.id
    });

    // 2. Increase Stock
    onUpdateStock(matchedProduct.id, { quantity: matchedProduct.quantity + returnQty });

    // 3. Adjust Customer Due (Decrease due if they owed us)
    if (dueAdjustment > 0 && selectedEntityId) {
        onUpdateCustomerDue(selectedEntityId, -dueAdjustment);
    }

    alert(`Customer Return Successful!\n\nStock Added: +${returnQty}\nDue Adjusted: $${dueAdjustment.toFixed(2)}\nCash Refunded: $${cashRefund.toFixed(2)}`);
    setSelectedProductId(''); setReturnQty(1); setSelectedEntityId('');
  };

  const handleSupplierReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedProduct) return alert('দয়া করে একটি প্রোডাক্ট সিলেক্ট করুন।');
    if (returnQty <= 0) return alert('রিটার্ন কোয়ান্টিটি সঠিক নয়।');
    if (returnQty > matchedProduct.quantity) return alert(`স্টকে পর্যাপ্ত প্রোডাক্ট নেই! বর্তমানে আছে: ${matchedProduct.quantity}`);
    if (!selectedEntityId) return alert('দয়া করে একজন সাপ্লায়ার সিলেক্ট করুন।');

    let dueAdjustment = 0;
    let cashReceived = refundAmount;

    const supplier = suppliers.find(s => s.id === selectedEntityId);
    if (supplier && supplier.totalDue > 0) {
        dueAdjustment = Math.min(refundAmount, supplier.totalDue);
        cashReceived = refundAmount - dueAdjustment;
    }

    // 1. Record as Negative Purchase
    onAddPurchase({
        poNumber: `RET-S-${Date.now().toString().slice(-6)}`,
        supplierId: selectedEntityId,
        supplierName: supplier?.name || 'Unknown',
        productId: matchedProduct.id,
        productName: `[RETURN TO SUPPLIER] ${matchedProduct.name}`,
        quantity: -returnQty,
        unitCost: matchedProduct.buyingPrice,
        totalCost: -refundAmount,
        amountPaid: -cashReceived,
        amountDue: -dueAdjustment,
        storeId: currentStore.id
    });

    // 2. Decrease Stock
    onUpdateStock(matchedProduct.id, { quantity: matchedProduct.quantity - returnQty });

    // 3. Adjust Supplier Due (Decrease due if we owed them)
    if (dueAdjustment > 0) {
        onUpdateSupplierDue(selectedEntityId, -dueAdjustment);
    }

    alert(`Supplier Return Successful!\n\nStock Reduced: -${returnQty}\nDue Adjusted: $${dueAdjustment.toFixed(2)}\nCash Received: $${cashReceived.toFixed(2)}`);
    setSelectedProductId(''); setReturnQty(1); setSelectedEntityId('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-8 pb-12">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
             <RefreshCcw className="w-8 h-8 text-indigo-400" /> Return Center
          </h1>
          <p className="text-slate-500 font-medium tracking-tight mt-1">Manage inward and outward product returns</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-full md:w-fit">
         <button 
           onClick={() => setActiveTab('CUSTOMER')} 
           className={`flex-1 md:w-48 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'CUSTOMER' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
         >
           <Users className="w-4 h-4" /> Customer
         </button>
         <button 
           onClick={() => setActiveTab('SUPPLIER')} 
           className={`flex-1 md:w-48 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-orange-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
         >
           <Truck className="w-4 h-4" /> Supplier
         </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ========================================================
            CUSTOMER RETURN FORM (INWARD)
        ======================================================== */}
        {activeTab === 'CUSTOMER' && (
          <motion.div 
            key="customer-tab"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl"
          >
            <div className="mb-8 flex items-center gap-4 border-b border-slate-800 pb-6">
               <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><ArrowLeftRight className="w-6 h-6"/></div>
               <div>
                 <h2 className="text-xl font-black text-white uppercase tracking-widest">Receive from Customer</h2>
                 <p className="text-xs text-slate-500 font-bold mt-1">Product will be ADDED to stock. Money will be REFUNDED or adjusted from due.</p>
               </div>
            </div>

            <form onSubmit={handleCustomerReturn} className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Search Product to Return</label>
                   <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                     <select required value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-emerald-400 appearance-none">
                        <option value="">-- Select Product --</option>
                        {products.filter(p => p.storeId === currentStore.id).map(p => (
                          <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                        ))}
                     </select>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Customer Profile (Optional)</label>
                   <div className="relative">
                     <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                     <select value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-emerald-400 appearance-none">
                        <option value="">Walk-in Customer (No Due Adjustment)</option>
                        {customers.filter(c => c.storeId === currentStore.id).map(c => (
                          <option key={c.id} value={c.id}>{c.name} (Due: ${c.totalDue})</option>
                        ))}
                     </select>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Return Quantity</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input required type="number" min="1" value={returnQty} onChange={e => setReturnQty(parseInt(e.target.value)||1)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-emerald-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Total Refund Value</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input required type="number" step="0.01" value={refundAmount} onChange={e => setRefundAmount(parseFloat(e.target.value)||0)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-black focus:border-emerald-400" />
                      </div>
                    </div>
                 </div>
               </div>

               <div className="flex flex-col h-full space-y-4">
                 <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex-1">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Refund Breakdown</h4>
                    {selectedEntityId && customers.find(c=>c.id===selectedEntityId)?.totalDue ? (
                       <div className="space-y-3">
                         <p className="flex justify-between text-xs font-bold text-slate-300"><span>Current Customer Due:</span> <span className="text-rose-400">${customers.find(c=>c.id===selectedEntityId)?.totalDue}</span></p>
                         <p className="flex justify-between text-xs font-bold text-slate-300"><span>Will Adjust Due:</span> <span className="text-emerald-400">${Math.min(refundAmount, customers.find(c=>c.id===selectedEntityId)?.totalDue || 0).toFixed(2)}</span></p>
                         <div className="border-t border-slate-800 pt-3 mt-2">
                            <p className="flex justify-between text-sm font-black text-white"><span>Cash to Return:</span> <span className="text-amber-400">${Math.max(0, refundAmount - (customers.find(c=>c.id===selectedEntityId)?.totalDue || 0)).toFixed(2)}</span></p>
                         </div>
                       </div>
                    ) : (
                       <div className="flex items-center justify-between h-full pb-4">
                         <span className="text-xs font-bold text-slate-400">Direct Cash Refund:</span>
                         <span className="text-2xl font-black text-amber-400">${refundAmount.toFixed(2)}</span>
                       </div>
                    )}
                 </div>
                 
                 <button type="submit" className="w-full py-5 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 flex justify-center items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> Process Customer Return
                 </button>
               </div>
            </form>
          </motion.div>
        )}

        {/* ========================================================
            SUPPLIER RETURN FORM (OUTWARD)
        ======================================================== */}
        {activeTab === 'SUPPLIER' && (
          <motion.div 
            key="supplier-tab"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl"
          >
            <div className="mb-8 flex items-center gap-4 border-b border-slate-800 pb-6">
               <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-400"><ArrowLeftRight className="w-6 h-6"/></div>
               <div>
                 <h2 className="text-xl font-black text-white uppercase tracking-widest">Return to Supplier</h2>
                 <p className="text-xs text-slate-500 font-bold mt-1">Product will be DEDUCTED from stock. You will receive REFUND or due will be adjusted.</p>
               </div>
            </div>

            <form onSubmit={handleSupplierReturn} className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Search Product to Return</label>
                   <div className="relative">
                     <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                     <select required value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-orange-400 appearance-none">
                        <option value="">-- Select Product --</option>
                        {products.filter(p => p.storeId === currentStore.id && p.quantity > 0).map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
                        ))}
                     </select>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Select Supplier</label>
                   <div className="relative">
                     <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                     <select required value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-orange-400 appearance-none">
                        <option value="">-- Select Supplier --</option>
                        {suppliers.filter(s => s.storeId === currentStore.id).map(s => (
                          <option key={s.id} value={s.id}>{s.name} (Due to them: ${s.totalDue})</option>
                        ))}
                     </select>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Return Quantity</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input required type="number" min="1" max={matchedProduct?.quantity || 1} value={returnQty} onChange={e => setReturnQty(parseInt(e.target.value)||1)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-orange-400 font-black focus:border-orange-400" />
                      </div>
                      {matchedProduct && <p className="text-[9px] text-rose-400 font-bold ml-2">Max limit: {matchedProduct.quantity}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Total Refund Received</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input required type="number" step="0.01" value={refundAmount} onChange={e => setRefundAmount(parseFloat(e.target.value)||0)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-black focus:border-orange-400" />
                      </div>
                    </div>
                 </div>
               </div>

               <div className="flex flex-col h-full space-y-4">
                 <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex-1">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Settlement Breakdown</h4>
                    {selectedEntityId && suppliers.find(s=>s.id===selectedEntityId)?.totalDue ? (
                       <div className="space-y-3">
                         <p className="flex justify-between text-xs font-bold text-slate-300"><span>Current Owed to Supplier:</span> <span className="text-rose-400">${suppliers.find(s=>s.id===selectedEntityId)?.totalDue}</span></p>
                         <p className="flex justify-between text-xs font-bold text-slate-300"><span>Will Adjust Due:</span> <span className="text-emerald-400">${Math.min(refundAmount, suppliers.find(s=>s.id===selectedEntityId)?.totalDue || 0).toFixed(2)}</span></p>
                         <div className="border-t border-slate-800 pt-3 mt-2">
                            <p className="flex justify-between text-sm font-black text-white"><span>Cash to Receive:</span> <span className="text-amber-400">${Math.max(0, refundAmount - (suppliers.find(s=>s.id===selectedEntityId)?.totalDue || 0)).toFixed(2)}</span></p>
                         </div>
                       </div>
                    ) : (
                       <div className="flex items-center justify-between h-full pb-4">
                         <span className="text-xs font-bold text-slate-400">Direct Cash Receive:</span>
                         <span className="text-2xl font-black text-amber-400">${refundAmount.toFixed(2)}</span>
                       </div>
                    )}
                    <div className="mt-4 bg-orange-500/10 p-3 rounded-xl border border-orange-500/20 flex items-start gap-2">
                       <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                       <p className="text-[9px] text-orange-400/80 font-bold uppercase tracking-widest leading-relaxed">Warning: This will permanently remove {returnQty} unit(s) from your active inventory stock.</p>
                    </div>
                 </div>
                 
                 <button type="submit" className="w-full py-5 bg-orange-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-orange-400 transition-all shadow-xl shadow-orange-500/20 flex justify-center items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> Process Supplier Return
                 </button>
               </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Returns;