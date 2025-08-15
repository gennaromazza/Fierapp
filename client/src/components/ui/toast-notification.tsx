import { useState, useEffect } from 'react';
import { Check, Gift, ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'gift' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    
    // Auto close after duration
    if (toast.duration && toast.duration > 0) {
      const autoCloseTimer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(autoCloseTimer);
      };
    }
    
    return () => clearTimeout(timer);
  }, [toast.duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'gift':
        return <Gift className="h-5 w-5 text-purple-600" />;
      case 'info':
        return <ShoppingCart className="h-5 w-5 text-blue-600" />;
      default:
        return <Check className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStyles = () => {
    const baseClasses = "relative overflow-hidden rounded-lg shadow-lg border backdrop-blur-sm";
    
    switch (toast.type) {
      case 'success':
        return `${baseClasses} bg-green-50/95 border-green-200 text-green-900`;
      case 'gift':
        return `${baseClasses} bg-gradient-to-r from-purple-50/95 to-pink-50/95 border-purple-200 text-purple-900`;
      case 'info':
        return `${baseClasses} bg-blue-50/95 border-blue-200 text-blue-900`;
      default:
        return `${baseClasses} bg-white/95 border-gray-200 text-gray-900`;
    }
  };

  return (
    <div
      className={cn(
        "transform transition-all duration-300 ease-out",
        isVisible && !isLeaving ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95",
        isLeaving && "-translate-x-full opacity-0 scale-95"
      )}
    >
      <div className={cn(getStyles(), "p-4 max-w-sm w-full")}>
        {/* Shimmer effect for gift toasts */}
        {toast.type === 'gift' && (
          <div className="absolute inset-0 -top-2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-pulse" />
        )}
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {toast.title}
            </p>
            {toast.description && (
              <p className="text-xs mt-1 opacity-80">
                {toast.description}
              </p>
            )}
            
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-xs font-medium underline hover:no-underline transition-all"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          <button
            onClick={handleClose}
            className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40 pointer-events-none" />
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastNotification toast={toast} onClose={onClose} />
          </div>
        ))}
      </div>
    </>
  );
}