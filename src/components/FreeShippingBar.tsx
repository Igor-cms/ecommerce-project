import { useMemo } from "react";

interface FreeShippingBarProps {
  cartTotal: number;
  threshold?: number;
}

const FreeShippingBar = ({ cartTotal, threshold = 50 }: FreeShippingBarProps) => {
  const progress = useMemo(() => {
    return Math.min((cartTotal / threshold) * 100, 100);
  }, [cartTotal, threshold]);

  const remaining = threshold - cartTotal;
  const isEligible = cartTotal >= threshold;

  if (isEligible) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground p-4 shadow-lg z-50">
        <div className="container mx-auto text-center">
          <p className="font-semibold">🎉 Congratulations! You've earned free shipping!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg z-50">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-body">
            Almost there—free shipping from €{threshold}!
          </span>
          <span className="text-sm font-semibold text-primary">
            €{remaining.toFixed(2)} remaining
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default FreeShippingBar;