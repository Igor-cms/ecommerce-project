import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useShopifyOrders, ShopifyOrder } from "@/hooks/useShopifyOrders";
import { useOrderSeparations } from "@/hooks/useOrderSeparations";
import { useShopifyFulfillment, FulfillmentAction } from "@/hooks/useShopifyFulfillment";
import { useFedexLabel } from "@/hooks/useFedexLabel";
import { CreateDraftOrderModal } from "@/components/CreateDraftOrderModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Package, Truck, CheckCircle, Clock, Search, Download, RefreshCw, AlertCircle, Eye, XCircle, PackageCheck, Printer, Pause, Play, ChevronDown, X, Tag, FileText, PlusCircle, Loader2
} from "lucide-react";
import { DialogDescription } from "@/components/ui/dialog";

const getDisplayStatus = (order: ShopifyOrder): string => {
  if (order.cancelled_at) return "cancelled";
  if (order.fulfillment_status === "fulfilled") return "fulfilled";
  // Use granular fulfillment_order_status when available
  if (order.fulfillment_order_status === "on_hold") return "on_hold";
  if (order.fulfillment_order_status === "in_progress") return "in_progress";
  if (order.fulfillment_status === "partial") return "partial";
  // unfulfilled (null)
  return "unfulfilled";
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "unfulfilled": return "Unfulfilled";
    case "partial": return "Partial";
    case "in_progress": return "In Progress";
    case "on_hold": return "On Hold";
    case "fulfilled": return "Fulfilled";
    case "cancelled": return "Cancelled";
    default: return status;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "unfulfilled": return <Clock className="w-4 h-4" />;
    case "partial": return <Package className="w-4 h-4" />;
    case "in_progress": return <RefreshCw className="w-4 h-4" />;
    case "on_hold": return <Pause className="w-4 h-4" />;
    case "fulfilled": return <CheckCircle className="w-4 h-4" />;
    case "cancelled": return <XCircle className="w-4 h-4" />;
    default: return <AlertCircle className="w-4 h-4" />;
  }
};

const getStatusVariant = (status: string): "secondary" | "outline" | "default" | "destructive" => {
  switch (status) {
    case "unfulfilled": return "secondary";
    case "partial": return "outline";
    case "in_progress": return "outline";
    case "on_hold": return "destructive";
    case "fulfilled": return "default";
    case "cancelled": return "destructive";
    default: return "secondary";
  }
};

const getAvailableActions = (status: string): { label: string; action: FulfillmentAction; icon: React.ReactNode }[] => {
  switch (status) {
    case "unfulfilled":
      return [
        { label: "Mark as Fulfilled", action: "fulfill", icon: <CheckCircle className="w-4 h-4" /> },
        { label: "Put on Hold", action: "hold", icon: <Pause className="w-4 h-4" /> },
      ];
    case "partial":
      return [
        { label: "Mark as Fulfilled", action: "fulfill", icon: <CheckCircle className="w-4 h-4" /> },
        { label: "Put on Hold", action: "hold", icon: <Pause className="w-4 h-4" /> },
      ];
    case "in_progress":
      return [
        { label: "Mark as Fulfilled", action: "fulfill", icon: <CheckCircle className="w-4 h-4" /> },
        { label: "Put on Hold", action: "hold", icon: <Pause className="w-4 h-4" /> },
      ];
    case "on_hold":
      return [
        { label: "Release Hold", action: "release_hold", icon: <Play className="w-4 h-4" /> },
        { label: "Mark as Fulfilled", action: "fulfill", icon: <CheckCircle className="w-4 h-4" /> },
      ];
    case "fulfilled":
      return [
        { label: "Cancel Fulfillment", action: "cancel_fulfillment", icon: <XCircle className="w-4 h-4" /> },
      ];
    default:
      return [];
  }
};

const INITIAL_ITEMS_SHOWN = 2;

