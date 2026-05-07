import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Product, Store, Sale } from '../types';
import { 
  ScanLine, 
  Package, 
  AlertCircle, 
  CheckCircle, 
  RefreshCcw, 
  ShoppingCart, 
  Truck, 
  History,
  Zap,
  X,
  Volume2,
  CameraOff
} from 'lucide-react';

interface ScannerProps {
  products: Product[];
  currentStore: Store;
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
}

type ScanMode = 'receive' | 'sales';

interface ScanHistory {
  id: string;
  productName: string;
  sku: string;
  mode: ScanMode;
  timestamp: string;
}

const Scanner: React.FC<ScannerProps> = ({ products, currentStore, onUpdate, onAddSale }) => {
  const [mode, setMode] = useState<ScanMode>('sales');
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const scannerRef = useRef<any>(null);
  const [flash, setFlash] = useState(false);

  const processScan = useCallback((decodedText: string) => {
    const product = products.find(p => p.sku === decodedText && p.storeId === currentStore.id);
    
    if (!product) {
      setStatus({ type: 'error', message: `SKU "${decodedText}" not found.` });
      return;
    }

    if (mode === 'sales') {
      if (product.quantity <= 0) {
        setStatus({ type: 'error', message: `Out of Stock: ${product.name}` });
        return;
      }
      const year = new Date().getFullYear();
      const invoiceId = `INV-SCN-${year}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      onAddSale({
        invoiceId,
        customerName: 'Scan-to-Go (Walk-in)',
        productId: product.id,
        productName: product.name,
        quantity: 1,
        buyingPrice: product.buyingPrice,
        unitPrice: product.price,
        discount: 0,
        totalPrice: product.price,
        amountPaid: product.price,
        amountDue: 0,
        storeId: currentStore.id
      });
      onUpdate(product.id, { quantity: product.quantity - 1 });
      setStatus({ type: 'success', message: `Sale Recorded: ${product.name}` });
    } else {
      onUpdate(product.id, { quantity: product.quantity + 1 });
      setStatus({ type: 'success', message: `Stock Received: ${product.name}` });
    }

    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    setHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), productName: product.name, sku: product.sku, mode, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
  }, [mode, products, currentStore, onUpdate, onAddSale]);

  const startScanner = async () => {
    setIsScanning(true);
    setStatus({ type: 'idle', message: 'Configuring optical sensor...' });
    
    setTimeout(async () => {
      try {
        const targetElement = document.getElementById("reader");
        if (!targetElement) return;

        const html5QrCode = new (window as any).Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 20, qrbox: { width: 280, height: 280 } };

        const onScanSuccess = (decodedText: string) => {
          processScan(decodedText);
          html5QrCode.pause();
          setTimeout(() => { if (scannerRef.current?.getState() === 3) scannerRef.current.resume(); }, 1500);
        };

        await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        setStatus({ type: 'idle', message: 'Scanning...' });
      } catch (err: any) {
        setStatus({ type: 'error', message: "Camera access denied or not found." });
        setIsScanning(false);
      }
    }, 500);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => { return () => { if (scannerRef.current) scannerRef.current.stop(); }; }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">Optical Hub <Zap className="w-6 h-6 text-amber-400" /></h1>
          <p className="text-slate-500 font-medium tracking-tight">Active for <span className="gold-gradient-text font-black">{currentStore.name}</span></p>
        </div>
        <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <button onClick={() => setMode('sales')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'sales' ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><ShoppingCart className="w-4 h-4 inline mr-2" /> Sales</button>
          <button onClick={() => setMode('receive')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'receive' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Truck className="w-4 h-4 inline mr-2" /> Receive</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <div className={`relative aspect-video bg-slate-900 rounded-[3rem] overflow-hidden border-4 transition-all ${flash ? 'border-white scale-[1.01]' : 'border-slate-800'}`}>
            {isScanning ? <div id="reader" className="w-full h-full"></div> : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border-2 ${mode === 'sales' ? 'border-amber-400 text-amber-400' : 'border-emerald-500 text-emerald-400'}`}><ScanLine className="w-10 h-10" /></div>
                <button onClick={startScanner} className={`px-10 py-4 rounded-[2rem] font-black uppercase text-xs ${mode === 'sales' ? 'bg-amber-400 text-slate-950 shadow-amber-900/20' : 'bg-emerald-500 text-slate-950 shadow-emerald-900/20'} shadow-2xl`}>Start Camera</button>
              </div>
            )}
            {isScanning && <button onClick={stopScanner} className="absolute top-6 right-6 z-10 bg-rose-600 p-2 rounded-xl text-white"><X className="w-5 h-5" /></button>}
          </div>
          
          <div className={`p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : status.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}>
             <div className="p-3 rounded-xl bg-slate-800">{status.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}</div>
             <div><p className="text-[10px] font-black uppercase opacity-60">System Feedback</p><p className="font-bold tracking-tight">{status.message || 'Awaiting input...'}</p></div>
          </div>
        </div>

        <div className="lg:col-span-5">
           <div className="bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
              <h3 className="font-black text-white text-lg tracking-tight mb-8 flex items-center gap-3"><History className="w-5 h-5 text-amber-400" /> Recent Activity</h3>
              <div className="space-y-4">
                 {history.map((item) => (
                   <div key={item.id} className="bg-slate-800/50 p-4 rounded-2xl flex items-center justify-between border border-slate-700/50 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.mode === 'sales' ? 'bg-amber-400/10 text-amber-400' : 'bg-emerald-400/10 text-emerald-400'}`}>{item.mode === 'sales' ? <ShoppingCart className="w-4 h-4" /> : <Truck className="w-4 h-4" />}</div>
                         <div><p className="text-sm font-bold text-white truncate max-w-[150px]">{item.productName}</p><p className="text-[10px] text-slate-500 font-bold uppercase">SKU: {item.sku}</p></div>
                      </div>
                      <div className="text-right"><p className={`text-xs font-black ${item.mode === 'sales' ? 'text-amber-400' : 'text-emerald-400'}`}>{item.mode === 'sales' ? '-1 UNIT' : '+1 UNIT'}</p><p className="text-[9px] text-slate-600 font-bold">{item.timestamp}</p></div>
                   </div>
                 ))}
                 {history.length === 0 && <div className="py-20 text-center opacity-30 grayscale"><Package className="w-12 h-12 mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest">No cycles yet</p></div>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;