import { useState, useCallback } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'gift';
  duration?: number;
}

interface Toast extends ToastOptions {
  id: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { ...options, id };

    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, options.duration || 3000);

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((title: string, description?: string, duration?: number) => {
    return toast({ title, description, variant: 'success', duration });
  }, [toast]);

  const gift = useCallback((title: string, description?: string, duration?: number) => {
    return toast({ title, description, variant: 'gift', duration });
  }, [toast]);

  const info = useCallback((title: string, description?: string, duration?: number) => {
    return toast({ title, description, variant: 'default', duration });
  }, [toast]);

  return {
    toasts,
    toast,
    dismiss,
    success,
    gift,
    info
  };
}