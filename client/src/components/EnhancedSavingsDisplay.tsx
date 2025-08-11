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
      bgGradient: "from-green-400 to-green-600",
      icon: TrendingUp,
      sparkles: 2,
      message: "Ottimo risparmio!"
    },
    good: {
      bgGradient: "from-green-500 to-emerald-600",
      icon: Gift,
      sparkles: 3,
      message: "Fantastico risparmio!"
    },
    great: {
      bgGradient: "from-emerald-500 to-teal-600",
      icon: Zap,
      sparkles: 4,
      message: "Risparmio straordinario!"
    },
    exceptional: {
      bgGradient: "from-yellow-400 via-orange-500 to-red-500",
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
        className={`
          inline-flex items-center bg-gradient-to-r ${config.bgGradient} 
          text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg
          transform transition-all duration-300 hover:scale-105
          animate-bounce-gentle
        `}
      >
        <IconComponent className="w-6 h-6 mr-2 animate-pulse" />
        <span className="mr-2">Risparmi:</span>
        <span className="font-mono text-xl tracking-wider">
          €{discount.toLocaleString('it-IT')}
        </span>
      </div>

      {/* Sparkle effects */}
      {showBurst && Array.from({ length: config.sparkles }).map((_, i) => (
        <div
          key={i}
          className={`
            absolute w-2 h-2 bg-yellow-300 rounded-full animate-sparkle-${i + 1}
            top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            pointer-events-none
          `}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s'
          }}
        />
      ))}

      {/* Floating message */}
      {showBurst && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 animate-float-up">
          <div className="bg-white text-gray-800 px-3 py-1 rounded-full text-sm font-semibold shadow-lg border-2 border-yellow-300">
            {config.message}
          </div>
        </div>
      )}

      {/* Glow effect for exceptional savings */}
      {level === "exceptional" && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-red-500 opacity-30 animate-pulse scale-110 blur-sm pointer-events-none" />
      )}
    </div>
  );
}