import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { type Product, type CartItem } from "@/types/product";
import { useStockLevels } from "@/hooks/useStockLevels";
import { useToast } from "@/hooks/use-toast";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { isSamplePack, cartHasSamplePack } from "@/utils/samplePack";
import { useAuthContext } from "@/contexts/AuthContext";
import { useSamplePackEligibility } from "@/hooks/useSamplePackEligibility";
import { supabase } from "@/integrations/supabase/client";

const getItemKey = (item: { product: Pick<Product, 'id' | 'variantId'>; selectedGrind?: string; selectedWeight?: number; selectedSize?: string }) =>
  `${item.product.id}__${item.product.variantId || ''}__${item.selectedGrind || ''}__${item.selectedWeight || ''}__${item.selectedSize || ''}`;

interface PendingSampleConfirm {
  product: Product;
  options?: { grind?: string; weight?: number; size?: string };
}

export interface DiscountInfo {
  type: "percentage" | "fixed_amount";
  value: number;
  title: string;
  amountOff: number;
  entitled_product_handles: string[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity: number, options?: { grind?: string; weight?: number; size?: string }) => Promise<boolean>;
  isSampleCheckLoading: boolean;
  sampleHasPurchased: boolean;
  removeItem: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  totalItems: number;
  subtotal: number;
  getItemKey: (item: CartItem) => string;
  getMaxQuantity: (variantId: string | undefined) => number;
  pendingSampleConfirm: PendingSampleConfirm | null;
  confirmSampleReplace: () => void;
  cancelSampleReplace: () => void;
  saveAsLastCart: () => void;
  loadLastCart: () => void;
  hasLastCart: boolean;
  discountCode: string | null;
  discountInfo: DiscountInfo | null;
  applyDiscount: (code: string) => Promise<{ success: boolean; error?: string }>;
  clearDiscount: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "lgd-edy-cart";
const LAST_CART_KEY = "lgd-edy-last-cart";
const DISCOUNT_KEY = "lgd-edy-discount";

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const loadDiscount = (): { code: string; info: DiscountInfo } | null => {
  try {
    const raw = localStorage.getItem(DISCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const calcAmountOff = (subtotal: number, type: "percentage" | "fixed_amount", value: number): number => {
  if (type === "percentage") {
    return Math.round(subtotal * value) / 100;
  }
  return Math.min(value, subtotal);
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setCartOpen] = useState(false);
  const [pendingSampleConfirm, setPendingSampleConfirm] = useState<PendingSampleConfirm | null>(null);
  const [isSampleCheckLoading, setIsSampleCheckLoading] = useState(false);
  const { checkStock, getAvailableUnits } = useStockLevels();
  const { toast } = useToast();
  const { isWholesale, isLoading: wholesaleLoading } = useWholesaleStatus();
  const { user } = useAuthContext();
  const { hasPurchased: sampleHasPurchased } = useSamplePackEligibility();

  // Discount state
  const savedDiscount = loadDiscount();
  const [discountCode, setDiscountCode] = useState<string | null>(savedDiscount?.code || null);
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(savedDiscount?.info || null);
  const prevItemsRef = useRef<string>("");

  // Swap cart variants when wholesale status changes
  useEffect(() => {
    if (wholesaleLoading || items.length === 0) return;

    const targetType = isWholesale ? 'wholesale' : 'retail';

    const needsSwap = items.some(item => {
      const currentVariant = item.product.variants?.find(v => v.id === item.product.variantId);
      const currentType = (currentVariant?.type || 'retail').toLowerCase();
      return currentType !== targetType;
    });

    if (!needsSwap) return;

    const swapped = items.map(item => {
      const currentVariant = item.product.variants?.find(v => v.id === item.product.variantId);
      const currentType = (currentVariant?.type || 'retail').toLowerCase();
      if (currentType === targetType) return item;

      const match = item.product.variants?.find(v =>
        v.type?.toLowerCase() === targetType && v.title === currentVariant?.title
      );
      if (!match) return null;

      return {
        ...item,
        product: { ...item.product, variantId: match.id, price: match.price },
      };
    }).filter(Boolean) as CartItem[];

    setItems(swapped);
  }, [isWholesale, wholesaleLoading]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Persist discount to localStorage
  useEffect(() => {
    if (discountCode && discountInfo) {
      localStorage.setItem(DISCOUNT_KEY, JSON.stringify({ code: discountCode, info: discountInfo }));
    } else {
      localStorage.removeItem(DISCOUNT_KEY);
    }
  }, [discountCode, discountInfo]);

  // Re-validate discount when cart items change
  useEffect(() => {
    if (!discountCode || !discountInfo) return;

    const itemsFingerprint = items.map(i => `${getItemKey(i)}:${i.quantity}`).join('|');
    if (itemsFingerprint === prevItemsRef.current) return;
    prevItemsRef.current = itemsFingerprint;

    if (items.length === 0) {
      setDiscountCode(null);
      setDiscountInfo(null);
      return;
    }

    // Check product eligibility if discount has restrictions
    if (discountInfo.entitled_product_handles.length > 0) {
      const hasEligible = items.some(item =>
        discountInfo.entitled_product_handles.some(handle =>
          item.product.slug === handle || item.product.name.toLowerCase().includes(handle.replace(/-/g, ' '))
        )
      );
      if (!hasEligible) {
        setDiscountCode(null);
        setDiscountInfo(null);
        toast({
          title: "Discount removed",
          description: "The qualifying product is no longer in your cart.",
          variant: "destructive",
        });
        return;
      }
    }

    // Recalculate amountOff with new subtotal
    const newSubtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const newAmountOff = calcAmountOff(newSubtotal, discountInfo.type, discountInfo.value);
    setDiscountInfo(prev => prev ? { ...prev, amountOff: newAmountOff } : null);
  }, [items, discountCode, discountInfo, toast]);

  const applyDiscount = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: { code: code.trim(), customerEmail: user?.email },
      });

      if (error || !data?.valid) {
        return { success: false, error: data?.error || 'Invalid or expired code' };
      }

      const entitledHandles: string[] = data.entitled_product_handles || [];

      // Check product eligibility
      if (entitledHandles.length > 0) {
        const hasEligible = items.some(item =>
          entitledHandles.some(handle =>
            item.product.slug === handle || item.product.name.toLowerCase().includes(handle.replace(/-/g, ' '))
          )
        );
        if (!hasEligible) {
          return { success: false, error: 'This discount is only valid for the Sample Pack.' };
        }
      }

      const sub = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const amountOff = calcAmountOff(sub, data.type, data.value);

      setDiscountCode(data.title);
      setDiscountInfo({
        type: data.type,
        value: data.value,
        title: data.title,
        amountOff,
        entitled_product_handles: entitledHandles,
      });
      return { success: true };
    } catch (err) {
      console.error('Error applying discount:', err);
      return { success: false, error: 'Failed to validate discount code' };
    }
  }, [items, user]);

  const clearDiscount = useCallback(() => {
    setDiscountCode(null);
    setDiscountInfo(null);
  }, []);

  const doAddItem = useCallback(
    (product: Product, quantity: number, options?: { grind?: string; weight?: number; size?: string }) => {
      const addingSample = isSamplePack(product.name);

      setItems((prev) => {
        // Sample Pack: max quantity 1
        if (addingSample) {
          quantity = 1;
        }

        // Sample Pack can only be purchased alone — show confirmation
        if (addingSample && prev.length > 0 && !prev.every(i => isSamplePack(i.product.name))) {
          setPendingSampleConfirm({ product, options });
          return prev; // don't modify cart yet
        }

        // If sample already in cart, block adding another
        if (addingSample && prev.some(i => isSamplePack(i.product.name))) {
          toast({
            title: "Sample Pack",
            description: "You can only purchase one Sample Pack.",
            variant: "destructive",
          });
          return prev;
        }

        // Cannot add non-sample items if cart has a sample pack
        if (!addingSample && cartHasSamplePack(prev)) {
          toast({
            title: "Sample Pack",
            description: "Please remove the Sample Pack first to add other products.",
            variant: "destructive",
          });
          return prev;
        }

      const existing = prev.find(
        (i) =>
          i.product.id === product.id &&
          (i.product.variantId || '') === (product.variantId || '') &&
          i.selectedGrind === options?.grind &&
          i.selectedWeight === options?.weight &&
          i.selectedSize === options?.size
      );

      const currentQty = existing ? existing.quantity : 0;
      const totalDesired = currentQty + quantity;

      // Check consolidated stock (raw materials)
      const { allowed: rawAllowed, maxAvailable: rawMax } = checkStock(product.variantId, prev, totalDesired);
      
      // Also check variant-level inventory_quantity (Shopify Available)
      const variant = product.variants?.find(v => v.id === product.variantId);
      const variantStock = variant?.inventory_quantity;
      const variantMax = typeof variantStock === 'number' ? Math.max(0, variantStock) : Infinity;

      // Also account for other cart items using the SAME variantId
      let sameVariantInCart = 0;
      for (const ci of prev) {
        if (ci.product.variantId === product.variantId && ci !== existing) {
          sameVariantInCart += ci.quantity;
        }
      }
      const effectiveVariantMax = Math.max(0, variantMax - sameVariantInCart);

      const effectiveMax = Math.min(rawMax, effectiveVariantMax);
      const allowed = totalDesired <= effectiveMax;
      
      if (!allowed) {
        const canAdd = effectiveMax - currentQty;
        if (canAdd <= 0) {
          toast({
            title: "Stock limited",
            description: variantMax === 0 ? "This product is out of stock." : "No more units available for this product.",
            variant: "destructive",
          });
          return prev;
        }
        toast({
          title: "Stock limited",
          description: `Only ${canAdd} more unit${canAdd > 1 ? 's' : ''} available. Added ${canAdd} to cart.`,
        });
        quantity = canAdd;
      }

        if (existing) {
          return prev.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + quantity } : i
          );
        }
        return [
          ...prev,
          {
            product,
            quantity,
            selectedGrind: options?.grind,
            selectedWeight: options?.weight,
            selectedSize: options?.size,
          },
        ];
      });
      setCartOpen(true);
    },
    [checkStock, toast]
  );

  const addItem = useCallback(
    async (product: Product, quantity: number, options?: { grind?: string; weight?: number; size?: string }): Promise<boolean> => {
      const addingSample = isSamplePack(product.name);

      // Centralized sample eligibility check using react-query hook state
      if (addingSample && sampleHasPurchased) {
        toast({
          title: "Already purchased",
          description: "This product is limited to one purchase per customer.",
          variant: "destructive",
        });
        return false;
      }

      doAddItem(product, quantity, options);
      return true;
    },
    [doAddItem, sampleHasPurchased, toast]
  );

  const removeItem = useCallback((itemKey: string) => {
    setItems((prev) => prev.filter((i) => getItemKey(i) !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => {
      const item = prev.find((i) => getItemKey(i) === itemKey);
      if (!item) return prev;

      // Sample Pack: max 1
      if (isSamplePack(item.product.name) && quantity > 1) {
        toast({
          title: "Sample Pack",
          description: "You can only purchase one Sample Pack.",
        });
        return prev;
      }

      // Check consolidated stock for the new quantity
      const otherItems = prev.filter((i) => getItemKey(i) !== itemKey);
      const { allowed: rawAllowed, maxAvailable: rawMax } = checkStock(item.product.variantId, otherItems, quantity);

      // Also check variant-level inventory_quantity (Shopify Available)
      const variant = item.product.variants?.find(v => v.id === item.product.variantId);
      const variantStock = variant?.inventory_quantity;
      const variantMax = typeof variantStock === 'number' ? Math.max(0, variantStock) : Infinity;

      // Account for other cart items using the same variantId
      let sameVariantInCart = 0;
      for (const ci of otherItems) {
        if (ci.product.variantId === item.product.variantId) {
          sameVariantInCart += ci.quantity;
        }
      }
      const effectiveVariantMax = Math.max(0, variantMax - sameVariantInCart);
      const effectiveMax = Math.min(rawMax, effectiveVariantMax);
      const allowed = quantity <= effectiveMax;

      if (!allowed) {
        if (effectiveMax <= 0) {
          toast({
            title: "Stock limited",
            description: "No stock available for this product.",
            variant: "destructive",
          });
          return prev;
        }
        toast({
          title: "Stock limited",
          description: `Maximum ${effectiveMax} units available.`,
        });
        return prev.map((i) => (getItemKey(i) === itemKey ? { ...i, quantity: effectiveMax } : i));
      }

      return prev.map((i) => (getItemKey(i) === itemKey ? { ...i, quantity } : i));
    });
  }, [checkStock, toast]);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountCode(null);
    setDiscountInfo(null);
  }, []);

  // Safety net: clear cart when returning from Shopify checkout with ?checkout_success=true
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('checkout_success') === 'true') {
      clearCart();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('checkout_success');
      setSearchParams(newParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const saveAsLastCart = useCallback(() => {
    if (items.length > 0) {
      localStorage.setItem(LAST_CART_KEY, JSON.stringify(items));
    }
  }, [items]);

  const loadLastCart = useCallback(() => {
    try {
      const raw = localStorage.getItem(LAST_CART_KEY);
      if (!raw) return;
      const lastItems: CartItem[] = JSON.parse(raw);
      if (!lastItems.length) return;
      setItems(lastItems);
      toast({
        title: "Last cart loaded",
        description: `${lastItems.reduce((s, i) => s + i.quantity, 0)} item(s) restored.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not load last cart.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const hasLastCart = (() => {
    try {
      const raw = localStorage.getItem(LAST_CART_KEY);
      return !!raw && JSON.parse(raw).length > 0;
    } catch { return false; }
  })();

  const getMaxQuantity = useCallback((variantId: string | undefined) => {
    return getAvailableUnits(variantId, items);
  }, [getAvailableUnits, items]);

  const confirmSampleReplace = useCallback(() => {
    if (!pendingSampleConfirm) return;
    const { product, options } = pendingSampleConfirm;
    setItems([{ product, quantity: 1, selectedGrind: options?.grind, selectedWeight: options?.weight, selectedSize: options?.size }]);
    setPendingSampleConfirm(null);
    setCartOpen(true);
  }, [pendingSampleConfirm]);

  const cancelSampleReplace = useCallback(() => {
    setPendingSampleConfirm(null);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, isCartOpen, setCartOpen, totalItems, subtotal, getItemKey, getMaxQuantity, pendingSampleConfirm, confirmSampleReplace, cancelSampleReplace, saveAsLastCart, loadLastCart, hasLastCart, discountCode, discountInfo, applyDiscount, clearDiscount, isSampleCheckLoading, sampleHasPurchased }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      items: [] as CartItem[],
      addItem: async () => false,
      isSampleCheckLoading: false,
      sampleHasPurchased: false,
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      isCartOpen: false,
      setCartOpen: () => {},
      totalItems: 0,
      subtotal: 0,
      getItemKey: () => '',
      getMaxQuantity: () => 99,
      pendingSampleConfirm: null,
      confirmSampleReplace: () => {},
      cancelSampleReplace: () => {},
      saveAsLastCart: () => {},
      loadLastCart: () => {},
      hasLastCart: false,
      discountCode: null,
      discountInfo: null,
      applyDiscount: async () => ({ success: false }),
      clearDiscount: () => {},
    } as CartContextType;
  }
  return ctx;
};
