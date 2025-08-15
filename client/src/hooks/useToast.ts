import { useState } from 'react';
import type { Toast, ToastType } from '@/components/ui/toast-notification';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    type: ToastType,
    title: string,
    description?: string,
    options?: {
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => {
    const id = Date.now().toString();
    const newToast: Toast = {
      id,
      type,
      title,
      description,
      duration: options?.duration ?? 4000,
      action: options?.action,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (title: string, description?: string, options?: { duration?: number }) =>
    addToast('success', title, description, options);

  const gift = (title: string, description?: string, options?: { duration?: number }) =>
    addToast('gift', title, description, options);

  const info = (title: string, description?: string, options?: { duration?: number }) =>
    addToast('info', title, description, options);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    gift,
    info,
  };
}
import { useState, useCallback } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
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

  return {
    toasts,
    toast,
    dismiss
  };
}
