import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShopifyDiscount {
  id: number;
  price_rule_id: number;
  discount_code_id: number | null;
  code: string | null;
  codes_count: number;
  title: string;
  value_type: 'percentage' | 'fixed_amount';
  value: number;
  status: 'active' | 'scheduled' | 'expired';
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  once_per_customer: boolean;
  target_type: string;
  target_selection: string;
  customer_selection: string;
  created_at: string;
}

interface ShopifyDiscountsResponse {
  discounts: ShopifyDiscount[];
  count: number;
}

export const useShopifyDiscounts = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['shopify-discounts'],
    queryFn: async (): Promise<ShopifyDiscount[]> => {
      const { data, error } = await supabase.functions.invoke<ShopifyDiscountsResponse>('shopify-discounts');

      if (error) {
        console.error('Error fetching Shopify discounts:', error);
        throw new Error(error.message || 'Failed to fetch discounts');
      }

      return data?.discounts || [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });
};
