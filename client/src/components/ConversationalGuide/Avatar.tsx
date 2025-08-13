import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AvatarType } from './types';

interface AvatarProps {
  type: AvatarType;
  showConfetti?: boolean;
  className?: string;
}

import avatarSmiling from '@assets/0861d60d-c48c-4f65-830d-642326651c52_1755072609157.png';
import avatarMoney from '@assets/ChatGPT Image 13 ago 2025, 10_51_24_1755075132893.png';
import avatarExplaining from '@assets/ChatGPT Image 13 ago 2025, 10_51_36 (1)_1755075132894.png';
import avatarExcited from '@assets/generated_images/Excited_photographer_avatar_b6154714.png';
import avatarThoughtful from '@assets/generated_images/Thoughtful_photographer_avatar_88eda1e0.png';

// Multiple avatar expressions for different conversation states
const avatarImages = {
  smiling: avatarSmiling,
  neutral: avatarThoughtful,
  explaining: avatarExplaining,
  enthusiastic: avatarMoney,
};

export function Avatar({ type, showConfetti = false, className }: AvatarProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showConfetti) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Random avatar animation every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }, 8000 + Math.random() * 4000); // 8-12 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "w-16 h-16 rounded-full overflow-hidden border-3 border-white shadow-lg transition-all duration-500",
          isAnimating && "animate-pulse scale-110 shadow-xl",
          type === 'enthusiastic' && "animate-bounce",
          type === 'explaining' && "animate-pulse"
        )}
      >
        <img
          src={avatarImages[type]}
          alt={`Avatar ${type}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to a simple colored circle if image fails
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.style.backgroundColor = getAvatarColor(type);
              parent.innerHTML = getAvatarInitial(type);
              parent.style.display = 'flex';
              parent.style.alignItems = 'center';
              parent.style.justifyContent = 'center';
              parent.style.fontSize = '24px';
              parent.style.fontWeight = 'bold';
              parent.style.color = 'white';
            }
          }}
        />
      </div>
      
      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded animate-ping"
              style={{
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getAvatarColor(type: AvatarType): string {
  const colors = {
    smiling: '#10B981',
    neutral: '#6B7280', 
    explaining: '#3B82F6',
    enthusiastic: '#F59E0B',
  };
  return colors[type];
}

function getAvatarInitial(type: AvatarType): string {
  const initials = {
    smiling: 'G',
    neutral: 'G',
    explaining: 'G',
    enthusiastic: 'G',
  };
  return initials[type];
}