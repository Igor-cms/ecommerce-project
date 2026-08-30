import React, { useEffect, useState } from 'react';
import { ANIMATION_DURATIONS, ANIMATION_EASING, BASE_CLIP_PATHS, ROTATION_ANGLES, TRANSFORM_ORIGINS, type HeroMode } from '@/config/heroAnimations';
import { BRAND_COLORS, type BrandType } from '@/config/brandConfig';
import { useIsMobile } from '@/hooks/use-mobile';

interface AnimatedPanelProps {
  brand: BrandType;
  mode: HeroMode;
  onClick: () => void;
  children?: React.ReactNode;
}

export const AnimatedPanel: React.FC<AnimatedPanelProps> = ({
  brand,
  mode,
  onClick,
  children
}) => {
  const [currentRotation, setCurrentRotation] = useState(() => {
    // Start with entering rotation if in entering mode
    return mode === 'entering' ? ROTATION_ANGLES.entering[brand] : 0;
  });
  const [isHidden, setIsHidden] = useState(false);
  
  const isMobile = useIsMobile();
  
  const isClickable = mode === 'idle';
  const targetRotation = ROTATION_ANGLES[mode][brand];
  const transformOrigin = TRANSFORM_ORIGINS[brand];
  const clipPath = isMobile
    ? (brand === 'legendary' 
        ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)'
        : 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)')
    : BASE_CLIP_PATHS[brand];
  
  // Don't hide panels - let rotation handle visibility
  const shouldHide = false;

  // Animate rotation when mode changes
  useEffect(() => {
    console.log(`Panel ${brand}: mode=${mode}, currentRotation=${currentRotation}, targetRotation=${targetRotation}`);
    setCurrentRotation(targetRotation);
    
    // Hide panel after animation completes if needed
    if (shouldHide) {
      setIsHidden(false); // Reset first
      setTimeout(() => {
        setIsHidden(true);
      }, ANIMATION_DURATIONS.panel);
    } else {
      setIsHidden(false);
    }
  }, [targetRotation, shouldHide]);

  return (
    <div 
      className="rotator absolute inset-0"
      style={{
        transformOrigin,
        transform: `rotate(${currentRotation}deg)`,
        transition: `transform ${ANIMATION_DURATIONS.panel}ms ${ANIMATION_EASING}`,
        willChange: 'transform',
        pointerEvents: 'none', // Let clicks pass through the rotator
        display: isHidden ? 'none' : 'block'
      }}
    >
      <div 
        className={`absolute inset-0 group ${
          isClickable ? 'cursor-pointer' : ''
        }`}
        style={{
          clipPath,
          backgroundColor: BRAND_COLORS[brand],
          pointerEvents: isClickable ? 'auto' : 'none'
        }}
        onClick={isClickable ? onClick : undefined}
      >
        {/* Hover overlay */}
        {isClickable && (
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              backgroundColor: brand === 'legendary' 
                ? 'hsl(350 58% 67% / 0.1)' 
                : 'hsl(45 85% 95% / 0.1)'
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
};