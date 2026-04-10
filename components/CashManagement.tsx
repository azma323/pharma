import React, { useState, useMemo } from 'react';
import { Store, CashTransaction } from '../types';
import { 
  Building2, 
  Wallet, 
  ArrowRightLeft, 
  ArrowUpFromLine, 
  History,
  X,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CashManagementProps {
  currentStore: Store;
  transactions: CashTransaction[];
  balances?: { cash: number, bank: number, card: number, bkash: number, nagad: number }; 
  onAddTransaction: (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => void | Promise<void>;
  onDeleteTransaction: (id: string) => void | Promise<void>;
  canEdit: boolean;
}

const CashManagement: React.FC<CashManagementProps> = ({
  currentStore,
  transactions,
  // 🔴 FAILSAFE: কোনো কারণে ডেটা না পেলেও অ্যাপ ক্র্যাশ করবে না 🔴
  balances = { cash: 0, bank: 0, card: 0, bkash: 0, nagad: 0 },
  onAddTransaction,
  canEdit
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [type, setType] = useState<'TRANSFER' | 'CASH_OUT'>('TRANSFER');
  const [source, setSource] = useState<string>('CASH');
  const [destination, setDestination] = useState<string>('BANK');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const storeTransactions = useMemo(() => {
    return transactions
      .filter(t => t.storeId === currentStore.id && (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.type.includes(searchTerm.toUpperCase())))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, currentStore.id, searchTerm]);

  const totalCashOut = useMemo(() => {
    return transactions
      .filter(t => t.storeId === currentStore.id && t.type === 'CASH_OUT')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions, currentStore.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    if (type === 'TRANSFER' && source === destination) {
       alert("Source and Destination cannot be the same!");
       return;
    }

    const getBalance = (method: string) => {
        if (method === 'CASH') return balances.cash;
        if (method === 'BANK') return balances.bank;
        if (method === 'CARD') return balances.card;
        if (method === 'BKASH') return balances.bkash;
        if (method === 'NAGAD') return balances.nagad;
        return 0;
    };

    if (amount > getBalance(source)) {
      alert(`Insufficient Funds! You only have $${getBalance(source).toFixed(2)} in ${source}.`);
      return;
    }

    setIsLoading(true);
    try {
      await onAddTransaction({
        storeId: currentStore.id,
        type,
        source: source,
        destination: type === 'TRANSFER' ? destination : undefined,
        amount: Number(amount),
        description: description || (type === 'CASH_OUT' ? 'Owner Withdrawal' : 'Fund Transfer')
      });
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
    } catch (error: any) {
      alert(`Transaction failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Fund Management
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage cash flow and banking for <span className="text-amber-400 font-black">{currentStore.name}</span></p>
        </div>
        {canEdit && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-emerald-900/20 uppercase tracking-widest text-xs"
          >
            <ArrowRightLeft className="w-5 h-5 stroke-[3px]" /> Log Transaction
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400 mx-auto mb-2"><Wallet className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cash</p>
            <h3 className="text-lg font-black text-amber-400">${balances.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-blue-400/10 rounded-xl flex items-center justify-center text-blue-400 mx-auto mb-2"><Building2 className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank</p>
            <h3 className="text-lg font-black text-blue-400">${balances.bank.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-indigo-400/10 rounded-xl flex items-center justify-center text-indigo-400 mx-auto mb-2"><CreditCard className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Card / POS</p>
            <h3 className="text-lg font-black text-indigo-400">${balances.card.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-pink-400/10 rounded-xl flex items-center justify-center text-pink-400 mx-auto mb-2"><Wallet className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">bKash</p>
            <h3 className="text-lg font-black text-pink-400">${balances.bkash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-orange-400/10 rounded-xl flex items-center justify-center text-orange-400 mx-auto mb-2"><Wallet className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nagad</p>
            <h3 className="text-lg font-black text-orange-400">${balances.nagad.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
         <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-4xl border border-slate-800 shadow-xl flex flex-col justify-center text-center">
            <div className="w-10 h-10 bg-rose-400/10 rounded-xl flex items-center justify-center text-rose-400 mx-auto mb-2"><ArrowUpFromLine className="w-5 h-5" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cash Out</p>
            <h3 className="text-lg font-black text-rose-400">${totalCashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
         </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black text-white uppercase tracking-widest">Transaction Ledger</h2>
        </div>
        
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest">
                <th className="p-5 font-black">Date</th>
                <th className="p-5 font-black">Type</th>
                <th className="p-5 font-black">Description</th>
                <th className="p-5 font-black text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {storeTransactions.map(t => (
                <tr key={t.id} className="group hover:bg-slate-800/40 transition-colors">
                  <td className="p-5 font-bold text-slate-400 text-xs">
                    {new Date(t.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      t.type === 'TRANSFER' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {t.type === 'TRANSFER' && t.destination ? `${t.source} TO ${t.destination}` : t.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-5 text-slate-300 text-sm font-bold">{t.description}</td>
                  <td className="p-5 text-right font-black text-sm text-white">
                    ${t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Log Transaction</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="flex p-1 bg-slate-800 rounded-2xl mb-6 border border-slate-700">
                  <button type="button" onClick={() => setType('TRANSFER')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'TRANSFER' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Internal Transfer</button>
                  <button type="button" onClick={() => setType('CASH_OUT')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'CASH_OUT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-400'}`}>Cash Out</button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Withdraw From</label>
                  <select value={source} onChange={(e: any) => setSource(e.target.value)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-bold focus:border-emerald-500 appearance-none">
                    <option value="CASH">CASH (${balances.cash.toFixed(2)})</option>
                    <option value="BANK">BANK (${balances.bank.toFixed(2)})</option>
                    <option value="CARD">CARD (${balances.card.toFixed(2)})</option>
                    <option value="BKASH">bKash (${balances.bkash.toFixed(2)})</option>
                    <option value="NAGAD">NAGAD (${balances.nagad.toFixed(2)})</option>
                  </select>
                </div>

                {type === 'TRANSFER' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Transfer To</label>
                    <select value={destination} onChange={(e: any) => setDestination(e.target.value)} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white font-bold focus:border-emerald-500 appearance-none">
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK</option>
                      <option value="CARD">CARD</option>
                      <option value="BKASH">bKash</option>
                      <option value="NAGAD">NAGAD</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Amount ($)</label>
                  <input type="number" required min="1" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="0.00" className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-emerald-500" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Note / Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'CASH_OUT' ? 'Owner Withdrawal' : 'Fund Transfer'} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-white text-sm focus:border-emerald-500" />
                </div>

                <button type="submit" disabled={isLoading} className={`w-full py-5 text-white rounded-[2rem] font-black shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50 ${type === 'CASH_OUT' ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-700'}`}>
                  {isLoading ? 'Processing...' : 'Confirm Transaction'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CashManagement;