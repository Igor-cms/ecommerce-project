import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/product";

interface ShopifyProductsResponse {
  products: Product[];
  count: number;
}

export const useShopifyProducts = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['shopify-products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.functions.invoke<ShopifyProductsResponse>('shopify-products');
      
      if (error) {
        console.error('Error fetching Shopify products:', error);
        throw new Error(error.message || 'Failed to fetch products');
      }
      
      return data?.products || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    retry: 2,
  });
};

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  name: string;
}

interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
}

interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  orderName: string;
  checkoutUrl: string;
  totalPrice: string;
  currency: string;
}

export const useCreateShopifyOrder = () => {
  const createOrder = async (cart: CartItem[], customer: CustomerInfo, notes?: string): Promise<CreateOrderResponse> => {
    const { data, error } = await supabase.functions.invoke<CreateOrderResponse>('shopify-orders', {
      body: { cart, customer, notes },
    });
    
    if (error) {
      console.error('Error creating Shopify order:', error);
      throw new Error(error.message || 'Failed to create order');
    }
    
    if (!data?.success) {
      throw new Error('Order creation failed');
    }
    
    return data;
  };

  return { createOrder };
};
