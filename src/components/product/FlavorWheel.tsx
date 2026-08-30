import { useState } from "react";

interface FlavorWheelProps {
  flavorNotes: string[];
}

const FLAVOR_COLORS: Record<string, string> = {
  // Fruits
  kiwi: "90, 50%, 50%",
  apple: "95, 45%, 48%",
  citrus: "55, 65%, 50%",
  lemon: "50, 70%, 52%",
  orange: "30, 70%, 55%",
  peach: "25, 65%, 65%",
  mango: "40, 75%, 55%",
  pineapple: "48, 70%, 52%",
  tropical: "45, 65%, 55%",
  berry: "290, 40%, 50%",
  blueberry: "250, 45%, 55%",
  raspberry: "340, 55%, 50%",
  strawberry: "350, 60%, 55%",
  plum: "280, 40%, 48%",
  grape: "270, 45%, 55%",
  cherry: "350, 55%, 45%",
  fig: "310, 30%, 40%",
  stonefruit: "25, 60%, 55%",
  // Sweets
  toffee: "35, 70%, 55%",
  caramel: "35, 65%, 50%",
  honey: "42, 75%, 55%",
  chocolate: "20, 55%, 35%",
  cocoa: "15, 50%, 30%",
  "brown sugar": "30, 60%, 42%",
  molasses: "20, 50%, 28%",
  vanilla: "45, 40%, 70%",
  maple: "28, 60%, 45%",
  sugar: "40, 50%, 65%",
  sweet: "38, 65%, 55%",
  bubblegum: "330, 60%, 60%",
  praline: "30, 55%, 45%",
  // Florals
  jasmine: "340, 50%, 65%",
  rose: "345, 55%, 60%",
  floral: "320, 45%, 62%",
  lavender: "270, 40%, 65%",
  hibiscus: "350, 50%, 55%",
  "white flowers": "320, 40%, 70%",
  // Nuts
  almond: "25, 40%, 45%",
  hazelnut: "25, 45%, 40%",
  walnut: "20, 35%, 38%",
  peanut: "30, 45%, 48%",
  nutty: "25, 40%, 42%",
  // Spices
  cinnamon: "15, 55%, 40%",
  clove: "10, 45%, 35%",
  pepper: "0, 30%, 35%",
  ginger: "35, 55%, 50%",
  // Others
  tobacco: "20, 30%, 32%",
  wine: "345, 50%, 40%",
  tea: "80, 30%, 45%",
  butter: "48, 55%, 65%",
  cream: "40, 30%, 75%",
  milk: "30, 20%, 80%",
};

const FALLBACK_COLOR = "330, 60%, 55%";

function getFlavorColor(note: string): string {
  const lower = note.toLowerCase().trim();
  if (FLAVOR_COLORS[lower]) return FLAVOR_COLORS[lower];
  for (const [keyword, color] of Object.entries(FLAVOR_COLORS)) {
    if (lower.includes(keyword) || keyword.includes(lower)) return color;
  }
  return FALLBACK_COLOR;
}

export const FlavorWheel = ({ flavorNotes }: FlavorWheelProps) => {
  if (!flavorNotes || flavorNotes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium font-display uppercase tracking-wider text-muted-foreground">
        Flavor Notes
      </h3>
      <div className="flex flex-wrap gap-2">
        {flavorNotes.map((note, i) => {
          const hsl = getFlavorColor(note);
          return (
            <span
              key={i}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-transform duration-200 hover:scale-105 animate-fade-in"
              style={{
                backgroundColor: `hsla(${hsl}, 0.15)`,
                color: `hsl(${hsl})`,
                animationDelay: `${i * 0.06}s`,
                animationFillMode: "both",
              }}
            >
              {note}
            </span>
          );
        })}
      </div>
    </div>
  );
};
