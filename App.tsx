import React, { useState, useEffect, useCallback, Suspense, lazy, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './components/Login';
import { Store, Product, User, UserRole, Sale, Expense, Customer, Supplier, Purchase, UserPermissions, CashTransaction } from './types';
import Swal from 'sweetalert2';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Inventory = lazy(() => import('./components/Inventory'));
const Sales = lazy(() => import('./components/Sales'));
const Expenses = lazy(() => import('./components/Expenses'));
const Users = lazy(() => import('./components/Users'));
const Customers = lazy(() => import('./components/Customers'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const Purchases = lazy(() => import('./components/Purchases'));
const Wastage = lazy(() => import('./components/Wastage'));
const Scanner = lazy(() => import('./components/Scanner'));
const Settings = lazy(() => import('./components/Settings'));
const CashManagement = lazy(() => import('./components/CashManagement'));

// Helper: Generate UUID locally for Offline Mode
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('omni_auth') === 'true');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('omni_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  
  const [storeInvestment, setStoreInvestment] = useState<number>(0);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);

  const [activities, setActivities] = useState<any[]>(() => {
    const saved = localStorage.getItem('omni_activities');
    return saved ? JSON.parse(saved) : [];
  });

  // ==========================================
  // OFFLINE SYNC ENGINE (BACKGROUND QUEUE)
  // ==========================================
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<any[]>(() => {
    const saved = localStorage.getItem('omni_sync_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

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

  useEffect(() => {
    localStorage.setItem('omni_sync_queue', JSON.stringify(syncQueue));
  }, [syncQueue]);

  const addToQueue = useCallback((action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
    setSyncQueue(prev => [...prev, { id: `sync-${Date.now()}-${Math.random()}`, action, payload, timestamp: Date.now() }]);
  }, []);

  const processSyncQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const failedTasks: any[] = [];
    
    for (const task of syncQueue) {
      try {
        if (task.action === 'INSERT') {
          await supabase.from(task.payload.table).insert([task.payload.data]);
        } else if (task.action === 'UPDATE') {
          await supabase.from(task.payload.table).update(task.payload.data).eq('id', task.payload.id);
        } else if (task.action === 'DELETE') {
          await supabase.from(task.payload.table).delete().eq('id', task.payload.id);
        }
      } catch (error) {
        console.error("Sync error on task:", task, error);
        failedTasks.push(task); 
      }
    }
    
    setSyncQueue(failedTasks);
    setIsSyncing(false);
    
    if (failedTasks.length === 0 && syncQueue.length > 0) {
      Swal.fire({ icon: 'success', title: 'Cloud Synced!', text: 'All offline records have been uploaded successfully.', timer: 3000, toast: true, position: 'top-end', showConfirmButton: false });
    }
  }, [isOnline, syncQueue, isSyncing]);

  useEffect(() => {
    if (isOnline) {
      processSyncQueue();
    }
  }, [isOnline, processSyncQueue]);
  // ==========================================


  const logActivity = useCallback((actionText: string) => {
    const newLog = { id: Date.now().toString(), text: actionText, user: currentUser?.name || 'System', timestamp: new Date().toISOString() };
    setActivities(prev => { const updated = [newLog, ...prev].slice(0, 50); localStorage.setItem('omni_activities', JSON.stringify(updated)); return updated; });
  }, [currentUser]);

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('omni_categories');
    return saved ? JSON.parse(saved) : ['Electronics', 'Clothing', 'Food', 'Others'];
  });

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('omni_expense_categories');
    return saved ? JSON.parse(saved) : ['Salary', 'Rent', 'Transport', 'Utilities', 'Wastage'];
  });

  const resetAllData = useCallback(() => {
    setProducts([]); setSales([]); setExpenses([]); setCustomers([]); setSuppliers([]); setPurchases([]); setUsers([]); setCashTransactions([]);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const fetchInitialMetadata = async () => {
      let storeQuery = supabase.from('stores').select('*');
      if (currentUser.role !== UserRole.SUPER_ADMIN) {
        if (!currentUser.assignedStoreId) { setStores([]); setIsInitialFetchDone(true); return; }
        storeQuery = storeQuery.eq('id', currentUser.assignedStoreId);
      }
      const { data: storesData } = await storeQuery;
      if (storesData && storesData.length > 0) {
        setStores(storesData);
        if (!currentStore || !storesData.find(s => s.id === currentStore.id)) setCurrentStore(storesData[0]);
      }
      let userQuery = supabase.from('users').select('*');
      if (currentUser.role !== UserRole.SUPER_ADMIN) userQuery = userQuery.eq('assignedStoreId', currentUser.assignedStoreId);
      const { data: usersData } = await userQuery;
      if (usersData) setUsers(usersData);
      setIsInitialFetchDone(true);
    };
    fetchInitialMetadata();
  }, [isAuthenticated, currentUser?.id, currentUser?.assignedStoreId]);

  useEffect(() => {
    if (currentStore?.id) {
       const saved = localStorage.getItem(`omni_invest_${currentStore.id}`);
       setStoreInvestment(saved ? parseFloat(saved) : 0);
    }
  }, [currentStore?.id]);

  const handleUpdateInvestment = useCallback((amount: number) => {
    if (currentStore?.id) {
       localStorage.setItem(`omni_invest_${currentStore.id}`, amount.toString());
       setStoreInvestment(amount);
    }
  }, [currentStore?.id]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !currentStore?.id) return;
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.assignedStoreId !== currentStore.id) { resetAllData(); return; }
    
    const fetchStoreData = async () => {
      setIsDataLoading(true); resetAllData(); 
      const storeId = currentStore.id;
      try {
        const [ { data: prodData }, { data: salesData }, { data: expData }, { data: custData }, { data: suppData }, { data: purData }, { data: cashTxData } ] = await Promise.all([
          supabase.from('products').select('*').eq('storeId', storeId),
          supabase.from('sales').select('*').eq('storeId', storeId).order('timestamp', { ascending: false }),
          supabase.from('expenses').select('*').eq('storeId', storeId).order('timestamp', { ascending: false }),
          supabase.from('customers').select('*').eq('storeId', storeId),
          supabase.from('suppliers').select('*').eq('storeId', storeId),
          supabase.from('purchases').select('*').eq('storeId', storeId).order('timestamp', { ascending: false }),
          supabase.from('cash_transactions').select('*').eq('storeId', storeId).order('timestamp', { ascending: false })
        ]);
        setProducts(prodData || []); setSales(salesData || []); setExpenses(expData || []); setCustomers(custData || []); setSuppliers(suppData || []); setPurchases(purData || []); setCashTransactions(cashTxData || []);
      } catch (error) { console.error("Database Fetch Error:", error); } finally { setIsDataLoading(false); }
    };
    fetchStoreData();
  }, [currentStore?.id, currentUser?.id, isAuthenticated]);

  const handleLogout = () => {
    logActivity("Logged out of the system");
    setIsAuthenticated(false); setCurrentUser(null); setCurrentStore(null); setIsInitialFetchDone(false); resetAllData(); localStorage.clear(); 
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user); setIsAuthenticated(true); localStorage.setItem('omni_auth', 'true'); localStorage.setItem('omni_user', JSON.stringify(user));
  };

  const addCashTransaction = useCallback(async (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => {
    const newId = generateUUID();
    const payload = { ...transaction, id: newId, storeId: currentStore?.id };
    const tempTransaction: CashTransaction = { ...payload, timestamp: new Date().toISOString(), amount: Number(transaction.amount) } as CashTransaction;
    setCashTransactions(prev => [tempTransaction, ...prev]);
    logActivity(`Logged Fund Transfer: ${transaction.type}`);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'cash_transactions', data: payload }); return; }
    try { await supabase.from('cash_transactions').insert([payload]); } 
    catch (err) { addToQueue('INSERT', { table: 'cash_transactions', data: payload }); }
  }, [currentStore?.id, logActivity, addToQueue]);

  const deleteCashTransaction = useCallback(async (id: string) => {
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Delete this transaction? Balances will be reverted automatically.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } });
    if (!res.isConfirmed) return;
    setCashTransactions(prev => prev.filter(t => t.id !== id)); 
    logActivity(`Deleted Fund Transaction`); 
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });

    if (!navigator.onLine) { addToQueue('DELETE', { table: 'cash_transactions', id }); return; }
    try { await supabase.from('cash_transactions').delete().eq('id', id); } 
    catch (err) { addToQueue('DELETE', { table: 'cash_transactions', id }); }
  }, [logActivity, addToQueue]);

  const overallBalances = useMemo(() => {
    if (!currentStore) return { cash: 0, bank: 0, card: 0, bkash: 0, nagad: 0 };
    let cash = storeInvestment, bank = 0, card = 0, bkash = 0, nagad = 0;
    sales.filter(s => s.storeId === currentStore.id && !s.invoiceId?.startsWith('VOID-')).forEach(s => {
       const method = s.paymentMethod || 'Cash';
       const amt = Number(s.amountPaid || 0);
       if (method === 'Card') card += amt; else if (method === 'bKash') bkash += amt; else if (method === 'Nagad') nagad += amt; else cash += amt;
    });
    expenses.filter(e => e.storeId === currentStore.id && e.category !== 'Wastage').forEach(e => { cash -= Number(e.amount || 0); });
    cashTransactions.filter(t => t.storeId === currentStore.id).forEach(t => {
      const amt = Number(t.amount || 0);
      const deductFrom = (src: string) => { if (src === 'CASH') cash -= amt; else if (src === 'BANK') bank -= amt; else if (src === 'CARD') card -= amt; else if (src === 'BKASH') bkash -= amt; else if (src === 'NAGAD') nagad -= amt; };
      const addTo = (dest: string) => { if (dest === 'CASH') cash += amt; else if (dest === 'BANK') bank += amt; else if (dest === 'CARD') card += amt; else if (dest === 'BKASH') bkash += amt; else if (dest === 'NAGAD') nagad += amt; };
      if (t.type === 'BANK_DEPOSIT') { cash -= amt; bank += amt; } else if (t.type === 'BANK_WITHDRAWAL') { bank -= amt; cash += amt; } else if (t.type === 'CASH_OUT') deductFrom(t.source); else if (t.type === 'TRANSFER') { deductFrom(t.source); if(t.destination) addTo(t.destination); }
    });
    return { cash, bank, card, bkash, nagad };
  }, [sales, expenses, cashTransactions, currentStore?.id, storeInvestment]); 

  const addSale = useCallback(async (sale: Omit<Sale, 'id' | 'timestamp'>) => {
    if (!sale.invoiceId?.startsWith('PAY-') && sale.productId !== 'PAYMENT_RECEIVED') {
      const product = products.find(p => p.id === sale.productId);
      if (!product || product.quantity < sale.quantity) { Swal.fire({ icon: 'error', title: 'Action Denied', text: 'Insufficient stock!', customClass: { popup: 'rounded-3xl' } }); throw new Error("Insufficient stock"); }
    }
    const newId = generateUUID();
    const payload = { ...sale, id: newId, storeId: currentStore?.id };
    const tempSale = { ...payload, timestamp: new Date().toISOString() } as Sale;
    setSales(prev => [tempSale, ...prev]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'sales', data: payload }); return; }
    try { await supabase.from('sales').insert([payload]); } 
    catch (err) { addToQueue('INSERT', { table: 'sales', data: payload }); }
  }, [currentStore?.id, products, addToQueue]);

  const addProduct = useCallback(async (newProduct: Omit<Product, 'id' | 'lastUpdated'>) => { 
    const newId = generateUUID();
    const payload = { ...newProduct, id: newId, storeId: currentStore?.id };
    const tempProduct = { ...payload, lastUpdated: new Date().toISOString() } as Product;
    setProducts(prev => [...prev, tempProduct]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'products', data: payload }); return tempProduct; }
    try { await supabase.from('products').insert([payload]); return tempProduct; } 
    catch (err) { addToQueue('INSERT', { table: 'products', data: payload }); return tempProduct; }
  }, [currentStore?.id, addToQueue]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => { 
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); 
    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'products', id, data: updates }); return; }
    try { await supabase.from('products').update(updates).eq('id', id); } 
    catch (err) { addToQueue('UPDATE', { table: 'products', id, data: updates }); }
  }, [addToQueue]);

  const updateSale = useCallback(async (id: string, updates: Partial<Sale>) => { 
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)); 
    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'sales', id, data: updates }); return; }
    try { await supabase.from('sales').update(updates).eq('id', id); } 
    catch (err) { addToQueue('UPDATE', { table: 'sales', id, data: updates }); }
  }, [addToQueue]);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'timestamp'>) => { 
    const newId = generateUUID();
    const payload = { ...expense, id: newId, storeId: currentStore?.id };
    const tempExpense = { ...payload, timestamp: new Date().toISOString() } as Expense;
    setExpenses(prev => [tempExpense, ...prev]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'expenses', data: payload }); return tempExpense; }
    try { await supabase.from('expenses').insert([payload]); return tempExpense; } 
    catch (err) { addToQueue('INSERT', { table: 'expenses', data: payload }); return tempExpense; }
  }, [currentStore?.id, addToQueue]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => { 
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e)); 
    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'expenses', id, data: updates }); return; }
    try { await supabase.from('expenses').update(updates).eq('id', id); } 
    catch (err) { addToQueue('UPDATE', { table: 'expenses', id, data: updates }); }
  }, [addToQueue]);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id'>) => { 
    const newId = generateUUID();
    const payload = { ...customer, id: newId, storeId: currentStore?.id };
    setCustomers(prev => [...prev, payload as Customer]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'customers', data: payload }); return; }
    try { await supabase.from('customers').insert([payload]); } 
    catch (err) { addToQueue('INSERT', { table: 'customers', data: payload }); }
  }, [currentStore?.id, addToQueue]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => { 
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); 
    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'customers', id, data: updates }); return; }
    try { await supabase.from('customers').update(updates).eq('id', id); } 
    catch (err) { addToQueue('UPDATE', { table: 'customers', id, data: updates }); }
  }, [addToQueue]);

  const updateCustomerDue = useCallback(async (id: string, amount: number) => { 
    const customer = customers.find(c => c.id === id); 
    if (customer) { 
      const newDue = customer.totalDue + amount; 
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, totalDue: newDue } : c)); 
      if (!navigator.onLine) { addToQueue('UPDATE', { table: 'customers', id, data: { totalDue: newDue } }); return; }
      try { await supabase.from('customers').update({ totalDue: newDue }).eq('id', id); } 
      catch (err) { addToQueue('UPDATE', { table: 'customers', id, data: { totalDue: newDue } }); }
    } 
  }, [customers, addToQueue]);

  const addSupplier = useCallback(async (supplier: Omit<Supplier, 'id'>) => { 
    const newId = generateUUID();
    const payload = { ...supplier, id: newId, storeId: currentStore?.id };
    setSuppliers(prev => [...prev, payload as Supplier]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'suppliers', data: payload }); return; }
    try { await supabase.from('suppliers').insert([payload]); } 
    catch (err) { addToQueue('INSERT', { table: 'suppliers', data: payload }); }
  }, [currentStore?.id, addToQueue]);

  const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>) => { 
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)); 
    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'suppliers', id, data: updates }); return; }
    try { await supabase.from('suppliers').update(updates).eq('id', id); } 
    catch (err) { addToQueue('UPDATE', { table: 'suppliers', id, data: updates }); }
  }, [addToQueue]);

  const updateSupplierDue = useCallback(async (id: string, amount: number) => { 
    const supplier = suppliers.find(s => s.id === id); 
    if (supplier) { 
      const newDue = supplier.totalDue + amount; 
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, totalDue: newDue } : s)); 
      if (!navigator.onLine) { addToQueue('UPDATE', { table: 'suppliers', id, data: { totalDue: newDue } }); return; }
      try { await supabase.from('suppliers').update({ totalDue: newDue }).eq('id', id); } 
      catch (err) { addToQueue('UPDATE', { table: 'suppliers', id, data: { totalDue: newDue } }); }
    } 
  }, [suppliers, addToQueue]);

  const addPurchase = useCallback(async (purchase: Omit<Purchase, 'id' | 'timestamp'>) => { 
    const newId = generateUUID();
    const payload = { ...purchase, id: newId, storeId: currentStore?.id };
    const tempPurchase = { ...payload, timestamp: new Date().toISOString() } as Purchase;
    setPurchases(prev => [tempPurchase, ...prev]);

    if (!navigator.onLine) { addToQueue('INSERT', { table: 'purchases', data: payload }); return; }
    try { await supabase.from('purchases').insert([payload]); } 
    catch (err) { addToQueue('INSERT', { table: 'purchases', data: payload }); }
  }, [currentStore?.id, addToQueue]);


  const deleteProduct = useCallback(async (id: string) => { 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'All related stock will be removed and related expenses will be reversed.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    const p = products.find(x => x.id === id); 
    if (p) { 
      const relatedExpenses = expenses.filter(e => e.storeId === currentStore?.id && e.category === "Operational Cost" && e.description.includes(p.name)); 
      if (relatedExpenses.length > 0) { 
        const expenseIdsToRemove = relatedExpenses.map(e => e.id); 
        setExpenses(prev => prev.filter(e => !expenseIdsToRemove.includes(e.id))); 
        relatedExpenses.forEach(exp => {
          if (!navigator.onLine) addToQueue('DELETE', { table: 'expenses', id: exp.id });
          else supabase.from('expenses').delete().eq('id', exp.id).then(({error}) => { if(error) addToQueue('DELETE', { table: 'expenses', id: exp.id }); });
        });
      } 
    } 
    setProducts(prev => prev.filter(p => p.id !== id)); 
    logActivity(`Deleted product: ${p?.name}`); 
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('DELETE', { table: 'products', id }); return; }
    try { await supabase.from('products').delete().eq('id', id); } catch(err) { addToQueue('DELETE', { table: 'products', id }); }
  }, [products, expenses, currentStore?.id, logActivity, addToQueue]);

  const deleteCustomer = useCallback(async (id: string) => { 
    const customer = customers.find(c => c.id === id); 
    if (customer && customer.totalDue > 0) { Swal.fire({ icon: 'warning', title: 'Action Denied', text: `Clear dues ($${customer.totalDue}) first!`, confirmButtonColor: '#f59e0b', customClass: { popup: 'rounded-3xl' } }); return; } 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Delete this customer profile?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    setCustomers(prev => prev.filter(c => c.id !== id)); 
    logActivity(`Deleted customer profile: ${customer?.name}`); 
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('DELETE', { table: 'customers', id }); return; }
    try { await supabase.from('customers').delete().eq('id', id); } catch(err) { addToQueue('DELETE', { table: 'customers', id }); }
  }, [customers, logActivity, addToQueue]);

  const deleteSupplier = useCallback(async (id: string) => { 
    const supplier = suppliers.find(s => s.id === id); 
    if (supplier && supplier.totalDue > 0) { Swal.fire({ icon: 'warning', title: 'Action Denied', text: `Clear dues ($${supplier.totalDue}) first!`, confirmButtonColor: '#f59e0b', customClass: { popup: 'rounded-3xl' } }); return; } 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Delete this supplier profile?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    setSuppliers(prev => prev.filter(s => s.id !== id)); 
    logActivity(`Deleted supplier profile: ${supplier?.name}`); 
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('DELETE', { table: 'suppliers', id }); return; }
    try { await supabase.from('suppliers').delete().eq('id', id); } catch(err) { addToQueue('DELETE', { table: 'suppliers', id }); }
  }, [suppliers, logActivity, addToQueue]);

  const deleteSale = useCallback(async (id: string) => { 
    const sale = sales.find(s => s.id === id); 
    if (!sale || sale.invoiceId?.startsWith('VOID-')) return; 
    if (sale.amountPaid > 0 && !sale.invoiceId?.startsWith('PAY-')) { Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'This invoice has payments. Please reverse the payment to $0 first.', confirmButtonColor: '#f59e0b', customClass: { popup: 'rounded-3xl' } }); return; } 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Do you want to VOID this sale? Stock and dues will be adjusted.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    const voidInvoiceId = `VOID-${sale.invoiceId}`; 
    const updates = { invoiceId: voidInvoiceId, quantity: 0, totalPrice: 0, amountPaid: 0, amountDue: 0 };
    
    if (sale.invoiceId?.startsWith('PAY-') || sale.productId === 'PAYMENT_RECEIVED') { 
      const customer = customers.find(c => c.id === sale.customerId); 
      if (customer && sale.amountPaid) { 
        const newDue = customer.totalDue + Number(sale.amountPaid); 
        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, totalDue: newDue } : c));
        if (!navigator.onLine) addToQueue('UPDATE', { table: 'customers', id: customer.id, data: { totalDue: newDue } });
        else supabase.from('customers').update({ totalDue: newDue }).eq('id', customer.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'customers', id: customer.id, data: { totalDue: newDue } }); });
      } 
    } else { 
      const product = products.find(p => p.id === sale.productId); 
      if (product) { 
        const newQty = product.quantity + Number(sale.quantity); 
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: newQty } : p)); 
        if (!navigator.onLine) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } });
        else supabase.from('products').update({ quantity: newQty }).eq('id', product.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } }); });
      } 
      if (sale.amountDue > 0 && sale.customerId) { 
        const customer = customers.find(c => c.id === sale.customerId); 
        if (customer) { 
          const newDue = Math.max(0, customer.totalDue - Number(sale.amountDue)); 
          setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, totalDue: newDue } : c));
          if (!navigator.onLine) addToQueue('UPDATE', { table: 'customers', id: customer.id, data: { totalDue: newDue } });
          else supabase.from('customers').update({ totalDue: newDue }).eq('id', customer.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'customers', id: customer.id, data: { totalDue: newDue } }); });
        } 
      } 
    } 
    
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)); 
    logActivity(`VOIDED Sale Invoice: ${sale.invoiceId}`); 
    Swal.fire({ icon: 'success', title: 'VOIDED', text: 'Sale voided successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'sales', id, data: updates }); return; }
    try { await supabase.from('sales').update(updates).eq('id', id); } catch(err) { addToQueue('UPDATE', { table: 'sales', id, data: updates }); }
  }, [sales, products, customers, logActivity, addToQueue]);

  const deletePurchase = useCallback(async (id: string) => { 
    const purchase = purchases.find(p => p.id === id); 
    if (!purchase || purchase.poNumber?.startsWith('VOID-')) return; 
    if (purchase.amountPaid > 0 && !purchase.poNumber?.startsWith('PAY-') && purchase.productId !== 'SUPPLIER_PAYMENT') { Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'This PO has payments recorded. Please reverse the payment to $0 first.', confirmButtonColor: '#f59e0b', customClass: { popup: 'rounded-3xl' } }); return; } 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Do you want to VOID this purchase? Stock will be reduced.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    const voidPoNumber = `VOID-${purchase.poNumber}`; 
    const updates = { poNumber: voidPoNumber, quantity: 0, totalCost: 0, amountPaid: 0, amountDue: 0 };

    if (purchase.poNumber?.startsWith('PAY-') || purchase.productId === 'SUPPLIER_PAYMENT' || purchase.productId === 'PAYMENT_RECEIVED') { 
      const supplier = suppliers.find(s => s.id === purchase.supplierId); 
      if (supplier && purchase.amountPaid) { 
        const newDue = supplier.totalDue + Number(purchase.amountPaid); 
        setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, totalDue: newDue } : s)); 
        if (!navigator.onLine) addToQueue('UPDATE', { table: 'suppliers', id: supplier.id, data: { totalDue: newDue } });
        else supabase.from('suppliers').update({ totalDue: newDue }).eq('id', supplier.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'suppliers', id: supplier.id, data: { totalDue: newDue } }); });
      } 
    } else { 
      const product = products.find(p => p.id === purchase.productId); 
      if (product) { 
        const newQty = Math.max(0, product.quantity - Number(purchase.quantity)); 
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: newQty } : p)); 
        if (!navigator.onLine) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } });
        else supabase.from('products').update({ quantity: newQty }).eq('id', product.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } }); });
      } 
      if (purchase.amountDue > 0 && purchase.supplierId) { 
        const supplier = suppliers.find(s => s.id === purchase.supplierId); 
        if (supplier) { 
          const newDue = Math.max(0, supplier.totalDue - Number(purchase.amountDue)); 
          setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, totalDue: newDue } : s)); 
          if (!navigator.onLine) addToQueue('UPDATE', { table: 'suppliers', id: supplier.id, data: { totalDue: newDue } });
          else supabase.from('suppliers').update({ totalDue: newDue }).eq('id', supplier.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'suppliers', id: supplier.id, data: { totalDue: newDue } }); });
        } 
      } 
    } 
    
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); 
    logActivity(`VOIDED Purchase PO: ${purchase.poNumber}`); 
    Swal.fire({ icon: 'success', title: 'VOIDED', text: 'Purchase voided successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('UPDATE', { table: 'purchases', id, data: updates }); return; }
    try { await supabase.from('purchases').update(updates).eq('id', id); } catch(err) { addToQueue('UPDATE', { table: 'purchases', id, data: updates }); }
  }, [purchases, products, suppliers, logActivity, addToQueue]);

  const deleteExpense = useCallback(async (id: string) => { 
    const expense = expenses.find(e => e.id === id); 
    if (!expense) return; 
    const res = await Swal.fire({ title: 'Are you sure?', text: 'Delete this expense? Funds will be reversed.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); 
    if (!res.isConfirmed) return; 
    
    if (expense.category === 'Wastage') { 
      const expenseData = expense as any; 
      if (expenseData.productId && expenseData.quantity) { 
        const product = products.find(p => p.id === expenseData.productId); 
        if (product) { 
          const newQty = product.quantity + Number(expenseData.quantity); 
          setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: newQty } : p)); 
          if (!navigator.onLine) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } });
          else supabase.from('products').update({ quantity: newQty }).eq('id', product.id).then(({error}) => { if(error) addToQueue('UPDATE', { table: 'products', id: product.id, data: { quantity: newQty } }); });
        } 
      } 
    } 
    
    setExpenses(prev => prev.filter(e => e.id !== id)); 
    logActivity(`Deleted Expense: ${expense.category} - $${expense.amount}`); 
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); 

    if (!navigator.onLine) { addToQueue('DELETE', { table: 'expenses', id }); return; }
    try { await supabase.from('expenses').delete().eq('id', id); } catch(err) { addToQueue('DELETE', { table: 'expenses', id }); }
  }, [expenses, products, logActivity, addToQueue]);


  const handleAddCategory = useCallback((name: string) => { setCategories(prev => { if (prev.includes(name)) return prev; const updated = [...prev, name]; localStorage.setItem('omni_categories', JSON.stringify(updated)); return updated; }); }, []);
  const handleRemoveCategory = useCallback((name: string) => { setCategories(prev => { const updated = prev.filter(c => c !== name); localStorage.setItem('omni_categories', JSON.stringify(updated)); return updated; }); }, []);
  const handleAddExpenseCategory = useCallback((name: string) => { setExpenseCategories(prev => { if (prev.includes(name)) return prev; const updated = [...prev, name]; localStorage.setItem('omni_expense_categories', JSON.stringify(updated)); return updated; }); }, []);
  const handleRemoveExpenseCategory = useCallback((name: string) => { setExpenseCategories(prev => { const updated = prev.filter(c => c !== name); localStorage.setItem('omni_expense_categories', JSON.stringify(updated)); return updated; }); }, []);
  
  const deleteStore = async (id: string) => { if (stores.length <= 1) { Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'System requires at least one hub.', confirmButtonColor: '#f59e0b', customClass: { popup: 'rounded-3xl' } }); return; } const res = await Swal.fire({ title: 'Are you sure?', text: 'Do you want to delete this entire hub?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Confirm', customClass: { popup: 'rounded-3xl' } }); if (!res.isConfirmed) return; await supabase.from('stores').delete().eq('id', id); const updated = stores.filter(s => s.id !== id); setStores(updated); if (currentStore?.id === id) setCurrentStore(updated[0]); Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); };
  const checkPermission = (action: keyof UserPermissions) => { if (currentUser?.role === UserRole.SUPER_ADMIN) return true; return currentUser?.permissions?.[action] || false; };

  const handleDownloadBackup = useCallback(async (storeId: string, storeName: string) => { try { const [ { data: prodData }, { data: custData }, { data: suppData } ] = await Promise.all([ supabase.from('products').select('*').eq('storeId', storeId), supabase.from('customers').select('*').eq('storeId', storeId), supabase.from('suppliers').select('*').eq('storeId', storeId) ]); const backupData = { storeName, backupDate: new Date().toISOString(), inventory: prodData || [], customers: custData || [], suppliers: suppData || [] }; const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_${storeName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); logActivity(`Downloaded JSON Backup for ${storeName}`); } catch (error: any) { Swal.fire({ icon: 'error', title: 'Backup Failed', text: error.message, customClass: { popup: 'rounded-3xl' } }); } }, [logActivity]);
  const handleRestoreBackup = useCallback(async (storeId: string, storeName: string, file: File) => { try { const text = await file.text(); const backupData = JSON.parse(text); if (!backupData.inventory || !backupData.customers || !backupData.suppliers) throw new Error("Invalid backup file format. Required data missing."); if (backupData.storeName && backupData.storeName !== storeName) { const res = await Swal.fire({ title: '⚠️ সতর্কতা', text: `এই ফাইলটি "${backupData.storeName}" এর, কিন্তু আপনি এটি "${storeName}" এ আপলোড করছেন! আপনি কি আসলেই এটি করতে চান?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', confirmButtonText: 'Yes, Restore', customClass: { popup: 'rounded-3xl' } }); if (!res.isConfirmed) return; } if (backupData.inventory.length > 0) { const { error } = await supabase.from('products').upsert(backupData.inventory); if (error) throw error; } if (backupData.customers.length > 0) { const { error } = await supabase.from('customers').upsert(backupData.customers); if (error) throw error; } if (backupData.suppliers.length > 0) { const { error } = await supabase.from('suppliers').upsert(backupData.suppliers); if (error) throw error; } logActivity(`Restored JSON Backup for ${storeName}`); await Swal.fire({ icon: 'success', title: 'ডেটা রিস্টোর সফল!', text: 'নতুন ডেটা দেখার জন্য পেজটি রিলোড হচ্ছে।', timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); window.location.reload(); } catch (error: any) { Swal.fire({ icon: 'error', title: 'Restore Failed', text: error.message, customClass: { popup: 'rounded-3xl' } }); } }, [logActivity]);

  if (!isAuthenticated || !currentUser) return <Login onLogin={handleLogin} />;
  
  if (isInitialFetchDone && !currentStore) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl">
           <h1 className="text-xl font-black text-rose-500 uppercase tracking-widest mb-2">Access Denied</h1>
           <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">{currentUser.role === UserRole.SUPER_ADMIN ? "No store hubs exist in the database. Please check your system." : "Your account has not been assigned to any specific Hub. Please contact your Super Admin."}</p>
           <button onClick={handleLogout} className="bg-rose-500 hover:bg-rose-600 transition-colors text-white w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20">Sign Out</button>
        </div>
      </div>
    );
 }

  if (!currentStore || isDataLoading || !isInitialFetchDone) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-400 font-black tracking-widest uppercase animate-pulse">Isolating Hub Data...</div>;

  return (
    <>
      {/* 🔴 OFFLINE STATUS INDICATOR 🔴 */}
      {!isOnline && (
        <div className="fixed bottom-6 left-6 z-[999] bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-bottom-5">
           <div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></div>
           Offline Mode: {syncQueue.length} pending
        </div>
      )}
      {isOnline && isSyncing && (
        <div className="fixed bottom-6 left-6 z-[999] bg-amber-400 text-slate-950 px-5 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-bottom-5">
           <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
           Syncing to Cloud...
        </div>
      )}

      <HashRouter>
        <Layout currentUser={currentUser} currentStore={currentStore} stores={stores} onStoreChange={setCurrentStore} users={users} onUserChange={setCurrentUser} products={products} onLogout={handleLogout}>
          
          <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-400 font-black tracking-widest uppercase animate-pulse">Loading Module...</div>}>
            <Routes>
              <Route path="/" element={currentUser.role !== UserRole.SALESMAN ? <Dashboard products={products} currentStore={currentStore} sales={sales} expenses={expenses} currentUser={currentUser} activities={activities} cashTransactions={cashTransactions} initialInvestment={storeInvestment} onUpdateInvestment={handleUpdateInvestment} overallBalances={overallBalances} /> : <Navigate to="/inventory" replace />} />
              
              <Route path="/funds" element={currentUser.role !== UserRole.SALESMAN ? <CashManagement currentStore={currentStore} transactions={cashTransactions} balances={overallBalances} onAddTransaction={addCashTransaction} onDeleteTransaction={deleteCashTransaction} canEdit={checkPermission('expenses_edit')} /> : <Navigate to="/" replace />} />

              <Route path="/inventory" element={<Inventory products={products} suppliers={suppliers} purchases={purchases} currentStore={currentStore} currentUser={currentUser} categories={categories} sales={sales} expenses={expenses} onUpdate={updateProduct} onDelete={deleteProduct} onAdd={addProduct} onAddSale={addSale} onAddExpense={addExpense} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory} onUpdateSupplierDue={updateSupplierDue} onAddPurchase={addPurchase} canEditPrices={checkPermission('inventory_edit')} canDelete={checkPermission('inventory_delete')} />} />
              <Route path="/sales" element={<Sales sales={sales} products={products} customers={customers} expenses={expenses} currentStore={currentStore} currentUser={currentUser} onAddSale={addSale} onUpdateSale={updateSale} onUpdateStock={updateProduct} onUpdateCustomerDue={updateCustomerDue} onDeleteSale={deleteSale} canDelete={checkPermission('sales_delete')} />} />
              <Route path="/customers" element={<Customers customers={customers} currentStore={currentStore} onAddCustomer={addCustomer} onUpdateCustomer={updateCustomer} onDeleteCustomer={deleteCustomer} onAddSale={addSale} onUpdateCustomerDue={updateCustomerDue} canEdit={checkPermission('customers_edit')} canDelete={checkPermission('customers_delete')} />} />
              
              {/* 🔴 TYPE FIXES (as any) TO RESOLVE PROMISE MATCHING ERRORS 🔴 */}
              <Route path="/suppliers" element={<Suppliers suppliers={suppliers} currentStore={currentStore} onAddSupplier={addSupplier} onUpdateSupplier={updateSupplier} onDeleteSupplier={deleteSupplier} onAddExpense={addExpense as any} onUpdateSupplierDue={updateSupplierDue} canEdit={checkPermission('suppliers_edit')} canDelete={checkPermission('suppliers_delete')} />} />
              <Route path="/purchases" element={<Purchases purchases={purchases} suppliers={suppliers} products={products} currentStore={currentStore} onAddPurchase={addPurchase} onUpdateStock={updateProduct} onUpdateSupplierDue={updateSupplierDue} onDeletePurchase={deletePurchase} onAddExpense={addExpense as any} canDelete={checkPermission('purchase_delete')} />} />
              <Route path="/expenses" element={currentUser.role !== UserRole.SALESMAN ? <Expenses expenses={expenses} currentStore={currentStore} currentUser={currentUser} expenseCategories={expenseCategories} onAddExpense={addExpense as any} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense} onAddExpenseCategory={handleAddExpenseCategory} onRemoveExpenseCategory={handleRemoveExpenseCategory} canEdit={checkPermission('expenses_edit')} canDelete={checkPermission('expenses_delete')} /> : <Navigate to="/inventory" replace />} />
              <Route path="/wastage" element={currentUser.role !== UserRole.SALESMAN ? <Wastage products={products} currentStore={currentStore} expenses={expenses} onUpdateStock={updateProduct} onAddExpense={addExpense as any} onDeleteExpense={deleteExpense} canDelete={checkPermission('expenses_delete')} /> : <Navigate to="/inventory" replace />} />
              
              <Route path="/scanner" element={<Scanner products={products} currentStore={currentStore} onUpdate={updateProduct} onAddSale={addSale} />} />
              <Route path="/users" element={currentUser.role === UserRole.SUPER_ADMIN || checkPermission('user_control_access') ? <Users users={users} stores={stores} setUsers={setUsers} /> : <Navigate to="/" replace />} />
              <Route path="/settings" element={currentUser.role === UserRole.SUPER_ADMIN ? <Settings stores={stores} currentUser={currentUser} users={users} currentStore={currentStore} setStores={setStores} setUsers={setUsers} setCurrentUser={setCurrentUser} setCurrentStore={setCurrentStore} onDeleteStore={deleteStore} onDownloadBackup={handleDownloadBackup} onRestoreBackup={handleRestoreBackup} canEditStores={checkPermission('settings_access')} /> : <Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

        </Layout>
      </HashRouter>
    </>
  );
};

export default App;