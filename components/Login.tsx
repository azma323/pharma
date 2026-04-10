import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User as UserIcon, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Supabase থেকে ইউজার চেক করা হচ্ছে
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .ilike('name', username) // নামের ছোট-বড় হাতের অক্ষর ইগনোর করবে
        .eq('password', password)
        .single();

      if (fetchError || !data) {
        setError('Invalid credentials. Access denied to global directory.');
        setIsLoading(false);
        return;
      }

      // ডাটাবেস থেকে পাওয়া ইউজারকে অ্যাপের ফর্মেটে সাজানো
      const loggedInUser: User = {
        id: data.id,
        name: data.name,
        role: data.role as UserRole,
        avatar: data.avatar || '',
        assignedStoreId: data.assignedStoreId,
        permissions: data.permissions
      };

      onLogin(loggedInUser);
    } catch (err) {
      setError('Connection failed. Please check your internet or database.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-amber-400/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-400/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.img 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            src="/logo.png"
            alt="BDT Logo"
            className="w-32 h-32 object-contain drop-shadow-2xl mb-6"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-black text-white tracking-tight text-center leading-tight mb-1">
            Buildings Developments & <br/> Technologies(bdt)
          </h1>
          <p className="text-amber-500 font-bold uppercase tracking-[0.3em] text-[9px]">A New Wave Of Dream</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Identity Verification</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Synchronizing session with global directory</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Personnel Identifier</label>
              <div className="relative group">
                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input 
                  type="text" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username" 
                  className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 transition-all amber-glow" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Security Key</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-amber-400 transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password" 
                  className="w-full pl-14 pr-14 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold focus:border-amber-400 transition-all amber-glow" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-5 rounded-[2rem] font-black shadow-xl shadow-amber-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Authorize Session <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-800 flex items-center justify-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">End-to-End Encrypted Protocol</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;