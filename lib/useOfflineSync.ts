import { useState, useEffect, useCallback } from 'react';

// যেকোনো অফলাইন অ্যাকশনের স্ট্রাকচার
export interface SyncAction {
  id: string;          // একটি ইউনিক আইডি
  type: 'ADD_SALE' | 'UPDATE_STOCK' | 'ADD_EXPENSE'; // কাজের ধরন
  payload: any;        // মূল ডেটা (যেমন: sale এর ডেটা)
  timestamp: number;
}

export const useOfflineSync = (
  // যখন ইন্টারনেট আসবে, তখন এই ফাংশনটি ডেটাগুলো ডেটাবেসে পাঠাবে
  onSync: (action: SyncAction) => Promise<boolean> 
) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<SyncAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // ব্রাউজার থেকে অফলাইন/অনলাইন স্ট্যাটাস চেক করা
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // শুরুতে লোকাল স্টোরেজে কোনো জমানো ডেটা থাকলে সেটা লোড করা
    const storedQueue = localStorage.getItem('bdt_sync_queue');
    if (storedQueue) {
      setSyncQueue(JSON.parse(storedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // কিউ (Queue) আপডেট হলে সাথে সাথে লোকাল স্টোরেজে সেভ করা
  useEffect(() => {
    localStorage.setItem('bdt_sync_queue', JSON.stringify(syncQueue));
  }, [syncQueue]);

  // ব্যাকগ্রাউন্ড সিঙ্ক লজিক (ইন্টারনেট আসলে যা ঘটবে)
  const processQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    const currentQueue = [...syncQueue];
    const failedQueue: SyncAction[] = [];

    for (const action of currentQueue) {
      try {
        const success = await onSync(action);
        if (!success) {
          failedQueue.push(action); // কোনো কারণে ফেইল করলে আবার রেখে দেবে
        }
      } catch (error) {
        console.error('Sync failed for action:', action, error);
        failedQueue.push(action);
      }
    }

    setSyncQueue(failedQueue);
    setIsSyncing(false);
  }, [isOnline, syncQueue, isSyncing, onSync]);

  // ইন্টারনেট আসার সাথে সাথে সিঙ্ক শুরু করা
  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline, processQueue]);

  // নতুন ডেটা কিউ-তে যুক্ত করার ফাংশন
  const addToQueue = (type: SyncAction['type'], payload: any) => {
    const newAction: SyncAction = {
      id: Date.now().toString(),
      type,
      payload,
      timestamp: Date.now()
    };
    setSyncQueue(prev => [...prev, newAction]);
  };

  return { isOnline, syncQueue, addToQueue, isSyncing };
};