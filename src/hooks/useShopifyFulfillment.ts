import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type FulfillmentAction = "fulfill" | "hold" | "release_hold" | "cancel_fulfillment" | "in_progress";

export const useShopifyFulfillment = (onSuccess?: () => void) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateFulfillment = async (orderId: number, action: FulfillmentAction) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-fulfillment", {
        body: { orderId, action },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to update fulfillment");
      }

      toast({
        title: "Fulfillment updated",
        description: `Order status changed successfully`,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("Fulfillment update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update fulfillment status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { updateFulfillment, loading };
};
