import React, { useState, useMemo } from 'react';
import { Purchase, Supplier, Product, Store, Expense } from '../types';
import { 
  ShoppingBag, Search, Plus, Truck, DollarSign, Trash2, Download,
  Calendar, Hash, ArrowRight, Package, Check, X, AlertOctagon,
  RotateCcw, Printer, Pill, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PurchasesProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  currentStore: Store;
  onAddPurchase: (purchase: Omit<Purchase, 'id' | 'timestamp'>) => void | Promise<void>;
  onUpdateStock: (id: string, updates: Partial<Product>) => void | Promise<void>;
  onUpdateSupplierDue: (id: string, amount: number) => void | Promise<void>;
  onDeletePurchase: (id: string) => void | Promise<void>;
  onAddExpense?: (expense: Omit<Expense, 'id' | 'timestamp'>) => void | Promise<void>;
  canDelete: boolean;
}

const Purchases: React.FC<PurchasesProps> = ({ 
  purchases, suppliers, products, currentStore, 
  onAddPurchase, onUpdateStock, onUpdateSupplierDue, onDeletePurchase, onAddExpense, canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // New Purchase State
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  
  // 🔴 Pharmacy Specific State
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Return State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [purchaseToReturn, setPurchaseToReturn] = useState<Purchase | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState<'EXPIRY' | 'DAMAGE'>('EXPIRY');

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPoForPrint, setSelectedPoForPrint] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const handleProductSelect = (pid: string) => {
    setProductId(pid);
    const p = products.find(prod => prod.id === pid);
    if (p) {
      setUnitCost(p.buyingPrice);
    }
  };

  const totalCost = quantity * unitCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !productId || quantity <= 0) return alert("Invalid inputs.");
    setIsLoading(true);

    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      const product = products.find(p => p.id === productId);
      if (!supplier || !product) throw new Error("Supplier or Product not found");

      const amountDue = totalCost - amountPaid;
      const poNumber = `PO-${Date.now().toString().slice(-6)}`;

      await onAddPurchase({
        poNumber,
        supplierId,
        supplierName: supplier.name,
        productId,
        productName: product.name,
        quantity,
        unitCost,
        totalCost,
        amountPaid,
        amountDue,
        batchNumber: batchNumber || undefined, // 🔴 Pharmacy Feature
        expiryDate: expiryDate || undefined,   // 🔴 Pharmacy Feature
        storeId: currentStore.id
      });

      await onUpdateStock(productId, { 
        quantity: product.quantity + quantity,
        buyingPrice: unitCost,
        batchNumber: batchNumber || product.batchNumber, // Update current batch
        expiryDate: expiryDate || product.expiryDate     // Update current expiry
      });
      
      if (amountDue > 0) {
        await onUpdateSupplierDue(supplierId, amountDue);
      }
      
      if (amountPaid > 0 && onAddExpense) {
        await onAddExpense({
          storeId: currentStore.id,
          category: "Inventory Purchase",
          amount: amountPaid,
          description: `Advance Payment for PO: ${poNumber} to ${supplier.name}`
        });
      }

      setIsModalOpen(false);
      setSupplierId(''); setProductId(''); setQuantity(1); setAmountPaid(0); setUnitCost(0); setBatchNumber(''); setExpiryDate('');
    } catch (error) {
      console.error(error);
      alert("Submission failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const getReturnableQty = (purchase: Purchase) => {
    if (!purchase) return 0;
    const returns = purchases.filter(p => p.poNumber === `RET-${purchase.poNumber}` && p.productId === purchase.productId);
    return purchase.quantity - returns.reduce((acc, curr) => acc + Math.abs(curr.quantity), 0);
  };

  const handleOpenReturn = (purchase: Purchase) => {
    const maxQty = getReturnableQty(purchase);
    if (maxQty <= 0) return alert('All items from this PO have already been returned.');
    setPurchaseToReturn(purchase);
    setReturnQty(1);
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseToReturn) return;
    const maxQty = getReturnableQty(purchaseToReturn);
    if (returnQty <= 0 || returnQty > maxQty) return alert(`Invalid quantity. Max: ${maxQty}`);
    
    setIsLoading(true);
    try {
      const returnAmount = returnQty * purchaseToReturn.unitCost;
      const supplier = suppliers.find(s => s.id === purchaseToReturn.supplierId);
      let dueAdjustment = 0;
      let cashRefund = 0;

      if (supplier && supplier.totalDue > 0) {
          if (returnAmount >= supplier.totalDue) {
              dueAdjustment = supplier.totalDue;
              cashRefund = returnAmount - supplier.totalDue;
          } else {
              dueAdjustment = returnAmount;
          }
      } else {
          cashRefund = returnAmount;
      }

      await onAddPurchase({
        poNumber: `RET-${purchaseToReturn.poNumber}`,
        supplierId: purchaseToReturn.supplierId,
        supplierName: purchaseToReturn.supplierName,
        productId: purchaseToReturn.productId,
        productName: `[${returnReason}] ${purchaseToReturn.productName}`,
        quantity: -returnQty,
        unitCost: purchaseToReturn.unitCost,
        totalCost: -returnAmount,
        amountPaid: -cashRefund,
        amountDue: -dueAdjustment,
        batchNumber: purchaseToReturn.batchNumber,
        storeId: currentStore.id
      });

      const product = products.find(p => p.id === purchaseToReturn.productId);
      if (product) await onUpdateStock(product.id, { quantity: product.quantity - returnQty });
      if (dueAdjustment > 0) await onUpdateSupplierDue(purchaseToReturn.supplierId, -dueAdjustment);
      if (cashRefund > 0 && onAddExpense) {
          await onAddExpense({
              storeId: currentStore.id,
              category: "Supplier Refund",
              amount: -cashRefund,
              description: `Cash refund received from ${purchaseToReturn.supplierName} for PO: ${purchaseToReturn.poNumber}`
          });
      }

      setIsReturnModalOpen(false);
      setPurchaseToReturn(null);
    } catch (error) {
       alert("Return failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, poNumber: string) => {
    if (poNumber.startsWith('PAY-')) return alert("Supplier payments cannot be deleted from here.");
    if (window.confirm("Delete this purchase record permanently? This will NOT adjust stock or dues automatically.")) {
      try {
        await onDeletePurchase(id);
      } catch (error) {
        alert("Deletion failed.");
      }
    }
  };

  const filteredPurchases = useMemo(() => {
    return purchases
      .filter(p => p.storeId === currentStore.id)
      .filter(p => 
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [purchases, currentStore.id, searchTerm]);

  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    let totalSpent = 0;
    let pendingDues = 0;
    let totalReturns = 0;
    
    filteredPurchases.forEach(p => {
      if (p.poNumber.startsWith('PAY-')) return;
      if (p.poNumber.startsWith('RET-')) {
          totalReturns += Math.abs(p.totalCost);
      } else {
          totalSpent += p.amountPaid;
          pendingDues += p.amountDue;
      }
    });
    
    const uniqueSuppliers = new Set(filteredPurchases.filter(p => !p.poNumber.startsWith('PAY-') && !p.poNumber.startsWith('RET-')).map(p => p.supplierId)).size;
    return { totalSpent, pendingDues, totalReturns, uniqueSuppliers };
  }, [filteredPurchases]);

  const exportToCSV = () => {
    const headers = ['PO Number', 'Supplier', 'Medicine', 'Batch', 'Expiry', 'Qty', 'Unit Cost', 'Total Cost', 'Paid', 'Due', 'Date'];
    const data = filteredPurchases.map(p => {
      const isPayment = p.poNumber.startsWith('PAY-');
      const isReturn = p.poNumber.startsWith('RET-');
      return [
        p.poNumber,
        p.supplierName.replace(/,/g, ';'),
        isPayment ? 'PAYMENT SETTLED' : p.productName.replace(/,/g, ';'),
        isPayment ? '-' : (p.batchNumber || 'N/A'),
        isPayment ? '-' : (p.expiryDate || 'N/A'),
        isPayment ? '-' : p.quantity,
        isPayment ? '-' : p.unitCost.toFixed(2),
        isPayment ? '-' : p.totalCost.toFixed(2),
        isReturn ? '-' : p.amountPaid.toFixed(2),
        isReturn ? '-' : p.amountDue.toFixed(2),
        new Date(p.timestamp).toLocaleDateString()
      ];
    });
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pharmacy_purchases_${currentStore.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (poNumber: string) => {
    setSelectedPoForPrint(poNumber);
    setShowPrintModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Medicine Procurement</h1>
          <p className="text-slate-500 font-medium">Purchase orders & Company Returns for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/10 uppercase tracking-widest text-xs">
            <ShoppingBag className="w-5 h-5 stroke-[3px]" /> Order Medicine
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-emerald-400/10 rounded-xl flex items-center justify-center text-emerald-400"><DollarSign className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Paid (Stock)</p>
          </div>
          <h3 className="text-2xl font-black text-emerald-400">${stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-rose-400/10 rounded-xl flex items-center justify-center text-rose-400"><AlertOctagon className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending PO Dues</p>
          </div>
          <h3 className="text-2xl font-black text-rose-400">${stats.pendingDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-orange-400/10 rounded-xl flex items-center justify-center text-orange-400"><RotateCcw className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Value Returned</p>
          </div>
          <h3 className="text-2xl font-black text-orange-400">${stats.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-400/10 rounded-xl flex items-center justify-center text-blue-400"><Truck className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Companies</p>
          </div>
          <h3 className="text-2xl font-black text-white">{stats.uniqueSuppliers}</h3>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
            <input type="text" placeholder="Search PO, medicine or company..." className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 focus:border-amber-400 transition-all amber-glow" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-900/80">
                <th className="px-6 py-5">Date & PO</th>
                <th className="px-6 py-5">Company / Supplier</th>
                <th className="px-6 py-5">Medicine Info</th>
                <th className="px-6 py-5 text-right">Settlement</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedPurchases.map(p => {
                const isPayment = p.poNumber.startsWith('PAY-');
                const isReturn = p.poNumber.startsWith('RET-');
                
                return (
                  <tr key={p.id} className={`group hover:bg-slate-800/40 transition-colors ${isPayment ? 'bg-emerald-500/5' : isReturn ? 'bg-orange-500/5' : ''}`}>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-400 text-xs mb-1">{new Date(p.timestamp).toLocaleDateString('en-GB')}</p>
                      <p className={`text-xs font-black tracking-widest ${isReturn ? 'text-orange-400' : isPayment ? 'text-emerald-400' : 'text-white'}`}>{p.poNumber}</p>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-300 text-sm">
                      {p.supplierName}
                    </td>
                    <td className="px-6 py-5">
                      {isPayment ? (
                         <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">Payment Settled</span>
                      ) : (
                         <div className="flex flex-col gap-1">
                            <span className={`text-sm font-bold ${isReturn ? 'text-orange-400 italic' : 'text-slate-200'}`}>{p.productName}</span>
                            <div className="flex gap-2">
                               <span className="text-[9px] text-slate-500 font-bold uppercase">Qty: <span className="text-amber-400">{isReturn ? p.quantity : p.quantity}</span></span>
                               {p.batchNumber && <span className="text-[9px] text-slate-500 font-bold uppercase border-l border-slate-700 pl-2">Batch: {p.batchNumber}</span>}
                            </div>
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isPayment ? (
                         <span className="text-emerald-400 font-black">+ ${p.amountPaid.toFixed(2)}</span>
                      ) : isReturn ? (
                         <div className="text-orange-400 font-black">
                           Refund: ${Math.abs(p.totalCost).toFixed(2)}
                           {p.amountDue < 0 && <p className="text-[9px] mt-1 text-slate-400">Due Adj: ${Math.abs(p.amountDue).toFixed(2)}</p>}
                         </div>
                      ) : (
                         <div>
                            <p className="font-black text-emerald-400">${p.totalCost.toFixed(2)}</p>
                            {p.amountDue > 0 && <p className="text-[9px] text-rose-400 font-black uppercase tracking-widest mt-1">Due: ${p.amountDue.toFixed(2)}</p>}
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isPayment && !isReturn && (
                          <button onClick={() => handleOpenReturn(p)} title="Return Medicine to Company" className="p-2 text-slate-600 hover:text-orange-400"><RotateCcw className="w-4 h-4" /></button>
                        )}
                        {!isPayment && !isReturn && (
                          <button onClick={() => handlePrint(p.poNumber)} className="p-2 text-slate-600 hover:text-amber-400"><Printer className="w-4 h-4" /></button>
                        )}
                        {canDelete && !isPayment && (
                          <button onClick={() => handleDelete(p.id, p.poNumber)} className="p-2 text-slate-600 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedPurchases.length === 0 && <tr><td colSpan={5} className="px-6 py-20 text-center opacity-30 grayscale"><ShoppingBag className="w-12 h-12 mx-auto text-slate-600 mb-4" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No procurement history</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <div><h2 className="text-xl font-black text-white uppercase tracking-widest">New Procurement</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Add Medical Stock</p></div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-2 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2"><Truck className="w-3 h-3 text-amber-500"/> Company / Supplier</label>
                      <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-bold focus:border-amber-400 appearance-none">
                        <option value="">Select Company...</option>
                        {suppliers.filter(s => s.storeId === currentStore.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2"><Package className="w-3 h-3 text-amber-500"/> Medicine Name</label>
                      <select required value={productId} onChange={e => handleProductSelect(e.target.value)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-bold focus:border-amber-400 appearance-none">
                        <option value="">Select Medicine...</option>
                        {products.filter(p => p.storeId === currentStore.id).map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} left)</option>)}
                      </select>
                    </div>
                  </div>

                  {/* 🔴 Pharmacy Section: Batch & Expiry 🔴 */}
                  <div className="bg-amber-400/5 border border-amber-400/20 p-5 rounded-2xl grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Batch Number</label>
                       <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="BCH-XXXX" className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white font-bold focus:border-amber-400" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Expiry Date</label>
                       <input type="date" required value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-rose-400 uppercase font-bold focus:border-amber-400" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Base Quantity Received</label>
                      <input required type="number" min="1" value={quantity} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-black focus:border-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Cost Per Base Unit ($)</label>
                      <input required type="number" step="0.01" value={unitCost} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-amber-400" />
                    </div>
                  </div>

                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                     <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Invoice Value</span>
                        <span className="text-xl font-black text-white">${totalCost.toFixed(2)}</span>
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-3 h-3"/> Amount Paid to Company ($)</label>
                       <input type="number" step="0.01" max={totalCost} value={amountPaid} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)} className="w-full px-5 py-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl outline-none text-emerald-400 font-black focus:border-emerald-400 transition-colors" />
                       <p className="text-[10px] font-bold text-rose-500 mt-1 text-right">Company Due Will Be: ${(totalCost - amountPaid).toFixed(2)}</p>
                     </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900">
                <button type="submit" form="purchase-form" disabled={isLoading} className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-900/20 hover:scale-[1.02] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                  {isLoading ? 'Processing...' : 'Confirm Stock Entry'} <ArrowRight className="w-5 h-5"/>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReturnModalOpen && purchaseToReturn && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative">
               <button onClick={() => setIsReturnModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
               <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-500"/> Return to Company</h2>
               <p className="text-xs text-slate-400 font-bold mb-6">Original PO: {purchaseToReturn.poNumber}</p>

               <form onSubmit={handleReturnSubmit} className="space-y-6">
                   <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 mb-6">
                       <p className="text-sm font-bold text-white mb-1">{purchaseToReturn.productName}</p>
                       <p className="text-xs text-slate-400">Unit Cost: ${(purchaseToReturn.unitCost).toFixed(2)} / base unit</p>
                   </div>

                   <div className="space-y-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Reason for Return</label>
                       <select value={returnReason} onChange={e => setReturnReason(e.target.value as any)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-bold focus:border-orange-500 appearance-none">
                         <option value="EXPIRY">Expired / Near Expiry</option>
                         <option value="DAMAGE">Damaged / Broken Seal</option>
                       </select>
                     </div>

                     <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Return Base Quantity</label>
                         <input type="number" min="1" max={getReturnableQty(purchaseToReturn)} value={returnQty} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setReturnQty(parseInt(e.target.value) || 1)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-orange-400 font-black focus:border-orange-500" />
                         <p className="text-[10px] text-orange-500/80 font-bold text-right mr-2 mt-1">Max returnable: {getReturnableQty(purchaseToReturn)} units</p>
                     </div>
                   </div>

                   <button type="submit" disabled={isLoading} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-orange-600 transition-colors disabled:opacity-50">Confirm Company Return</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintModal && selectedPoForPrint && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-print">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrintModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white text-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-black uppercase tracking-widest text-xs text-slate-500">PO Voucher</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="bg-slate-950 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors"><Printer className="w-4 h-4" /> Print</button>
                  <button onClick={() => setShowPrintModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 print-content" id="printable-po">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2">{currentStore.name}</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{currentStore.location}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black uppercase tracking-tighter mb-1">{selectedPoForPrint.startsWith('RET-') ? 'RETURN VOUCHER' : 'PURCHASE ORDER'}</h2>
                    <p className="text-xs font-bold text-slate-400">{selectedPoForPrint}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Company / Supplier</p>
                    <p className="font-black text-lg">{purchases.find(p => p.poNumber === selectedPoForPrint)?.supplierName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Issue Date</p>
                    <p className="font-black text-lg">{new Date(purchases.find(p => p.poNumber === selectedPoForPrint)?.timestamp || '').toLocaleDateString()}</p>
                  </div>
                </div>

                <table className="w-full mb-12">
                  <thead>
                    <tr className="border-b-2 border-slate-950 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-4 text-left">Medicine & Batch</th><th className="py-4 text-center">Base Qty</th><th className="py-4 text-right">Unit Cost</th><th className="py-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.filter(p => p.poNumber === selectedPoForPrint).map(item => (
                      <tr key={item.id}>
                        <td className="py-4">
                           <p className="font-bold">{item.productName}</p>
                           {item.batchNumber && <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">BCH: {item.batchNumber}</p>}
                        </td>
                        <td className="py-4 text-center font-bold">{Math.abs(item.quantity)}</td>
                        <td className="py-4 text-right font-bold">${item.unitCost.toFixed(2)}</td>
                        <td className="py-4 text-right font-black">${Math.abs(item.totalCost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">{selectedPoForPrint.startsWith('RET-') ? 'Refund Value' : 'Subtotal'}</span>
                      <span className="font-black">${Math.abs(purchases.filter(p => p.poNumber === selectedPoForPrint).reduce((acc, curr) => acc + curr.totalCost, 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">{selectedPoForPrint.startsWith('RET-') ? 'Due Adj.' : 'Paid'}</span>
                      <span className="font-black text-emerald-600">
                         ${Math.abs(purchases.filter(p => p.poNumber === selectedPoForPrint).reduce((acc, curr) => acc + (selectedPoForPrint.startsWith('RET-') ? curr.amountDue : (curr.amountPaid || 0)), 0)).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t-2 border-slate-950 pt-3 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Current Balance</span>
                      <span className="text-2xl font-black">
                         ${suppliers.find(s => s.id === purchases.find(p => p.poNumber === selectedPoForPrint)?.supplierId)?.totalDue.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-20 pt-12 border-t border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Thank you for your business</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
};

export default Purchases;