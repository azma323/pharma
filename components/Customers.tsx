import React, { useState, useMemo } from 'react';
import { Customer, Store, User, Sale } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  DollarSign, 
  Trash2, 
  Edit2,
  Download,
  UserPlus,
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';

interface CustomersProps {
  customers: Customer[];
  currentStore: Store;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void | Promise<void>;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => void | Promise<void>;
  onDeleteCustomer: (id: string) => void | Promise<void>;
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void | Promise<void>;
  onUpdateCustomerDue: (id: string, amount: number) => void | Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
}

const Customers: React.FC<CustomersProps> = ({ 
  customers, 
  currentStore, 
  onAddCustomer, 
  onUpdateCustomer, 
  onDeleteCustomer,
  onAddSale,
  onUpdateCustomerDue,
  canEdit,
  canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => c.storeId === currentStore.id)
      .filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
      );
  }, [customers, currentStore.id, searchTerm]);

  const totalDues = useMemo(() => {
    return filteredCustomers.reduce((acc, curr) => acc + curr.totalDue, 0);
  }, [filteredCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingCustomer) {
        await onUpdateCustomer(editingCustomer.id, { name, phone, address });
        Swal.fire({ icon: 'success', title: 'Updated!', text: 'Customer profile modified.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      } else {
        await onAddCustomer({
          name,
          phone,
          address,
          totalDue: 0,
          storeId: currentStore.id
        });
        Swal.fire({ icon: 'success', title: 'Registered!', text: 'New customer profile synchronized.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      }
      resetForm();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Operation Failed', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    setIsLoading(true);

    try {
      await onAddSale({
        invoiceId: `PAY-${Date.now().toString().slice(-6)}`,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        productId: null as unknown as string, 
        productName: 'Due Payment Received',
        quantity: 1,
        buyingPrice: 0,
        unitPrice: paymentAmount,
        discount: 0,
        totalPrice: paymentAmount,
        amountPaid: paymentAmount,
        amountDue: 0,
        storeId: currentStore.id
      });

      await onUpdateCustomerDue(selectedCustomer.id, -paymentAmount);

      Swal.fire({ icon: 'success', title: 'Payment Successful', text: `$${paymentAmount} received from ${selectedCustomer.name}`, timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      setIsPaymentModalOpen(false);
      setSelectedCustomer(null);
      setPaymentAmount(0);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Payment Failed', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address);
    setIsModalOpen(true);
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.totalDue);
    setIsPaymentModalOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Address', 'Total Due'];
    const data = filteredCustomers.map(c => [
      c.name,
      c.phone,
      c.address.replace(/,/g, ';'),
      c.totalDue.toFixed(2)
    ]);
    
    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_${currentStore.name.replace(/\s+/g, '_')}.csv`);
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
            CRM & Dues
            <span className="bg-amber-400/10 text-amber-400 text-xs py-1 px-3 rounded-full border border-amber-400/20 uppercase tracking-widest font-bold">Accounts Receivable</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage customer profiles and outstanding balances for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-xl"
          >
            <Download className="w-5 h-5" />
          </button>
          {canEdit && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/10 uppercase tracking-widest text-xs"
            >
              <UserPlus className="w-5 h-5 stroke-[3px]" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 flex items-center gap-6 group hover:border-amber-400/30 transition-all">
          <div className="w-14 h-14 bg-amber-400/10 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Customers</p>
            <h3 className="text-2xl font-black text-white">{filteredCustomers.length}</h3>
          </div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 flex items-center gap-6 group hover:border-rose-400/30 transition-all">
          <div className="w-14 h-14 bg-rose-400/10 rounded-2xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Outstanding</p>
            <h3 className="text-2xl font-black text-rose-400">${totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="relative group mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 focus:border-amber-400 transition-all amber-glow" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-5">Customer</th>
                <th className="px-6 py-5">Contact</th>
                <th className="px-6 py-5">Address</th>
                <th className="px-6 py-5 text-right">Outstanding Due</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="group hover:bg-slate-800/40 transition-all">
                  <td className="px-6 py-5">
                    <p className="font-black text-white text-sm">{customer.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Ref: {customer.id.substring(0, 8)}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Phone className="w-3 h-3 text-amber-500" />
                      {customer.phone}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-400 text-xs truncate max-w-[200px]">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {customer.address}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className={`font-black text-sm ${customer.totalDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ${customer.totalDue.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {customer.totalDue > 0 && (
                        <button 
                          onClick={() => openPaymentModal(customer)}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-white transition-all"
                        >
                          Receive Payment
                        </button>
                      )}
                      {canEdit && (
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-slate-600 hover:text-amber-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => onDeleteCustomer(customer.id)}
                          className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">{editingCustomer ? 'Edit Profile' : 'Add Customer'}</h2>
                <button onClick={resetForm} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Full Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Personnel Identifier" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Phone Number</label>
                  <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880..." className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Address</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Geographical Location" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow h-32 resize-none" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 rounded-[2rem] font-black shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                  {isLoading ? 'Processing...' : (editingCustomer ? 'Synchronize Profile' : 'Authorize Registration')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isPaymentModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Receive Settlement</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="mb-6 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Customer</p>
                <p className="text-white font-black">{selectedCustomer.name}</p>
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Due</p>
                  <p className="text-rose-400 font-black">${selectedCustomer.totalDue.toFixed(2)}</p>
                </div>
              </div>
              <form onSubmit={handleReceivePayment} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Settlement Amount ($)</label>
                  <input required type="number" step="0.01" max={selectedCustomer.totalDue} value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="Enter amount received" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-amber-400 amber-glow" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white rounded-[2rem] font-black shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                  {isLoading ? 'Processing...' : 'Confirm Settlement'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;