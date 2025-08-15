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