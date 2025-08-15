
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, XCircle, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastNotificationProps {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;
  onDismiss: (id: string) => void;
}

export function ToastNotification({
  id,
  title,
  description,
  variant = 'default',
  duration = 3000,
  onDismiss
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(id), 300);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
          icon: Gift,
          border: 'border-green-200'
        };
      case 'destructive':
        return {
          bg: 'bg-gradient-to-r from-red-500 to-rose-500',
          icon: XCircle,
          border: 'border-red-200'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-orange-500 to-amber-500',
          icon: AlertCircle,
          border: 'border-orange-200'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
          icon: CheckCircle,
          border: 'border-blue-200'
        };
    }
  };

  const { bg, icon: Icon, border } = getVariantStyles();

  return (
    <>
      {/* Backdrop with Blur */}
      <div 
        className={cn(
          "fixed inset-0 z-40 transition-all duration-300",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ 
          backdropFilter: isVisible ? 'blur(4px)' : 'blur(0px)',
          backgroundColor: 'rgba(0, 0, 0, 0.1)'
        }}
      />

      {/* Toast Content */}
      <div 
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 transition-all duration-300",
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
      >
        <div className={cn(
          "min-w-[350px] max-w-md rounded-2xl shadow-2xl text-white p-6 border",
          bg,
          border
        )}>
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-4 pr-6">
            <div className="bg-white/20 rounded-full p-3 animate-pulse">
              <Icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{title}</h3>
              {description && (
                <p className="text-white/90 text-sm">{description}</p>
              )}
            </div>
          </div>

          {/* Animated progress bar */}
          <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/40 rounded-full transition-all ease-linear"
              style={{
                animation: `shrink ${duration}ms linear forwards`
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}

export function ToastContainer({ toasts, onDismiss }: { 
  toasts: any[], 
  onDismiss: (id: string) => void 
}) {
  if (toasts.length === 0) return null;

  // Show only the most recent toast
  const latestToast = toasts[toasts.length - 1];

  return (
    <ToastNotification
      key={latestToast.id}
      {...latestToast}
      onDismiss={onDismiss}
    />
  );
}
