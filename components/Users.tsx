import React, { useState, useEffect } from 'react';
import { User, Store, UserRole, UserPermissions } from '../types';
import { supabase } from '../lib/supabase';
import { 
  Users as UsersIcon, 
  Plus, 
  Trash2, 
  Shield, 
  Warehouse, 
  X, 
  Search, 
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Edit2,
  Check,
  Phone,
  RefreshCw
} from 'lucide-react';

interface UsersProps {
  users: User[];
  stores: Store[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const PERMISSION_LIST: { key: keyof UserPermissions; label: string }[] = [
  { key: 'inventory_edit', label: 'Inventory: Edit' },
  { key: 'inventory_delete', label: 'Inventory: Delete' },
  { key: 'sales_delete', label: 'Sales: Delete' },
  { key: 'purchase_delete', label: 'Purchase: Delete' },
  { key: 'customers_edit', label: 'Customers: Edit' },
  { key: 'customers_delete', label: 'Customers: Delete' },
  { key: 'suppliers_edit', label: 'Suppliers: Edit' },
  { key: 'suppliers_delete', label: 'Suppliers: Delete' },
  { key: 'expenses_edit', label: 'Expenses: Edit' },
  { key: 'expenses_delete', label: 'Expenses: Delete' },
  { key: 'user_control_access', label: 'User Control: Access' },
  { key: 'settings_access', label: 'Settings: Access' },
];

const DEFAULT_PERMISSIONS: UserPermissions = {
  inventory_edit: false,
  inventory_delete: false,
  sales_delete: false,
  purchase_delete: false,
  customers_edit: false,
  customers_delete: false,
  suppliers_edit: false,
  suppliers_delete: false,
  expenses_edit: false,
  expenses_delete: false,
  user_control_access: false,
  settings_access: false,
};

const FULL_PERMISSIONS: UserPermissions = {
  inventory_edit: true,
  inventory_delete: true,
  sales_delete: true,
  purchase_delete: true,
  customers_edit: true,
  customers_delete: true,
  suppliers_edit: true,
  suppliers_delete: true,
  expenses_edit: true,
  expenses_delete: true,
  user_control_access: true,
  settings_access: true,
};

const Users: React.FC<UsersProps> = ({ users, stores, setUsers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.SALESMAN);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchLatestUsers = async () => {
      setIsSyncing(true);
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        if (data) {
          setUsers(data as User[]);
        }
      } catch (err) {
        console.error("Failed to sync users:", err);
      } finally {
        setIsSyncing(false);
      }
    };
    
    fetchLatestUsers();
  }, [setUsers]);

  useEffect(() => {
    if (selectedRole === UserRole.SUPER_ADMIN) {
      setPermissions(FULL_PERMISSIONS);
    }
  }, [selectedRole]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.phone && u.phone.includes(searchTerm)) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setSelectedRole(UserRole.SALESMAN);
    setPermissions(DEFAULT_PERMISSIONS);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setPermissions(user.permissions || (user.role === UserRole.SUPER_ADMIN ? FULL_PERMISSIONS : DEFAULT_PERMISSIONS));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const form = e.target as HTMLFormElement;
    const name = form.userName.value;
    const phone = form.userPhone?.value || null;
    const role = form.userRole.value as UserRole;
    const assignedStoreId = form.userStore.value || null; 
    const password = form.userPass.value;

    const userPayload = {
      name,
      phone, 
      role,
      assignedStoreId: role === UserRole.SUPER_ADMIN ? null : assignedStoreId,
      password,
      permissions: role === UserRole.SUPER_ADMIN ? FULL_PERMISSIONS : permissions,
      avatar: editingUser ? editingUser.avatar : `https://picsum.photos/seed/${name.replace(/\s+/g, '')}/200`
    };

    try {
      if (editingUser) {
        const { data, error } = await supabase
          .from('users')
          .update(userPayload)
          .eq('id', editingUser.id)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setUsers(prev => prev.map(u => u.id === editingUser.id ? {
            ...data,
            role: data.role as UserRole
          } : u));
          alert('Identity Synchronized: Personnel credentials updated.');
        }
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert([userPayload])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newUser: User = {
            ...data,
            role: data.role as UserRole
          };
          setUsers(prev => [...prev, newUser]);
          alert('Access Provisioned: New identity synchronized to global directory.');
        }
      }
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`Error saving user: ${error.message}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (key: keyof UserPermissions) => {
    if (selectedRole === UserRole.SUPER_ADMIN) return;
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const removeUser = async (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.name === 'Admin' && userToDelete?.role === UserRole.SUPER_ADMIN) {
      alert("Critical Error: Cannot delete the primary Super Admin.");
      return;
    }

    if (window.confirm('Access Revocation: Permanently remove this user session?')) {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (error: any) {
        alert(`Error deleting user: ${error.message}`);
      }
    }
  };

  const getStoreName = (id?: string) => {
    if (!id) return 'Global / All Branches';
    return stores.find(s => s.id === id)?.name || 'Unknown Hub';
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Personnel Governance
            {isSyncing && <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />}
          </h1>
          <p className="text-slate-500 font-medium">Global access directory and branch assignments</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-amber-900/10 uppercase tracking-widest text-xs"
        >
          <UserPlus className="w-5 h-5 stroke-[3px]" />
          Provision Access
        </button>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="mb-8 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Query directory for personnel..." 
            className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 placeholder:text-slate-600 focus:border-amber-400/50 transition-all amber-glow" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => {
            const isStoreOwner = user.role === ('STORE_OWNER' as UserRole);

            return (
              <div key={user.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 group hover:border-amber-400/30 transition-all relative overflow-hidden flex flex-col h-full">
                 <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 blur-2xl transition-colors ${isStoreOwner ? 'bg-emerald-400/5 group-hover:bg-emerald-400/10' : 'bg-amber-400/5 group-hover:bg-amber-400/10'}`}></div>
                 
                 {/* 🔴 Image Tag Removed. Using justify-end to align role badge correctly 🔴 */}
                 <div className="flex items-start justify-end relative z-10 mb-6">
                    <div className="flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        user.role === UserRole.SUPER_ADMIN ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 
                        isStoreOwner ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 
                        user.role === UserRole.MANAGER ? 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20' : 
                        'bg-slate-700/50 text-slate-400 border-slate-700'
                      }`}>
                        {user.role.replace('_', ' ')}
                      </span>
                      <p className="text-[10px] text-slate-500 font-bold mt-2 font-mono">#{user.id.substring(0, 8)}</p>
                    </div>
                 </div>

                 <div className="relative z-10 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className={`text-xl font-black tracking-tight transition-all duration-500 truncate ${isStoreOwner ? 'group-hover:text-emerald-400 text-white' : 'group-hover:gold-gradient-text text-white'}`}>{user.name}</h3>
                      
                      {user.phone && (
                        <div className="flex items-center gap-2 mt-2 text-slate-400">
                          <Phone className={`w-3.5 h-3.5 shrink-0 ${isStoreOwner ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span className="text-xs font-bold tracking-widest">{user.phone}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1 text-slate-500">
                        <Warehouse className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest truncate">{getStoreName(user.assignedStoreId)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center mt-auto">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-4 h-4 ${user.role === UserRole.SUPER_ADMIN ? 'text-amber-500' : isStoreOwner ? 'text-emerald-500' : 'text-slate-600'}`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clearance Lvl {user.role === UserRole.SUPER_ADMIN ? '3' : (user.role === UserRole.MANAGER || isStoreOwner) ? '2' : '1'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEditModal(user)} className="p-2.5 text-slate-600 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button 
                          onClick={() => removeUser(user.id)} 
                          className="p-2.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                          title={user.name === 'Admin' ? "Cannot delete primary admin" : "Delete user"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-800 shadow-2xl p-8 my-8 relative animate-in zoom-in-95 duration-300">
             <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
             <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{editingUser ? 'Identity Modification' : 'Identity Provisioning'}</h2>
             <p className="text-slate-500 text-xs font-bold mb-8 uppercase tracking-[0.2em]">Configure Personnel Access Rights</p>
             
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Legal Nomenclature</label>
                      <input name="userName" required defaultValue={editingUser?.name} placeholder="Full Operational Name" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Contact Number (Optional)</label>
                      <input name="userPhone" defaultValue={editingUser?.phone} placeholder="+8801..." className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Protocol Role</label>
                        <select 
                          name="userRole" 
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                          className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow appearance-none"
                        >
                          <option value={UserRole.SALESMAN}>Salesman</option>
                          <option value={UserRole.MANAGER}>Store Manager</option>
                          <option value={'STORE_OWNER' as UserRole}>Store Owner</option>
                          <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Site Assignment</label>
                        <select 
                          name="userStore" 
                          defaultValue={editingUser?.assignedStoreId || ''} 
                          disabled={selectedRole === UserRole.SUPER_ADMIN}
                          className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Global / No Branch</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Authentication Key</label>
                      <div className="relative">
                        <input name="userPass" required defaultValue={editingUser?.password} type={showPassword ? "text" : "password"} placeholder="Secure Access String" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 amber-glow" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-4 text-slate-600 hover:text-amber-400 transition-colors">
                          {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-400/5 p-4 rounded-2xl border border-amber-400/10 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-[10px] text-slate-400 font-medium">Assigned Store Owners, Managers and Salesmen will be restricted to viewing and managing data strictly within their designated Site Hub.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Granular Permissions</label>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {PERMISSION_LIST.map((perm) => (
                        <button
                          key={perm.key}
                          type="button"
                          disabled={selectedRole === UserRole.SUPER_ADMIN}
                          onClick={() => togglePermission(perm.key)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            permissions[perm.key] 
                              ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' 
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                          } ${selectedRole === UserRole.SUPER_ADMIN ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{perm.label}</span>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            permissions[perm.key] ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-700'
                          }`}>
                            {permissions[perm.key] && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-5 rounded-[2rem] font-black shadow-xl shadow-amber-900/20 hover:scale-[1.02] transition-transform uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? 'Processing...' : (editingUser ? 'Synchronize Credentials' : 'Execute Authorization')}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;