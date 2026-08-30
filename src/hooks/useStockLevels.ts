import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type CartItem } from "@/types/product";

interface RawMaterialStock {
  id: string;
  name: string;
  quantity_available: number;
  unit: string;
  shopify_product_id: string | null;
}

interface VariantMapping {
  raw_material_id: string;
  shopify_variant_id: string;
  quantity_per_unit: number;
}

interface StockLevelsData {
  materials: RawMaterialStock[];
  variant_mappings: VariantMapping[];
}

export const useStockLevels = () => {
  const query = useQuery<StockLevelsData>({
    queryKey: ["stock-levels"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-stock-levels");
      if (error) throw error;
      return data as StockLevelsData;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Given a Shopify variant ID and the current cart items,
   * returns how many more units of that variant can be added.
   * Returns Infinity if the variant has no raw material mapping (fallback).
   */
  const getAvailableUnits = (
    shopifyVariantId: string | undefined,
    cartItems: CartItem[]
  ): number => {
    if (!shopifyVariantId || !query.data) return Infinity;

    const { materials, variant_mappings } = query.data;

    // Find mapping for this variant
    const mapping = variant_mappings.find(
      (m) => m.shopify_variant_id === shopifyVariantId
    );
    if (!mapping) return Infinity; // No mapping → no consolidated limit

    // Find the raw material
    const material = materials.find((m) => m.id === mapping.raw_material_id);
    if (!material) return Infinity;

    // Calculate how much of this raw material is already consumed by the cart
    // Find all variant mappings that consume from the same raw material
    const siblingMappings = variant_mappings.filter(
      (m) => m.raw_material_id === mapping.raw_material_id
    );

    let cartConsumptionGrams = 0;
    for (const item of cartItems) {
      const itemVariantId = item.product.variantId;
      if (!itemVariantId) continue;

      const itemMapping = siblingMappings.find(
        (m) => m.shopify_variant_id === itemVariantId
      );
      if (itemMapping) {
        cartConsumptionGrams += itemMapping.quantity_per_unit * item.quantity;
      }
    }

    const availableGrams = material.quantity_available - cartConsumptionGrams;
    if (availableGrams <= 0) return 0;

    return Math.floor(availableGrams / mapping.quantity_per_unit);
  };

  /**
   * Check if adding `addQuantity` units of a variant would exceed consolidated stock.
   * Returns { allowed: boolean, maxAvailable: number }
   */
  const checkStock = (
    shopifyVariantId: string | undefined,
    currentCartItems: CartItem[],
    addQuantity: number
  ): { allowed: boolean; maxAvailable: number } => {
    const available = getAvailableUnits(shopifyVariantId, currentCartItems);
    return {
      allowed: addQuantity <= available,
      maxAvailable: available,
    };
  };

  return {
    ...query,
    getAvailableUnits,
    checkStock,
  };
};
