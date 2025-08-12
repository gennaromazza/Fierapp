import { useEffect, useState } from 'react';
import { Gift, Unlock, X } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  type: 'gift' | 'unlock';
  message: string;
}

interface GiftNotificationProps {
  notification: NotificationItem | null;
  onClose: () => void;
}

export default function GiftNotification({ notification, onClose }: GiftNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const isGift = notification.type === 'gift';
  const bgColor = isGift ? 'from-green-500 to-emerald-500' : 'from-orange-500 to-amber-500';
  const Icon = isGift ? Gift : Unlock;

  return (
    <div 
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className={`bg-gradient-to-r ${bgColor} text-white rounded-2xl shadow-2xl p-6 min-w-[350px] max-w-md`}>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="absolute top-2 right-2 text-white/80 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-start gap-4">
          <div className="bg-white/20 rounded-full p-3 animate-pulse">
            <Icon className="w-8 h-8" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              {isGift ? '🎉 Complimenti!' : '🔓 Sbloccato!'}
            </h3>
            <p className="text-white/95 font-medium">{notification.title}</p>
            <p className="text-white/80 text-sm mt-1">{notification.message}</p>
          </div>
        </div>

        {/* Animated particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}