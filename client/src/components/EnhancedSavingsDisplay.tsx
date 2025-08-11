
import { useEffect, useState } from "react";
import { TrendingUp, Gift, Zap, Star, Euro } from "lucide-react";
import { useCart } from "../hooks/useCart";

interface EnhancedSavingsDisplayProps {
  discount: number;
  className?: string;
}

export default function EnhancedSavingsDisplay({ discount, className = "" }: EnhancedSavingsDisplayProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const [countUp, setCountUp] = useState(0);

  useEffect(() => {
    if (discount > 0) {
      setAnimationKey(prev => prev + 1);
      setShowBurst(true);
      
      // Animate count up effect
      let start = 0;
      const increment = discount / 30;
      const timer = setInterval(() => {
        start += increment;
        if (start >= discount) {
          setCountUp(discount);
          clearInterval(timer);
        } else {
          setCountUp(Math.floor(start));
        }
      }, 50);

      const burstTimer = setTimeout(() => setShowBurst(false), 2000);
      return () => {
        clearTimeout(burstTimer);
        clearInterval(timer);
      };
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
      sparkles: 3,
      message: "GRANDE RISPARMIO!",
      pulse: false
    },
    good: {
      icon: Gift,
      sparkles: 4,
      message: "FANTASTICO RISPARMIO!",
      pulse: true
    },
    great: {
      icon: Zap,
      sparkles: 5,
      message: "RISPARMIO STRAORDINARIO!",
      pulse: true
    },
    exceptional: {
      icon: Star,
      sparkles: 6,
      message: "RISPARMIO INCREDIBILE!",
      pulse: true
    }
  };

  const config = levelConfig[level];
  const IconComponent = config.icon;

  return (
    <div className={`relative ${className}`}>
      {/* Main dramatic savings display */}
      <div 
        key={animationKey}
        className={`
          relative inline-flex flex-col items-center justify-center
          px-12 py-8 rounded-3xl font-black text-center
          shadow-2xl transform transition-all duration-500 hover:scale-105
          border-4 border-white/50 backdrop-blur-sm
          ${config.pulse ? 'animate-pulse' : ''}
        `}
        style={{
          background: `linear-gradient(135deg, #FF6B35, #F7931E, #FFD23F)`,
          backgroundSize: '200% 200%',
          animation: config.pulse ? 'gradient-shift 3s ease infinite, pulse 2s ease-in-out infinite' : 'gradient-shift 3s ease infinite',
          boxShadow: `
            0 0 80px rgba(255, 107, 53, 0.6),
            0 30px 60px rgba(0, 0, 0, 0.4),
            inset 0 0 40px rgba(255, 255, 255, 0.3),
            0 0 0 3px rgba(255, 255, 255, 0.8)
          `
        }}
      >
        {/* Top icon with intense glow */}
        <div className="mb-4 relative">
          <IconComponent 
            className="w-12 h-12 text-white drop-shadow-2xl animate-bounce" 
            style={{ filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.8))' }}
          />
          <div className="absolute inset-0 w-12 h-12 bg-white/30 rounded-full blur-lg animate-ping"></div>
        </div>

        {/* "RISPARMI" Label */}
        <div className="mb-2">
          <span className="text-white text-2xl font-black uppercase tracking-widest drop-shadow-2xl">
            RISPARMI
          </span>
        </div>

        {/* Massive Euro Amount */}
        <div className="flex items-center justify-center mb-3">
          <Euro className="w-8 h-8 text-white mr-2 drop-shadow-2xl" />
          <span 
            className="text-6xl font-black text-white tracking-tight drop-shadow-2xl font-mono"
            style={{ 
              textShadow: '0 0 30px rgba(0,0,0,0.8), 0 0 60px rgba(255,107,53,0.8), 0 4px 8px rgba(0,0,0,0.5)',
              filter: 'brightness(1.1)'
            }}
          >
            {countUp.toLocaleString('it-IT')}
          </span>
        </div>

        {/* Impact message */}
        <div className="text-white text-lg font-bold uppercase tracking-wide drop-shadow-lg">
          {config.message}
        </div>

        {/* Animated border glow */}
        <div 
          className="absolute inset-0 rounded-3xl opacity-60 animate-pulse"
          style={{
            background: `linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent)`,
            backgroundSize: '200% 200%',
            animation: 'border-glow 2s ease-in-out infinite'
          }}
        ></div>
      </div>

      {/* Explosive sparkle effects */}
      {showBurst && Array.from({ length: config.sparkles }).map((_, i) => (
        <div
          key={i}
          className="absolute w-5 h-5 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #FFD700, #FF6B35)',
            borderRadius: '50%',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${i * (360 / config.sparkles)}deg) translateX(90px)`,
            animation: `sparkle-burst 1.5s ease-out ${i * 0.1}s forwards`,
            boxShadow: '0 0 20px #FFD700, 0 0 40px #FF6B35'
          }}
        />
      ))}

      {/* Floating congratulations message */}
      {showBurst && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 animate-float-up z-10">
          <div 
            className="px-6 py-3 rounded-2xl text-lg font-black shadow-2xl border-3 uppercase tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF, #F0F0F0)',
              color: '#FF6B35',
              borderColor: '#FF6B35',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              boxShadow: '0 10px 30px rgba(255, 107, 53, 0.3)'
            }}
          >
            🎉 {config.message} 🎉
          </div>
        </div>
      )}

      {/* Exceptional level gets extra dramatic effects */}
      {level === "exceptional" && (
        <>
          <div 
            className="absolute inset-0 rounded-3xl opacity-40 animate-ping scale-125 pointer-events-none"
            style={{
              background: `radial-gradient(circle, var(--brand-accent), transparent 70%)`
            }}
          />
          <div 
            className="absolute inset-0 rounded-3xl opacity-30 animate-pulse scale-150 blur-xl pointer-events-none"
            style={{
              background: `linear-gradient(135deg, var(--brand-accent), var(--brand-secondary))`
            }}
          />
        </>
      )}
    </div>
  );
}
