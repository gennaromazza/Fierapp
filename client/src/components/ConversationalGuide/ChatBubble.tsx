import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';
import type { AvatarType } from './types';

interface ChatBubbleProps {
  message: string;
  avatar: AvatarType;
  showConfetti?: boolean;
  isTyping?: boolean;
  onAnimationComplete?: () => void;
}

export function ChatBubble({ 
  message, 
  avatar, 
  showConfetti = false, 
  isTyping = false,
  onAnimationComplete 
}: ChatBubbleProps) {
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isTyping) {
      setDisplayedMessage(message);
      setIsComplete(true);
      onAnimationComplete?.();
      return;
    }

    setDisplayedMessage('');
    setIsComplete(false);
    
    let currentIndex = 0;
    const typingSpeed = 30; // milliseconds per character

    const typeInterval = setInterval(() => {
      if (currentIndex < message.length) {
        setDisplayedMessage(message.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsComplete(true);
        onAnimationComplete?.();
      }
    }, typingSpeed);

    return () => clearInterval(typeInterval);
  }, [message, isTyping, onAnimationComplete]);

  return (
    <div className="flex items-start gap-3 mb-4 animate-fade-in">
      <Avatar type={avatar} showConfetti={showConfetti} />
      
      <div className="flex-1 max-w-md">
        <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-lg border">
          <p className="text-gray-800 leading-relaxed">
            {displayedMessage}
            {isTyping && !isComplete && (
              <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}