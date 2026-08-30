import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";

export interface ShopifyLineItem {
  id: number;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
  image: string | null;
}

export interface ShopifyOrder {
  id: number;
  name: string; // e.g. "#1001"
  email: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null; // fulfilled, partial, null (unfulfilled)
  fulfillment_order_status: string | null; // on_hold, in_progress, fulfilled (granular from fulfillment_orders API)
  total_price: string;
  currency: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
  shipping_address: {
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    country: string;
    zip: string;
  } | null;
  line_items: ShopifyLineItem[];
  note: string | null;
  tags: string;
  cancelled_at: string | null;
}

export const useShopifyOrders = () => {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isAdmin } = useAuthContext();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-orders", {
        method: "GET",
      });

      if (error) throw error;

      const incoming: ShopifyOrder[] = data?.orders || [];

      // Defense-in-depth: even though the edge function filters by the
      // authenticated user's email for non-admins, drop anything that
      // doesn't match the logged-in email here as a second guard.
      const userEmail = user?.email?.toLowerCase() ?? null;
      const filtered = isAdmin
        ? incoming
        : incoming.filter(
            (o) =>
              userEmail !== null &&
              ((o.customer?.email || o.email || "").toLowerCase() === userEmail)
          );

      setOrders(filtered);
    } catch (error) {
      console.error("Error fetching Shopify orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders from Shopify",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user, isAdmin]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
};

export const useShopifyOrder = (idOrName: string | undefined) => {
  const { orders, loading, refetch } = useShopifyOrders();

  const normalized = idOrName?.replace(/^#/, "");
  const order = normalized
    ? orders.find(
        (o) =>
          String(o.id) === normalized ||
          o.name === idOrName ||
          o.name === `#${normalized}` ||
          o.name.replace(/^#/, "") === normalized
      )
    : undefined;

  return {
    order,
    loading,
    refetch,
    notFound: !loading && !order && !!idOrName,
  };
};
