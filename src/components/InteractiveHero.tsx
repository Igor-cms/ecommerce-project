import React from 'react';
import { InteractiveHeroContainer } from './hero/InteractiveHeroContainer';

interface InteractiveHeroProps {
  onBrandSelect?: (brand: "legendary" | "everyday" | null) => void;
  isEntering?: boolean;
}

export const InteractiveHero: React.FC<InteractiveHeroProps> = ({ onBrandSelect, isEntering = false }) => {
  return <InteractiveHeroContainer onBrandSelect={onBrandSelect} isEntering={isEntering} />;
};