import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  coffee_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  size: string;
  roast_option: string | null;
  coffees: {
    name: string;
    code: string;
    image: string;
  };
}

interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  shipping_address: any;
  billing_address: any;
  notes: string | null;
  whatsapp_referral: boolean;
  tags: string[] | null;
  admin_notes: string | null;
  order_items: OrderItem[];
}

export const useAllOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAllOrders = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          *,
          order_items(
            *,
            coffees(name, code, image)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  return {
    orders,
    loading,
    refetch: fetchAllOrders
  };
};
