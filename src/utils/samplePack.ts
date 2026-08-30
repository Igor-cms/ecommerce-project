import { type CartItem } from "@/types/product";

/**
 * Check if a product is a Sample Pack by name.
 */
export const isSamplePack = (productName: string): boolean =>
  productName.toLowerCase().includes("sample");

/**
 * Check if the cart contains only Sample Pack items.
 */
export const cartHasSamplePack = (items: CartItem[]): boolean =>
  items.some(item => isSamplePack(item.product.name));

/**
 * Check if the cart contains ONLY sample pack items.
 */
export const cartIsOnlySamplePack = (items: CartItem[]): boolean =>
  items.length > 0 && items.every(item => isSamplePack(item.product.name));
