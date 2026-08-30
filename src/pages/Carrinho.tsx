import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import { useCheckoutCelebration } from "@/hooks/useCheckoutCelebration";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useWholesaleMOQ } from "@/hooks/useWholesaleMOQ";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { Progress } from "@/components/ui/progress";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  Truck,
  CreditCard,
  Gift,
  Loader2,
} from "lucide-react";

const Carrinho = () => {
  const { items, removeItem, updateQuantity, subtotal, getItemKey } = useCart();
  const { celebrate } = useCheckoutCelebration();
  const { checkout, isLoading } = useShopifyCheckout(celebrate);
  const { isWholesale, totalWeightG, meetsMinimum, remainingG, progressPercent } = useWholesaleMOQ();
  const { isWholesale: isWholesaleUser } = useWholesaleStatus();
  const freeShippingThreshold = isWholesaleUser ? 300 : 50;

  usePageSEO({ title: "Cart", description: "Review your shopping cart at Legendary Everyday." });

  const shipping = subtotal >= freeShippingThreshold ? 0 : 4.99;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center py-16">
            <ShoppingCart className="w-24 h-24 text-muted-foreground mx-auto mb-8" />
            <h1 className="text-3xl font-display font-bold mb-4">Your cart is empty</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Add some amazing products to your cart to continue.
            </p>
            <Button size="lg" asChild>
              <Link to="/shop">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Link to="/shop" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue shopping
          </Link>
          <h1 className="text-3xl md:text-4xl font-display font-bold">Shopping Cart</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Your Items ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, index) => (
                  <div key={getItemKey(item)}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <img
                        src={item.product.images?.[0] || "/placeholder.svg"}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />

                      <div className="flex-1">
                        <h3 className="font-semibold">{item.product.name}</h3>
                        <Badge variant={item.product.brand === "legendary" ? "default" : "secondary"}>
                          {item.product.brand.charAt(0).toUpperCase() + item.product.brand.slice(1)}
                        </Badge>
                        {(item.selectedGrind || item.selectedWeight || item.selectedSize) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[item.selectedGrind, item.selectedWeight && `${item.selectedWeight}g`, item.selectedSize]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="text-lg font-bold mt-1">€{item.product.price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-[44px] min-h-[44px]"
                          onClick={() => updateQuantity(getItemKey(item), item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-[44px] min-h-[44px]"
                          onClick={() => updateQuantity(getItemKey(item), item.quantity + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                        <p className="font-bold">€{(item.product.price * item.quantity).toFixed(2)}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-w-[44px] min-h-[44px] text-destructive hover:text-destructive"
                          onClick={() => removeItem(getItemKey(item))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {index < items.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    Shipping
                  </span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-green-600 font-medium">Free</span>
                    ) : (
                      `€${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>

                {shipping > 0 && (
                  <div className="text-sm text-muted-foreground">
                    💡 Free shipping on orders over €{freeShippingThreshold}
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>€{total.toFixed(2)}</span>
                </div>

                {isWholesale && !meetsMinimum && (
                  <div className="rounded-xl border border-border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Wholesale Minimum: 3kg</p>
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Current: {(totalWeightG / 1000).toFixed(1)}kg · {(remainingG / 1000).toFixed(1)}kg remaining to meet the minimum
                    </p>
                  </div>
                )}

                {isWholesale && meetsMinimum && (
                  <p className="text-sm text-primary font-medium text-center">
                    ✅ Wholesale minimum met ({(totalWeightG / 1000).toFixed(1)}kg)
                  </p>
                )}

                <Button size="lg" className="w-full" onClick={checkout} disabled={isLoading || (isWholesale && !meetsMinimum)}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  {isLoading ? "Redirecting..." : "Checkout"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Secure payment via Shopify. Your data is protected.
                </p>
              </CardContent>
            </Card>

            {/* Trust Signals */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <span>Fast shipping in 2-3 business days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span>100% secure payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-primary" />
                    <span>Satisfaction guarantee</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Carrinho;
