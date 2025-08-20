import { useEffect, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportantMessageChatProps {
  message: string;
  avatar?: React.ReactNode;
  options?: Array<{
    id: string;
    label: string;
    action: () => void;
  }>;
  onAnimationComplete?: () => void;
}

export default function ImportantMessageChat({
  message,
  avatar,
  options,
  onAnimationComplete,
}: ImportantMessageChatProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    // Sequenza di animazioni
    const timer1 = setTimeout(() => setIsVisible(true), 100);
    const timer2 = setTimeout(() => setShowContent(true), 400);
    const timer3 = setTimeout(() => setShowSparkles(true), 800);
    const timer4 = setTimeout(() => {
      onAnimationComplete?.();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onAnimationComplete]);

  return (
    <div className="mb-6 relative">
      {/* Sfondo con effetto glow */}
      <div
        className={`absolute inset-0 -m-4 rounded-3xl transition-all duration-1000 ${
          isVisible
            ? "bg-gradient-to-r from-purple-100 via-pink-50 to-purple-100 opacity-70 shadow-2xl scale-105"
            : "opacity-0 scale-95"
        }`}
        style={{
          filter: isVisible ? "blur(0px)" : "blur(10px)",
        }}
      />
      
      {/* Particelle fluttuanti */}
      {showSparkles && (
        <>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${20 + i * 15}%`,
                top: `${10 + (i % 2) * 20}px`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: "2s",
              }}
            >
              <Star
                className={`w-3 h-3 text-yellow-400 animate-pulse ${
                  i % 2 === 0 ? "animate-spin" : ""
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            </div>
          ))}
        </>
      )}

      {/* Contenuto principale */}
      <div className="relative z-10 flex items-start gap-4 p-6">
        {/* Avatar con effetti */}
        <div
          className={`relative transition-all duration-700 ${
            isVisible
              ? "transform scale-110 rotate-3"
              : "transform scale-95 opacity-0"
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse opacity-50 scale-110" />
          <div className="relative">
            {avatar}
          </div>
          {showSparkles && (
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 animate-bounce" />
          )}
        </div>

        {/* Messaggio */}
        <div
          className={`relative flex-1 transition-all duration-700 ${
            showContent
              ? "transform translate-y-0 opacity-100"
              : "transform translate-y-4 opacity-0"
          }`}
        >
          {/* Bubble con gradiente speciale */}
          <div className="relative bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-2xl p-5 shadow-lg border border-purple-100">
            {/* Effetto shine */}
            <div
              className={`absolute inset-0 rounded-2xl transition-opacity duration-1000 ${
                isVisible ? "opacity-30" : "opacity-0"
              }`}
              style={{
                background:
                  "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)",
                animation: isVisible ? "shine 2s ease-in-out infinite" : "none",
              }}
            />
            
            {/* Testo del messaggio */}
            <p
              className={`relative text-gray-800 font-semibold text-lg leading-relaxed transition-all duration-500 ${
                showContent ? "animate-pulse" : ""
              }`}
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              {message}
            </p>

            {/* Badge di importanza */}
            <div
              className={`absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg transition-all duration-700 ${
                showContent
                  ? "transform scale-100 rotate-12"
                  : "transform scale-0"
              }`}
            >
              ✨ Importante
            </div>

            {/* Options buttons */}
            {options && showContent && (
              <div className="mt-4 space-y-2">
                {options.map((option) => (
                  <Button
                    key={option.id}
                    onClick={option.action}
                    variant="outline"
                    className="w-full justify-start text-left bg-white/90 hover:bg-purple-50 border-purple-200 hover:border-purple-300 shadow-sm font-semibold"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Ombra dinamica */}
          <div
            className={`absolute inset-0 rounded-2xl transition-all duration-700 -z-10 ${
              isVisible
                ? "bg-purple-200 opacity-20 transform translate-y-2 blur-md scale-105"
                : "opacity-0 transform translate-y-0"
            }`}
          />
        </div>
      </div>

      {/* CSS per animazione shine */}
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50% { transform: translateX(100%) skewX(-15deg); }
          100% { transform: translateX(100%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
}