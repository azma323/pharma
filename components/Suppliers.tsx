import React, { useState, useMemo } from 'react';
import { Supplier, Store, Expense } from '../types';
import { 
  Truck, Search, Phone, MapPin, DollarSign, Trash2, Edit2,
  Download, Briefcase, X, UserCircle, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';

interface SuppliersProps {
  suppliers: Supplier[];
  currentStore: Store;
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void | Promise<void>;
  onUpdateSupplier: (id: string, updates: Partial<Supplier>) => void | Promise<void>;
  onDeleteSupplier: (id: string) => void | Promise<void>;
  onAddExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void | Promise<void>;
  onUpdateSupplierDue: (id: string, amount: number) => void | Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
}

const Suppliers: React.FC<SuppliersProps> = ({ 
  suppliers, currentStore, onAddSupplier, onUpdateSupplier, onDeleteSupplier,
  onAddExpense, onUpdateSupplierDue, canEdit, canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(false); 

  // Form States
  const [name, setName] = useState(''); // Company Name
  const [phone, setPhone] = useState(''); // Company Phone
  const [address, setAddress] = useState('');
  const [amName, setAmName] = useState('');
  const [amPhone, setAmPhone] = useState('');
  const [srName, setSrName] = useState('');
  const [srPhone, setSrPhone] = useState('');
  
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter(s => s.storeId === currentStore.id)
      .filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.srName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.srPhone || '').includes(searchTerm)
      );
  }, [suppliers, currentStore.id, searchTerm]);

  const totalDues = useMemo(() => {
    return filteredSuppliers.reduce((acc, curr) => acc + curr.totalDue, 0);
  }, [filteredSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = { 
        name, phone, address, amName, amPhone, srName, srPhone 
      };

      if (editingSupplier) {
        await onUpdateSupplier(editingSupplier.id, payload);
        Swal.fire({ icon: 'success', title: 'Updated!', text: 'Company profile updated.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      } else {
        await onAddSupplier({
          ...payload,
          totalDue: 0,
          storeId: currentStore.id
        });
        Swal.fire({ icon: 'success', title: 'Registered!', text: 'New company registered successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      }
      resetForm();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Operation Failed', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || paymentAmount <= 0) return;
    setIsLoading(true);

    try {
      await onAddExpense({
        storeId: currentStore.id,
        category: 'Supplier Payment',
        amount: paymentAmount,
        description: `Settlement payment to: ${selectedSupplier.name}`
      });

      await onUpdateSupplierDue(selectedSupplier.id, -paymentAmount);

      Swal.fire({ icon: 'success', title: 'Payment Sent', text: `$${paymentAmount} paid to ${selectedSupplier.name}`, timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      setIsPaymentModalOpen(false);
      setSelectedSupplier(null);
      setPaymentAmount(0);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Payment Failed', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setPhone(''); setAddress('');
    setAmName(''); setAmPhone(''); setSrName(''); setSrPhone('');
    setEditingSupplier(null); setIsModalOpen(false);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setAmName(supplier.amName || '');
    setAmPhone(supplier.amPhone || '');
    setSrName(supplier.srName || '');
    setSrPhone(supplier.srPhone || '');
    setIsModalOpen(true);
  };

  const openPaymentModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentAmount(supplier.totalDue);
    setIsPaymentModalOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Company Name', 'Area Manager', 'AM Phone', 'Representative (SR)', 'SR Phone', 'Total Due'];
    const data = filteredSuppliers.map(s => [
      s.name,
      s.amName || 'N/A',
      s.amPhone || 'N/A',
      s.srName || 'N/A',
      s.srPhone || 'N/A',
      s.totalDue.toFixed(2)
    ]);
    
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `companies_${currentStore.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Company Directory
            <span className="bg-amber-400/10 text-amber-400 text-xs py-1 px-3 rounded-full border border-amber-400/20 uppercase tracking-widest font-bold">Accounts Payable</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage medicine companies, SR and AM contacts for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl"><Download className="w-5 h-5" /></button>
          {canEdit && (
            <button onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }} className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/10 uppercase tracking-widest text-xs">
              <Briefcase className="w-5 h-5 stroke-[3px]" /> Add Company
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 flex items-center gap-6 group hover:border-amber-400/30 transition-all">
          <div className="w-14 h-14 bg-amber-400/10 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform"><Truck className="w-7 h-7" /></div>
          <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Listed Companies</p><h3 className="text-2xl font-black text-white">{filteredSuppliers.length}</h3></div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 flex items-center gap-6 group hover:border-rose-400/30 transition-all">
          <div className="w-14 h-14 bg-rose-400/10 rounded-2xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform"><DollarSign className="w-7 h-7" /></div>
          <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Payable</p><h3 className="text-2xl font-black text-rose-400">${totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3></div>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="relative group mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
          <input type="text" placeholder="Search by Company, SR Name or Phone..." className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 focus:border-amber-400 transition-all amber-glow" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-5">Company Info</th>
                <th className="px-6 py-5">Area Manager (AM)</th>
                <th className="px-6 py-5">Representative (SR)</th>
                <th className="px-6 py-5 text-right">Outstanding Payable</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="group hover:bg-slate-800/40 transition-all">
                  <td className="px-6 py-5">
                    <p className="font-black text-white text-sm">{supplier.name}</p>
                    <div className="flex flex-col gap-1 mt-1">
                       {supplier.phone && <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Phone className="w-3 h-3 text-amber-500"/> {supplier.phone}</span>}
                       {supplier.address && <span className="text-[10px] text-slate-500 truncate max-w-[150px] flex items-center gap-1"><MapPin className="w-3 h-3"/> {supplier.address}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {supplier.amName ? (
                      <div>
                        <p className="text-sm font-bold text-slate-300 flex items-center gap-1"><UserCircle className="w-4 h-4 text-slate-500"/>{supplier.amName}</p>
                        {supplier.amPhone && <p className="text-[10px] text-emerald-400 font-black tracking-widest mt-1">{supplier.amPhone}</p>}
                      </div>
                    ) : <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">N/A</span>}
                  </td>
                  <td className="px-6 py-5">
                    {supplier.srName ? (
                      <div className="bg-slate-800/50 p-2 rounded-xl inline-block border border-slate-700/50">
                        <p className="text-xs font-bold text-amber-400 flex items-center gap-1"><Users className="w-3 h-3"/>{supplier.srName}</p>
                        {supplier.srPhone && <p className="text-[10px] text-slate-400 font-black tracking-widest mt-1">{supplier.srPhone}</p>}
                      </div>
                    ) : <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">N/A</span>}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className={`font-black text-sm ${supplier.totalDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>${supplier.totalDue.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {supplier.totalDue > 0 && (
                        <button onClick={() => openPaymentModal(supplier)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Pay Company</button>
                      )}
                      {canEdit && <button onClick={() => handleEdit(supplier)} className="p-2 text-slate-600 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>}
                      {canDelete && <button onClick={() => onDeleteSupplier(supplier.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetForm} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">{editingSupplier ? 'Edit Company Profile' : 'Add New Company'}</h2>
                <button onClick={resetForm} className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
                  <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-slate-700 pb-2">1. Company Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Company Name *</label>
                      <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Square Pharma" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Office Phone</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Head office number" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Company Address</label>
                      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Physical Address" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-amber-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AM Box */}
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-slate-700 pb-2">2. Area Manager (AM)</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">AM Name</label>
                      <input value={amName} onChange={e => setAmName(e.target.value)} placeholder="Manager's Name" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-blue-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">AM Phone</label>
                      <input value={amPhone} onChange={e => setAmPhone(e.target.value)} placeholder="+880..." className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-blue-400" />
                    </div>
                  </div>

                  {/* SR Box */}
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700 pb-2">3. Representative (SR)</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">SR Name</label>
                      <input value={srName} onChange={e => setSrName(e.target.value)} placeholder="Order Cutter's Name" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">SR Phone</label>
                      <input value={srPhone} onChange={e => setSrPhone(e.target.value)} placeholder="+880..." className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold focus:border-emerald-400" />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full py-5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 rounded-[2rem] font-black shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                  {isLoading ? 'Synchronizing...' : 'Save Company Profile'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isPaymentModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Company Payment</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="mb-6 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Company</p>
                <p className="text-white font-black">{selectedSupplier.name}</p>
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Payable</p>
                  <p className="text-rose-400 font-black">${selectedSupplier.totalDue.toFixed(2)}</p>
                </div>
              </div>
              <form onSubmit={handlePaySupplier} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Settlement Amount ($)</label>
                  <input required type="number" step="0.01" max={selectedSupplier.totalDue} value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="Enter amount to pay" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-rose-400 font-black focus:border-amber-400 amber-glow" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-5 bg-gradient-to-r from-rose-500 to-rose-700 text-white rounded-[2rem] font-black shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                  {isLoading ? 'Settling...' : 'Confirm Settlement'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Suppliers;