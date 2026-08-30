import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Tag, CheckCircle2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export const DiscountCodeField = () => {
  const { discountCode, discountInfo, applyDiscount, clearDiscount } = useCart();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const code = inputValue.trim();
    if (!code) return;

    setIsLoading(true);
    setError(null);

    const result = await applyDiscount(code);
    if (!result.success) {
      setError(result.error || "Invalid or expired code");
    } else {
      setInputValue("");
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  if (discountCode && discountInfo) {
    return (
      <div className="px-6 py-3 space-y-1.5">
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary flex-1 truncate">
            {discountCode}
          </span>
          <span className="text-xs text-primary/80">
            {discountInfo.type === "percentage"
              ? `-${discountInfo.value}%`
              : `-€${discountInfo.value.toFixed(2)}`}
          </span>
          <button
            onClick={clearDiscount}
            className="p-0.5 rounded hover:bg-primary/10 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-primary/60" />
          </button>
        </div>
        <p className="text-xs text-primary flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Discount applied
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-3 space-y-1.5">
      <div className="flex gap-2">
        <Input
          placeholder="Discount code"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 rounded-xl text-sm flex-1"
          disabled={isLoading}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl px-4 text-sm font-medium"
          onClick={handleApply}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};
