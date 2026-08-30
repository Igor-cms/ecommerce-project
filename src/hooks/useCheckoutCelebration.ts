import confetti from 'canvas-confetti';
import checkoutSound from '@/assets/checkout-sound.mp3';

const checkoutAudio = new Audio(checkoutSound);

export const useCheckoutCelebration = () => {
  const celebrate = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    checkoutAudio.volume = 0.5;
    checkoutAudio.currentTime = 0;
    checkoutAudio.play().catch(() => {});
  };
  return { celebrate };
};
