import { type CartItem } from "@/types/product";

/**
 * Parse weight in grams from a variant title string.
 * Supports formats like "250g", "1kg", "1 kg", "500 g", etc.
 * Returns 0 if no weight pattern is found.
 */
export const parseWeightFromTitle = (title: string): number => {
  if (!title) return 0;
  const match = title.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (!match) return 0;
  const value = parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  return unit === "kg" ? value * 1000 : value;
};

/**
 * Calculate total cart weight in grams.
 * Uses selectedWeight (if set), then variantId to find matching variant title,
 * then falls back to the first variant title.
 */
export const getCartWeightGrams = (items: CartItem[]): number => {
  return items.reduce((total, item) => {
    // If selectedWeight is set directly (in grams), use it
    if (item.selectedWeight) {
      return total + item.selectedWeight * item.quantity;
    }

    // Try to find weight from variant title
    const variants = item.product.variants;
    if (variants && variants.length > 0) {
      // Match by variantId first
      const selectedVariant = item.product.variantId
        ? variants.find((v) => v.id === item.product.variantId)
        : null;

      const variantTitle = selectedVariant?.title || variants[0]?.title || "";
      const weight = parseWeightFromTitle(variantTitle);
      return total + weight * item.quantity;
    }

    return total;
  }, 0);
};
