
import { useEffect, useState } from "react";
import { TrendingUp, Gift, Zap, Star } from "lucide-react";
import { useCart } from "../hooks/useCart";

interface EnhancedSavingsDisplayProps {
  discount: number;
  className?: string;
}

export default function EnhancedSavingsDisplay({ discount, className = "" }: EnhancedSavingsDisplayProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (discount > 0) {
      setAnimationKey(prev => prev + 1);
      setShowBurst(true);
      const timer = setTimeout(() => setShowBurst(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [discount]);

  if (discount <= 0) return null;

  const getSavingsLevel = () => {
    if (discount >= 500) return "exceptional";
    if (discount >= 200) return "great";
    if (discount >= 50) return "good";
    return "standard";
  };

  const level = getSavingsLevel();
  
  const levelConfig = {
    standard: {
      icon: TrendingUp,
      sparkles: 2,
      message: "Ottimo risparmio!"
    },
    good: {
      icon: Gift,
      sparkles: 3,
      message: "Fantastico risparmio!"
    },
    great: {
      icon: Zap,
      sparkles: 4,
      message: "Risparmio straordinario!"
    },
    exceptional: {
      icon: Star,
      sparkles: 5,
      message: "Risparmio INCREDIBILE!"
    }
  };

  const config = levelConfig[level];
  const IconComponent = config.icon;

  return (
    <div className={`relative ${className}`}>
      {/* Main savings display */}
      <div 
        key={animationKey}
        className="inline-flex items-center px-8 py-4 rounded-2xl font-bold text-xl shadow-elegant transform transition-all duration-300 hover:scale-105 glass border-2"
        style={{
          background: `linear-gradient(135deg, var(--brand-accent), var(--brand-secondary))`,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: 'white'
        }}
      >
        <IconComponent className="w-7 h-7 mr-3 animate-bounce-gentle" />
        <span className="mr-3">Risparmi:</span>
        <span className="font-mono text-2xl tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.95)' }}>
          €{discount.toLocaleString('it-IT')}
        </span>
      </div>

      {/* Sparkle effects */}
      {showBurst && Array.from({ length: config.sparkles }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full pointer-events-none animate-bounce-gentle"
          style={{
            backgroundColor: 'var(--brand-accent)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s'
          }}
        />
      ))}

      {/* Floating message */}
      {showBurst && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 animate-float-up">
          <div 
            className="px-3 py-1 rounded-full text-sm font-semibold shadow-lg border-2"
            style={{
              backgroundColor: 'var(--brand-background)',
              color: 'var(--brand-text)',
              borderColor: 'var(--brand-accent)'
            }}
          >
            {config.message}
          </div>
        </div>
      )}

      {/* Subtle glow effect for exceptional savings */}
      {level === "exceptional" && (
        <div 
          className="absolute inset-0 rounded-2xl opacity-20 animate-pulse scale-110 blur-sm pointer-events-none"
          style={{
            background: `linear-gradient(135deg, var(--brand-accent), var(--brand-secondary))`
          }}
        />
      )}
    </div>
  );
}
