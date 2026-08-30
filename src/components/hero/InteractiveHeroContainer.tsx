import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AnimatedPanel } from './AnimatedPanel';
import { BrandText } from './BrandText';
import { WholesaleForm } from './WholesaleForm';
import { useHeroAnimations } from '@/hooks/useHeroAnimations';
import { useScrollLock } from '@/hooks/useScrollLock';

interface InteractiveHeroContainerProps {
  onBrandSelect?: (brand: "legendary" | "everyday" | null) => void;
  isEntering?: boolean;
}

export const InteractiveHeroContainer: React.FC<InteractiveHeroContainerProps> = ({ onBrandSelect, isEntering = false }) => {
  const navigate = useNavigate();
  const {
    mode,
    isAnimating,
    brandSelected,
    wholesaleModalOpen,
    showContent,
    handleEntranceComplete,
    handleBrandClick,
    handleBackToSplit,
    handleWholesaleClick,
    handleWholesaleClose
  } = useHeroAnimations({ onBrandSelect });
  
  useScrollLock(isAnimating);

  // Trigger entrance animation when component mounts with isEntering
  useEffect(() => {
    if (isEntering && mode === 'entering') {
      // Small delay to ensure panels are rendered in entering position first
      setTimeout(handleEntranceComplete, 100);
    }
  }, [isEntering, mode, handleEntranceComplete]);

  return (
    <div className={mode === 'idle' ? 'overflow-hidden' : ''}>
      <section 
        className={`h-[calc(100dvh-8rem)] md:h-screen relative ${mode === 'idle' ? 'overflow-hidden' : 'overflow-visible'}`}
        style={{
          // Keep destination background during animation for contrast, but don't animate the bg while rotating
          backgroundColor: (mode === 'everyday' || (isAnimating && brandSelected === 'everyday')) ? 'hsl(350 58% 67%)' : 'transparent',
          transition: 'none'
        }}
      >
        {/* Back to Split Button */}
        {mode !== 'idle' && mode !== 'wholesale' && !isAnimating && (
          <Button 
            onClick={handleBackToSplit} 
            variant="outline" 
            size="sm" 
            className="absolute top-6 left-6 z-50 bg-white/90 border-black/20 hover:bg-white transition-all duration-300 rounded-full px-4 py-2 text-black hover:text-black/70"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Animated Panels - Legendary behind, Everyday on top for proper layering */}
        <AnimatedPanel
          brand="legendary"
          mode={mode}
          onClick={() => handleBrandClick('legendary')}
        />
        
        <AnimatedPanel
          brand="everyday"
          mode={mode}
          onClick={() => handleBrandClick('everyday')}
        />

        {/* Brand Words */}
        {mode === 'idle' && (
          <>
            {/* BECAUSE YOU ARE - solid pink text */}
            <div 
              className="absolute top-[15%] md:top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center transition-opacity duration-500 ease-out"
              style={{ 
                opacity: showContent ? 1 : 0
              }}
            >
              <h3 
                className="text-5xl sm:text-5xl md:text-6xl lg:text-8xl font-display font-bold tracking-tight md:whitespace-nowrap px-4 md:px-0"
                style={{
                  color: 'hsl(350 58% 67%)'
                }}
              >
                <span className="hero-stroke-all">BECAUSE </span>
              <span className="hero-stroke-desktop">YOU </span>
              <span className="hero-stroke-desktop"><span className="text-[hsl(45_85%_95%)] md:text-[hsl(350_58%_67%)]">ARE</span></span>
              </h3>
            </div>

            {/* LEGENDARY - positioned entirely in cream side */}
            <div 
              className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center transition-opacity duration-500 ease-out delay-200"
              style={{ 
                opacity: showContent ? 1 : 0
              }}
            >
            <h2 className="flex flex-col md:flex-row items-center text-5xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-black drop-shadow-lg leading-none" style={{
                color: 'hsl(350 58% 67%)'
              }}>
                {"LEGENDARY".split("").map((letter, i) => (
                  <span key={i}>{letter}</span>
                ))}
              </h2>
            </div>
            
            {/* EVERYDAY - positioned entirely in pink side */}
            <div 
              className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center transition-opacity duration-500 ease-out delay-300"
              style={{ 
                opacity: showContent ? 1 : 0
              }}
            >
            <h2 className="flex flex-col md:flex-row items-center text-5xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-black drop-shadow-lg leading-none" style={{
                color: 'hsl(45 85% 95%)'
              }}>
                {"EVERYDAY".split("").map((letter, i) => (
                  <span key={i}>{letter}</span>
                ))}
              </h2>
            </div>
          </>
        )}

        {/* Expanded Brand Title with "Because you are" and opposite brand */}
        {(mode === 'legendary' || mode === 'everyday') && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* "Because you are" with margin-top 70px */}
            <div className="absolute left-1/2 transform -translate-x-1/2 mt-[70px]">
              <h3 className="text-xl sm:text-2xl md:text-5xl lg:text-6xl font-display font-bold text-center md:whitespace-nowrap px-4 md:px-0" style={{
                color: mode === "legendary" ? 'hsl(350 58% 67%)' : 'hsl(45 85% 95%)',
                WebkitTextStroke: '2px hsl(45 85% 95%)'
              }}>
                BECAUSE YOU ARE
              </h3>
            </div>

            {/* Main brand title with adjusted positioning */}
            <div className={`absolute inset-0 flex items-center justify-center ${mode === "legendary" ? "transform -translate-y-4 -translate-x-8" : "transform translate-y-4 translate-x-8"}`}>
              <div className="relative">
                <h2 className="text-5xl sm:text-6xl md:text-9xl lg:text-[12rem] font-display font-black" style={{
                  color: mode === "legendary" ? 'hsl(350 58% 67%)' : 'hsl(45 85% 95%)'
                }}>
                  {mode === "legendary" ? "LEGENDARY" : "EVERYDAY"}
                </h2>

                {/* "everyday" positioned right below and to the right of LEGENDARY */}
                {mode === "legendary" && !isAnimating && (
                  <div 
                    className="absolute -bottom-8 right-0 transform translate-x-8 cursor-pointer hover:opacity-70 transition-opacity duration-200 pointer-events-auto"
                    onClick={() => handleBrandClick('everyday')}
                  >
                    <h4 className="text-lg sm:text-xl md:text-4xl lg:text-5xl font-display font-bold border-2 border-white px-4 py-2 rounded-lg" style={{
                      color: 'hsl(45 85% 95%)',
                      backgroundColor: 'hsl(350 58% 67%)'
                    }}>
                      everyday
                    </h4>
                  </div>
                )}

                {/* "LEGENDARY" positioned close to the left above EVERYDAY with specific margins */}
                {mode === "everyday" && (
                  <div 
                    className="absolute -top-8 left-0 transform -translate-x-8 cursor-pointer hover:opacity-70 transition-opacity duration-200 pointer-events-auto" 
                    style={{ marginLeft: '-50px', marginTop: '-15px' }}
                    onClick={() => handleBrandClick('legendary')}
                  >
                    <h4 className="text-lg sm:text-xl md:text-4xl lg:text-5xl font-display font-bold border-2 border-white px-4 py-2 rounded-lg" style={{
                      color: 'hsl(350 58% 67%)',
                      backgroundColor: 'hsl(45 85% 95%)'
                    }}>
                      LEGENDARY
                    </h4>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wholesale Registration CTA - Below brand words */}
        {mode === 'idle' && (
          <div 
            className="absolute bottom-8 md:bottom-1/4 left-1/2 transform -translate-x-1/2 z-40 transition-opacity duration-500 ease-out delay-500"
            style={{ 
              opacity: showContent ? 1 : 0
            }}
          >
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Button 
                onClick={() => navigate('/shop')} 
                className="px-8 py-4 text-lg font-display font-bold rounded-2xl transition-all duration-300 hover:scale-110 hover:rotate-1 backdrop-blur-sm min-w-[260px] text-center" 
                style={{
                  backgroundColor: 'hsl(45 85% 95%)',
                  color: 'hsl(0 0% 17%)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                }}
              >
                Shop Now
              </Button>
              <Button 
                onClick={handleWholesaleClick} 
                className="px-8 py-4 text-lg font-display font-bold rounded-2xl transition-all duration-300 hover:scale-110 hover:rotate-1 backdrop-blur-sm text-white min-w-[260px] text-center" 
                style={{
                  backgroundColor: 'hsl(350 58% 67%)',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                }}
              >
                Register for Wholesale
              </Button>
            </div>
          </div>
        )}

        {/* Wholesale Form */}
        <WholesaleForm 
          isOpen={mode === 'wholesale' && wholesaleModalOpen}
          onClose={handleWholesaleClose}
        />
      </section>
    </div>
  );
};