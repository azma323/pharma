import React, { useState, useEffect } from 'react';
import { Store, User, StorePayment, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { 
  Settings as SettingsIcon, Store as StoreIcon, CreditCard, Lock, Plus, 
  Trash2, Edit2, X, AlertCircle, CheckCircle2, CalendarClock, Clock, RefreshCw, Download, Upload 
} from 'lucide-react';
import Swal from 'sweetalert2'; 

interface SettingsProps {
  stores: Store[];
  currentUser: User;
  users: User[];
  currentStore: Store;
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setCurrentStore: React.Dispatch<React.SetStateAction<Store | null>>;
  onDeleteStore: (id: string) => void | Promise<void>;
  onDownloadBackup: (storeId: string, storeName: string) => Promise<void>;
  onRestoreBackup: (storeId: string, storeName: string, file: File) => Promise<void>;
  canEditStores: boolean;
}

const Settings: React.FC<SettingsProps> = ({ stores, currentUser, users, setStores, setCurrentUser, onDeleteStore, onDownloadBackup, onRestoreBackup, canEditStores }) => {
  const [activeTab, setActiveTab] = useState<'hubs' | 'billing' | 'security'>('hubs');
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [backingUpStoreId, setBackingUpStoreId] = useState<string | null>(null);

  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const fetchPayments = async () => {
    setIsSyncing(true);
    try {
      const { data } = await supabase.from('store_payments').select('*').order('paymentDate', { ascending: false });
      if (data) setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [activeTab]);

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const form = e.target as HTMLFormElement;
    
    const storePayload = {
      name: form.storeName.value,
      location: form.storeLocation.value,
      monthlyFee: parseFloat(form.monthlyFee.value) || 0,
      billingStartMonth: form.billingStartMonth.value
    };

    try {
      if (editingStore) {
        const { data, error } = await supabase.from('stores').update(storePayload).eq('id', editingStore.id).select().single();
        if (error) throw error;
        if (data) {
          setStores(prev => prev.map(s => s.id === editingStore.id ? data : s));
          Swal.fire({ icon: 'success', title: 'Updated!', text: 'Store updated successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
        }
      } else {
        const { data, error } = await supabase.from('stores').insert([storePayload]).select().single();
        if (error) throw error;
        if (data) {
          setStores(prev => [...prev, data]);
          Swal.fire({ icon: 'success', title: 'Registered!', text: 'New store registered.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
        }
      }
      setIsStoreModalOpen(false);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadClick = async (storeId: string, storeName: string) => {
    const result = await Swal.fire({
      title: 'Download Backup?',
      text: `Do you want to download backup for "${storeName}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Download',
      customClass: { popup: 'rounded-[2rem]' }
    });

    if(result.isConfirmed) {
      setBackingUpStoreId(storeId);
      await onDownloadBackup(storeId, storeName);
      setBackingUpStoreId(null);
    }
  };

  const handleUploadClick = async (storeId: string, storeName: string) => {
    const result = await Swal.fire({
      title: '⚠️ Warning!',
      text: `Restoring data for "${storeName}" will overwrite current inventory. Are you sure?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Restore',
      customClass: { popup: 'rounded-[2rem]' }
    });

    if(result.isConfirmed) {
        document.getElementById(`backup-upload-${storeId}`)?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, storeId: string, storeName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onRestoreBackup(storeId, storeName, file);
    e.target.value = ''; 
  };

  const handleApprovePayment = async (paymentId: string) => {
    const result = await Swal.fire({ title: 'Approve Payment?', icon: 'question', showCancelButton: true, confirmButtonColor: '#10b981', customClass: { popup: 'rounded-[2rem]' } });
    if (!result.isConfirmed) return;
    
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'PAID' } : p));
    await supabase.from('store_payments').update({ status: 'PAID' }).eq('id', paymentId);
    Swal.fire({ icon: 'success', title: 'Approved', timer: 1000, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
  };

  const handleRejectPayment = async (paymentId: string) => {
    const result = await Swal.fire({ title: 'Reject Payment?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', customClass: { popup: 'rounded-[2rem]' } });
    if (!result.isConfirmed) return;

    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'REJECTED' } : p));
    await supabase.from('store_payments').update({ status: 'REJECTED' }).eq('id', paymentId);
    Swal.fire({ icon: 'info', title: 'Rejected', timer: 1000, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) return alert("New passwords do not match!");
    if (currentUser.password && passwordData.current !== currentUser.password) return alert("Current password is incorrect!");

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.from('users').update({ password: passwordData.new }).eq('id', currentUser.id);
      if (error) throw error;
      setCurrentUser({ ...currentUser, password: passwordData.new });
      Swal.fire({ icon: 'success', title: 'Password Updated!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, customClass: { popup: 'rounded-[2rem]' } });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'PENDING');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
        <SettingsIcon className="w-8 h-8 text-amber-500" />
        <h1 className="text-3xl font-black text-white tracking-tight">System Settings</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <button onClick={() => setActiveTab('hubs')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest ${activeTab === 'hubs' ? 'bg-amber-400 text-slate-950 shadow-xl' : 'bg-slate-900 text-slate-500'}`}><div className="flex items-center gap-2"><StoreIcon className="w-4 h-4" /> Store Hubs</div></button>
        <button onClick={() => setActiveTab('billing')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest ${activeTab === 'billing' ? 'bg-amber-400 text-slate-950 shadow-xl' : 'bg-slate-900 text-slate-500'}`}><div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Billing Requests</div></button>
        <button onClick={() => setActiveTab('security')} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest ${activeTab === 'security' ? 'bg-amber-400 text-slate-950 shadow-xl' : 'bg-slate-900 text-slate-500'}`}><div className="flex items-center gap-2"><Lock className="w-4 h-4" /> Security</div></button>
      </div>

      {activeTab === 'hubs' && (
        <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Registered Stores</h2>
            {canEditStores && (
              <button onClick={() => { setEditingStore(null); setIsStoreModalOpen(true); }} className="bg-slate-800 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-amber-400 hover:text-slate-950 transition-colors text-xs uppercase tracking-widest"><Plus className="w-4 h-4" /> Add Store</button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map(store => (
              <div key={store.id} className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 flex flex-col justify-between hover:border-amber-400/30 transition-colors">
                <div>
                  <h3 className="text-lg font-black text-white mb-1">{store.name}</h3>
                  <p className="text-xs text-slate-400 font-bold mb-4">{store.location}</p>
                  <div className="flex gap-2 mb-4">
                    <div className="bg-slate-900 px-4 py-2 rounded-xl inline-block">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Monthly Fee</p>
                      <p className="text-amber-400 font-black">${store.monthlyFee || 0}</p>
                    </div>
                    <div className="bg-slate-900 px-4 py-2 rounded-xl inline-block">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Billing Starts</p>
                      <p className="text-emerald-400 font-black">{store.billingStartMonth || 'Not Set'}</p>
                    </div>
                  </div>
                </div>
                {canEditStores && (
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-700/50">
                    <button onClick={() => handleDownloadClick(store.id, store.name)} disabled={backingUpStoreId === store.id} className="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
                      {backingUpStoreId === store.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleUploadClick(store.id, store.name)} className="p-2 text-slate-400 hover:text-blue-400 transition-colors">
                      <Upload className="w-4 h-4" />
                    </button>
                    <input type="file" id={`backup-upload-${store.id}`} accept=".json" className="hidden" onChange={(e) => handleFileChange(e, store.id, store.name)} />
                    <button onClick={() => { setEditingStore(store); setIsStoreModalOpen(true); }} className="p-2 text-slate-400 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={async () => {
                       const res = await Swal.fire({title: 'Delete Store?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', customClass: {popup: 'rounded-[2rem]'}});
                       if(res.isConfirmed) onDeleteStore(store.id);
                    }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3"><CalendarClock className="w-6 h-6 text-amber-500" /><h2 className="text-xl font-black text-white uppercase tracking-widest">Pending Approvals</h2></div>
               <button onClick={fetchPayments} disabled={isSyncing} className="bg-slate-800 text-amber-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-slate-700">
                 <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Data
               </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="px-6 py-5">Store Name</th>
                    <th className="px-6 py-5 text-center">Month</th>
                    <th className="px-6 py-5 text-center">Amount</th>
                    <th className="px-6 py-5 text-center">TrxID</th>
                    <th className="px-6 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {pendingPayments.map(payment => {
                    const store = stores.find(s => s.id === payment.storeId);
                    return (
                      <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-5 font-bold text-white text-sm">{store?.name || 'Unknown Store'}</td>
                        <td className="px-6 py-5 text-center font-black text-amber-400 uppercase tracking-widest text-[10px]">{new Date(payment.monthYear + "-01").toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-5 text-center font-black text-slate-300">${payment.amountPaid}</td>
                        <td className="px-6 py-5 text-center font-black text-emerald-400 tracking-widest">{payment.trxId}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleApprovePayment(payment.id)} className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Approve</button>
                            <button onClick={() => handleRejectPayment(payment.id)} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Reject</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingPayments.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">No pending payment requests</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <StoreIcon className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-black text-white uppercase tracking-widest">
                Store Status ({new Date(currentMonthYear + "-01").toLocaleString('en-GB', { month: 'long', year: 'numeric' })})
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="px-6 py-5">Store Name</th>
                    <th className="px-6 py-5">Owner Name</th>
                    <th className="px-6 py-5">Phone</th>
                    <th className="px-6 py-5 text-center">Monthly Fee</th>
                    <th className="px-6 py-5 text-center text-rose-400">Due Months</th>
                    <th className="px-6 py-5 text-center text-rose-400">Total Due</th>
                    <th className="px-6 py-5 text-center">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {stores.map(store => {
                    const storePayments = payments.filter(p => p.storeId === store.id && p.monthYear === currentMonthYear);
                    const isPaid = storePayments.some(p => p.status === 'PAID');
                    const isPending = storePayments.some(p => p.status === 'PENDING');
                    const status = isPaid ? 'PAID' : (isPending ? 'PENDING' : 'DUE');
                    
                    // 🔴 100% Perfect Match Logic for assignedStoreId 🔴
                    const storeUser = users?.find(u => 
                      String((u as any).assignedStoreId) === String(store.id) && 
                      u.role !== UserRole.SUPER_ADMIN
                    );
                    
                    const ownerName = storeUser?.name || 'Not Set';
                    const ownerPhone = storeUser?.phone || 'Not Set';

                    let monthsDue = 0;
                    let totalDue = 0;
                    if (store.billingStartMonth && store.monthlyFee) {
                      const [startYear, startMonth] = store.billingStartMonth.split('-').map(Number);
                      const [currYear, currMonth] = currentMonthYear.split('-').map(Number);
                      const totalMonthsActive = (currYear - startYear) * 12 + (currMonth - startMonth) + 1;
                      
                      if (totalMonthsActive > 0) {
                        const paidMonthsCount = payments.filter(p => p.storeId === store.id && p.status === 'PAID').length;
                        monthsDue = totalMonthsActive - paidMonthsCount;
                        if (monthsDue < 0) monthsDue = 0;
                        totalDue = monthsDue * store.monthlyFee;
                      }
                    }

                    return (
                      <tr key={store.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-5 font-bold text-white text-sm">{store.name}</td>
                        <td className="px-6 py-5 font-semibold text-slate-300 text-sm">{ownerName}</td>
                        <td className="px-6 py-5 font-semibold text-slate-300 text-sm">{ownerPhone}</td>
                        <td className="px-6 py-5 text-center font-black text-slate-300">${store.monthlyFee || 0}</td>
                        <td className="px-6 py-5 text-center font-black text-rose-400">{monthsDue} Month(s)</td>
                        <td className="px-6 py-5 text-center font-black text-rose-500">${totalDue}</td>
                        <td className="px-6 py-5 text-center">
                           {status === 'PAID' && <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 inline-block w-24">PAID</span>}
                           {status === 'PENDING' && <span className="bg-amber-400/20 text-amber-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-400/30 inline-block w-24">PENDING</span>}
                           {status === 'DUE' && <span className="bg-rose-500/20 text-rose-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/30 inline-block w-24">DUE</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
             <Lock className="w-6 h-6 text-amber-500" />
             <div>
               <h2 className="text-xl font-black text-white uppercase tracking-widest">Account Security</h2>
               <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Update your login password</p>
             </div>
          </div>
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Current Password</label><input type="password" required value={passwordData.current} onChange={e => setPasswordData({...passwordData, current: e.target.value})} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">New Password</label><input type="password" required minLength={6} value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Confirm New Password</label><input type="password" required minLength={6} value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" /></div>
            <button type="submit" disabled={isUpdatingPassword} className="w-full bg-amber-400 text-slate-950 py-5 rounded-[2rem] font-black mt-4 hover:scale-[1.02] transition-transform uppercase tracking-widest text-xs disabled:opacity-50">{isUpdatingPassword ? 'Updating...' : 'Update Password'}</button>
          </form>
        </div>
      )}

      {isStoreModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
             <button onClick={() => setIsStoreModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
             <h2 className="text-2xl font-black text-white mb-6 tracking-tight">{editingStore ? 'Update Store' : 'Register Store'}</h2>
             
             <form onSubmit={handleStoreSubmit} className="space-y-5">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Store Name</label><input name="storeName" required defaultValue={editingStore?.name} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Location</label><input name="storeLocation" required defaultValue={editingStore?.location} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" /></div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Billing Start Month</label>
                  <input name="billingStartMonth" type="month" required defaultValue={editingStore?.billingStartMonth || currentMonthYear} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-amber-400 amber-glow" />
                </div>

                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Monthly Subscription Fee ($)</label><input name="monthlyFee" type="number" step="0.01" required defaultValue={editingStore?.monthlyFee || 0} className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-emerald-400 font-black focus:border-amber-400 amber-glow" /></div>

                <button type="submit" disabled={isLoading} className="w-full bg-amber-400 text-slate-950 py-5 rounded-[2rem] font-black mt-4 hover:scale-[1.02] transition-transform uppercase tracking-widest text-xs disabled:opacity-50">{isLoading ? 'Processing...' : 'Save Configuration'}</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;