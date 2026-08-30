import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RawMaterialVariant {
  id: string;
  raw_material_id: string;
  shopify_variant_id: string;
  shopify_product_name: string;
  shopify_variant_title: string;
  quantity_per_unit: number;
  created_at: string;
}

export const useRawMaterialVariants = (rawMaterialId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['raw_material_variants', rawMaterialId],
    queryFn: async () => {
      let q = supabase.from('raw_material_variants').select('*');
      if (rawMaterialId) q = q.eq('raw_material_id', rawMaterialId);
      const { data, error } = await q.order('shopify_product_name');
      if (error) throw error;
      return data as RawMaterialVariant[];
    },
  });

  const linkVariant = useMutation({
    mutationFn: async (variant: {
      raw_material_id: string;
      shopify_variant_id: string;
      shopify_product_name: string;
      shopify_variant_title: string;
      quantity_per_unit: number;
    }) => {
      const { data, error } = await supabase
        .from('raw_material_variants')
        .insert(variant)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] }),
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, quantity_per_unit }: { id: string; quantity_per_unit: number }) => {
      const { data, error } = await supabase
        .from('raw_material_variants')
        .update({ quantity_per_unit })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] }),
  });

  const unlinkVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('raw_material_variants')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] }),
  });

  return { ...query, linkVariant, updateVariant, unlinkVariant };
};
