import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

interface WholesaleApplication {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  business_type: string;
  expected_volume: string | null;
  additional_info: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export const useWholesaleStatus = () => {
  const { user, loading: authLoading } = useAuthContext();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['wholesale-status', userId],
    queryFn: async (): Promise<WholesaleApplication | null> => {
      const { data, error } = await supabase
        .from('wholesale_applications')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data as WholesaleApplication | null;
    },
    enabled: !!userId,
  });

  return {
    isAuthenticated: !!userId,
    isAuthLoading: authLoading,
    isWholesale: query.data?.status === 'approved',
    status: query.data?.status ?? null,
    application: query.data,
    isLoading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
};
