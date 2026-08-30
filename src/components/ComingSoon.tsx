import { Coffee } from "lucide-react";

interface ComingSoonProps {
  className?: string;
}

export const ComingSoon = ({ className = "" }: ComingSoonProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-20 px-6 ${className}`}
    >
      <Coffee className="w-12 h-12 text-primary mb-6 opacity-80" />
      <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight mb-4 leading-[1.05]">
        We're going through<br />some changes
      </h2>
      <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
        Big things are coming. Stay legendary.
      </p>
    </div>
  );
};
