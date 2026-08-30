import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, Truck, MapPin, ChevronRight } from "lucide-react";
import { useShopifyOrder } from "@/hooks/useShopifyOrders";
import {
  getDisplayStatus,
  getStatusIcon,
  getStatusVariant,
  getStatusLabel,
  TIMELINE_STEPS,
  isStepActive,
} from "@/lib/orderStatus";
import { usePageSEO } from "@/hooks/usePageSEO";

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { order, loading, notFound } = useShopifyOrder(id);

  usePageSEO({
    title: order ? `Order ${order.name}` : "Order Details",
    description: "Track the status of your order with Legendary Everyday.",
  });

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/my-orders">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Orders
          </Link>
        </Button>

        {loading && <OrderDetailSkeleton />}

        {notFound && (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Order not found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find this order in your account.
              </p>
              <Button asChild>
                <Link to="/my-orders">View All Orders</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {order && (() => {
          const status = getDisplayStatus(order);
          const StatusIcon = getStatusIcon(status);
          const currency = order.currency === "EUR" ? "€" : order.currency;

          return (
            <>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-display font-bold">Order {order.name}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Placed on {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <Badge variant={getStatusVariant(status)} className="flex items-center gap-1 text-sm py-1.5 px-3">
                  <StatusIcon className="w-4 h-4" />
                  {getStatusLabel(status)}
                </Badge>
              </div>

              {order.cancelled_at && (
                <Card className="mb-6 border-destructive/50 bg-destructive/5">
                  <CardContent className="py-4 text-sm text-destructive">
                    This order was cancelled on{" "}
                    {new Date(order.cancelled_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
                  </CardContent>
                </Card>
              )}

              {!order.cancelled_at && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Truck className="w-5 h-5" />
                      Order Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
                      <div className="relative grid grid-cols-4 gap-2">
                        {TIMELINE_STEPS.map((step, i) => {
                          const active = isStepActive(i, status);
                          return (
                            <div key={step.key} className="flex flex-col items-center text-center">
                              <div
                                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-colors ${
                                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full ${active ? "bg-primary-foreground" : "bg-muted-foreground/40"}`} />
                              </div>
                              <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {status !== "delivered" && (
                      <p className="text-sm text-muted-foreground mt-6 text-center">
                        Estimated delivery: 3-5 business days from shipping
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.line_items.map((item, index) => (
                      <div key={item.id}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {item.image ? (
                              <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded-lg" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold">{item.title}</h4>
                              {item.variant_title && (
                                <p className="text-xs text-muted-foreground">{item.variant_title}</p>
                              )}
                              <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                            </div>
                          </div>
                          <p className="font-semibold">
                            {currency}
                            {(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </p>
                        </div>
                        {index < order.line_items.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span>
                        {currency}
                        {parseFloat(order.total_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {order.shipping_address && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="w-5 h-5" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">
                        {order.customer.first_name} {order.customer.last_name}
                      </p>
                      <p className="text-muted-foreground">{order.shipping_address.address1}</p>
                      {order.shipping_address.address2 && (
                        <p className="text-muted-foreground">{order.shipping_address.address2}</p>
                      )}
                      <p className="text-muted-foreground">
                        {order.shipping_address.city}, {order.shipping_address.zip}
                      </p>
                      <p className="text-muted-foreground">{order.shipping_address.country}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button variant="outline" asChild>
                  <Link to="/my-orders">
                    All Orders
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

const OrderDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-start justify-between">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-7 w-24" />
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  </div>
);

export default OrderDetail;
