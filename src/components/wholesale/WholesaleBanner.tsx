import { Link } from "react-router-dom";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { Package, CheckCircle2 } from "lucide-react";

export const WholesaleBanner = () => {
  const { isWholesale, isLoading } = useWholesaleStatus();

  if (isLoading) return null;

  if (isWholesale) {
    return (
      <Link
        to="/wholesale"
        className="block mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 hover:border-primary/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <span className="text-foreground font-medium">
            Wholesale Approved — View exclusive prices →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/wholesale"
      className="block mb-4 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <Package className="w-5 h-5 text-primary shrink-0" />
        <span className="text-foreground">
          Request access to wholesale →
        </span>
      </div>
    </Link>
  );
};
