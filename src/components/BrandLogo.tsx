import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface BrandLogoProps {
  className?: string;
  currentBrand?: "legendary" | "everyday" | null;
  onBrandChange?: (brand: "legendary" | "everyday") => void;
  interactive?: boolean;
  linkTo?: string;
}

export const BrandLogo = ({ 
  className, 
  currentBrand, 
  onBrandChange,
  interactive = false,
  linkTo
}: BrandLogoProps) => {
  const navigate = useNavigate();

  const handleToggle = () => {
    if (linkTo) {
      navigate(linkTo);
      return;
    }
    if (interactive && onBrandChange) {
      if (currentBrand === "legendary") {
        onBrandChange("everyday");
      } else {
        onBrandChange("legendary");
      }
    }
  };

  // Default to legendary for toggle display
  const displayBrand = currentBrand || "legendary";

  if (!interactive) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="bg-cream text-primary px-3 py-1 rounded-lg">
          <span className="font-display font-black text-lg tracking-wider">LGD</span>
        </div>
        <div className="bg-primary text-cream px-3 py-1 rounded-lg">
          <span className="font-display font-black text-lg tracking-wider">EDY</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div 
        className="relative w-32 h-12 rounded-full cursor-pointer transition-all duration-500 ease-in-out overflow-hidden"
        style={{
          backgroundColor: displayBrand === "everyday" ? "hsl(45 85% 95%)" : "hsl(350 58% 67%)"
        }}
        onClick={handleToggle}
      >
        {/* Background track */}
        <div className="absolute inset-1 rounded-full flex">
          {/* Sliding toggle indicator */}
          <div 
            className="absolute top-0 bottom-0 w-1/2 rounded-full transition-all duration-500 ease-in-out shadow-lg"
            style={{
              backgroundColor: displayBrand === "everyday" ? "hsl(350 58% 67%)" : "hsl(45 85% 95%)",
              transform: displayBrand === "everyday" ? "translateX(100%)" : "translateX(0%)"
            }}
          />
          
          {/* LGD Label */}
          <div className="w-1/2 flex items-center justify-center relative z-10">
            <span 
              className="font-display font-black text-sm tracking-wider transition-colors duration-300"
              style={{
                color: displayBrand === "legendary" 
                  ? "hsl(350 58% 67%)" 
                  : "hsl(45 85% 95%)"
              }}
            >
              LGD
            </span>
          </div>
          
          {/* EDY Label */}
          <div className="w-1/2 flex items-center justify-center relative z-10">
            <span 
              className="font-display font-black text-sm tracking-wider transition-colors duration-300"
              style={{
                color: displayBrand === "everyday" 
                  ? "hsl(45 85% 95%)" 
                  : "hsl(350 58% 67%)"
              }}
            >
              EDY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandLogo;