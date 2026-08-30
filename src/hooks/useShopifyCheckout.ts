import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useWholesaleMOQ } from "@/hooks/useWholesaleMOQ";
import { cartIsOnlySamplePack } from "@/utils/samplePack";

export const useShopifyCheckout = (onSuccess?: () => void) => {
  const { items, saveAsLastCart, discountCode, discountInfo } = useCart();
  const { toast } = useToast();
  const { isWholesale, meetsMinimum } = useWholesaleMOQ();
  const [isLoading, setIsLoading] = useState(false);

  const checkout = async () => {
    if (items.length === 0) return;
    saveAsLastCart();

    if (isWholesale && !meetsMinimum && !cartIsOnlySamplePack(items)) {
      toast({
        title: "Minimum order not met",
        description: "Wholesale orders require a minimum of 3kg. Please add more products.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const cart = items.map((item) => ({
        productId: item.product.id,
        variantId: item.product.variantId || undefined,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name,
      }));

      onSuccess?.();

      // Native browser navigation to the edge function which returns a 303 redirect
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `https://${projectId}.supabase.co/functions/v1/shopify-checkout-redirect`;
      form.target = "_self";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "json";
      input.value = JSON.stringify({ cart, discountCode: discountCode || undefined, discountInfo: discountInfo ? { type: discountInfo.type, value: discountInfo.value } : undefined });
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      toast({
        title: "Checkout error",
        description: "Could not redirect to payment. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return { checkout, isLoading };
};
