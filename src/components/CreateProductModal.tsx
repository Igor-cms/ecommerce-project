import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useShopifyCollections } from "@/hooks/useShopifyCollections";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, DollarSign, ImagePlus, Tag, Truck,
  Plus, Trash2, Loader2, X,
} from "lucide-react";

type OptionDraft = { name: string; values: string[] };
type MatrixRow = {
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  sku: string;
  weight: string;
  weightUnit: string;
  inventoryQuantity: string;
};

const buildMatrix = (opts: OptionDraft[], existing: MatrixRow[]): MatrixRow[] => {
  const cleanOpts = opts
    .map(o => ({ ...o, values: o.values.filter(v => v && v.trim() !== "") }))
    .filter(o => o.name.trim() !== "" && o.values.length > 0);
  if (cleanOpts.length === 0) return [];

  const combos: string[][] = cleanOpts.reduce<string[][]>(
    (acc, opt) => acc.flatMap(a => opt.values.map(v => [...a, v])),
    [[]]
  );

  return combos.map(combo => {
    const [o1, o2, o3] = [combo[0] ?? null, combo[1] ?? null, combo[2] ?? null];
    const match = existing.find(e =>
      (e.option1 ?? null) === o1 &&
      (e.option2 ?? null) === o2 &&
      (e.option3 ?? null) === o3
    );
    return match ?? {
      option1: o1, option2: o2, option3: o3,
      price: "", sku: "", weight: "", weightUnit: "g", inventoryQuantity: "",
    };
  });
};

interface CreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateProductModal = ({ open, onOpenChange, onSuccess }: CreateProductModalProps) => {
  const { toast } = useToast();
  const { data: collections = [] } = useShopifyCollections(open);

  // Basic Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "draft">("draft");

  // Pricing & Variants
  const [hasMultipleVariants, setHasMultipleVariants] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([{ name: "", values: [] }]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [newValueDraft, setNewValueDraft] = useState<Record<number, string>>({});

  // Single variant fields
  const [singlePrice, setSinglePrice] = useState("");
  const [singleSku, setSingleSku] = useState("");
  const [singleWeight, setSingleWeight] = useState("");
  const [singleWeightUnit, setSingleWeightUnit] = useState("g");
  const [singleInventory, setSingleInventory] = useState("");

  // Media
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Organization
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState("");
  const [tags, setTags] = useState("");
  const [collectionId, setCollectionId] = useState("");

  // Shipping
  const [requiresShipping, setRequiresShipping] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const customCollections = collections.filter(c => c.type === 'custom');

  const handleAddImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    if (!url.startsWith("https://")) {
      toast({ title: "Image URL must start with https://", variant: "destructive" });
      return;
    }
    setImageUrls(prev => [...prev, url]);
    setNewImageUrl("");
  };

