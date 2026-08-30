import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoastWindow } from "@/hooks/useRoastList";

export interface SeparationItem {
  title: string;
  variant: string;
  quantity: number;
}

export const useSeparationList = (customStart?: Date, customEnd?: Date) => {
  const [items, setItems] = useState<SeparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const { toast } = useToast();
  const defaultWindow = useRoastWindow();
  const start = customStart || defaultWindow.start;
  const end = customEnd || defaultWindow.end;

  const fetchSeparationList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: "any",
        limit: "250",
        created_at_min: start.toISOString(),
        created_at_max: end.toISOString(),
      });

      const { data, error } = await supabase.functions.invoke(
        `shopify-orders?${params.toString()}`,
        { method: "GET" }
      );

      if (error) throw error;

      const orders = (data?.orders || []).filter(
        (o: any) => o.financial_status === "paid" && !o.cancelled_at
      );

      // Aggregate by coffee name + weight only (ignore retail/wholesale)
      const map = new Map<string, number>();
      for (const order of orders) {
        for (const item of order.line_items || []) {
          const name = item.title;
          const rawVariant = item.variant_title || "Default";
          // Extract only the weight portion (e.g. "250g / Retail" → "250g")
          const weight = rawVariant.split("/")[0].trim();
          const key = `${name}|||${weight}`;
          map.set(key, (map.get(key) || 0) + (item.quantity || 1));
        }
      }

      const result: SeparationItem[] = Array.from(map.entries())
        .map(([key, quantity]) => {
          const [title, variant] = key.split("|||");
          return { title, variant, quantity };
        })
        .sort((a, b) => a.title.localeCompare(b.title) || a.variant.localeCompare(b.variant));

      setItems(result);
      setLastFetched(new Date());
    } catch (error) {
      console.error("Error fetching separation list:", error);
      toast({
        title: "Error",
        description: "Failed to load separation list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [start, end, toast]);

  useEffect(() => {
    fetchSeparationList();
  }, [fetchSeparationList]);

  return {
    items,
    loading,
    lastFetched,
    refetch: fetchSeparationList,
    windowStart: start,
    windowEnd: end,
  };
};
