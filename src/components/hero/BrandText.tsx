import React from 'react';
import { BRAND_TEXT_POSITIONS, type BrandType } from '@/config/brandConfig';
import { type HeroMode } from '@/config/heroAnimations';

interface BrandTextProps {
  mode: HeroMode;
  onBrandClick?: (brand: 'legendary' | 'everyday') => void;
}

export const BrandText: React.FC<BrandTextProps> = ({ mode, onBrandClick }) => {
  if (mode === 'wholesale') return null;

  const positions = BRAND_TEXT_POSITIONS[mode as keyof typeof BRAND_TEXT_POSITIONS];
  if (!positions) return null;

  return (
    <>
      {/* Legendary Text */}
      {positions.legendary && (
        <div 
          className={positions.legendary.className} 
          style={positions.legendary.style || {}}
        >
          <h1 
            className={`text-9xl md:text-[12rem] font-display font-bold leading-none select-none ${
              mode === 'everyday' 
                ? 'text-gray-800 opacity-50 text-7xl md:text-8xl cursor-pointer hover:opacity-70 transition-opacity duration-200' 
                : 'text-gray-800'
            }`}
            onClick={mode === 'everyday' ? () => onBrandClick?.('legendary') : undefined}
          >
            LEGENDARY
          </h1>
        </div>
      )}

      {/* Everyday Text */}
      {positions.everyday && (
        <div 
          className={positions.everyday.className} 
          style={positions.everyday.style || {}}
        >
          <h1 className="text-9xl md:text-[12rem] font-display font-bold text-cream leading-none select-none">
            EVERYDAY
          </h1>
        </div>
      )}

      {/* Because You Are Text */}
      {positions.because && (
        <div 
          className={positions.because.className} 
          style={positions.because.style || {}}
        >
          <h2 
            className="text-6xl md:text-5xl font-display font-light leading-tight select-none"
            style={{
              color: 'hsl(350 58% 67%)'
            }}
          >
            BECAUSE YOU ARE
          </h2>
        </div>
      )}
    </>
  );
};