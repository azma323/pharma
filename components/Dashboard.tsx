import React, { useState, useMemo, useEffect } from 'react';
import { Product, Store, Sale, Expense, User, UserRole, CashTransaction } from '../types';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, TrendingUp, Package, AlertTriangle, ShoppingCart, 
  Zap, Wallet, LayoutDashboard, Check, Calendar, CreditCard, 
  QrCode, X, CheckCircle2, Clock, Activity, Edit2, Building2, ChevronDown,
  AlertOctagon, Pill
} from 'lucide-react';
import Swal from 'sweetalert2'; 
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  products: Product[];
  currentStore: Store;
  sales: Sale[];
  expenses: Expense[];
  currentUser: User;
  activities?: any[];
  cashTransactions?: CashTransaction[];
  initialInvestment: number; 
  onUpdateInvestment: (val: number) => void; 
  overallBalances?: { cash: number, bank: number, card: number, bkash: number, nagad: number }; 
}

const Dashboard: React.FC<DashboardProps> = ({ 
  products, currentStore, sales, expenses, currentUser, activities = [],
  cashTransactions = [], initialInvestment, onUpdateInvestment, 
  overallBalances = { cash: 0, bank: 0, card: 0, bkash: 0, nagad: 0 } 
}) => {

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isEditingInvest, setIsEditingInvest] = useState(false);
  const [investInput, setInvestInput] = useState(initialInvestment.toString());
  const [showBalanceTable, setShowBalanceTable] = useState(false); 

  useEffect(() => { setInvestInput(initialInvestment.toString()); }, [initialInvestment]);
  const handleSaveInvestment = () => { onUpdateInvestment(parseFloat(investInput) || 0); setIsEditingInvest(false); };

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [trxId, setTrxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bKashNumber = "01633334466"; 

  const relevantMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startMonthStr = currentStore.billingStartMonth || currentMonthStr; 
    let [startYear, startMonth] = startMonthStr.split('-').map(Number);
    const [endYear, endMonth] = currentMonthStr.split('-').map(Number);
    let count = 0;
    while ((startYear < endYear || (startYear === endYear && startMonth <= endMonth)) && count < 60) {
      months.push(`${startYear}-${String(startMonth).padStart(2, '0')}`);
      startMonth++;
      if (startMonth > 12) { startMonth = 1; startYear++; }
      count++;
    }
    return months.length > 0 ? months : [currentMonthStr];
  }, [currentStore.billingStartMonth]);

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      setIsLoadingStatus(true);
      const { data } = await supabase.from('store_payments').select('*').eq('storeId', currentStore.id).in('monthYear', relevantMonths);
      setPaymentHistory(data || []);
      setIsLoadingStatus(false);
    };
    fetchPaymentStatus();
  }, [currentStore.id, relevantMonths]);

  const targetMonthData = useMemo(() => {
    let pendingCount = 0;
    let monthsDue = 0;
    let totalDue = 0;
    let targetMonthToPay = relevantMonths[relevantMonths.length - 1]; 

    if (currentStore.billingStartMonth && currentStore.monthlyFee) {
      const paidCount = paymentHistory.filter(p => p.status === 'PAID').length;
      pendingCount = paymentHistory.filter(p => p.status === 'PENDING').length;
      monthsDue = relevantMonths.length - paidCount;
      if (monthsDue < 0) monthsDue = 0;
      totalDue = monthsDue * currentStore.monthlyFee;
    }

    for (const month of relevantMonths) {
      const hasPaid = paymentHistory.some(p => p.monthYear === month && p.status === 'PAID');
      if (!hasPaid) { targetMonthToPay = month; break; }
    }

    let status = 'PAID';
    if (monthsDue > 0) status = 'DUE';
    if (pendingCount > 0) status = 'PENDING';

    return { status, monthsDue, totalDue, targetMonthToPay };
  }, [paymentHistory, relevantMonths, currentStore]);

  const submitPaymentTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = { storeId: currentStore.id, monthYear: targetMonthData.targetMonthToPay, amountPaid: currentStore.monthlyFee || 0, paymentDate: new Date().toISOString(), trxId: trxId.trim(), status: 'PENDING' };
      const { data, error } = await supabase.from('store_payments').insert([payload]).select().single();
      if (error) throw error;
      setPaymentHistory(prev => [...prev, data]);
      setIsPaymentModalOpen(false);
      Swal.fire({ icon: 'success', title: 'Payment Submitted!', text: 'Your payment is pending approval.', customClass: { popup: 'rounded-4xl' } });
    } catch (error: any) { Swal.fire({ icon: 'error', title: 'Submission Failed', text: error.message, customClass: { popup: 'rounded-4xl' } }); } 
    finally { setIsSubmitting(false); setTrxId(''); }
  };

  // 🔴 Pharmacy Feature: Expiry Checker
  const getExpiryStatus = (dateStr?: string) => {
    if(!dateStr) return null;
    const today = new Date();
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { type: 'EXPIRED', label: 'Expired', days: diffDays };
    if (diffDays <= 90) return { type: 'NEAR_EXPIRY', label: `Exp: ${diffDays} days`, days: diffDays };
    return null;
  };

  const inventoryStats = useMemo(() => {
    const storeProducts = products.filter(p => p.storeId === currentStore.id);
    const stockEquity = storeProducts.reduce((acc, p) => acc + (p.quantity * p.buyingPrice), 0);
    const lowStockCount = storeProducts.filter(p => p.quantity <= p.minThreshold).length;
    
    let expiredCount = 0;
    let nearExpiryCount = 0;

    storeProducts.forEach(p => {
      const expStatus = getExpiryStatus(p.expiryDate);
      if (expStatus?.type === 'EXPIRED') expiredCount++;
      if (expStatus?.type === 'NEAR_EXPIRY') nearExpiryCount++;
    });

    return { totalItems: storeProducts.length, stockEquity, lowStockCount, expiredCount, nearExpiryCount, storeProducts };
  }, [products, currentStore.id]);

  const monthStats = useMemo(() => {
    const filteredSales = sales.filter(s => s.storeId === currentStore.id && (!selectedMonth || s.timestamp?.startsWith(selectedMonth)) && !s.invoiceId?.startsWith('VOID-'));
const filteredExpenses = expenses.filter(e => e.storeId === currentStore.id && (!selectedMonth || e.timestamp?.startsWith(selectedMonth)));
    let totalSales = 0, totalProfit = 0, totalExpense = 0, wastageLoss = 0;
    
    filteredSales.forEach(s => {
      const isPayment = s.invoiceId?.startsWith('PAY-') || s.productId === 'PAYMENT_RECEIVED';
      if (!isPayment) {
        totalSales += s.totalPrice;
        const product = products.find(p => p.id === s.productId);
        totalProfit += (s.totalPrice - ((product ? product.buyingPrice : s.buyingPrice) * s.quantity));
      }
    });
    filteredExpenses.forEach(e => e.category === 'Wastage' ? wastageLoss += e.amount : totalExpense += e.amount);
    
    return { totalSales, totalProfit: totalProfit - wastageLoss, totalExpense };
  }, [sales, products, expenses, currentStore.id, selectedMonth]);

  // 🔴 Pharmacy Feature: Combined Alerts (Low Stock + Expiry)
  const criticalAlerts = useMemo(() => {
    return inventoryStats.storeProducts
      .map(p => ({ product: p, expStatus: getExpiryStatus(p.expiryDate) }))
      .filter(item => item.product.quantity <= item.product.minThreshold || item.expStatus !== null)
      .sort((a, b) => {
        // Expired first, then Near Expiry, then Low Stock
        if (a.expStatus?.type === 'EXPIRED' && b.expStatus?.type !== 'EXPIRED') return -1;
        if (a.expStatus?.type !== 'EXPIRED' && b.expStatus?.type === 'EXPIRED') return 1;
        return 0;
      });
  }, [inventoryStats.storeProducts]);

  const todaysActivities = useMemo(() => { const today = new Date().toISOString().split('T')[0]; return activities.filter(a => a.timestamp?.startsWith(today)).slice(0, 10); }, [activities]);

  const totalNetBalance = overallBalances.cash + overallBalances.card + overallBalances.bkash + overallBalances.nagad;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {currentUser.role !== UserRole.SUPER_ADMIN && (
        <>
          {isLoadingStatus ? (
            <div className="p-6 rounded-4xl bg-slate-900/50 border border-slate-800 animate-pulse h-32 flex items-center justify-center text-slate-500 font-bold tracking-widest text-[10px] uppercase">Syncing Billing Data...</div>
          ) : (
            <div className={`p-6 rounded-4xl border-2 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 ${
              targetMonthData.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/30' : 
              targetMonthData.status === 'PENDING' ? 'bg-amber-400/10 border-amber-400/30' : 
              'bg-rose-500/10 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${targetMonthData.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : targetMonthData.status === 'PENDING' ? 'bg-amber-400/20 text-amber-400' : 'bg-rose-500/20 text-rose-500'}`}>
                  {targetMonthData.status === 'PAID' ? <CheckCircle2 className="w-8 h-8" /> : targetMonthData.status === 'PENDING' ? <Clock className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">Software Subscription</h2>
                  <p className={`text-xs font-bold mt-1 uppercase tracking-widest ${targetMonthData.status === 'PAID' ? 'text-emerald-400' : targetMonthData.status === 'PENDING' ? 'text-amber-400' : 'text-rose-500'}`}>
                    {targetMonthData.status === 'PAID' ? 'ALL CLEARED' : 
                     targetMonthData.status === 'PENDING' ? 'PENDING APPROVAL' : 
                     `${targetMonthData.monthsDue} MONTH(S) DUE (Total: $${targetMonthData.totalDue})`}
                  </p>
                </div>
              </div>

              {targetMonthData.status === 'DUE' ? (
                <button onClick={() => setIsPaymentModalOpen(true)} className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-4xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2">
                  <CreditCard className="w-5 h-5" /> Pay 1 Month (${currentStore.monthlyFee || 0})
                </button>
              ) : (
                <div className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border flex items-center gap-2 ${targetMonthData.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-400/20 text-amber-400 border-amber-400/30'}`}>
                   {targetMonthData.status === 'PAID' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                   {targetMonthData.status === 'PAID' ? 'All Cleared' : 'In Review'}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">Command Center</h1>
          <p className="text-slate-500 font-medium mt-1">Financial & Medical metrics for <span className="text-amber-400 font-black">{currentStore.name}</span></p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 pl-4 rounded-2xl shadow-xl">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Capital:</span>
            {isEditingInvest ? (
              <div className="flex items-center gap-2">
                <input type="number" value={investInput} onChange={e => setInvestInput(e.target.value)} className="bg-slate-800 text-amber-400 font-black outline-none px-3 py-1 rounded-xl w-24 text-sm focus:border focus:border-amber-400/50" autoFocus />
                <button onClick={handleSaveInvestment} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"><Check className="w-4 h-4" /></button>
                <button onClick={() => {setIsEditingInvest(false); setInvestInput(initialInvestment.toString());}} className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 cursor-pointer group px-2 py-1 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors" onClick={() => setIsEditingInvest(true)}>
                <span className="text-amber-400 font-black text-sm">${initialInvestment.toLocaleString()}</span>
                <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-xl">
            <Calendar className="w-5 h-5 text-slate-400 ml-2" />
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-white font-bold outline-none cursor-pointer pr-4" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-6 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400"><ShoppingCart className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sales (Selected Month)</p>
          </div>
          <h3 className="text-2xl font-black text-white">${monthStats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-emerald-400/10 rounded-2xl flex items-center justify-center text-emerald-400"><TrendingUp className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Profit (Selected Month)</p>
          </div>
          <h3 className="text-2xl font-black text-emerald-400">${monthStats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-rose-400/10 rounded-2xl flex items-center justify-center text-rose-400"><Zap className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expense (Selected Month)</p>
          </div>
          <h3 className="text-2xl font-black text-rose-400">${monthStats.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>

        <div onClick={() => setShowBalanceTable(!showBalanceTable)} className="bg-slate-900/50 p-6 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center cursor-pointer hover:border-amber-400/30 transition-all relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-400/10 rounded-2xl flex items-center justify-center text-blue-400"><Wallet className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">Net Balance <ChevronDown className={`w-3 h-3 transition-transform ${showBalanceTable ? 'rotate-180' : ''}`} /></p>
          </div>
          <h3 className="text-2xl font-black text-blue-400">${totalNetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
      </div>

      <AnimatePresence>
        {showBalanceTable && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-slate-900/50 backdrop-blur-md p-6 rounded-4xl border border-slate-800 shadow-xl duration-300">
            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-400"/> Fund Breakdown <span className="text-[10px] text-slate-500 normal-case tracking-normal ml-2">(All-Time Available Liquid Funds)</span></h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
               <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-black uppercase mb-1">Cash In Drawer</p><p className="text-xl font-black text-emerald-400">${overallBalances.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
               <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-black uppercase mb-1">Card / POS</p><p className="text-xl font-black text-indigo-400">${overallBalances.card.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
               <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-black uppercase mb-1">bKash</p><p className="text-xl font-black text-pink-400">${overallBalances.bkash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
               <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-black uppercase mb-1">Nagad</p><p className="text-xl font-black text-orange-400">${overallBalances.nagad.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between">
               <div>
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-2"><Building2 className="w-4 h-4"/> Bank Account Deposit</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Safely deposited funds (Not included in Net Liquid Balance)</p>
               </div>
               <h3 className="text-2xl font-black text-blue-400">${overallBalances.bank.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Pill className="w-32 h-32 text-amber-400" /></div>
          <h2 className="text-lg font-black text-white uppercase tracking-widest mb-8 flex items-center gap-3"><LayoutDashboard className="w-5 h-5 text-amber-500" /> Inventory Status</h2>
          
          <div className="space-y-6 relative z-10">
            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Medicines</p><p className="text-4xl font-black text-white">{inventoryStats.totalItems}</p></div>
            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Stock Equity</p><p className="text-4xl font-black text-emerald-400">${inventoryStats.stockEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            
            {/* 🔴 Pharmacy Feature: Expiry Summary 🔴 */}
            <div className="pt-4 border-t border-slate-800/50 flex gap-4">
               <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3">
                 <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Expired</p>
                 <p className="text-xl font-black text-rose-500">{inventoryStats.expiredCount}</p>
               </div>
               <div className="flex-1 bg-amber-400/10 border border-amber-400/20 rounded-2xl p-3">
                 <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Exp. in 90 Days</p>
                 <p className="text-xl font-black text-amber-400">{inventoryStats.nearExpiryCount}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[400px]">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between">
             <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3"><AlertOctagon className="w-5 h-5 text-rose-500" /> Critical Alerts</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div className="space-y-2 p-4">
                {criticalAlerts.map(item => {
                  const isLowStock = item.product.quantity <= item.product.minThreshold;
                  return (
                    <div key={item.product.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                       <p className="font-bold text-white text-sm truncate">{item.product.name}</p>
                       <div className="flex flex-wrap gap-2 mt-2">
                          {isLowStock && (
                             <span className="bg-rose-500/10 text-rose-400 text-[9px] px-2 py-1 rounded uppercase font-black tracking-widest border border-rose-500/20">
                               Low Stock: {item.product.quantity} left
                             </span>
                          )}
                          {item.expStatus && (
                             <span className={`text-[9px] px-2 py-1 rounded uppercase font-black tracking-widest border ${item.expStatus.type === 'EXPIRED' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-400/10 text-amber-400 border-amber-400/20'}`}>
                               {item.expStatus.label}
                             </span>
                          )}
                       </div>
                    </div>
                  )
                })}
                {criticalAlerts.length === 0 && (
                  <div className="text-center opacity-40 py-10">
                    <Check className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">All optimal & safe</p>
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[400px]">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between">
             <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3"><Activity className="w-5 h-5 text-blue-400" /> Today's Log</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {todaysActivities.map(activity => (
              <div key={activity.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <p className="text-xs text-white font-bold">{activity.text}</p>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-amber-400 font-black tracking-widest uppercase">{activity.user}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(activity.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {todaysActivities.length === 0 && (
               <div className="text-center opacity-40 py-10"><Activity className="w-8 h-8 mx-auto text-blue-500 mb-2" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No activity today</p></div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 w-full max-w-md rounded-4xl border border-slate-800 shadow-2xl p-8 relative">
               <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
               <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><CreditCard className="w-6 h-6 text-pink-500" /> bKash Payment</h2>
               
               <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center mb-6 shadow-inner">
                  <QrCode className="w-16 h-16 text-pink-500 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Send Money to bKash</p>
                  <p className="text-3xl font-black text-white tracking-widest">{bKashNumber}</p>
                  <div className="mt-4 inline-block bg-pink-500/20 text-pink-400 px-4 py-2 rounded-xl border border-pink-500/30">
                    <p className="text-[10px] font-black uppercase tracking-widest">Amount to Pay</p>
                    <p className="text-lg font-black">${currentStore.monthlyFee || 0}</p>
                  </div>
               </div>

               <form onSubmit={submitPaymentTrx} className="space-y-4">
                  <input type="text" required value={trxId} onChange={(e) => setTrxId(e.target.value.toUpperCase())} placeholder="Enter TrxID after payment" className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-black uppercase tracking-widest focus:border-pink-500 text-center" />
                  <button type="submit" disabled={isSubmitting} className="w-full bg-pink-500 text-white py-5 rounded-4xl font-black uppercase tracking-widest text-xs shadow-lg disabled:opacity-50 hover:bg-pink-600 transition-colors">Submit Transaction</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;