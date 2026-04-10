import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sale, Product, Store, User, UserRole, Customer, Expense } from '../types';
import { 
  ShoppingCart, Search, User as UserIcon, Hash, DollarSign, Trash2, X,
  ArrowRight, ScanLine, CameraOff, Check, History, LayoutDashboard,
  TrendingUp, Printer, Download, CreditCard, ChevronLeft, ChevronRight,
  RotateCcw, AlertOctagon, Zap, ChevronDown, Pill, FileText, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SalesProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  expenses: Expense[];
  currentStore: Store;
  currentUser: User;
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  onUpdateSale: (id: string, updates: Partial<Sale>) => void;
  onUpdateStock: (id: string, updates: Partial<Product>) => void;
  onUpdateCustomerDue: (id: string, amount: number) => void;
  onDeleteSale: (id: string) => void;
  canDelete: boolean;
}

const Sales: React.FC<SalesProps> = ({ 
  sales, products, customers, expenses,
  currentStore, currentUser, onAddSale, onUpdateSale,
  onUpdateStock, onUpdateCustomerDue, onDeleteSale, canDelete
}) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMethodBreakdown, setShowMethodBreakdown] = useState(false); 
  
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 

  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  // Form State
  const [skuId, setSkuId] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  
  // Pharmacy Features State
  const [saleUnit, setSaleUnit] = useState<'PIECE' | 'STRIP' | 'BOX'>('PIECE');
  const [prescriptionRef, setPrescriptionRef] = useState('');
  
  const [quantity, setQuantity] = useState(1); 
  const [unitPrice, setUnitPrice] = useState(0); 
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash'); 
  const [invoiceId, setInvoiceId] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<string | null>(null);

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
  const [returnQty, setReturnQty] = useState(1);

  useEffect(() => {
    if (isSessionActive && !invoiceId) {
      const year = new Date().getFullYear();
      const count = sales.length + 1;
      setInvoiceId(`INV-${year}-${String(count).padStart(3, '0')}`);
    }
  }, [isSessionActive, sales.length, invoiceId]);

  useEffect(() => setCurrentPage(1), [searchTerm, filterDate]);

  useEffect(() => {
    if (matchedProduct) {
      let multiplier = 1;
      if (saleUnit === 'BOX' && matchedProduct.piecesPerBox) multiplier = matchedProduct.piecesPerBox;
      if (saleUnit === 'STRIP' && matchedProduct.piecesPerStrip) multiplier = matchedProduct.piecesPerStrip;
      setUnitPrice(matchedProduct.price * multiplier);
    }
  }, [saleUnit, matchedProduct]);

  const resetEntryForm = () => {
    setSkuId(''); setMatchedProduct(null); setQuantity(1); setDiscount(0); setAmountPaid(0); setScannerError(null); setPaymentMethod('Cash'); setSaleUnit('PIECE'); setPrescriptionRef('');
  };

  const safeStopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) await scannerRef.current.stop();
      } catch (err) {} finally { scannerRef.current = null; }
    }
  };

  const startScanner = async () => {
    setIsScanning(true); setScannerError(null); await safeStopScanner();
    setTimeout(async () => {
      try {
        const html5QrCode = new (window as any).Html5Qrcode("sales-scanner-reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };
        const onScanSuccess = (decodedText: string) => { handleSkuLookup(decodedText, true); setIsScanning(false); safeStopScanner(); };
        try { await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {}); } 
        catch (err1) {
          try { await html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, () => {}); } 
          catch (err2) {
            const devices = await (window as any).Html5Qrcode.getCameras();
            if (devices && devices.length > 0) await html5QrCode.start(devices[0].id, config, onScanSuccess, () => {});
            else throw new Error("Optical device unavailable.");
          }
        }
      } catch (err: any) { setScannerError(err?.message || "Scanner initialization failed."); setIsScanning(false); }
    }, 350);
  };

  const handleSkuLookup = (sku: string, isFromScanner: boolean = false) => {
    setSkuId(sku); if (!sku) { setMatchedProduct(null); return; }
    
    const product = products.find(p => (p.sku === sku || p.barcodeId === sku || p.name.toLowerCase() === sku.toLowerCase()) && p.storeId === currentStore.id);
    
    if (product) { 
      setMatchedProduct(product); 
      setSaleUnit('PIECE');
      setUnitPrice(product.price); 
    } else {
      setMatchedProduct(null);
      if (isFromScanner) { alert('Medicine not found in database!'); setSkuId(''); }
    }
  };

  const totalAmount = useMemo(() => (quantity * unitPrice) * (1 - (discount / 100)), [quantity, unitPrice, discount]);

  const sessionSales = useMemo(() => sales.filter(s => s.invoiceId === invoiceId && s.storeId === currentStore.id), [sales, invoiceId, currentStore.id]);
  const totalTurnover = useMemo(() => sessionSales.reduce((acc, curr) => acc + curr.totalPrice, 0), [sessionSales]);

  const todayStats = useMemo(() => {
    const todayDate = new Date();
    const isToday = (dateString: string) => {
      if (!dateString) return false;
      const d = new Date(dateString);
      return d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth() && d.getFullYear() === todayDate.getFullYear();
    };

    const todaySales = sales.filter(s => s.storeId === currentStore.id && isToday(s.timestamp) && !s.invoiceId?.startsWith('VOID-'));
    const todayExpenses = expenses.filter(e => e.storeId === currentStore.id && isToday(e.timestamp));
    
    let totalSales = 0, todayCash = 0, todayCard = 0, todayBkash = 0, todayNagad = 0, totalProfit = 0, totalExpense = 0, wastageLoss = 0;

    todaySales.forEach(s => {
      const amt = Number(s.amountPaid || 0);
      const method = s.paymentMethod || 'Cash';
      
      if (method === 'Card') todayCard += amt;
      else if (method === 'bKash') todayBkash += amt;
      else if (method === 'Nagad') todayNagad += amt;
      else todayCash += amt;

      const isPayment = s.invoiceId?.startsWith('PAY-') || s.productId === 'PAYMENT_RECEIVED' || s.productId === 'SUPPLIER_PAYMENT';
      if (!isPayment) {
        totalSales += Number(s.totalPrice || 0);
        const product = products.find(p => p.id === s.productId);
        totalProfit += (Number(s.totalPrice || 0) - (Number(product ? product.buyingPrice : (s.buyingPrice || 0)) * Number(s.quantity || 0)));
      }
    });

    todayExpenses.forEach(e => e.category === 'Wastage' ? wastageLoss += Number(e.amount || 0) : totalExpense += Number(e.amount || 0));

    const netBalance = (todayCash + todayCard + todayBkash + todayNagad) - totalExpense;

    return { totalSales, todayCash, todayCard, todayBkash, todayNagad, totalProfit: totalProfit - wastageLoss, totalExpense, netBalance };
  }, [sales, products, expenses, currentStore.id]);

  const alternativeMedicines = useMemo(() => {
    if (!skuId || matchedProduct) return [];
    const searchStr = skuId.toLowerCase();
    return products.filter(p => 
      p.storeId === currentStore.id && 
      p.quantity > 0 && 
      p.genericName && 
      p.genericName.toLowerCase().includes(searchStr)
    );
  }, [skuId, matchedProduct, products, currentStore.id]);


  const getBaseUnitsToDeduct = () => {
    let multiplier = 1;
    if (saleUnit === 'BOX' && matchedProduct?.piecesPerBox) multiplier = matchedProduct.piecesPerBox;
    if (saleUnit === 'STRIP' && matchedProduct?.piecesPerStrip) multiplier = matchedProduct.piecesPerStrip;
    return quantity * multiplier;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedProduct) return;
    
    const baseQtyToDeduct = getBaseUnitsToDeduct();
    if (baseQtyToDeduct > matchedProduct.quantity) return alert(`Error: Insufficient stock! Only ${matchedProduct.quantity} base units left.`);

    const isCashSale = !customerId || customerId === '';
    const finalAmountPaid = isCashSale ? totalAmount : amountPaid;
    const currentDue = isCashSale ? 0 : Math.max(0, totalAmount - finalAmountPaid);
    
    const displayProductName = saleUnit === 'PIECE' ? matchedProduct.name : `${matchedProduct.name} (${quantity} ${saleUnit})`;

    onAddSale({
      invoiceId,
      customerId: isCashSale ? (null as unknown as string) : customerId,
      customerName: isCashSale ? 'Cash Sale (Walk-in)' : (customerName || 'Walk-in Customer'),
      productId: matchedProduct.id,
      productName: displayProductName,
      quantity: baseQtyToDeduct, 
      buyingPrice: matchedProduct.buyingPrice, 
      unitPrice: totalAmount / baseQtyToDeduct, 
      discount,
      totalPrice: totalAmount,
      amountPaid: finalAmountPaid,
      amountDue: currentDue,
      paymentMethod: paymentMethod, 
      prescriptionRef: prescriptionRef || undefined,
      storeId: currentStore.id
    });

    onUpdateStock(matchedProduct.id, { quantity: matchedProduct.quantity - baseQtyToDeduct });
    if (!isCashSale && currentDue > 0) onUpdateCustomerDue(customerId, currentDue);
    
    setShowSuccessToast(true); setTimeout(() => setShowSuccessToast(false), 1500); resetEntryForm();
  };

  const getReturnableQty = (sale: Sale) => {
    if (!sale) return 0;
    const returns = sales.filter(s => s.invoiceId === `RET-${sale.invoiceId}` && s.productId === sale.productId);
    return sale.quantity - returns.reduce((acc, curr) => acc + Math.abs(curr.quantity), 0);
  };

  const handleOpenReturn = (sale: Sale) => {
    const maxQty = getReturnableQty(sale);
    if (maxQty <= 0) return alert('All items returned.');
    setSaleToReturn(sale); setReturnQty(1); setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!saleToReturn) return;
    const maxQty = getReturnableQty(saleToReturn);
    if (returnQty <= 0 || returnQty > maxQty) return alert(`Invalid quantity. Max: ${maxQty}.`);

    const refundAmount = returnQty * (saleToReturn.totalPrice / saleToReturn.quantity);
    let cashRefund = 0, dueAdjustment = 0;

    if (saleToReturn.customerId) {
        const customer = customers.find(c => c.id === saleToReturn.customerId);
        const currentDue = customer ? customer.totalDue : 0;
        if (currentDue > 0) {
            if (refundAmount >= currentDue) { dueAdjustment = currentDue; cashRefund = refundAmount - currentDue; } 
            else { dueAdjustment = refundAmount; cashRefund = 0; }
        } else cashRefund = refundAmount;
    } else cashRefund = refundAmount; 

    onAddSale({
        invoiceId: `RET-${saleToReturn.invoiceId}`,
        customerId: saleToReturn.customerId,
        customerName: saleToReturn.customerName,
        productId: saleToReturn.productId,
        productName: `[RETURN] ${saleToReturn.productName}`,
        quantity: -returnQty,
        buyingPrice: saleToReturn.buyingPrice,
        unitPrice: saleToReturn.unitPrice,
        discount: saleToReturn.discount,
        totalPrice: -refundAmount,
        amountPaid: -cashRefund,
        amountDue: -dueAdjustment,
        paymentMethod: saleToReturn.paymentMethod,
        storeId: currentStore.id
    });

    const product = products.find(p => p.id === saleToReturn.productId);
    if (product) onUpdateStock(product.id, { quantity: product.quantity + returnQty });
    if (dueAdjustment > 0 && saleToReturn.customerId) onUpdateCustomerDue(saleToReturn.customerId, -dueAdjustment);

    alert(`Return processed!\nRestored: +${returnQty}\nDue Adjusted: $${dueAdjustment.toFixed(2)}\nCash Refund: $${cashRefund.toFixed(2)}`);
    setIsReturnModalOpen(false); setSaleToReturn(null);
  };

  const exportToCSV = () => {
    const headers = ['Invoice', 'Customer', 'Product', 'Qty', 'Unit Price', 'Discount', 'Total', 'Paid', 'Due', 'Payment Method', 'Prescription', 'Date'];
    const data = sales
      .filter(s => s.storeId === currentStore.id)
      .map(saleRecord => {
        const isPayment = saleRecord.invoiceId?.startsWith('PAY-') || saleRecord.productId === 'PAYMENT_RECEIVED';
        const isVoid = saleRecord.invoiceId?.startsWith('VOID-');
        return [
          saleRecord.invoiceId,
          saleRecord.customerName,
          isPayment ? 'DUE COLLECTION' : saleRecord.productName.replace(/,/g, ';'),
          isPayment ? '-' : (isVoid ? '0' : saleRecord.quantity),
          isPayment ? '-' : (isVoid ? '0.00' : saleRecord.unitPrice.toFixed(2)),
          isPayment ? '-' : saleRecord.discount + '%',
          isPayment ? '-' : (isVoid ? '0.00' : saleRecord.totalPrice.toFixed(2)),
          (saleRecord.amountPaid || 0).toFixed(2),
          (saleRecord.amountDue || 0).toFixed(2),
          saleRecord.paymentMethod || 'Cash',
          saleRecord.prescriptionRef || 'N/A',
          new Date(saleRecord.timestamp).toLocaleDateString()
        ];
      });
    
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pharmacy_sales_${currentStore.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (invId: string) => { setSelectedInvoiceForPrint(invId); setShowPrintModal(true); };

  if (!isSessionActive) {
    const historicalSales = sales
      .filter(s => s.storeId === currentStore.id)
      // 🔴 ফিক্স: এই লাইনে .toLowerCase() এবং .startsWith() গুলোকে Null Proof (Safe) করা হয়েছে
      .filter(s => (
        (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.productName || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) && (!filterDate || s.timestamp?.startsWith(filterDate)))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()); 

    const totalPages = Math.ceil(historicalSales.length / ITEMS_PER_PAGE);
    const paginatedSales = historicalSales.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Pharmacy POS</h1>
            <p className="text-slate-500 font-medium italic">Sales & Dispensing terminal for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportToCSV} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl"><Download className="w-5 h-5" /></button>
            <button onClick={() => setIsSessionActive(true)} className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/10 uppercase tracking-widest text-xs">
              <ShoppingCart className="w-5 h-5 stroke-[3px]" /> Open Terminal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center gap-4 group hover:border-slate-500/30 transition-all">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform"><ShoppingCart className="w-5 h-5" /></div>
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Today's Sales</p><h3 className="text-lg font-black text-white tracking-tighter">${todayStats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
          </div>
          
          <div onClick={() => setShowMethodBreakdown(!showMethodBreakdown)} className="bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center gap-4 group hover:border-amber-500/30 transition-all cursor-pointer relative z-10">
            <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">Today's Collection <ChevronDown className={`w-3 h-3 transition-transform ${showMethodBreakdown ? 'rotate-180' : ''}`} /></p>
              <h3 className="text-lg font-black text-amber-400 tracking-tighter">${(todayStats.todayCash + todayStats.todayCard + todayStats.todayBkash + todayStats.todayNagad).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
            
            <AnimatePresence>
              {showMethodBreakdown && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl z-50">
                   <div className="flex justify-between text-[11px] font-black text-slate-300 mb-2 uppercase tracking-widest"><span>Cash:</span> <span className="text-emerald-400">${todayStats.todayCash.toFixed(2)}</span></div>
                   <div className="flex justify-between text-[11px] font-black text-slate-300 mb-2 uppercase tracking-widest"><span>Card:</span> <span className="text-indigo-400">${todayStats.todayCard.toFixed(2)}</span></div>
                   <div className="flex justify-between text-[11px] font-black text-slate-300 mb-2 uppercase tracking-widest"><span>bKash:</span> <span className="text-pink-400">${todayStats.todayBkash.toFixed(2)}</span></div>
                   <div className="flex justify-between text-[11px] font-black text-slate-300 uppercase tracking-widest"><span>Nagad:</span> <span className="text-orange-400">${todayStats.todayNagad.toFixed(2)}</span></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center gap-4 group hover:border-emerald-500/30 transition-all">
            <div className="w-10 h-10 bg-emerald-400/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform"><TrendingUp className="w-5 h-5" /></div>
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Today's Profit</p><h3 className="text-lg font-black text-emerald-400 tracking-tighter">${todayStats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center gap-4 group hover:border-rose-500/30 transition-all">
            <div className="w-10 h-10 bg-rose-400/10 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform"><Zap className="w-5 h-5" /></div>
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Today's Expense</p><h3 className="text-lg font-black text-rose-400 tracking-tighter">${todayStats.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center gap-4 group hover:border-blue-500/30 transition-all">
            <div className="w-10 h-10 bg-blue-400/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform"><LayoutDashboard className="w-5 h-5" /></div>
            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Balance</p><h3 className={`text-lg font-black tracking-tighter ${todayStats.netBalance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>${todayStats.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input type="text" placeholder="Search invoice, medicine or patient..." className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 focus:border-amber-400 transition-all amber-glow" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="relative flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-2xl px-4 focus-within:border-amber-400 transition-colors">
                <input type="date" className="bg-transparent py-4 outline-none text-xs font-bold text-slate-300 w-full" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                {filterDate && <button onClick={() => setFilterDate('')} className="p-1 text-slate-500 hover:text-rose-400"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-900/80">
                  <th className="px-6 py-5">Date</th>
                  <th className="px-6 py-5">Invoice & Patient</th>
                  <th className="px-6 py-5">Medicine Issued</th>
                  <th className="px-6 py-5 text-center">Base Qty</th>
                  <th className="px-6 py-5 text-right">Settlement</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedSales.map((saleRecord) => {
                  const isPayment = saleRecord.invoiceId?.startsWith('PAY-') || saleRecord.productId === 'PAYMENT_RECEIVED';
                  const isVoid = saleRecord.invoiceId?.startsWith('VOID-');
                  const isReturn = saleRecord.invoiceId?.startsWith('RET-');

                  return (
                    <tr key={saleRecord.id} className={`group hover:bg-slate-800/40 transition-all ${isVoid ? 'opacity-50 grayscale' : ''} ${isReturn ? 'bg-orange-500/5 hover:bg-orange-500/10' : ''}`}>
                      <td className="px-6 py-5 font-bold text-slate-400 text-xs whitespace-nowrap">{new Date(saleRecord.timestamp || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-6 py-5">
                        <div className="font-black text-xs tracking-tighter mb-1">
                          {isVoid ? <span className="text-rose-500 line-through">{saleRecord.invoiceId}</span> : 
                           isReturn ? <span className="text-orange-400">{saleRecord.invoiceId}</span> : 
                           <span className="text-white">{saleRecord.invoiceId}</span>}
                        </div>
                        <p className="text-xs text-slate-400 font-bold">{saleRecord.customerName}</p>
                        {saleRecord.prescriptionRef && <p className="text-[9px] text-amber-500 uppercase tracking-widest mt-1"><FileText className="w-3 h-3 inline mr-1"/>{saleRecord.prescriptionRef}</p>}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-300 flex flex-col">
                        {isPayment ? <span className="text-blue-400 italic font-bold">Due Collection</span> : isReturn ? <span className="text-orange-400 italic font-bold">{saleRecord.productName}</span> : saleRecord.productName}
                        {saleRecord.paymentMethod && <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-black mt-1">[{saleRecord.paymentMethod}]</span>}
                      </td>
                      <td className="px-6 py-5 text-center font-black text-white text-sm">{isPayment ? '-' : (isVoid ? '0' : saleRecord.quantity)}</td>
                      <td className="px-6 py-5 text-right font-black text-sm">
                        {isVoid ? <span className="text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border border-rose-500/20">VOIDED</span> : 
                         isReturn ? <span className="text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border border-orange-500/20">REFUND</span> : 
                         isPayment ? <span className="text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest">+ ${saleRecord.amountPaid?.toFixed(2)}</span> : 
                         <div className="text-emerald-400"><p>${saleRecord.totalPrice.toFixed(2)}</p>{saleRecord.amountDue > 0 && <p className="text-rose-400 text-[9px] uppercase tracking-tighter mt-1">Due: ${saleRecord.amountDue.toFixed(2)}</p>}</div>}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isPayment && !isVoid && !isReturn && (
                            <button onClick={() => handleOpenReturn(saleRecord)} title="Return Item" className="p-2 text-slate-600 hover:text-orange-400"><RotateCcw className="w-4 h-4" /></button>
                          )}
                          {!isPayment && !isVoid && !isReturn && (
                            <button onClick={() => handlePrint(saleRecord.invoiceId)} className="p-2 text-slate-600 hover:text-amber-400"><Printer className="w-4 h-4" /></button>
                          )}
                          {canDelete && !isVoid && !isReturn && (
                            saleRecord.amountPaid > 0 && !isPayment ? (
                              <button title="Cannot void: Payment exists. Reverse payment first." className="p-2 text-slate-600 cursor-not-allowed opacity-50"><AlertOctagon className="w-4 h-4" /></button>
                            ) : (
                              <button onClick={() => onDeleteSale(saleRecord.id)} className="p-2 text-slate-600 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedSales.length === 0 && <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500 text-xs font-bold uppercase tracking-widest opacity-50">No sales records found</td></tr>}
              </tbody>
            </table>
          </div>
          
          {totalPages > 0 && (
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, historicalSales.length)} of {historicalSales.length} entries</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 disabled:opacity-30 hover:bg-slate-700 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <div className="px-4 py-2 bg-amber-400/10 border border-amber-400/20 rounded-xl"><span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span></div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 disabled:opacity-30 hover:bg-slate-700 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isReturnModalOpen && saleToReturn && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative">
                 <button onClick={() => setIsReturnModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
                 <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-500"/> Return Medicine</h2>
                 <p className="text-xs text-slate-400 font-bold mb-6">Original Invoice: {saleToReturn.invoiceId}</p>

                 <form onSubmit={handleReturnSubmit} className="space-y-6">
                     <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 mb-6">
                         <p className="text-sm font-bold text-white mb-1">{saleToReturn.productName}</p>
                         <p className="text-xs text-slate-400">Unit Settlement: ${(saleToReturn.totalPrice / saleToReturn.quantity).toFixed(2)} / base unit</p>
                     </div>

                     <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Return Base Quantity</label>
                         <input type="number" min="1" max={getReturnableQty(saleToReturn)} value={returnQty} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setReturnQty(parseInt(e.target.value) || 1)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-orange-400 font-black focus:border-orange-500" />
                         <p className="text-[10px] text-orange-500/80 font-bold text-right mr-2 mt-1">Max returnable: {getReturnableQty(saleToReturn)} units</p>
                     </div>

                     <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-orange-600 transition-colors">Confirm Refund</button>
                 </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPrintModal && selectedInvoiceForPrint && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-print">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrintModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white text-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-black uppercase tracking-widest text-xs text-slate-500">Invoice Preview</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="bg-slate-950 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors"><Printer className="w-4 h-4" /> Print</button>
                    <button onClick={() => setShowPrintModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 print-content" id="printable-invoice">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h1 className="text-4xl font-black tracking-tighter mb-2">{currentStore.name}</h1>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{currentStore.location}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-xl font-black uppercase tracking-tighter mb-1">Medical Invoice</h2>
                      <p className="text-xs font-bold text-slate-400">{selectedInvoiceForPrint}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient Details</p>
                      <p className="font-black text-lg">{sales.find(s => s.invoiceId === selectedInvoiceForPrint)?.customerName || 'Walk-in Patient'}</p>
                      {sales.find(s => s.invoiceId === selectedInvoiceForPrint)?.prescriptionRef && (
                         <p className="text-xs font-bold text-slate-500 mt-1">Ref: {sales.find(s => s.invoiceId === selectedInvoiceForPrint)?.prescriptionRef}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Date Dispensed</p>
                      <p className="font-black text-lg">{new Date(sales.find(s => s.invoiceId === selectedInvoiceForPrint)?.timestamp || '').toLocaleDateString()}</p>
                    </div>
                  </div>

                  <table className="w-full mb-12">
                    <thead>
                      <tr className="border-b-2 border-slate-950 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-4 text-left">Medicine Description</th><th className="py-4 text-center">Base Qty</th><th className="py-4 text-right">Unit Price</th><th className="py-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sales.filter(s => s.invoiceId === selectedInvoiceForPrint).map(item => (
                        <tr key={item.id}>
                          <td className="py-4 font-bold">{item.productId === 'PAYMENT_RECEIVED' ? 'Due Collection' : item.productName}</td>
                          <td className="py-4 text-center font-bold">{item.productId === 'PAYMENT_RECEIVED' ? '-' : item.quantity}</td>
                          <td className="py-4 text-right font-bold">${item.unitPrice.toFixed(2)}</td>
                          <td className="py-4 text-right font-black">${item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end">
                    <div className="w-64 space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-slate-500 font-bold">Subtotal</span><span className="font-black">${sales.filter(s => s.invoiceId === selectedInvoiceForPrint).reduce((acc, curr) => acc + curr.totalPrice, 0).toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500 font-bold">Amount Paid</span><span className="font-black text-emerald-600">${sales.filter(s => s.invoiceId === selectedInvoiceForPrint).reduce((acc, curr) => acc + (curr.amountPaid || 0), 0).toFixed(2)}</span></div>
                      <div className="border-t-2 border-slate-950 pt-3 flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest">Balance Due</span><span className="text-2xl font-black">${sales.filter(s => s.invoiceId === selectedInvoiceForPrint).reduce((acc, curr) => acc + (curr.amountDue || 0), 0).toFixed(2)}</span></div>
                    </div>
                  </div>

                  <div className="mt-20 pt-12 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Thank you for your trust. Get well soon.</p>
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
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-8 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
      <div className="lg:w-[500px] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 overflow-y-auto custom-scrollbar relative">
        <div className="mb-6 flex items-center justify-between">
          <div><h2 className="text-xl font-black text-white tracking-tight uppercase">Dispense Medicine</h2><p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{invoiceId}</p></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full"><div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" /><span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Active Terminal</span></div>
        </div>

        {showSuccessToast && (
          <div className="mb-6 bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-in slide-in-from-top-2"><Check className="w-5 h-5" /><p className="text-xs font-black uppercase tracking-widest">Added to cart. Ready for next item.</p></div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] ml-2">Scan Medicine (SKU / Name)</label>
            <div className="relative group">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
              <input required value={skuId} autoFocus onChange={e => handleSkuLookup(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} placeholder="Search Medicine..." className={`w-full pl-12 pr-14 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow ${matchedProduct ? 'bg-slate-800/50 border-amber-400/30' : ''}`} />
              {!isScanning && <button type="button" onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 hover:text-amber-400 transition-all"><ScanLine className="w-5 h-5" /></button>}
            </div>
          </div>

          {isScanning && (
            <div className="mb-6 animate-in fade-in duration-300">
              <div className="relative aspect-video bg-slate-800 rounded-3xl overflow-hidden border-2 border-amber-400/50">
                <div id="sales-scanner-reader" className="w-full h-full"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-white/30 animate-scan pointer-events-none"></div>
                <button onClick={() => { setIsScanning(false); safeStopScanner(); }} className="absolute bottom-4 right-4 bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Cancel</button>
              </div>
            </div>
          )}

          {scannerError && <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold"><CameraOff className="w-4 h-4" /><p>{scannerError}</p></div>}

          {!matchedProduct && skuId.length > 2 && alternativeMedicines.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl animate-in slide-in-from-top-2">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Generic Match Found</p>
              <div className="space-y-2">
                {alternativeMedicines.slice(0, 3).map(alt => (
                  <div key={alt.id} onClick={() => { setSkuId(alt.sku); setMatchedProduct(alt); setSaleUnit('PIECE'); setUnitPrice(alt.price); }} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-white">{alt.name}</p>
                      <p className="text-[9px] text-slate-400">{alt.genericName}</p>
                    </div>
                    <span className="text-xs font-black text-emerald-400">${alt.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedProduct && (
            <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2">
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl flex items-start gap-4 relative">
                 <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-amber-500 border border-slate-700 shrink-0"><Pill className="w-5 h-5"/></div>
                 <div>
                   <p className="font-bold text-white text-sm">{matchedProduct.name}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{matchedProduct.genericName || 'N/A'}</p>
                   <div className="flex gap-2">
                     {matchedProduct.batchNumber && <span className="bg-slate-800 text-slate-300 text-[9px] px-2 py-1 rounded font-black tracking-widest uppercase border border-slate-700">Batch: {matchedProduct.batchNumber}</span>}
                     {matchedProduct.expiryDate && <span className="bg-rose-500/10 text-rose-400 text-[9px] px-2 py-1 rounded font-black tracking-widest uppercase border border-rose-500/20">Exp: {new Date(matchedProduct.expiryDate).toLocaleDateString('en-GB')}</span>}
                   </div>
                 </div>
                 <div className="absolute top-4 right-4 text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Stock Left</p>
                    <p className={`text-lg font-black ${matchedProduct.quantity <= matchedProduct.minThreshold ? 'text-rose-500' : 'text-emerald-400'}`}>{matchedProduct.quantity}</p>
                 </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Patient Profile</label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <select value={customerId} onChange={e => { const cust = customers.find(c => c.id === e.target.value); setCustomerId(e.target.value); setCustomerName(cust ? cust.name : ''); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm font-bold focus:border-amber-400 appearance-none">
                  <option value="">Walk-in Patient</option>
                  {customers.filter(c => c.storeId === currentStore.id).map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Prescription Ref.</label>
              <div className="relative group">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input type="text" value={prescriptionRef} onChange={e => setPrescriptionRef(e.target.value)} placeholder="Dr. Ref / Rx Num" className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 text-sm font-bold focus:border-amber-400" />
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!matchedProduct ? 'opacity-30 pointer-events-none blur-[1px]' : ''}`}>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Selling Unit</label>
              <select value={saleUnit} onChange={e => setSaleUnit(e.target.value as any)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-black focus:border-amber-400 appearance-none text-center">
                 <option value="PIECE">Single Piece</option>
                 {matchedProduct?.piecesPerStrip && matchedProduct.piecesPerStrip > 1 && <option value="STRIP">Strip ({matchedProduct.piecesPerStrip} pcs)</option>}
                 {matchedProduct?.piecesPerBox && matchedProduct.piecesPerBox > 1 && <option value="BOX">Full Box ({matchedProduct.piecesPerBox} pcs)</option>}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Quantity ({saleUnit.toLowerCase()}s)</label>
              <div className="relative group">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input required type="number" min="1" value={quantity} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-black focus:border-amber-400 amber-glow" />
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!matchedProduct ? 'opacity-30 pointer-events-none blur-[1px]' : ''}`}>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Price per {saleUnit.toLowerCase()} ($)</label>
              <div className="relative group">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input required type="number" step="0.01" value={unitPrice} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)} className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-emerald-400 font-black focus:border-amber-400" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white font-bold focus:border-amber-400 appearance-none text-center uppercase tracking-widest text-[10px]">
                <option value="Cash">CASH</option>
                <option value="Card">CARD</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">NAGAD</option>
              </select>
            </div>
          </div>
          
          <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!matchedProduct ? 'opacity-30 pointer-events-none blur-[1px]' : ''}`}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">discount (%)</label>
                <input type="number" min="0" max="100" value={discount} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-rose-500 font-black focus:border-amber-400 amber-glow" />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Amount Paid ($)</label>
                  <div className="relative group">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                    <input type="number" step="0.01" disabled={!customerId} value={!customerId ? totalAmount : amountPaid} onWheel={(e) => (e.target as HTMLInputElement).blur()} onFocus={e => e.target.select()} onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)} className={`w-full pl-12 pr-4 py-4 rounded-2xl outline-none font-black transition-all ${!customerId ? 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-500 cursor-not-allowed' : 'bg-slate-800 border border-slate-700 text-amber-400 focus:border-amber-400 amber-glow'}`} />
                  </div>
              </div>
          </div>

          <div className={`bg-slate-950 p-6 rounded-3xl border border-slate-800 mt-auto ${!matchedProduct ? 'opacity-50 grayscale' : ''}`}>
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Estimated Settlement</span>
                <span className="text-2xl font-black gold-gradient-text tracking-tighter">${totalAmount.toFixed(2)}</span>
             </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button type="submit" disabled={!matchedProduct} className={`w-full py-5 rounded-3xl font-black shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${matchedProduct ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-amber-900/20 hover:scale-[1.02]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>add to cart <ArrowRight className="w-5 h-5" /></button>
            <button type="button" onClick={() => { setIsSessionActive(false); setInvoiceId(''); setCustomerName(''); resetEntryForm(); }} className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-3xl font-black hover:text-white transition-all text-[10px] uppercase tracking-[0.2em] shadow-xl">finalize bill</button>
          </div>
        </form>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
           <div><h2 className="text-xl font-black text-white tracking-tight uppercase">Current Cart</h2><p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Active Patient Bill</p></div>
           <div className="p-3 bg-slate-800 rounded-2xl text-amber-500 border border-slate-700 shadow-xl"><History className="w-5 h-5" /></div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th className="px-6 py-5">Medicine</th><th className="px-6 py-5 text-center">Dispensed (Base Units)</th><th className="px-6 py-5 text-right">Settlement ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sessionSales.map((sessionSale) => (
                    <tr key={sessionSale.id} className="group hover:bg-slate-800/40 transition-all animate-in slide-in-from-right-4 duration-300">
                      <td className="px-6 py-5">
                         <p className="font-bold text-white text-sm truncate max-w-xs">{sessionSale.productName}</p>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter italic">{sessionSale.customerName}</p>
                      </td>
                      <td className="px-6 py-5 text-center font-black text-amber-400">
                         {sessionSale.quantity}
                      </td>
                      <td className="px-6 py-5 text-right font-black text-emerald-400">
                         ${sessionSale.totalPrice.toFixed(2)}
                      </td>
                    </tr>
                ))}
                {sessionSales.length === 0 && <tr><td colSpan={3} className="px-6 py-20 text-center opacity-30 grayscale"><LayoutDashboard className="w-12 h-12 mx-auto text-slate-600 mb-4" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cart is empty</p></td></tr>}
              </tbody>
           </table>
        </div>
        
        <div className="p-8 bg-slate-950 border-t border-slate-800">
           <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Bill Value</p><p className="text-2xl font-black text-white">${totalTurnover.toFixed(2)}</p></div>
              <div className="flex flex-col items-end"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Items Carted</p><p className="text-2xl font-black text-amber-400">{sessionSales.length}</p></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sales;