import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";

interface BenQuoteProps {
  quote: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const BenQuote = ({ quote, className, size = "md" }: BenQuoteProps) => {
  const sizeClasses = {
    sm: "text-sm p-3",
    md: "text-base p-4", 
    lg: "text-lg p-6"
  };

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-secondary/10 to-primary/10 rounded-2xl border border-primary/20",
      sizeClasses[size],
      className
    )}>
      <Quote className="absolute top-2 left-2 w-4 h-4 text-primary/40" />
      
      <blockquote className="italic text-foreground/90 font-body">
        {quote}
      </blockquote>
      
      <div className="flex items-center mt-3 pt-3 border-t border-primary/10">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
          <span className="text-xs font-bold text-primary-foreground">B</span>
        </div>
        <div>
          <p className="font-display font-semibold text-sm">Ben</p>
          <p className="text-xs text-muted-foreground">Founder & Head Roaster</p>
        </div>
      </div>
      
      {/* Speech bubble tail */}
      <div className="absolute -bottom-2 left-6 w-4 h-4 bg-gradient-to-br from-secondary/10 to-primary/10 rotate-45 border-r border-b border-primary/20"></div>
    </div>
  );
};