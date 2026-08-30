import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";

export const useWholesaleVat = () => {
  const { user, loading: authLoading } = useAuthContext();
  const { isWholesale, isLoading: wholesaleLoading } = useWholesaleStatus();
  const queryClient = useQueryClient();

  const vatQuery = useQuery({
    queryKey: ["wholesale-vat", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-shopify-vat");
      if (error) throw error;
      const result = data as { vat_number: string | null; vat_exempt: boolean } | null;
      if (!result) return null;
      // If no VAT data exists in Shopify, return null to trigger collection
      if (!result.vat_number && !result.vat_exempt) return null;
      return result;
    },
    enabled: !!user && isWholesale,
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ vat_number, vat_exempt }: { vat_number: string | null; vat_exempt: boolean }) => {
      const { data, error } = await supabase.functions.invoke("save-wholesale-vat", {
        body: { vat_number, vat_exempt },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-vat", user?.id] });
    },
  });

  const needsVatCollection =
    !authLoading &&
    !wholesaleLoading &&
    !!user &&
    isWholesale &&
    !vatQuery.isLoading &&
    !vatQuery.isError &&
    !vatQuery.data;

  return {
    needsVatCollection,
    vatInfo: vatQuery.data,
    isLoading: authLoading || wholesaleLoading || vatQuery.isLoading,
    submitVat: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
};
