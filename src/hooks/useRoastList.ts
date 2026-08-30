import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { previousThursday, nextWednesday, isThursday, startOfDay, endOfDay, format } from "date-fns";
import { parseWeightFromTitle } from "@/utils/cartWeight";

export interface RoastItem {
  title: string;
  totalKg: number;
}

const getRoastWindow = () => {
  const now = new Date();

  // Find start: last Thursday 00:00 (or today if Thursday)
  let start: Date;
  if (isThursday(now)) {
    start = startOfDay(now);
  } else {
    start = startOfDay(previousThursday(now));
  }

  // Find end: next Wednesday 23:59 from start
  const end = endOfDay(nextWednesday(start));

  return { start, end };
};

export const useRoastWindow = () => {
  return useMemo(() => getRoastWindow(), []);
};

export const isRoastDay = () => isThursday(new Date());

export const useRoastList = (customStart?: Date, customEnd?: Date) => {
  const [items, setItems] = useState<RoastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const { toast } = useToast();
  const defaultWindow = useRoastWindow();
  const start = customStart || defaultWindow.start;
  const end = customEnd || defaultWindow.end;

  const fetchRoastList = useCallback(async () => {
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

      // Aggregate by coffee name, converting to kg
      const map = new Map<string, number>();
      for (const order of orders) {
        for (const item of order.line_items || []) {
          const name = item.title;
          const variantTitle = item.variant_title || "";
          const weightGrams = parseWeightFromTitle(variantTitle);
          const totalGrams = weightGrams * (item.quantity || 1);
          map.set(name, (map.get(name) || 0) + totalGrams);
        }
      }

      const result: RoastItem[] = Array.from(map.entries())
        .map(([title, grams]) => ({ title, totalKg: Math.round((grams / 1000) * 100) / 100 }))
        .sort((a, b) => a.title.localeCompare(b.title));

      setItems(result);
      setLastFetched(new Date());
    } catch (error) {
      console.error("Error fetching roast list:", error);
      toast({
        title: "Error",
        description: "Failed to load roast list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [start, end, toast]);

  useEffect(() => {
    fetchRoastList();
  }, [fetchRoastList]);

  return {
    items,
    loading,
    lastFetched,
    refetch: fetchRoastList,
    windowStart: start,
    windowEnd: end,
  };
};
