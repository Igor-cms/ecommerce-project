import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Package,
  Truck,
  Mail,
  ArrowRight,
  Coffee,
  Clock,
} from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useCart } from "@/contexts/CartContext";
import { useShopifyOrder } from "@/hooks/useShopifyOrders";

const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 6;

const Success = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order") ?? undefined;
  const { clearCart } = useCart();
  const { order, loading, refetch, notFound } = useShopifyOrder(orderId);
  const [retries, setRetries] = useState(0);

  usePageSEO({
    title: "Order Confirmed",
    description: "Your order has been successfully placed with Legendary Everyday.",
  });

  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!orderId || order || retries >= MAX_RETRIES) return;
    if (loading) return;
    const t = setTimeout(() => {
      setRetries((r) => r + 1);
      refetch();
    }, RETRY_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [orderId, order, loading, retries, refetch]);

  const stillSyncing = !order && (loading || (notFound && retries < MAX_RETRIES));
  const giveUp = !order && notFound && retries >= MAX_RETRIES;
  const currency = order?.currency === "EUR" ? "€" : order?.currency ?? "€";

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-display font-bold text-green-800 mb-2">
              Order Confirmed!
            </h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your purchase. Your order has been successfully processed.
            </p>
          </div>

          {stillSyncing && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 animate-pulse" />
                  Confirming your order details
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  This usually takes just a few seconds.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-8 w-1/2 ml-auto" />
                </div>
              </CardContent>
            </Card>
          )}

          {giveUp && (
            <Card className="mb-6">
              <CardContent className="py-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your order is being processed</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  It's taking a moment to appear in your account. Check back shortly in My Orders — you'll also receive a confirmation email.
                </p>
              </CardContent>
            </Card>
          )}

          {order && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order {order.name}</span>
                  <Badge variant="default" className="bg-green-600">Confirmed</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Placed on {new Date(order.created_at).toLocaleDateString("en-US")} at{" "}
                  {new Date(order.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold">Order Items</h3>
                  {order.line_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded-lg" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.title}</h4>
                        {item.variant_title && (
                          <p className="text-xs text-muted-foreground">{item.variant_title}</p>
                        )}
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">
                        {currency}
                        {(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>
                    {currency}
                    {parseFloat(order.total_price).toFixed(2)}
                  </span>
                </div>

                {order.shipping_address && (
                  <>
                    <Separator className="my-4" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Shipping to</p>
                      <p className="text-muted-foreground">
                        {order.customer.first_name} {order.customer.last_name}
                        <br />
                        {order.shipping_address.address1}
                        <br />
                        {order.shipping_address.city}, {order.shipping_address.zip}
                        <br />
                        {order.shipping_address.country}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Email Confirmation</h4>
                    <p className="text-sm text-muted-foreground">
                      We've sent a confirmation with all your order details.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Order Preparation</h4>
                    <p className="text-sm text-muted-foreground">
                      Our team will start preparing your order within the next few hours.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Tracking</h4>
                    <p className="text-sm text-muted-foreground">
                      Follow the status of your order in My Orders. You'll receive a tracking code once it's shipped.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to={order ? `/my-orders/${order.id}` : "/my-orders"}>
                <Package className="w-4 h-4 mr-2" />
                {order ? "View Order Details" : "Go to My Orders"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>

            <Button variant="outline" size="lg" asChild>
              <Link to="/shop">
                <Coffee className="w-4 h-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Success;