  // Option editor mutations
  const updateOptionName = (i: number, name: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, name } : o));
  };
  const addOption = () => {
    if (options.length >= 3) return;
    setOptions(prev => [...prev, { name: "", values: [] }]);
    // Initialize new option column on existing rows
    setMatrix(prev => prev.map(row => {
      const next = { ...row };
      if (options.length === 1) next.option2 = "";
      else if (options.length === 2) next.option3 = "";
      return next;
    }));
  };
  const removeOption = (i: number) => {
    setOptions(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [{ name: "", values: [] }];
    });
    // Shift option values down in matrix rows
    setMatrix(prev => prev.map(row => {
      const vals = [row.option1, row.option2, row.option3];
      vals.splice(i, 1);
      vals.push(null);
      return { ...row, option1: vals[0], option2: vals[1], option3: vals[2] };
    }));
  };

  const updateMatrixField = (index: number, field: keyof MatrixRow, value: string) => {
    setMatrix(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const addManualVariant = () => {
    setMatrix(prev => [...prev, {
      option1: options[0]?.name.trim() ? "" : null,
      option2: options[1]?.name.trim() ? "" : null,
      option3: options[2]?.name.trim() ? "" : null,
      price: "", sku: "", weight: "", weightUnit: "g", inventoryQuantity: "",
    }]);
  };

  const removeMatrixRow = (index: number) => {
    setMatrix(prev => prev.filter((_, i) => i !== index));
  };

  const matrixLabel = (row: MatrixRow) =>
    [row.option1, row.option2, row.option3].filter(Boolean).join(" / ");

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    if (hasMultipleVariants) {
      const namedOpts = options.filter(o => o.name.trim());
      if (namedOpts.length === 0) {
        toast({ title: "Add at least one option name", variant: "destructive" });
        return;
      }
      if (matrix.length === 0) {
        toast({ title: "Add at least one variant", variant: "destructive" });
        return;
      }
      const invalidOpt = matrix.some((v, _) =>
        namedOpts.some((_, oi) => {
          const f = (`option${oi + 1}`) as "option1" | "option2" | "option3";
          return !(v[f] ?? "").toString().trim();
        })
      );
      if (invalidOpt) {
        toast({ title: "Each variant must have a value for every option", variant: "destructive" });
        return;
      }
      const invalid = matrix.some(v => !v.price.trim() || isNaN(Number(v.price)) || Number(v.price) <= 0);
      if (invalid) {
        toast({ title: "Each variant needs a valid price", variant: "destructive" });
        return;
      }
    } else {
      if (!singlePrice.trim() || isNaN(Number(singlePrice)) || Number(singlePrice) <= 0) {
        toast({ title: "A valid price is required", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        title: title.trim(),
        status,
      };

      if (description.trim()) payload.bodyHtml = description.trim();
      if (vendor.trim()) payload.vendor = vendor.trim();
      if (productType.trim()) payload.productType = productType.trim();
      if (tags.trim()) payload.tags = tags.trim();
      if (collectionId) payload.collectionId = Number(collectionId);

      if (imageUrls.length > 0) {
        payload.images = imageUrls.map(src => ({ src }));
      }

      if (hasMultipleVariants) {
        const namedOpts = options.filter(o => o.name.trim());
        // Derive unique option values from the rows entered
        payload.options = namedOpts.map((o, idx) => {
          const f = (`option${idx + 1}`) as "option1" | "option2" | "option3";
          const values = Array.from(new Set(
            matrix.map(r => (r[f] ?? "").toString().trim()).filter(Boolean)
          ));
          return { name: o.name.trim(), values, position: idx + 1 };
        });
        payload.variants = matrix.map(v => ({
          option1: v.option1?.toString().trim() || undefined,
          option2: v.option2?.toString().trim() || undefined,
          option3: v.option3?.toString().trim() || undefined,
          price: v.price,
          sku: v.sku || undefined,
          weight: v.weight ? Number(v.weight) : undefined,
          weightUnit: v.weightUnit,
          inventoryQuantity: v.inventoryQuantity ? Number(v.inventoryQuantity) : undefined,
          requiresShipping,
        }));
      } else {
        payload.variants = [{
          option1: "Default Title",
          price: singlePrice,
          sku: singleSku || undefined,
          weight: singleWeight ? Number(singleWeight) : undefined,
          weightUnit: singleWeightUnit,
          inventoryQuantity: singleInventory ? Number(singleInventory) : undefined,
          requiresShipping,
        }];
      }

      const { data, error } = await supabase.functions.invoke('shopify-create-product', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: `Product "${data.title}" created`,
        description: `Status: ${data.status} | Variants: ${data.variantsCreated}${data.collectionAdded ? ' | Added to collection' : ''}`,
      });

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Product creation failed:', err);
      toast({
        title: "Failed to create product",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setStatus("draft");
    setHasMultipleVariants(false);
    setOptions([{ name: "", values: [] }]);
    setMatrix([]);
    setNewValueDraft({});
    setSinglePrice("");
    setSingleSku("");
    setSingleWeight("");
    setSingleWeightUnit("g");
    setSingleInventory("");
    setImageUrls([]);
    setNewImageUrl("");
    setProductType("");
    setVendor("");
    setTags("");
    setCollectionId("");
    setRequiresShipping(true);
    onOpenChange(false);
  };

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (hasMultipleVariants) {
      const namedOpts = options.filter(o => o.name.trim());
      if (namedOpts.length === 0 || matrix.length === 0) return false;
      return matrix.every(v => {
        if (!v.price.trim() || Number(v.price) <= 0) return false;
        return namedOpts.every((_, oi) => {
          const f = (`option${oi + 1}`) as "option1" | "option2" | "option3";
          return (v[f] ?? "").toString().trim() !== "";
        });
      });
    }
    return singlePrice.trim() !== "" && Number(singlePrice) > 0;
  }, [title, hasMultipleVariants, options, matrix, singlePrice]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Create Product</DialogTitle>
          <DialogDescription className="sr-only">Fill in the details to create a new Shopify product</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* Basic Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Basic Info</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
                <Input placeholder="Product title" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <Textarea
                  placeholder="Product description (HTML allowed)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={(v: "active" | "draft") => setStatus(v)}>
                  <SelectTrigger className="w-40 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Pricing & Variants */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Pricing & Variants</h3>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="hasVariants"
                checked={hasMultipleVariants}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setHasMultipleVariants(enabled);
                  if (enabled && matrix.length === 0) {
                    const blank = { option1: "", option2: null, option3: null, price: "", sku: "", weight: "", weightUnit: "g", inventoryQuantity: "" };
                    setMatrix([{ ...blank }, { ...blank }, { ...blank }]);
                  }
                }}
              />
              <label htmlFor="hasVariants" className="text-sm cursor-pointer">
                This product has multiple variants (e.g. Weight × Distribution)
              </label>
            </div>

            {!hasMultipleVariants ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Price (EUR) *</label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00"
                      value={singlePrice} onChange={e => setSinglePrice(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">SKU</label>
                    <Input placeholder="SKU-001" value={singleSku} onChange={e => setSingleSku(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Weight</label>
                    <Input type="number" step="0.1" min="0" placeholder="0"
                      value={singleWeight} onChange={e => setSingleWeight(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                    <Select value={singleWeightUnit} onValueChange={setSingleWeightUnit}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="oz">oz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Inventory</label>
                    <Input type="number" min="0" step="1" placeholder="0"
                      value={singleInventory} onChange={e => setSingleInventory(e.target.value)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Option names */}
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Option name {options.length > 1 ? i + 1 : ""}
                        </label>
                        <Input
                          placeholder="e.g. Size, Distribution, Color"
                          value={opt.name}
                          onChange={e => updateOptionName(i, e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors mt-5"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < 3 && (
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <Plus className="w-3 h-3 mr-1" /> Add option
                    </Button>
                  )}
                </div>

                {/* Variant rows */}
                {(() => {
                  const namedOpts = options.filter(o => o.name.trim());
                  const colCount = Math.max(1, namedOpts.length);
                  const gridCols = `repeat(${colCount}, minmax(80px, 1.2fr)) 0.7fr 0.8fr 0.5fr 0.5fr 0.6fr auto`;
                  return (
                    <div className="space-y-2">
                      <div className="border rounded-md divide-y overflow-x-auto">
                        <div
                          className="grid gap-2 px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-medium"
                          style={{ gridTemplateColumns: gridCols }}
                        >
                          {namedOpts.length > 0
                            ? namedOpts.map((o, oi) => <span key={oi}>{o.name}</span>)
                            : <span>Variant</span>}
                          <span>Price *</span>
                          <span>SKU</span>
                          <span>Weight</span>
                          <span>Unit</span>
                          <span>Stock</span>
                          <span></span>
                        </div>
                        {matrix.map((row, index) => (
                          <div
                            key={index}
                            className="grid gap-2 px-3 py-2 items-center"
                            style={{ gridTemplateColumns: gridCols }}
                          >
                            {(namedOpts.length > 0 ? namedOpts : [{ name: "" }]).map((opt, oi) => {
                              const field = (`option${oi + 1}`) as "option1" | "option2" | "option3";
                              return (
                                <Input
                                  key={oi}
                                  placeholder={`e.g. ${opt.name === "Size" ? "250g" : opt.name || "Value"}`}
                                  value={row[field] ?? ""}
                                  onChange={e => updateMatrixField(index, field, e.target.value)}
                                  className="h-7 text-sm"
                                />
                              );
                            })}
                            <Input type="number" step="0.01" min="0" placeholder="0.00"
                              value={row.price} onChange={e => updateMatrixField(index, "price", e.target.value)}
                              className="h-7 text-sm" />
                            <Input placeholder="SKU"
                              value={row.sku} onChange={e => updateMatrixField(index, "sku", e.target.value)}
                              className="h-7 text-sm" />
                            <Input type="number" step="0.1" min="0" placeholder="0"
                              value={row.weight} onChange={e => updateMatrixField(index, "weight", e.target.value)}
                              className="h-7 text-sm" />
                            <Select value={row.weightUnit} onValueChange={val => updateMatrixField(index, "weightUnit", val)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="g">g</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="lb">lb</SelectItem>
                                <SelectItem value="oz">oz</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input type="number" min="0" step="1" placeholder="0"
                              value={row.inventoryQuantity}
                              onChange={e => updateMatrixField(index, "inventoryQuantity", e.target.value)}
                              className="h-7 text-sm" />
                            <button
                              type="button"
                              onClick={() => removeMatrixRow(index)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                              title="Remove variant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" onClick={addManualVariant}>
                        <Plus className="w-3 h-3 mr-1" /> Add variant
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Media */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Images</h3>
            </div>

            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative group w-20 h-20 border rounded-md overflow-hidden">
                    <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== index))}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="https://... (public image URL)"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddImage())}
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleAddImage} disabled={!newImageUrl.trim()}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">URL must be publicly accessible. Shopify will download the image.</p>
          </section>

          {/* Organization */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Organization</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product Type</label>
                  <Input placeholder="e.g. Coffee, Apparel" value={productType} onChange={e => setProductType(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vendor</label>
                  <Input placeholder="e.g. Legendary Coffee" value={vendor} onChange={e => setVendor(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Collection</label>
                <Select value={collectionId} onValueChange={setCollectionId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a collection (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customCollections.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Only custom collections are shown. Smart collections auto-include by rules.</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                <Input placeholder="tag1, tag2, tag3" value={tags} onChange={e => setTags(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Shipping */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Shipping</h3>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresShipping"
                checked={requiresShipping}
                onCheckedChange={(checked) => setRequiresShipping(checked === true)}
              />
              <label htmlFor="requiresShipping" className="text-sm cursor-pointer">
                This is a physical product (requires shipping)
              </label>
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
                    disabled={!canSubmit || isSubmitting}
                    style={{ pointerEvents: !canSubmit ? 'none' : 'auto' }}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      "Create Product"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canSubmit && (
                <TooltipContent>
                  {!title.trim() ? "Product title is required" : "Add options + values and a valid price for every variant"}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
