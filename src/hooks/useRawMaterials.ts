import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RawMaterial {
  id: string;
  name: string;
  quantity_available: number;
  unit: string;
  shopify_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useRawMaterials = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['raw_materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as RawMaterial[];
    },
  });

  const addMaterial = useMutation({
    mutationFn: async (material: { name: string; quantity_available: number; unit: string }) => {
      const { data, error } = await supabase
        .from('raw_materials')
        .insert(material)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw_materials'] }),
  });

  const updateMaterial = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RawMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from('raw_materials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raw_materials'] }),
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw_materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] });
    },
  });

  return { ...query, addMaterial, updateMaterial, deleteMaterial };
};
