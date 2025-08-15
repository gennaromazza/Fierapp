
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, XCircle, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastNotificationProps {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'gift';
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
          bg: 'bg-white border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          descColor: 'text-green-700'
        };
      case 'gift':
        return {
          bg: 'bg-gradient-to-r from-emerald-50 to-green-50 border-green-300',
          icon: Gift,
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          descColor: 'text-green-700'
        };
      case 'destructive':
        return {
          bg: 'bg-white border-red-200',
          icon: XCircle,
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          descColor: 'text-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-white border-orange-200',
          icon: AlertCircle,
          iconColor: 'text-orange-600',
          titleColor: 'text-orange-800',
          descColor: 'text-orange-700'
        };
      default:
        return {
          bg: 'bg-white border-brand-accent',
          icon: CheckCircle,
          iconColor: 'text-brand-accent',
          titleColor: 'text-brand-text',
          descColor: 'text-gray-600'
        };
    }
  };

  const { bg, icon: Icon, iconColor, titleColor, descColor } = getVariantStyles();
  const isSpecial = variant === 'gift';

  return (
    <>
      {/* Backdrop with Blur - solo per i toast speciali */}
      {isSpecial && (
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
      )}

      {/* Toast Content */}
      <div
        className={cn(
          "fixed top-4 right-4 transform transition-all duration-300 ease-out",
          "max-w-sm w-full rounded-lg border-2 overflow-hidden shadow-lg",
          isVisible ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95",
          bg,
          isSpecial ? "z-50 animate-pulse" : "z-30"
        )}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 p-4">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
            isSpecial ? "bg-green-100" : "bg-gray-100"
          )}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold text-sm mb-1", titleColor)}>
              {title}
            </h3>
            {description && (
              <p className={cn("text-xs", descColor)}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all ease-linear",
              variant === 'gift' ? "bg-green-500" : 
              variant === 'success' ? "bg-green-500" :
              variant === 'destructive' ? "bg-red-500" :
              variant === 'warning' ? "bg-orange-500" : "bg-brand-accent"
            )}
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
