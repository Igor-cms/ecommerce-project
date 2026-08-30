import { Truck, Coffee } from "lucide-react";
import { useState, useEffect } from "react";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";

const getNextRoast = () => {
  const now = new Date();
  const target = new Date(now);
  // Set to Thursday (4) at 09:00
  const day = now.getDay();
  let daysUntil = (4 - day + 7) % 7;
  if (daysUntil === 0 && (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 0 && now.getSeconds() > 0))) {
    daysUntil = 7;
  }
  target.setDate(now.getDate() + daysUntil);
  target.setHours(9, 0, 0, 0);
  return target;
};

const parseCountdown = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
};

const FreeShippingBanner = () => {
  const { isWholesale, isLoading } = useWholesaleStatus();
  const [countdown, setCountdown] = useState({ d: "00", h: "00", m: "00", s: "00" });

  useEffect(() => {
    const tick = () => {
      const diff = getNextRoast().getTime() - Date.now();
      setCountdown(parseCountdown(diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) return null;

  const message = isWholesale
    ? `Free Shipping: Europe €300+ | UK €400+ — US: €80 Flat Rate on €800+`
    : `Free Shipping — Europe: €50+ | UK: €70+`;

  const blocks = [
    { value: countdown.d, label: "DAYS", calendar: true },
    { value: countdown.h, label: "HRS", calendar: false },
    { value: countdown.m, label: "MIN", calendar: false },
    { value: countdown.s, label: "SEC", calendar: false },
  ];

  return (
    <div className="w-full bg-primary/5 border-b border-primary/20 py-2">
      <div className="container mx-auto px-4">
        {/* Mobile: flex-wrap single line */}
        <div className="flex flex-wrap sm:hidden items-center justify-center gap-3 text-center">
          {/* Free Shipping Message */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {message}
            </span>
          </div>

          {/* Roasting Message */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Coffee className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium">
              Roasting Thursday, order cutoff is 9am 💖
            </span>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-1">
            {blocks.map((block, i) => (
              <div key={block.label} className="flex items-center gap-1">
                <div
                  className={`flex flex-col items-center justify-center rounded-md bg-primary/10 border border-primary/20 min-w-[30px] h-[32px] px-1 ${
                    block.calendar ? "border-t-2 border-t-primary" : ""
                  }`}
                >
                  <span className="text-[10px] font-bold tabular-nums text-foreground leading-none">
                    {block.value}
                  </span>
                  <span className="text-[7px] uppercase tracking-wider text-muted-foreground/70 font-semibold leading-none mt-0.5">
                    {block.label}
                  </span>
                </div>
                {i < blocks.length - 1 && (
                  <span className="text-[9px] font-bold text-primary/40">:</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop/Tablet: 2-line layout */}
        <div className="hidden sm:flex flex-col items-center justify-center gap-2">
          {/* Line 1: Free Shipping */}
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-medium">
              {message}
            </span>
          </div>

          {/* Line 2: Roasting + Countdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Coffee className="w-3 h-3 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground font-medium">
                Roasting Thursday, order cutoff is 9am 💖
              </span>
            </div>

            {/* Countdown */}
            <div className="flex items-center gap-1">
              {blocks.map((block, i) => (
                <div key={block.label} className="flex items-center gap-1">
                  <div
                    className={`flex flex-col items-center justify-center rounded-md bg-primary/10 border border-primary/20 min-w-[32px] h-[34px] px-1 ${
                      block.calendar ? "border-t-2 border-t-primary" : ""
                    }`}
                  >
                    <span className="text-xs font-bold tabular-nums text-foreground leading-none">
                      {block.value}
                    </span>
                    <span className="text-[7px] uppercase tracking-wider text-muted-foreground/70 font-semibold leading-none mt-0.5">
                      {block.label}
                    </span>
                  </div>
                  {i < blocks.length - 1 && (
                    <span className="text-[10px] font-bold text-primary/40">:</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreeShippingBanner;
