import { useState, useEffect, useRef } from "react";

interface ElevationDisplayProps {
  elevation_m: number;
}

export const ElevationDisplay = ({ elevation_m }: ElevationDisplayProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasStarted) {
        setHasStarted(true);
      }
    }, { threshold: 0.3 });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const increment = Math.ceil(elevation_m / 30);
    let current = 0;

    const interval = setInterval(() => {
      if (current >= elevation_m) {
        setDisplayValue(elevation_m);
        clearInterval(interval);
      } else {
        current = Math.min(current + increment, elevation_m);
        setDisplayValue(current);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [hasStarted, elevation_m]);

  return (
    <div ref={containerRef} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
      <svg width="32" height="32" viewBox="0 0 40 40" className="text-primary shrink-0">
        <path
          d="M6 32 L20 10 L34 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13 32 L22 18 L31 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
      <div>
        <p className="text-xs text-muted-foreground">Elevation</p>
        <p className="text-sm font-medium font-display">
          {displayValue.toLocaleString()}<span className="text-xs text-muted-foreground ml-0.5">masl</span>
        </p>
      </div>
    </div>
  );
};
