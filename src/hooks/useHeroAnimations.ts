import { useState, useCallback, useEffect, useRef } from 'react';
import { ANIMATION_DURATIONS, type HeroMode } from '@/config/heroAnimations';

interface UseHeroAnimationsProps {
  onBrandSelect?: (brand: "legendary" | "everyday" | null) => void;
}

export const useHeroAnimations = ({ onBrandSelect }: UseHeroAnimationsProps = {}) => {
  const [mode, setMode] = useState<HeroMode>('entering');
  const [isAnimating, setIsAnimating] = useState(false);
  const [brandSelected, setBrandSelected] = useState<"legendary" | "everyday" | null>(null);
  const [wholesaleModalOpen, setWholesaleModalOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const entranceFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle entrance animation
  const handleEntranceComplete = useCallback(() => {
    if (entranceFallbackRef.current) {
      clearTimeout(entranceFallbackRef.current);
      entranceFallbackRef.current = null;
    }
    setIsAnimating(true);
    setMode('idle');
    setTimeout(() => {
      setShowContent(true);
      setIsAnimating(false);
    }, ANIMATION_DURATIONS.panel);
  }, []);

  // Safety fallback: if stuck in 'entering' mode, auto-transition to idle
  useEffect(() => {
    if (mode === 'entering') {
      entranceFallbackRef.current = setTimeout(() => {
        handleEntranceComplete();
      }, 500);
      return () => {
        if (entranceFallbackRef.current) {
          clearTimeout(entranceFallbackRef.current);
        }
      };
    }
  }, [mode, handleEntranceComplete]);

  const handleBrandClick = useCallback((brand: 'legendary' | 'everyday') => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setMode(brand);
    
    // After rotation completes, set brand selected and show products
    setTimeout(() => {
      setBrandSelected(brand);
      onBrandSelect?.(brand);
      setIsAnimating(false);
    }, ANIMATION_DURATIONS.panel);
  }, [isAnimating, onBrandSelect]);

  const handleBackToSplit = useCallback(() => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    // Set mode to 'idle' immediately so panels rotate back now
    setMode('idle');
    setTimeout(() => {
      setBrandSelected(null);
      onBrandSelect?.(null);
      setIsAnimating(false);
    }, ANIMATION_DURATIONS.panel);
  }, [isAnimating, onBrandSelect]);

  const handleWholesaleClick = useCallback(() => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setMode('wholesale');
    // After panels rotate to open the seam, show the form
    setTimeout(() => {
      setWholesaleModalOpen(true);
      setIsAnimating(false);
    }, ANIMATION_DURATIONS.panel);
  }, [isAnimating]);

  const handleWholesaleClose = useCallback(() => {
    setIsAnimating(true);
    setWholesaleModalOpen(false);
    // Return both panels to 0deg by switching to 'idle' immediately
    setMode('idle');
    setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATIONS.panel);
  }, []);

  return {
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
  };
};