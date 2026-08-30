import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export const useSamplePackEligibility = () => {
  const { user, loading: authLoading } = useAuthContext();
  const email = user?.email ?? null;

  const query = useQuery({
    queryKey: ['sample-pack-eligibility', email],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-sample-eligibility', {
        body: { email },
      });
      if (error) throw error;
      return data as { eligible: boolean; hasPurchased: boolean };
    },
    enabled: !!email,
    staleTime: 30 * 1000, // cache for 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    eligible: !email ? true : (query.data?.eligible ?? true),
    hasPurchased: query.data?.hasPurchased ?? false,
    isLoading: authLoading || query.isLoading,
    isChecked: !!email && query.isSuccess,
  };
};
