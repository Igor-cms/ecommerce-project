import { useCart } from "@/contexts/CartContext";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { getCartWeightGrams } from "@/utils/cartWeight";
import { cartIsOnlySamplePack } from "@/utils/samplePack";

const MIN_WEIGHT_G = 3000;

export const useWholesaleMOQ = () => {
  const { items } = useCart();
  const { isWholesale } = useWholesaleStatus();

  const isSamplePackOnly = cartIsOnlySamplePack(items);
  const totalWeightG = getCartWeightGrams(items);
  const meetsMinimum = !isWholesale || isSamplePackOnly || totalWeightG >= MIN_WEIGHT_G;
  const remainingG = isSamplePackOnly ? 0 : Math.max(0, MIN_WEIGHT_G - totalWeightG);

  return {
    isWholesale,
    isSamplePackOnly,
    totalWeightG,
    minWeightG: MIN_WEIGHT_G,
    meetsMinimum,
    remainingG,
    progressPercent: isSamplePackOnly ? 100 : Math.min(100, (totalWeightG / MIN_WEIGHT_G) * 100),
  };
};
