import { AlertTriangle } from "lucide-react";

const OrderClosedBanner = () => {
  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">
          Orders are currently closed
        </span>
      </div>
    </div>
  );
};

export default OrderClosedBanner;