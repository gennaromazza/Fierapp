import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Import user's avatar images
import avatar1 from '@assets/0861d60d-c48c-4f65-830d-642326651c52_1755072609157.png';
import avatar2 from '@assets/ChatGPT Image 13 ago 2025, 10_51_24_1755075132893.png';
import avatar3 from '@assets/ChatGPT Image 13 ago 2025, 10_51_36 (1)_1755075132894.png';
import type { AvatarType } from './types';

interface SpectacularAvatarProps {
  type: AvatarType;
  message?: string;
  onAnimationComplete?: () => void;
  isFullscreen?: boolean;
  className?: string;
}

export function SpectacularAvatar({ 
  type, 
  message, 
  onAnimationComplete,
  isFullscreen = false,
  className 
}: SpectacularAvatarProps) {
  const [showEffects, setShowEffects] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Generate random particles
  useEffect(() => {
    if (isFullscreen) {
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
      }));
      setParticles(newParticles);
      setShowEffects(true);
    }
  }, [isFullscreen]);

  // Use user's provided avatar images
  const avatarImages = {
    smiling: avatar1,
    neutral: avatar2,
    explaining: avatar3,
    enthusiastic: avatar1,
    excited: avatar2,
    thoughtful: avatar3
  };

  const backgroundColors = {
    smiling: 'from-yellow-400 to-orange-400',
    neutral: 'from-gray-400 to-gray-500',
    explaining: 'from-blue-400 to-cyan-400',
    enthusiastic: 'from-pink-400 to-purple-400',
    excited: 'from-green-400 to-emerald-400',
    thoughtful: 'from-indigo-400 to-violet-400'
  };

  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 100, 
            damping: 15,
            duration: 0.8 
          }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          {/* Animated Background Gradient */}
          <motion.div
            className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-20",
              backgroundColors[type]
            )}
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Particle Effects */}
          {showEffects && particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 bg-white rounded-full"
              initial={{ x: particle.x, y: particle.y, opacity: 0 }}
              animate={{
                y: [particle.y, particle.y - 200],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeOut"
              }}
            />
          ))}

          {/* Giant Avatar */}
          <motion.div
            className="relative z-10"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [-5, 5, -5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <motion.div
              className="text-[300px] select-none"
              initial={{ rotate: 0 }}
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 0.5,
                times: [0, 0.2, 0.4, 0.6, 1]
              }}
            >
              <img 
                src={avatarImages[type]} 
                alt="Avatar"
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>

          {/* Cartoon Effects Text */}
          {showEffects && (
            <>
              <motion.div
                className="absolute top-20 left-20 text-8xl font-bold text-yellow-400"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                WOW!
              </motion.div>
              <motion.div
                className="absolute bottom-20 right-20 text-8xl font-bold text-pink-400"
                initial={{ scale: 0, rotate: 45 }}
                animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                BOOM!
              </motion.div>
              <motion.div
                className="absolute top-40 right-40 text-6xl font-bold text-cyan-400"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 360] }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                ✨
              </motion.div>
            </>
          )}

          {/* Message Display */}
          {message && (
            <motion.div
              className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-white rounded-3xl p-8 shadow-2xl max-w-2xl"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <p className="text-2xl font-bold text-gray-800 text-center">
                {message}
              </p>
            </motion.div>
          )}

          {/* Skip Button */}
          <motion.button
            className="absolute top-8 right-8 bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-full font-semibold hover:bg-white/30 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            onClick={onAnimationComplete}
          >
            Continua →
          </motion.button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Regular Avatar (non-fullscreen)
  return (
    <motion.div
      className={cn("relative", className)}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <motion.div
        className="text-6xl select-none"
        animate={{
          rotate: [0, -5, 5, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <img 
          src={avatarImages[type]} 
          alt="Avatar"
          className="w-full h-full object-contain"
        />
      </motion.div>
      
      {/* Small particle effect on hover */}
      <motion.div
        className="absolute -top-2 -right-2 text-2xl"
        initial={{ opacity: 0, scale: 0 }}
        whileHover={{ opacity: 1, scale: 1 }}
      >
        ✨
      </motion.div>
    </motion.div>
  );
}