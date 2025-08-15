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
  const isSpecial = variant === 'success'; // Assuming 'success' variant is the "gift" one for special effects

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
          "fixed top-4 right-4 z-50 transform transition-all duration-500 ease-out",
          "max-w-sm w-full rounded-xl border-2 overflow-hidden",
          isVisible ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95",
          border,
          isSpecial ? "shadow-2xl backdrop-blur-sm animate-pulse" : "shadow-lg"
        )}
        style={{
          background: isSpecial
            ? `linear-gradient(135deg, ${bg.replace('bg-gradient-to-r ', '').replace('from-', '').replace(' to-', ', ')})`
            : undefined,
          backgroundColor: !isSpecial ? bg.replace('bg-', '') : undefined,
          boxShadow: isSpecial
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : undefined
        }}
      >
        <button
          onClick={handleDismiss}
          className={cn(
            "absolute top-3 right-3 p-1 rounded-full transition-colors",
            isSpecial ? "text-white/80 hover:text-white" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 p-6">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            isSpecial ? "bg-white/20 animate-pulse" : "bg-blue-100"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              isSpecial ? "text-white" : "text-blue-600"
            )} />
          </div>

          <div className="flex-1">
            <h3 className={cn(
              "font-bold text-lg mb-1",
              isSpecial ? "text-white" : "text-gray-900"
            )}>{title}</h3>
            {description && (
              <p className={cn(
                "text-sm",
                isSpecial ? "text-white/90" : "text-gray-600"
              )}>{description}</p>
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