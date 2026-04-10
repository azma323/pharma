import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ScanLine, Settings, Menu, Warehouse, UserCircle,
  ShieldCheck, ShieldOff, ChevronDown, ShoppingBag, ShoppingCart, Bell, Search,
  Users as UsersIcon, X, Wallet, LogOut, Users, Truck, AlertTriangle, Trash2, History,
  Wifi, WifiOff, AlertOctagon, Pill, Clock
} from 'lucide-react';
import { User, Store, UserRole, Product, UserPermissions } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  currentStore: Store;
  stores: Store[];
  users: User[];
  products: Product[];
  onStoreChange: (store: Store) => void;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, currentUser, currentStore, stores, users, products, onStoreChange, onUserChange, onLogout
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const location = useLocation();

  // 🔴 Network Status Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPermission = (action: keyof UserPermissions) => {
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;
    return currentUser.permissions?.[action] || false;
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', allowed: currentUser.role !== UserRole.SALESMAN },
    { name: 'Inventory', icon: Package, path: '/inventory', allowed: true },
    { name: 'POS / Sales', icon: ShoppingCart, path: '/sales', allowed: true },
    { name: 'Purchases', icon: ShoppingBag, path: '/purchases', allowed: true },
    { name: 'Wastage', icon: Trash2, path: '/wastage', allowed: currentUser.role !== UserRole.SALESMAN },
    { name: 'Expenses', icon: Wallet, path: '/expenses', allowed: currentUser.role !== UserRole.SALESMAN },
    { name: 'Cash Funds', icon: DollarSignIcon, path: '/funds', allowed: currentUser.role !== UserRole.SALESMAN },
    { name: 'Patients', icon: Users, path: '/customers', allowed: true },
    { name: 'Companies', icon: Truck, path: '/suppliers', allowed: true },
    { name: 'Scanner', icon: ScanLine, path: '/scanner', allowed: true },
    { name: 'Staff Users', icon: UsersIcon, path: '/users', allowed: currentUser.role === UserRole.SUPER_ADMIN || checkPermission('user_control_access') },
    { name: 'Settings', icon: Settings, path: '/settings', allowed: currentUser.role === UserRole.SUPER_ADMIN },
  ];

  // 🔴 Pharmacy Alerts Engine
  const getExpiryStatus = (dateStr?: string) => {
    if(!dateStr) return null;
    const diffDays = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 90) return 'NEAR_EXPIRY';
    return null;
  };

  const alerts = useMemo(() => {
    const storeProducts = products.filter(p => p.storeId === currentStore.id);
    
    const lowStock = storeProducts.filter(p => p.quantity <= p.minThreshold);
    const expired = storeProducts.filter(p => getExpiryStatus(p.expiryDate) === 'EXPIRED');
    const nearExpiry = storeProducts.filter(p => getExpiryStatus(p.expiryDate) === 'NEAR_EXPIRY');

    // Remove duplicates (e.g., if a product is both expired and low stock, prioritize expired)
    const uniqueLowStock = lowStock.filter(p => getExpiryStatus(p.expiryDate) !== 'EXPIRED' && getExpiryStatus(p.expiryDate) !== 'NEAR_EXPIRY');

    return { 
      lowStock: uniqueLowStock, 
      expired, 
      nearExpiry, 
      total: uniqueLowStock.length + expired.length + nearExpiry.length 
    };
  }, [products, currentStore.id]);

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden selection:bg-amber-400/30 selection:text-amber-400">
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-slate-900 border-r border-slate-800 transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-24 flex items-center justify-between px-8 border-b border-slate-800/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Warehouse className="w-5 h-5 text-slate-950" />
             </div>
             <div>
               <h1 className="text-xl font-black tracking-tighter text-white leading-none">BDT-POS</h1>
               <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Pharmacy Edition</p>
             </div>
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white bg-slate-800 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
          {navItems.filter(item => item.allowed).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.name} to={item.path} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${isActive ? 'bg-amber-400/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-bold text-sm tracking-wide">{item.name}</span>
                {isActive && <motion.div layoutId="activeNav" className="absolute left-0 w-1.5 h-8 bg-amber-400 rounded-r-full" />}
              </Link>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-800/50">
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-4">
             <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-slate-300"><UserCircle className="w-6 h-6" /></div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black text-white truncate">{currentUser.name}</p>
               <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest truncate">{currentUser.role.replace('_', ' ')}</p>
             </div>
             <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-800 rounded-xl transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        
        {/* Header */}
        <header className="h-24 flex items-center justify-between px-6 lg:px-10 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-colors shadow-xl"><Menu className="w-5 h-5" /></button>
            
            <div className="relative">
              <button onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)} disabled={currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.STORE_OWNER} className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md border border-slate-800 px-5 py-3 rounded-2xl hover:border-amber-400/50 transition-all shadow-xl group">
                 <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform"><Warehouse className="w-4 h-4" /></div>
                 <div className="text-left hidden sm:block">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Active Hub</p>
                   <p className="text-sm font-black text-white leading-none">{currentStore.name}</p>
                 </div>
                 {(currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.STORE_OWNER) && <ChevronDown className={`w-4 h-4 text-slate-500 ml-2 transition-transform duration-300 ${isStoreMenuOpen ? 'rotate-180' : ''}`} />}
              </button>

              <AnimatePresence>
                {isStoreMenuOpen && (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.STORE_OWNER) && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setIsStoreMenuOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-800 mb-2"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Switch Branch / Hub</p></div>
                      {stores.map((store) => (
                        <button key={store.id} onClick={() => { onStoreChange(store); setIsStoreMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${currentStore.id === store.id ? 'bg-amber-400/10 text-amber-400' : 'hover:bg-slate-800 text-slate-300'}`}>
                          <Warehouse className="w-4 h-4" /><span className="font-bold text-sm">{store.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 relative">
             {/* 🔴 Connection Status Indicator */}
             <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="text-[9px] font-black uppercase tracking-widest">{isOnline ? 'Cloud Sync On' : 'Offline Mode'}</span>
             </div>

             <div className="relative">
                <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-3.5 bg-slate-900/50 backdrop-blur-md border border-slate-800 text-slate-400 rounded-2xl hover:text-amber-400 hover:border-amber-400/30 transition-all shadow-xl relative group">
                  <Bell className="w-5 h-5 group-hover:animate-wiggle" />
                  {alerts.total > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 border-2 border-slate-950 rounded-full flex items-center justify-center text-[9px] font-black text-white animate-pulse-slow">
                      {alerts.total > 9 ? '9+' : alerts.total}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationOpen && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-0 mt-4 w-[340px] sm:w-[400px] bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden z-50">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-black text-white tracking-tight">Pharmacy Alerts</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Requires Attention ({alerts.total})</p>
                          </div>
                          {alerts.total > 0 && <div className="p-2 bg-rose-500/10 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-500" /></div>}
                        </div>
                        
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {alerts.total > 0 ? (
                            <>
                              {/* Expired Alerts */}
                              {alerts.expired.map(p => (
                                <div key={p.id} className="p-4 hover:bg-slate-800/50 rounded-2xl transition-colors flex gap-4 group">
                                  <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 shrink-0"><AlertOctagon className="w-5 h-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                       <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">Expired</span>
                                       <span className="text-[9px] font-bold text-slate-500 uppercase">BCH: {p.batchNumber || 'N/A'}</span>
                                    </div>
                                    <Link to="/inventory" onClick={() => setIsNotificationOpen(false)} className="text-[9px] text-rose-400 font-black uppercase tracking-widest mt-2 inline-block hover:underline">Remove from shelf</Link>
                                  </div>
                                </div>
                              ))}

                              {/* Near Expiry Alerts */}
                              {alerts.nearExpiry.map(p => (
                                <div key={p.id} className="p-4 hover:bg-slate-800/50 rounded-2xl transition-colors flex gap-4 group">
                                  <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400 shrink-0"><Clock className="w-5 h-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                       <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Near Expiry</span>
                                       <span className="text-[9px] font-bold text-slate-500 uppercase">Exp: {new Date(p.expiryDate!).toLocaleDateString('en-GB')}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Low Stock Alerts */}
                              {alerts.lowStock.map(p => (
                                <div key={p.id} className="p-4 hover:bg-slate-800/50 rounded-2xl transition-colors flex gap-4 group">
                                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0"><Package className="w-5 h-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">Stock critical: <span className="text-orange-400 font-black">{p.quantity} units</span> left.</p>
                                    <Link to="/purchases" onClick={() => setIsNotificationOpen(false)} className="text-[9px] text-orange-400 font-black uppercase tracking-widest mt-2 inline-block hover:underline">Order Restock</Link>
                                  </div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="px-5 py-10 text-center opacity-30 grayscale">
                              <Bell className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No active alerts</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 lg:pt-4 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

// SVG Icon Helper for Cash Funds
const DollarSignIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);

export default Layout;