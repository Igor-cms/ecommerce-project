import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface ShopifyCustomerAddress {
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
}

export interface ShopifyCustomer {
  id: number;
  name: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  note: string;
  tags: string;
  accepts_marketing: boolean;
  city: string;
  country: string;
  orders_count: number;
  total_spent: string;
  currency: string;
  default_address: ShopifyCustomerAddress | null;
}

interface CustomersResponse {
  customers: ShopifyCustomer[];
  pagination: {
    next: string | null;
    previous: string | null;
  };
}

const fetchCustomers = async (query: string, pageInfo: string): Promise<CustomersResponse> => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (pageInfo) params.set("page_info", pageInfo);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `https://${projectId}.supabase.co/functions/v1/shopify-customers?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) throw new Error("Failed to fetch customers");
  return response.json();
};

export const useShopifyCustomers = (query: string, pageInfo: string, enabled: boolean = true) => {
  return useQuery<CustomersResponse>({
    queryKey: ["shopify-customers", query, pageInfo],
    queryFn: () => fetchCustomers(query, pageInfo),
    staleTime: 60_000,
    enabled,
  });
};

export const useCustomerSearch = (minLength = 2) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const enabled = debouncedTerm.length >= minLength;

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["shopify-customer-search", debouncedTerm],
    queryFn: () => fetchCustomers(debouncedTerm, ""),
    enabled,
    staleTime: 30_000,
  });

  const filtered = enabled
    ? (data?.customers ?? []).filter(c => {
        const term = debouncedTerm.toLowerCase();
        return (
          c.email?.toLowerCase().includes(term) ||
          c.name?.toLowerCase().includes(term) ||
          c.first_name?.toLowerCase().includes(term) ||
          c.last_name?.toLowerCase().includes(term)
        );
      })
    : [];

  return {
    searchTerm,
    setSearchTerm,
    customers: filtered,
    isLoading: enabled && isLoading,
  };
};
