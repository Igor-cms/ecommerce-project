import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "horizontal" | "stacked";
}

export const Logo = ({ className, variant = "horizontal" }: LogoProps) => {
  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div className="bg-cream text-primary px-4 py-2 rounded-t-xl">
          <span className="font-display font-black text-2xl tracking-wider">LGD</span>
        </div>
        <div className="bg-primary text-cream px-4 py-2 rounded-b-xl">
          <span className="font-display font-black text-2xl tracking-wider">EDY</span>
        </div>
      </div>
    );
  }

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
};

export default Logo;