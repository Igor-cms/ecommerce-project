import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useStockLevels } from "@/hooks/useStockLevels";
import { useShopifyCheckout } from "@/hooks/useShopifyCheckout";
import { useCheckoutCelebration } from "@/hooks/useCheckoutCelebration";
import { useWholesaleMOQ } from "@/hooks/useWholesaleMOQ";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { Progress } from "@/components/ui/progress";
import { DiscountCodeField } from "@/components/cart/DiscountCodeField";

export const CartDrawer = () => {
  const { items, isCartOpen, setCartOpen, removeItem, updateQuantity, totalItems, subtotal, getItemKey, clearCart, loadLastCart, hasLastCart, discountInfo } = useCart();
  const { celebrate } = useCheckoutCelebration();
  const { checkout, isLoading } = useShopifyCheckout(celebrate);
  const { isWholesale, totalWeightG, meetsMinimum, remainingG, progressPercent } = useWholesaleMOQ();
  const { isWholesale: isWholesaleUser } = useWholesaleStatus();
  const { getAvailableUnits } = useStockLevels();
  const freeShippingThreshold = isWholesaleUser ? 300 : 50;

  return (
    <Sheet open={isCartOpen} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <ShoppingCart className="w-5 h-5" />
            Your Cart
            {totalItems > 0 && (
              <span className="text-sm font-body text-foreground">
                ({totalItems} {totalItems === 1 ? "item" : "items"})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <Separator />

        {items.length > 0 && (
          <div className="flex gap-2 px-6 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl text-xs"
              onClick={clearCart}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Clear Cart
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl text-xs"
              onClick={loadLastCart}
              disabled={!hasLastCart}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Last Cart
            </Button>
          </div>
        )}

        {!items.length && hasLastCart && (
          <div className="px-6 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl text-xs"
              onClick={loadLastCart}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Load Last Cart
            </Button>
          </div>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/40" />
            <div>
              <p className="font-display text-lg font-semibold">Cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add products to get started.
              </p>
            </div>
            <Button variant="outline" className="rounded-xl mt-2" onClick={() => setCartOpen(false)}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.map((item) => (
                <div key={getItemKey(item)} className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                    <img
                      src={item.product.images?.[0] || "/placeholder.svg"}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">{item.product.name}</p>
                    {(item.selectedGrind || item.selectedWeight || item.selectedSize) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[item.selectedGrind, item.selectedWeight && `${item.selectedWeight}g`, item.selectedSize]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-primary mt-1">
                      €{(item.product.price * item.quantity).toFixed(2)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() => updateQuantity(getItemKey(item), item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(getItemKey(item), item.quantity + 1)}
                        disabled={(() => {
                          const consolidatedMax = getAvailableUnits(item.product.variantId, items.filter(i => getItemKey(i) !== getItemKey(item)));
                          const variantStock = item.product.variants?.find(v => v.id === item.product.variantId)?.inventory_quantity;
                          const shopifyMax = typeof variantStock === 'number' ? Math.max(0, variantStock) : Infinity;
                          return item.quantity >= Math.min(consolidatedMax, shopifyMax);
                        })()}
                        className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(getItemKey(item))}
                        className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount Code */}
            <DiscountCodeField />

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 space-y-3 bg-background">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">Subtotal</span>
                <span className="font-display font-bold text-lg">€{subtotal.toFixed(2)}</span>
              </div>

              {discountInfo && discountInfo.amountOff > 0 && (
                <div className="flex items-center justify-between text-primary">
                  <span className="text-sm">Discount ({discountInfo.title})</span>
                  <span className="text-sm font-semibold">-€{discountInfo.amountOff.toFixed(2)}</span>
                </div>
              )}

              {discountInfo && discountInfo.amountOff > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold">Total</span>
                  <span className="font-display font-bold text-lg">€{(subtotal - discountInfo.amountOff).toFixed(2)}</span>
                </div>
              )}

              {subtotal < freeShippingThreshold && (
                <p className="text-xs text-muted-foreground text-center">
                  €{(freeShippingThreshold - subtotal).toFixed(2)} away from free shipping!
                </p>
              )}
              {subtotal >= freeShippingThreshold && (
                <p className="text-xs text-primary font-medium text-center">
                  🎉 Free shipping!
                </p>
              )}

              {isWholesale && !meetsMinimum && (
                <div className="rounded-xl border border-border bg-muted/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Wholesale Minimum: 3kg</p>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Current: {(totalWeightG / 1000).toFixed(1)}kg · {(remainingG / 1000).toFixed(1)}kg remaining
                  </p>
                </div>
              )}

              {isWholesale && meetsMinimum && items.length > 0 && (
                <p className="text-xs text-primary font-medium text-center">
                  ✅ Wholesale minimum met ({(totalWeightG / 1000).toFixed(1)}kg)
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full rounded-xl"
                  size="lg"
                  onClick={checkout}
                  disabled={isLoading || (isWholesale && !meetsMinimum)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    "Checkout"
                  )}
                </Button>
                <Button variant="outline" className="w-full rounded-xl" size="lg" asChild>
                  <Link to="/cart" onClick={() => setCartOpen(false)}>
                    View Cart
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
