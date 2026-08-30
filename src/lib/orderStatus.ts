import { Clock, RefreshCw, Truck, CheckCircle, XCircle, type LucideIcon } from "lucide-react";
import type { ShopifyOrder } from "@/hooks/useShopifyOrders";

export type DisplayStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export const getDisplayStatus = (order: Pick<ShopifyOrder, "cancelled_at" | "fulfillment_status" | "financial_status">): DisplayStatus => {
  if (order.cancelled_at) return "cancelled";
  if (order.fulfillment_status === "fulfilled") return "delivered";
  if (order.fulfillment_status === "partial") return "shipped";
  if (order.financial_status === "paid") return "processing";
  return "pending";
};

export const getStatusIcon = (status: DisplayStatus): LucideIcon => {
  switch (status) {
    case "pending": return Clock;
    case "processing": return RefreshCw;
    case "shipped": return Truck;
    case "delivered": return CheckCircle;
    case "cancelled": return XCircle;
  }
};

export const getStatusVariant = (status: DisplayStatus): "secondary" | "outline" | "default" | "destructive" => {
  switch (status) {
    case "pending": return "secondary";
    case "processing": return "outline";
    case "shipped": return "default";
    case "delivered": return "default";
    case "cancelled": return "destructive";
  }
};

export const getStatusLabel = (status: DisplayStatus): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

export const TIMELINE_STEPS: { key: DisplayStatus; label: string }[] = [
  { key: "pending", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export const isStepActive = (stepIndex: number, status: DisplayStatus): boolean => {
  const order: DisplayStatus[] = ["pending", "processing", "shipped", "delivered"];
  const currentIdx = order.indexOf(status);
  return currentIdx >= stepIndex;
};
