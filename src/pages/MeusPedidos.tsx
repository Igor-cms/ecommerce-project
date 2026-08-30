import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useShopifyOrders } from "@/hooks/useShopifyOrders";
import { Package, Search, RefreshCw, ChevronRight } from "lucide-react";
import {
  getDisplayStatus,
  getStatusIcon,
  getStatusVariant,
  getStatusLabel,
  TIMELINE_STEPS,
  isStepActive,
} from "@/lib/orderStatus";

const MeusPedidos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { orders, loading, refetch } = useShopifyOrders();

  const ordersWithStatus = orders.map(o => ({ ...o, displayStatus: getDisplayStatus(o) }));

  const filteredOrders = ordersWithStatus.filter(order =>
    order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.line_items.some(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold mb-4">My Orders</h1>
            <p className="text-lg text-muted-foreground">
              Track all your orders and purchase history
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64 mt-2" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.displayStatus);
                return (
                  <Link
                    key={order.id}
                    to={`/my-orders/${order.id}`}
                    className="block transition-shadow hover:shadow-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <Card className="cursor-pointer">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              Order {order.name}
                              <Badge variant={getStatusVariant(order.displayStatus)} className="flex items-center gap-1">
                                <StatusIcon className="w-4 h-4" />
                                {getStatusLabel(order.displayStatus)}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Placed on {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-2xl font-bold">
                              {order.currency === 'EUR' ? '€' : order.currency}{parseFloat(order.total_price).toFixed(2)}
                            </p>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
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
                                <p className="font-semibold">€{(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
                              </div>
                              {index < order.line_items.length - 1 && <Separator className="mt-4" />}
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 pt-6 border-t">
                          <h4 className="font-semibold mb-4">Order Status</h4>
                          <div className="flex items-center justify-between text-sm">
                            {TIMELINE_STEPS.map((step, i) => {
                              const active = isStepActive(i, order.displayStatus);
                              return (
                                <div key={step.key} className={`flex items-center gap-2 ${active ? "text-primary" : "text-muted-foreground"}`}>
                                  <div className={`w-3 h-3 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/30"}`} />
                                  {step.label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No orders found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm ? "Try adjusting your search" : "You haven't placed any orders yet"}
                  </p>
                  <Button asChild>
                    <Link to="/shop">Start Shopping</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusPedidos;
