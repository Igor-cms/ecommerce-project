import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useOrderSeparations = () => {
  const [separatedIds, setSeparatedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSeparations = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("order_separations")
        .select("shopify_order_id");

      if (error) throw error;
      setSeparatedIds(new Set((data || []).map((r: any) => r.shopify_order_id)));
    } catch (error) {
      console.error("Error fetching separations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeparations();
  }, [fetchSeparations]);

  const toggleSeparation = useCallback(async (shopifyOrderId: string) => {
    const isSeparated = separatedIds.has(shopifyOrderId);

    try {
      if (isSeparated) {
        const { error } = await (supabase as any)
          .from("order_separations")
          .delete()
          .eq("shopify_order_id", shopifyOrderId);
        if (error) throw error;

        setSeparatedIds(prev => {
          const next = new Set(prev);
          next.delete(shopifyOrderId);
          return next;
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("order_separations")
          .insert({ shopify_order_id: shopifyOrderId, separated_by: user?.id });
        if (error) throw error;

        setSeparatedIds(prev => new Set(prev).add(shopifyOrderId));
      }
    } catch (error) {
      console.error("Error toggling separation:", error);
      toast({
        title: "Error",
        description: "Failed to update separation status",
        variant: "destructive",
      });
    }
  }, [separatedIds, toast]);

  return { separatedIds, loading: loading, toggleSeparation, refetch: fetchSeparations };
};
