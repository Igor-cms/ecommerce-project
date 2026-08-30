import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BrandSwitcherProps {
  currentBrand: "legendary" | "everyday" | "all";
  onBrandChange: (brand: "legendary" | "everyday" | "all") => void;
  className?: string;
  sticky?: boolean;
  showAll?: boolean;
}

export const BrandSwitcher = ({ 
  currentBrand, 
  onBrandChange, 
  className,
  sticky = false,
  showAll = false,
}: BrandSwitcherProps) => {
  return (
    <div className={cn(
      "flex items-center justify-center gap-1 p-1 bg-muted rounded-xl w-fit mx-auto",
      sticky && "sticky top-4 z-40",
      className
    )}>
      {showAll && (
        <Button
          variant={currentBrand === "all" ? "default" : "ghost"}
          className={cn(
            "px-3 py-1.5 md:px-6 md:py-2 font-display font-semibold text-xs md:text-sm transition-all",
            currentBrand === "all" 
            ? "bg-[hsl(350_58%_67%)] text-[hsl(45_85%_95%)] shadow-sm hover:bg-[hsl(350_58%_67%/0.5)] hover:text-[hsl(45_85%_95%)]" 
            : "text-[hsl(0_0%_17%)] hover:bg-[hsl(350_58%_67%/0.15)] hover:text-[hsl(350_58%_67%)]"
        )}
        onClick={() => onBrandChange("all")}
        >
          ALL
        </Button>
      )}
      <Button
        variant={currentBrand === "legendary" ? "default" : "ghost"}
        className={cn(
          "px-3 py-1.5 md:px-6 md:py-2 font-display font-semibold text-xs md:text-sm transition-all",
          currentBrand === "legendary" 
            ? "bg-[hsl(350_58%_67%)] text-[hsl(45_85%_95%)] shadow-sm hover:bg-[hsl(350_58%_67%/0.5)] hover:text-[hsl(45_85%_95%)]" 
            : "text-[hsl(0_0%_17%)] hover:bg-[hsl(350_58%_67%/0.15)] hover:text-[hsl(350_58%_67%)]"
        )}
        onClick={() => onBrandChange("legendary")}
      >
        LEGENDARY
      </Button>
      <Button
        variant={currentBrand === "everyday" ? "default" : "ghost"}
        className={cn(
          "px-3 py-1.5 md:px-6 md:py-2 font-display font-semibold text-xs md:text-sm transition-all",
          currentBrand === "everyday" 
            ? "bg-[hsl(350_58%_67%)] text-[hsl(45_85%_95%)] shadow-sm hover:bg-[hsl(350_58%_67%/0.5)] hover:text-[hsl(45_85%_95%)]" 
            : "text-[hsl(0_0%_17%)] hover:bg-[hsl(350_58%_67%/0.15)] hover:text-[hsl(350_58%_67%)]"
        )}
        onClick={() => onBrandChange("everyday")}
      >
        EVERYDAY
      </Button>
    </div>
  );
};