const AdminOrders = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const { orders, loading, refetch } = useShopifyOrders();
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, string>>({});
  const [modalStatus, setModalStatus] = useState<string | null>(null);
  const [labelModal, setLabelModal] = useState<number | null>(null);
  const [labelConfirmed, setLabelConfirmed] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<number | null>(null);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [xeroModal, setXeroModal] = useState<number | null>(null);
  const [xeroSending, setXeroSending] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const { separatedIds, toggleSeparation } = useOrderSeparations();
  const { updateFulfillment, loading: fulfillmentLoading } = useShopifyFulfillment(() => {
    refetch().then(() => setOptimisticStatuses({}));
  });
  const { createLabel, loading: labelLoading, result: labelResult, error: labelError, reset: resetLabel } = useFedexLabel();

  const ordersWithStatus = orders.map(o => {
    const optimistic = optimisticStatuses[o.id];
    const enrichedOrder = optimistic
      ? { ...o, fulfillment_order_status: optimistic }
      : o;
    return { ...enrichedOrder, displayStatus: getDisplayStatus(enrichedOrder) };
  });

  const filteredOrders = ordersWithStatus.filter(order => {
    const term = searchTerm.toLowerCase();
    const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim().toLowerCase();
    const productMatch = order.line_items.some(li =>
      li.title.toLowerCase().includes(term) ||
      (li.variant_title && li.variant_title.toLowerCase().includes(term))
    );
    const matchesSearch = !term ||
      order.name.toLowerCase().includes(term) ||
      customerName.includes(term) ||
      order.email.toLowerCase().includes(term) ||
      productMatch;
    const matchesStatus = statusFilter === "all" || order.displayStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: ordersWithStatus.length,
    unfulfilled: ordersWithStatus.filter(o => o.displayStatus === "unfulfilled").length,
    in_progress: ordersWithStatus.filter(o => o.displayStatus === "in_progress" || o.displayStatus === "partial").length,
    on_hold: ordersWithStatus.filter(o => o.displayStatus === "on_hold").length,
    fulfilled: ordersWithStatus.filter(o => o.displayStatus === "fulfilled").length,
    cancelled: ordersWithStatus.filter(o => o.displayStatus === "cancelled").length,
  };

  const undeliveredOrders = ordersWithStatus.filter(o => o.displayStatus !== "fulfilled");

  const printHtml = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  const handlePrintUndelivered = () => {
    const rows = undeliveredOrders.map(order => {
      const customer = `${order.customer.first_name} ${order.customer.last_name}`.trim() || "Guest";
      const date = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const status = getStatusLabel(order.displayStatus);
      const items = order.line_items.map(li => {
        const variant = li.variant_title ? ` (${li.variant_title})` : "";
        return `<div style="padding:2px 0;">${li.title}${variant} ×${li.quantity}</div>`;
      }).join("");
      const address = order.shipping_address
        ? `${order.shipping_address.address1}, ${order.shipping_address.city} ${order.shipping_address.zip}, ${order.shipping_address.country}`
        : "—";
      const note = order.note ? `<div style="font-style:italic;color:#666;margin-top:4px;">Note: ${order.note}</div>` : "";

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;font-weight:bold;">${order.name}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;">${customer}<br/><span style="font-size:11px;color:#666;">${order.email}</span></td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;">${date}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;">${status}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;">€${parseFloat(order.total_price).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;font-size:12px;">${items}${note}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;font-size:12px;">${address}</td>
      </tr>`;
    }).join("");

    printHtml(`<!DOCTYPE html><html><head><title>Undelivered Orders</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;}
      table{width:100%;border-collapse:collapse;}
      th{text-align:left;padding:8px;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;color:#555;}
      h1{font-size:18px;margin-bottom:4px;} p.sub{color:#666;margin-top:0;margin-bottom:16px;font-size:13px;}
      @media print{body{padding:0;}}</style></head>
      <body><h1>Undelivered Orders</h1><p class="sub">Printed ${new Date().toLocaleString()} — ${undeliveredOrders.length} orders</p>
      <table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th>Items</th><th>Shipping</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
  };

  const handlePrintOrder = (order: typeof ordersWithStatus[0]) => {
    const customer = `${order.customer.first_name} ${order.customer.last_name}`.trim() || "Guest";
    const date = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const status = getStatusLabel(order.displayStatus);
    const items = order.line_items.map(li => {
      const variant = li.variant_title ? ` (${li.variant_title})` : "";
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${li.title}${variant}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${li.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">€${(parseFloat(li.price) * li.quantity).toFixed(2)}</td></tr>`;
    }).join("");
    const address = order.shipping_address
      ? `${order.shipping_address.address1}${order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ""}<br/>${order.shipping_address.city}, ${order.shipping_address.province} ${order.shipping_address.zip}<br/>${order.shipping_address.country}`
      : "No shipping address";
    const note = order.note ? `<div style="margin-top:16px;padding:8px;background:#f9f9f9;border-radius:4px;"><strong>Note:</strong> ${order.note}</div>` : "";

    printHtml(`<!DOCTYPE html><html><head><title>Order ${order.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px;max-width:600px;margin:0 auto;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th{text-align:left;padding:6px 8px;border-bottom:2px solid #333;font-size:11px;text-transform:uppercase;color:#555;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
      .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#eee;}
      h1{font-size:20px;margin:0;} .meta{color:#666;font-size:12px;margin-top:4px;}
      .section{margin-top:16px;} .section h3{font-size:13px;margin-bottom:6px;text-transform:uppercase;color:#555;}
      .total{text-align:right;font-size:16px;font-weight:bold;margin-top:12px;padding-top:8px;border-top:2px solid #333;}
      @media print{body{padding:0;}}</style></head>
      <body>
        <div class="header"><div><h1>Order ${order.name}</h1><div class="meta">${date} • <span class="badge">${status}</span></div></div><div style="text-align:right;"><strong>${customer}</strong><br/><span style="color:#666;font-size:12px;">${order.email}</span></div></div>
        <div class="section"><h3>Items</h3><table><thead><tr><th>Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Total</th></tr></thead><tbody>${items}</tbody></table>
        <div class="total">Total: €${parseFloat(order.total_price).toFixed(2)}</div></div>
        <div class="section"><h3>Shipping Address</h3><p>${address}</p></div>
        ${note}
      </body></html>`);
  };

  const handleFulfillmentAction = (orderId: number, action: FulfillmentAction) => {
    // Optimistic update: set expected status immediately
    const statusMap: Record<string, string> = {
      hold: "on_hold",
      in_progress: "in_progress",
      fulfill: "fulfilled",
      release_hold: "open",
      cancel_fulfillment: "open",
    };
    if (statusMap[action]) {
      setOptimisticStatuses(prev => ({ ...prev, [orderId]: statusMap[action] }));
    }
    updateFulfillment(orderId, action);
  };

  return (
    <>
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold mb-4">Order Management</h1>
            <p className="text-lg text-muted-foreground">Real-time orders from Shopify</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCreateOrderOpen(true)}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Order
            </Button>
            <Button variant="outline" onClick={handlePrintUndelivered} disabled={loading || undeliveredOrders.length === 0}>
              <Printer className="w-4 h-4 mr-2" />
              Print Undelivered ({undeliveredOrders.length})
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { key: "all", label: "Total", value: stats.total, color: "text-foreground" },
            { key: "unfulfilled", label: "Unfulfilled", value: stats.unfulfilled, color: "text-yellow-600" },
            { key: "in_progress", label: "In Progress", value: stats.in_progress, color: "text-blue-600" },
            { key: "on_hold", label: "On Hold", value: stats.on_hold, color: "text-orange-600" },
            { key: "fulfilled", label: "Fulfilled", value: stats.fulfilled, color: "text-green-600" },
            { key: "cancelled", label: "Cancelled", value: stats.cancelled, color: "text-red-600" },
          ].map((stat) => (
            <Card
              key={stat.key}
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/30"
              onClick={() => setModalStatus(stat.key)}
            >
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status modal */}
        <Dialog open={modalStatus !== null} onOpenChange={(open) => !open && setModalStatus(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {modalStatus === "all" ? "All Orders" : `${getStatusLabel(modalStatus || "")} Orders`}
                {" "}
                <span className="text-muted-foreground font-normal text-base">
                  ({modalStatus === "all"
                    ? ordersWithStatus.length
                    : modalStatus === "in_progress"
                    ? ordersWithStatus.filter(o => o.displayStatus === "in_progress" || o.displayStatus === "partial").length
                    : ordersWithStatus.filter(o => o.displayStatus === modalStatus).length
                  })
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {(modalStatus === "all"
                ? ordersWithStatus
                : modalStatus === "in_progress"
                ? ordersWithStatus.filter(o => o.displayStatus === "in_progress" || o.displayStatus === "partial")
                : ordersWithStatus.filter(o => o.displayStatus === modalStatus)
              ).map((order) => {
                const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim() || "Guest";
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => {
                      setModalStatus(null);
                      setStatusFilter(modalStatus === "all" ? "all" : modalStatus || "all");
                      setSearchTerm(order.name);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-bold text-sm whitespace-nowrap">{order.name}</span>
                      <span className="text-sm text-muted-foreground truncate">{customerName}</span>
                      <Badge variant={getStatusVariant(order.displayStatus)} className="flex items-center gap-1 text-xs shrink-0">
                        {getStatusIcon(order.displayStatus)}
                        {getStatusLabel(order.displayStatus)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-semibold text-sm">
                        €{parseFloat(order.total_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {modalStatus !== null && (modalStatus === "all" ? ordersWithStatus : ordersWithStatus.filter(o => modalStatus === "in_progress" ? (o.displayStatus === "in_progress" || o.displayStatus === "partial") : o.displayStatus === modalStatus)).length === 0 && (
                <p className="text-center text-muted-foreground py-8">No orders with this status</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by order number, customer or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-9" />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64 mt-2" /></CardHeader>
                <CardContent><Skeleton className="h-20 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim() || "Guest";
                const actions = getAvailableActions(order.displayStatus);
                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 flex-wrap">
                             {order.name}
                             {order.displayStatus !== "cancelled" && actions.length > 0 ? (
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild disabled={fulfillmentLoading}>
                                   <button className="inline-flex items-center gap-1 cursor-pointer focus:outline-none">
                                     <Badge variant={getStatusVariant(order.displayStatus)} className="flex items-center gap-1 pr-1.5">
                                       {getStatusIcon(order.displayStatus)}
                                       {getStatusLabel(order.displayStatus)}
                                       <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                                     </Badge>
                                   </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="start">
                                   {actions.map(({ label, action, icon }) => (
                                     <DropdownMenuItem
                                       key={action}
                                       onClick={() => handleFulfillmentAction(order.id, action)}
                                       className="flex items-center gap-2 cursor-pointer"
                                     >
                                       {icon}
                                       {label}
                                     </DropdownMenuItem>
                                   ))}
                                 </DropdownMenuContent>
                               </DropdownMenu>
                             ) : (
                               <Badge variant={getStatusVariant(order.displayStatus)} className="flex items-center gap-1">
                                 {getStatusIcon(order.displayStatus)}
                                 {getStatusLabel(order.displayStatus)}
                               </Badge>
                             )}
                             {order.financial_status && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  order.financial_status === "paid"
                                    ? "border-green-300 bg-green-100 text-green-800"
                                    : order.financial_status === "refunded"
                                    ? "border-red-300 bg-red-100 text-red-800"
                                    : order.financial_status === "pending"
                                    ? "border-yellow-300 bg-yellow-100 text-yellow-800"
                                    : ""
                                }`}
                              >
                                {order.financial_status}
                              </Badge>
                            )}
                            {separatedIds.has(String(order.id)) && (
                              <Badge className="flex items-center gap-1 bg-emerald-600 text-white border-emerald-600">
                                <PackageCheck className="w-3 h-3" />
                                Separated
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {customerName} • {order.email}{order.customer.phone ? ` • ${order.customer.phone}` : ""} • {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setLabelModal(order.id)} title="Label">
                            <Tag className="w-4 h-4 mr-1" />
                            Label
                          </Button>
                          {order.financial_status === "paid" ? (
                            <Button variant="outline" size="sm" onClick={() => setXeroModal(order.id)} title="Generate Xero Invoice">
                              <FileText className="w-4 h-4 mr-1" />
                              Xero Invoice
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setInvoiceModal(order.id)} title="Invoice">
                              <FileText className="w-4 h-4 mr-1" />
                              Invoice
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handlePrintOrder(order)} title="Print order">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <div className="text-right">
                            <p className="text-2xl font-bold">
                              {order.currency === 'EUR' ? '€' : order.currency}{parseFloat(order.total_price).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="items" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="items">Items ({order.line_items.length})</TabsTrigger>
                          <TabsTrigger value="shipping">Shipping</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="items" className="mt-4">
                          <div className="space-y-2">
                            {(() => {
                              const isExpanded = expandedOrders.has(order.id);
                              const visibleItems = isExpanded ? order.line_items : order.line_items.slice(0, INITIAL_ITEMS_SHOWN);
                              const hasMore = order.line_items.length > INITIAL_ITEMS_SHOWN;
                              return (
                                <>
                                  {visibleItems.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                      <div className="flex items-center gap-3">
                                        {item.image && (
                                          <img src={item.image} alt={item.title} className="w-10 h-10 rounded object-cover" />
                                        )}
                                        <div>
                                          <span className="font-medium">{item.title}</span>
                                          {item.variant_title && (
                                            <span className="text-sm text-muted-foreground ml-1">({item.variant_title})</span>
                                          )}
                                          <span className="text-sm text-muted-foreground ml-1">×{item.quantity}</span>
                                        </div>
                                      </div>
                                      <span className="font-semibold">€{(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {hasMore && (
                                    <button
                                      onClick={() => setExpandedOrders(prev => {
                                        const next = new Set(prev);
                                        if (next.has(order.id)) next.delete(order.id);
                                        else next.add(order.id);
                                        return next;
                                      })}
                                      className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium py-1.5 transition-colors"
                                    >
                                      {isExpanded
                                        ? "Collapse"
                                        : `Show ${order.line_items.length - INITIAL_ITEMS_SHOWN} more item${order.line_items.length - INITIAL_ITEMS_SHOWN > 1 ? "s" : ""}`}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="shipping" className="mt-4">
                          {order.shipping_address ? (
                            <div>
                              <h4 className="font-semibold mb-2">Shipping Address</h4>
                              <p className="text-sm text-muted-foreground">
                                {order.shipping_address.address1}
                                {order.shipping_address.address2 && `, ${order.shipping_address.address2}`}
                                <br />
                                {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}
                                <br />
                                {order.shipping_address.country}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No shipping address provided</p>
                          )}
                          {order.note && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Order Note</h4>
                              <p className="text-sm text-muted-foreground">{order.note}</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No orders found</h3>
                  <p className="text-muted-foreground">Try adjusting your search filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Label Modal — FedEx */}
      <Dialog open={labelModal !== null} onOpenChange={(open) => {
        if (!open) {
          setLabelModal(null);
          setLabelConfirmed(false);
          resetLabel();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate FedEx Label</DialogTitle>
            <DialogDescription>
              Create a real shipping label via FedEx, attach tracking to the order, and notify the customer.
            </DialogDescription>
          </DialogHeader>

          {!labelConfirmed && !labelResult && !labelError && (
            <>
              <div className="py-4 space-y-3 text-sm text-muted-foreground">
                <p>Upon confirmation:</p>
                <ul className="list-disc list-inside space-y-1.5 ml-1">
                  <li>A <span className="font-medium text-foreground">FedEx label</span> will be generated</li>
                  <li>The order will be marked as <span className="font-medium text-foreground">Fulfilled</span></li>
                  <li>The customer will be <span className="font-medium text-foreground">notified by email</span> with tracking</li>
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setLabelModal(null); setLabelConfirmed(false); resetLabel(); }}>
                  Cancel
                </Button>
                <Button onClick={async () => {
                  if (labelModal == null) return;
                  setLabelConfirmed(true);
                  const r = await createLabel(labelModal);
                  if (r) refetch();
                }}>
                  Generate Label
                </Button>
              </div>
            </>
          )}

          {labelLoading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating FedEx label…</p>
            </div>
          )}

          {labelResult && !labelLoading && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="text-center font-medium">Label generated</p>
              <p className="text-center text-sm">
                Tracking: <span className="font-mono">{labelResult.trackingNumber}</span>
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {labelResult.serviceType} · {labelResult.weightKg.toFixed(2)} kg
              </p>
              <div className="flex gap-2 mt-2">
                {labelResult.pdfDownloadUrl && (
                  <Button asChild>
                    <a href={labelResult.pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-1.5" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <a href={labelResult.trackingUrl} target="_blank" rel="noopener noreferrer">
                    Track
                  </a>
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setLabelModal(null); setLabelConfirmed(false); resetLabel(); }}>
                Close
              </Button>
            </div>
          )}

          {labelError && !labelLoading && (
            <div className="flex flex-col items-center py-6 gap-3">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-center font-medium">Label generation failed</p>
              <p className="text-center text-xs text-muted-foreground max-w-sm break-words">{labelError}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => { setLabelConfirmed(false); resetLabel(); }}>
                  Try Again
                </Button>
                <Button variant="ghost" onClick={() => { setLabelModal(null); setLabelConfirmed(false); resetLabel(); }}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Modal */}
      {(() => {
        const invoiceOrder = invoiceModal !== null ? ordersWithStatus.find(o => o.id === invoiceModal) : null;
        const customerName = invoiceOrder ? `${invoiceOrder.customer.first_name} ${invoiceOrder.customer.last_name}`.trim() || "Guest" : "";
        return (
          <AlertDialog open={invoiceModal !== null} onOpenChange={(open) => { if (!open) setInvoiceModal(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send Invoice</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to send an invoice email to {customerName} ({invoiceOrder?.email}) for order {invoiceOrder?.name}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={invoiceSending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={invoiceSending}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!invoiceOrder) return;
                    setInvoiceSending(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("shopify-send-invoice", {
                        body: { orderId: invoiceOrder.id },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success(`Invoice sent for ${data?.orderName || invoiceOrder.name}`);
                      setInvoiceModal(null);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send invoice");
                    } finally {
                      setInvoiceSending(false);
                    }
                  }}
                >
                  {invoiceSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  {invoiceSending ? "Sending..." : "Send Invoice"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Xero Invoice Modal */}
      {(() => {
        const xeroOrder = xeroModal !== null ? ordersWithStatus.find(o => o.id === xeroModal) : null;
        const customerName = xeroOrder ? `${xeroOrder.customer.first_name} ${xeroOrder.customer.last_name}`.trim() || "Guest" : "";
        return (
          <AlertDialog open={xeroModal !== null} onOpenChange={(open) => { if (!open) setXeroModal(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate Xero Invoice</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create an AUTHORISED invoice in Xero for {customerName} ({xeroOrder?.email}) using the items and totals of order {xeroOrder?.name}, download the PDF, and open the Xero "View Invoice" page in a new tab.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={xeroSending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={xeroSending}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!xeroOrder) return;
                    setXeroSending(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("xero-create-invoice", {
                        body: { orderId: xeroOrder.id },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);

                      // Decode base64 PDF and trigger silent download
                      if (data?.pdf) {
                        const binary = atob(data.pdf);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        const blob = new Blob([bytes], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `invoice-${data?.orderName || xeroOrder.name}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }

                      if (data?.onlineInvoiceUrl) {
                        window.open(data.onlineInvoiceUrl, "_blank", "noopener,noreferrer");
                        toast.success(`Xero invoice ${data?.invoiceNumber || ""} created — opening View Invoice…`);
                      } else {
                        toast.success(`Xero invoice ${data?.invoiceNumber || ""} created for ${data?.orderName || xeroOrder.name}`);
                      }
                      setXeroModal(null);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to create Xero invoice");
                    } finally {
                      setXeroSending(false);
                    }
                  }}
                >
                  {xeroSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  {xeroSending ? "Generating..." : "Generate Invoice"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Create Order Modal */}
      <CreateDraftOrderModal
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        onSuccess={refetch}
      />
    </>
  );
};

export default AdminOrders;
