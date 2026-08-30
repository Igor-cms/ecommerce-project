import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  type: 'custom' | 'smart';
}

interface ShopifyCollectionsResponse {
  collections: ShopifyCollection[];
}

export const useShopifyCollections = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['shopify-collections'],
    queryFn: async (): Promise<ShopifyCollection[]> => {
      const { data, error } = await supabase.functions.invoke<ShopifyCollectionsResponse>('shopify-collections');

      if (error) {
        console.error('Error fetching Shopify collections:', error);
        throw new Error(error.message || 'Failed to fetch collections');
      }

      return data?.collections || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
};
