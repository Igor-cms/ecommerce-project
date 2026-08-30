import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useShopifyCustomers, ShopifyCustomer } from "@/hooks/useShopifyCustomers";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Plus, Trash2, Package, User,
  Loader2, X, CheckCircle2, StickyNote, CreditCard, Truck,
} from "lucide-react";
import { Product } from "@/types/product";

interface LineItem {
  variantId?: string;
  title: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  productId: string;
}

interface CreateDraftOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CustomerSuggestions = ({
  customers,
  isLoading,
  onSelect,
}: {
  customers: ShopifyCustomer[];
  isLoading: boolean;
  onSelect: (c: ShopifyCustomer) => void;
}) => {
  if (isLoading) {
    return (
      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading customers...
      </div>
    );
  }
  if (customers.length === 0) return null;
  return (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-56 overflow-y-auto">
      {customers.map(c => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
          onMouseDown={() => onSelect(c)}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {(c.first_name?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {c.first_name || "—"} <span className="font-normal text-muted-foreground">{c.last_name}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">{c.orders_count} orders</div>
        </button>
      ))}
    </div>
  );
};

export const CreateDraftOrderModal = ({ open, onOpenChange, onSuccess }: CreateDraftOrderModalProps) => {
  const { toast } = useToast();
  const { data: products = [], isLoading: productsLoading } = useShopifyProducts(open);

  // Product state
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<ShopifyCustomer | null>(null);
  const [nameInputValue, setNameInputValue] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const { data: allCustomersData, isLoading: customersLoading } = useShopifyCustomers("", "", open);

  // Notes state
  const [notes, setNotes] = useState("");

  // Payment terms state
  const [paymentDueLater, setPaymentDueLater] = useState(false);
  const [paymentTermsDays, setPaymentTermsDays] = useState("7");

  // Shipping state
  const [freeShipping, setFreeShipping] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allCustomers: ShopifyCustomer[] = allCustomersData?.customers ?? [];

  const filteredCustomers = useMemo(() => {
    const term = nameInputValue.trim().toLowerCase();
    if (!term) return allCustomers.slice(0, 50);
    return allCustomers.filter(c =>
      c.first_name?.toLowerCase().includes(term) ||
      c.last_name?.toLowerCase().includes(term) ||
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [allCustomers, nameInputValue]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products.slice(0, 20);
    return products.filter(p => p.name.toLowerCase().includes(term)).slice(0, 20);
  }, [products, productSearch]);

  const handleSelectCustomer = (c: ShopifyCustomer) => {
    setSelectedCustomer(c);
    setNameInputValue(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
    setShowNameDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setNameInputValue("");
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setShowProductSuggestions(false);
    setSelectedVariantId(product.variants?.[0]?.id ?? "");
    setQuantity(1);
  };

  const handleAddLineItem = () => {
    if (!selectedProduct) return;
    const variant = selectedProduct.variants?.find(v => v.id === selectedVariantId);
    const price = variant?.price ?? selectedProduct.price;
    const title = selectedProduct.name;
    const variantTitle = variant?.title && variant.title !== "Default Title" ? variant.title : undefined;
    const existingIndex = lineItems.findIndex(item => item.variantId === selectedVariantId && item.title === title);
    if (existingIndex >= 0) {
      setLineItems(prev => prev.map((item, i) =>
        i === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
      ));
    } else {
      setLineItems(prev => [...prev, {
        variantId: selectedVariantId || undefined,
        title,
        variantTitle,
        price,
        quantity,
        productId: selectedProduct.id,
      }]);
    }
    setSelectedProduct(null);
    setSelectedVariantId("");
    setProductSearch("");
    setQuantity(1);
  };

  const handleSubmit = async () => {
    if (lineItems.length === 0) {
      toast({ title: "Add at least one product", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        lineItems: lineItems.map(item => ({
          variantId: item.variantId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
        })),
      };

      if (selectedCustomer) {
        payload.customer = {
          shopifyId: String(selectedCustomer.id),
          email: selectedCustomer.email,
          firstName: selectedCustomer.first_name,
          lastName: selectedCustomer.last_name,
          phone: selectedCustomer.phone,
        };
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      if (paymentDueLater) {
        payload.paymentTermsDays = parseInt(paymentTermsDays);
      }

      payload.freeShipping = freeShipping;

      const { data, error } = await supabase.functions.invoke('shopify-create-draft-order', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: `Order ${data.name} created`,
        description: `Total: €${Number(data.totalPrice).toFixed(2)}`,
      });

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Order creation failed:', err);
      toast({
        title: "Failed to create order",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setLineItems([]);
    setSelectedCustomer(null);
    setNameInputValue("");
    setShowNameDropdown(false);
    setProductSearch("");
    setSelectedProduct(null);
    setNotes("");
    setPaymentDueLater(false);
    setPaymentTermsDays("7");
    setFreeShipping(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Create Order</DialogTitle>
          <DialogDescription className="sr-only">Select products and a customer to create a Shopify order</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* Products */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Products</h3>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductSuggestions(true); }}
                onFocus={() => setShowProductSuggestions(true)}
                onBlur={() => setTimeout(() => setShowProductSuggestions(false), 150)}
                className="pl-9"
                disabled={productsLoading}
              />
              {showProductSuggestions && filteredProducts.length > 0 && !selectedProduct && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                      onMouseDown={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="text-muted-foreground text-xs">€{product.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="border rounded-md p-3 mb-3 bg-muted/30 space-y-3">
                <p className="font-medium text-sm">{selectedProduct.name}</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedProduct.variants && selectedProduct.variants.length > 1 && (
                    <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                      <SelectTrigger className="w-48 h-8 text-sm">
                        <SelectValue placeholder="Select variant" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProduct.variants.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.title} — €{v.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleAddLineItem} disabled={!selectedVariantId && !!selectedProduct.variants?.length}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
            )}

            {lineItems.length > 0 && (
              <div className="border rounded-md divide-y">
                {lineItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.variantTitle && <p className="text-xs text-muted-foreground">{item.variantTitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => {
                          const qty = parseInt(e.target.value) || 1;
                          setLineItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: qty } : it));
                        }}
                        className="w-16 h-7 text-sm text-center"
                      />
                      <span className="text-sm w-16 text-right">€{(item.price * item.quantity).toFixed(2)}</span>
                      <button type="button" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-2 flex justify-between items-center bg-muted/30">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">€{subtotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Customer */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Customer (optional)</h3>
              </div>
              {selectedCustomer && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-600 font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                  <button type="button" onClick={handleClearCustomer} className="hover:text-destructive transition-colors ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {!selectedCustomer && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search customer by name or email..."
                  value={nameInputValue}
                  className="pl-8"
                  onChange={e => {
                    setNameInputValue(e.target.value);
                    setShowNameDropdown(true);
                  }}
                  onFocus={() => setShowNameDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                  autoComplete="off"
                />
                {showNameDropdown && (
                  <CustomerSuggestions
                    customers={filteredCustomers}
                    isLoading={customersLoading}
                    onSelect={handleSelectCustomer}
                  />
                )}
              </div>
            )}
          </section>

          {/* Notes */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Notes (optional)</h3>
            </div>
            <Textarea
              placeholder="Add notes for this order..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </section>

          {/* Shipping */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Shipping</h3>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="freeShipping"
                checked={freeShipping}
                onCheckedChange={(checked) => setFreeShipping(checked === true)}
              />
              <label htmlFor="freeShipping" className="text-sm cursor-pointer">
                Free shipping
              </label>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Payment</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="paymentDueLater"
                  checked={paymentDueLater}
                  onCheckedChange={(checked) => setPaymentDueLater(checked === true)}
                />
                <label htmlFor="paymentDueLater" className="text-sm cursor-pointer">
                  Payment due later
                </label>
              </div>
              {paymentDueLater && (
                <div className="pl-6">
                  <label className="text-xs text-muted-foreground mb-1 block">Payment terms</label>
                  <Select value={paymentTermsDays} onValueChange={setPaymentTermsDays}>
                    <SelectTrigger className="w-48 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Within 7 days</SelectItem>
                      <SelectItem value="15">Within 15 days</SelectItem>
                      <SelectItem value="30">Within 30 days</SelectItem>
                      <SelectItem value="45">Within 45 days</SelectItem>
                      <SelectItem value="60">Within 60 days</SelectItem>
                      <SelectItem value="90">Within 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  <Button
                    onClick={handleSubmit}
                    disabled={lineItems.length === 0 || isSubmitting}
                    style={{ pointerEvents: lineItems.length === 0 ? 'none' : 'auto' }}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      "Create Order"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {lineItems.length === 0 && (
                <TooltipContent>
                  Add at least one product to create an order
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
