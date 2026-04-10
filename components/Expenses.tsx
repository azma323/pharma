import React, { useState, useMemo } from 'react';
import { Expense, Store, User, UserRole } from '../types';
import { 
  Wallet, 
  Search, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  ArrowRight, 
  ChevronRight,
  TrendingDown,
  ArrowDownRight,
  Filter,
  DollarSign,
  Tag,
  ClipboardList,
  Settings,
  Download,
  Lock // 🔴 Locked আইকনের জন্য
} from 'lucide-react';

interface ExpensesProps {
  expenses: Expense[];
  currentStore: Store;
  currentUser: User;
  expenseCategories: string[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void | Promise<void>;
  onUpdateExpense: (id: string, updates: Partial<Expense>) => void | Promise<void>;
  onDeleteExpense: (id: string) => void | Promise<void>;
  onAddExpenseCategory: (name: string) => void;
  onRemoveExpenseCategory: (name: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const Expenses: React.FC<ExpensesProps> = ({ 
  expenses, 
  currentStore, 
  currentUser, 
  expenseCategories,
  onAddExpense, 
  onUpdateExpense, 
  onDeleteExpense,
  onAddExpenseCategory,
  onRemoveExpenseCategory,
  canEdit,
  canDelete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🔴 Manual Categories List (Wastage বাদে বাকি সব ম্যানুয়াল) 🔴
  const manualCategories = useMemo(() => {
    return expenseCategories.filter(c => c.toLowerCase() !== 'wastage');
  }, [expenseCategories]);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(e => e.storeId === currentStore.id) // 🔴 Wastage এখন লিস্টে দেখাবে, কিন্তু Locked থাকবে 🔴
      .filter(e => {
        const matchesSearch = (e.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;
        const matchesDate = !filterDate || (e.timestamp && e.timestamp.startsWith(filterDate));
        return matchesSearch && matchesCategory && matchesDate;
      });
  }, [expenses, currentStore.id, searchTerm, selectedCategory, filterDate]);

  const totalExpenditure = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      // 🔴 ভুলটি এখানেই ছিল। আমি ডাটাবেসের ফরমেট অনুযায়ী আগের নিয়মে ফেরত নিয়েছি 🔴
      const data = {
        storeId: currentStore.id,
        category: form.expCat.value,
        amount: parseFloat(form.expAmount.value),
        description: form.expDesc.value
      };

      if (editingExpense) {
        await onUpdateExpense(editingExpense.id, data);
        alert('Update Success: Financial record modified.');
      } else {
        await onAddExpense(data);
        alert('Settlement Logged: Expense successfully recorded.');
      }

      setIsModalOpen(false);
      setEditingExpense(null);
    } catch (error: any) {
      alert(`Operation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this expenditure? Funds will be reversed automatically.")) {
      try {
        await onDeleteExpense(id);
      } catch (error: any) {
        alert(`Delete failed: ${error.message}`);
      }
    }
  };

  const exportToCSV = () => {
    const headers = ['Category', 'Description', 'Amount', 'Date'];
    const data = filteredExpenses.map(e => [
      e.category,
      e.description.replace(/,/g, ';'),
      e.amount.toFixed(2),
      new Date(e.timestamp).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_${currentStore.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      onAddExpenseCategory(newCatName.trim());
      setNewCatName('');
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Financial Outflow
            <span className="bg-rose-500/10 text-rose-500 text-[10px] py-1 px-3 rounded-full border border-rose-500/20 uppercase tracking-[0.2em] font-black">Expenditure Ledger</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Operational cost tracking for <span className="gold-gradient-text font-extrabold">{currentStore.name}</span></p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-slate-900 border border-slate-800 text-slate-300 px-5 py-4 rounded-2xl font-bold flex items-center gap-2 hover:border-rose-500/50 transition-all shadow-xl"
          >
            <Tag className="w-4 h-4 text-rose-500" />
            <span className="hidden md:inline uppercase tracking-widest text-[10px]">Manage Categories</span>
          </button>
          {canEdit && (
            <button 
              onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
              className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] hover:bg-rose-600 transition-all shadow-xl shadow-rose-900/20 uppercase tracking-widest text-xs"
            >
              <Plus className="w-5 h-5 stroke-[3px]" />
              Log New Expense
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col justify-between">
           <div className="flex justify-between items-start mb-4">
              <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                <Wallet className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gross Expenditure</span>
           </div>
           <div>
              <p className="text-4xl font-black text-white tracking-tighter">${totalExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-rose-400 font-bold mt-2 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3" /> Real-time capital drain
              </p>
           </div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl md:col-span-2">
           <div className="flex items-center gap-4 mb-6">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-white text-lg tracking-tight">System Memo</h3>
           </div>
           <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            This ledger tracks all non-inventory capital outflows including facility rent, personnel compensation, and utility logistics. System-generated expenses (like Wastage) are locked here and can only be modified from their source module.
           </p>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search memo or identifier..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 placeholder:text-slate-600 focus:border-rose-500/50 transition-all amber-glow" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
              <input 
                type="date" 
                className="pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-300 focus:border-rose-500 transition-all amber-glow" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
              />
            </div>
            <select 
              className="px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-300 focus:border-rose-500 transition-all appearance-none cursor-pointer shadow-xl pr-12 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%2394a3b8%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]" 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-5">Category</th>
                <th className="px-6 py-5">Memo / Description</th>
                <th className="px-6 py-5">Timestamp</th>
                <th className="px-6 py-5 text-right">Settlement</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredExpenses.map((e, idx) => {
                // 🔴 Strict Lock: ম্যানুয়াল লিস্টে না থাকলে বা Wastage হলে লকড হয়ে যাবে 🔴
                const isAutoGenerated = !manualCategories.includes(e.category) || e.category.toLowerCase() === 'wastage';

                return (
                  <tr key={e.id} className={`group transition-all duration-300 hover:bg-slate-800/20 ${idx % 2 === 0 ? 'bg-slate-900/10' : ''}`}>
                    <td className="px-6 py-5">
                      <span className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border transition-all ${isAutoGenerated ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-slate-800 text-rose-400 border-rose-500/20 group-hover:border-rose-500/50'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-white tracking-tight line-clamp-1">{e.description}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-300">{e.timestamp ? new Date(e.timestamp).toLocaleDateString() : 'N/A'}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-black text-rose-500 tracking-tight">-${e.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isAutoGenerated ? (
                        <div className="flex items-center justify-end text-slate-600 gap-1 opacity-50" title="Auto-generated: Edit/Delete from source tab">
                          <Lock className="w-4 h-4" /> <span className="text-[10px] uppercase font-black tracking-widest">Locked</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button 
                              onClick={() => handleEdit(e)}
                              className="p-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(e.id)}
                              className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 bg-slate-800/50 rounded-full text-slate-600">
                        <TrendingDown className="w-10 h-10" />
                      </div>
                      <p className="text-slate-500 text-sm font-medium italic tracking-widest uppercase">
                        Zero financial outflows logged for this criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
             <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
             <h2 className="text-2xl font-black text-white mb-6 tracking-tight flex items-center gap-3">
               <Tag className="w-6 h-6 text-rose-500" />
               Expense Sectors
             </h2>
             
             <div className="space-y-6">
                <div className="flex gap-3">
                   <input 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="New Expenditure Tag..." 
                    className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-rose-500 transition-all amber-glow" 
                   />
                   <button 
                    onClick={handleAddCategory}
                    className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black shadow-lg"
                   >
                     <Plus className="w-6 h-6" />
                   </button>
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                   {expenseCategories.map(cat => (
                     <div key={cat} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 group hover:border-rose-500/30 transition-all">
                        <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">{cat}</span>
                        {/* 🔴 Locked ক্যাটাগরিগুলো ডিলিট করা যাবে না 🔴 */}
                        {cat !== 'Salary' && cat !== 'Rent' && cat !== 'Transport' && cat !== 'Utilities' && cat.toLowerCase() !== 'wastage' && (
                           <button onClick={() => onRemoveExpenseCategory(cat)} className="text-slate-600 hover:text-rose-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                        )}
                     </div>
                   ))}
                </div>
             </div>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
             <button 
              onClick={() => { setIsModalOpen(false); setEditingExpense(null); }} 
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
             >
              <X className="w-6 h-6" />
             </button>
             <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
               {editingExpense ? 'Modify Outflow' : 'Log Expenditure'}
             </h2>
             <p className="text-slate-500 text-[10px] font-black mb-8 uppercase tracking-[0.2em]">
               Financial settlement for site: <span className="text-rose-500">{currentStore.name}</span>
             </p>
             
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Type / Category</label>
                    <div className="relative group">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-rose-500 transition-colors" />
                      <select 
                        name="expCat" 
                        defaultValue={editingExpense?.category} 
                        className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-rose-500 appearance-none"
                      >
                        {/* 🔴 শুধুমাত্র ম্যানুয়াল ক্যাটাগরিগুলোই ড্রপডাউনে আসবে 🔴 */}
                        {manualCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Amount ($)</label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-rose-500 transition-colors" />
                      <input 
                        name="expAmount" 
                        type="number" 
                        step="0.01" 
                        required 
                        defaultValue={editingExpense?.amount}
                        className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-rose-500 font-black focus:border-rose-500 amber-glow" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Memo / Description</label>
                  <textarea 
                    name="expDesc" 
                    required 
                    defaultValue={editingExpense?.description}
                    placeholder="Provide specific details for this expenditure..." 
                    className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-rose-500 amber-glow h-32 resize-none" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-rose-500 text-white py-5 rounded-[2rem] font-black shadow-2xl shadow-rose-900/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : (editingExpense ? 'Authorize Modification' : 'Authorize Settlement')} 
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
<div className="space-y-8 animate-in fade-in duration-700"></div>