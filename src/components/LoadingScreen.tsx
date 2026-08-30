import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import whiskAnimation from '@/assets/whisk-animation.mp4';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(onComplete, 500);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }, 10000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500",
        isExiting ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="text-center">
        <div className="w-[85vw] md:w-[60vw] h-[50vh] md:h-[60vh] mx-auto mb-8 relative">
          <video 
            ref={videoRef}
            src={whiskAnimation} 
            autoPlay 
            loop 
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
          />
          
          <button
            onClick={toggleSound}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            aria-label={isMuted ? "Ativar som" : "Desativar som"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-primary">
            Brewing Excellence
          </h2>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          </div>
          
           <Button 
            onClick={handleSkip}
            variant="outline"
            className="mt-8 px-8 py-3 text-base font-medium transition-all duration-300 hover:scale-105 min-h-[48px]"
          >
            Skip Animation
          </Button>
        </div>
      </div>
    </div>
  );
};
