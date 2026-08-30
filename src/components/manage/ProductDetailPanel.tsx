import { useState, useMemo, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Product } from "@/types/product";
import { cn } from "@/lib/utils";
import {
  Pencil, Save, X, MapPin, Mountain, Beaker, Leaf, Flame, Coffee, Loader2, Package, ShieldAlert, Plus, Check
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMetaobjects } from "@/hooks/useMetaobjects";

interface ProductDetailPanelProps {
  product: Product | null;
  onClose: () => void;
}

const ProductDetailPanel = ({ product, onClose }: ProductDetailPanelProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuthContext();
  const [selectedImage, setSelectedImage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = !!user && isAdmin;

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");

  // Options + matrix variants editor
  type OptionDraft = { id?: number; name: string; values: string[]; position?: number };
  type VariantDraft = {
    id?: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    price: number;
    sku: string;
    type?: string;
    title?: string;
    inventory_quantity?: number;
  };
  const [editOptions, setEditOptions] = useState<OptionDraft[]>([]);
  const [editVariants, setEditVariants] = useState<VariantDraft[]>([]);

  const [editOrigin, setEditOrigin] = useState("");
  const [editElevation, setEditElevation] = useState("");
  const [editVariety, setEditVariety] = useState("");
  const [editProcess, setEditProcess] = useState("");
  const [editFlavors, setEditFlavors] = useState<Array<{ gid: string; name: string }>>([]);
  const [flavorPickerOpen, setFlavorPickerOpen] = useState(false);

  // Try to derive a flavor "template" — the metafield identity + metaobject type — from
  // either this product or any sibling product in the cache that already has flavors.
  // This lets admin add flavors to products that don't have any yet.
  const flavorTemplate = (() => {
    const own = product?.coffee;
    if (own?.flavor_metafield && own?.flavor_metaobject_type) {
      return {
        metafield: own.flavor_metafield,
        metaobjectType: own.flavor_metaobject_type,
      };
    }
    const cached = queryClient.getQueryData<Product[]>(["shopify-products"]) || [];
    for (const p of cached) {
      if (p.coffee?.flavor_metafield && p.coffee?.flavor_metaobject_type) {
        return {
          metafield: p.coffee.flavor_metafield,
          metaobjectType: p.coffee.flavor_metaobject_type,
        };
      }
    }
    return null;
  })();

  const flavorMetaobjectType = flavorTemplate?.metaobjectType;
  const { data: flavorOptions = [], isLoading: flavorOptionsLoading } = useMetaobjects(
    canEdit && isEditing ? flavorMetaobjectType : undefined
  );

  if (!product) return null;

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Build matrix variants from option combinations, preserving id/price/sku from existing variants when option values match.
  const buildMatrix = (opts: OptionDraft[], existing: VariantDraft[]): VariantDraft[] => {
    const cleanOpts = opts
      .map(o => ({ ...o, values: o.values.filter(v => v && v.trim() !== "") }))
      .filter(o => o.name.trim() !== "" && o.values.length > 0);
    if (cleanOpts.length === 0) return existing.length ? [existing[0]] : [];

    // Cartesian product
    const combos: Array<Array<string>> = cleanOpts.reduce<Array<Array<string>>>(
      (acc, opt) => acc.flatMap(a => opt.values.map(v => [...a, v])),
      [[]]
    );

    return combos.map(combo => {
      const [o1, o2, o3] = [combo[0] ?? null, combo[1] ?? null, combo[2] ?? null];
      // Strict match first (all option dimensions equal)
      let match = existing.find(e =>
        (e.option1 ?? null) === o1 &&
        (e.option2 ?? null) === o2 &&
        (e.option3 ?? null) === o3
      );
      // Fallback: existing variants from before a new option was added have null
      // on the new dimension. Treat null as a wildcard that only matches the FIRST
      // value of that option so we preserve the original variant id/sku/price
      // for that combo (e.g. existing "250g" → new "250g / Retail").
      if (!match) {
        match = existing.find(e => {
          for (let k = 0; k < cleanOpts.length; k++) {
            const key = (`option${k + 1}`) as "option1" | "option2" | "option3";
            const ev = (e as any)[key] ?? null;
            const cv = combo[k];
            if (ev === null) {
              if (cv !== cleanOpts[k].values[0]) return false;
            } else if (ev !== cv) return false;
          }
          return true;
        });
      }
      return match
        ? { ...match, option1: o1, option2: o2, option3: o3 }
        : { option1: o1, option2: o2, option3: o3, price: 0, sku: "" };
    });
  };

  const enterEditMode = () => {
    setEditName(product.name);
    setEditDescription(product.description || "");
    setEditTags(product.badges?.join(", ") || "");

    // Seed options: prefer Shopify-provided options, otherwise infer from variants
    let seededOpts: OptionDraft[] = [];
    if (product.options && product.options.length > 0) {
      seededOpts = product.options.map(o => ({
        id: o.id,
        name: o.name,
        values: [...o.values],
        position: o.position,
      }));
    } else if (product.variants && product.variants.length > 0) {
      const names = ["Weight", "Distribution", "Option 3"];
      [0, 1, 2].forEach(i => {
        const key = (`option${i + 1}`) as "option1" | "option2" | "option3";
        const vals = Array.from(new Set(
          product.variants!.map(v => (v as any)[key]).filter((x): x is string => !!x)
        ));
        if (vals.length > 0) seededOpts.push({ name: names[i], values: vals, position: i + 1 });
      });
    }

    const seededVariants: VariantDraft[] = (product.variants || []).map(v => ({
      id: v.id,
      option1: v.option1 ?? null,
      option2: v.option2 ?? null,
      option3: v.option3 ?? null,
      price: v.price,
      sku: v.sku || "",
      type: v.type,
      title: v.title,
      inventory_quantity: v.inventory_quantity,
    }));

    setEditOptions(seededOpts);
    setEditVariants(seededVariants.length ? seededVariants : buildMatrix(seededOpts, []));
    setEditOrigin(product.coffee?.origin || "");
    setEditElevation(product.coffee?.elevation_m ? String(product.coffee.elevation_m) : "");
    setEditVariety(product.coffee?.variety || "");
    setEditProcess(product.coffee?.process || "");
    setEditFlavors(product.coffee?.flavor_refs ? [...product.coffee.flavor_refs] : []);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  // Option editor mutations — each rebuilds the variant matrix while preserving overlapping prices/SKUs.
  const updateOptionName = (i: number, name: string) => {
    setEditOptions(prev => prev.map((o, idx) => idx === i ? { ...o, name } : o));
  };
  const addOptionValue = (i: number, value: string) => {
    if (!value.trim()) return;
    setEditOptions(prev => {
      const next = prev.map((o, idx) =>
        idx === i && !o.values.includes(value.trim())
          ? { ...o, values: [...o.values, value.trim()] }
          : o
      );
      setEditVariants(curr => buildMatrix(next, curr));
      return next;
    });
  };
  const removeOptionValue = (i: number, value: string) => {
    setEditOptions(prev => {
      const next = prev.map((o, idx) =>
        idx === i ? { ...o, values: o.values.filter(v => v !== value) } : o
      );
      setEditVariants(curr => buildMatrix(next, curr));
      return next;
    });
  };
  const addOption = () => {
    if (editOptions.length >= 3) return;
    setEditOptions(prev => [...prev, { name: "", values: [], position: prev.length + 1 }]);
  };
  const removeOption = (i: number) => {
    setEditOptions(prev => {
      const next = prev.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, position: idx + 1 }));
      setEditVariants(curr => buildMatrix(next, curr));
      return next;
    });
  };

  const updateVariantField = (index: number, field: "price" | "sku", value: string) => {
    setEditVariants(prev => prev.map((v, i) => {
      if (i !== index) return v;
      if (field === "price") return { ...v, price: parseFloat(value) || 0 };
      return { ...v, sku: value };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = { productId: product.id };

      if (editName !== product.name) updatePayload.title = editName;
      if (editDescription !== (product.description || "")) updatePayload.body_html = editDescription;
      if (editTags !== (product.badges?.join(", ") || "")) updatePayload.tags = editTags;

      // Detect option/variant structural or value changes
      const originalOpts = (product.options || []).map(o => ({ name: o.name, values: [...o.values].sort().join("|") }));
      const currentOpts = editOptions
        .filter(o => o.name.trim() && o.values.length > 0)
        .map(o => ({ name: o.name, values: [...o.values].sort().join("|") }));
      const optionsChanged =
        originalOpts.length !== currentOpts.length ||
        originalOpts.some((o, i) => o.name !== currentOpts[i]?.name || o.values !== currentOpts[i]?.values);

      const variantsChanged = editVariants.some(ev => {
        const original = ev.id ? product.variants?.find(v => v.id === ev.id) : undefined;
        if (!original) return true; // new variant
        return original.price !== ev.price || (original.sku || "") !== (ev.sku || "");
      }) || (product.variants?.some(ov => !editVariants.find(ev => ev.id === ov.id)) ?? false);

      if (optionsChanged || variantsChanged) {
        if (optionsChanged && currentOpts.length > 0) {
          // Matrix mode: send full options + variants array
          updatePayload.options = editOptions
            .filter(o => o.name.trim() && o.values.length > 0)
            .map((o, idx) => ({
              ...(o.id ? { id: o.id } : {}),
              name: o.name,
              values: o.values,
              position: idx + 1,
            }));
          updatePayload.variants = editVariants.map(v => ({
            ...(v.id ? { id: v.id } : {}),
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
            price: v.price,
            sku: v.sku,
          }));
        } else {
          // Price/SKU only on existing variants
          updatePayload.variants = editVariants
            .filter(ev => {
              if (!ev.id) return false;
              const original = product.variants?.find(v => v.id === ev.id);
              return original && (original.price !== ev.price || (original.sku || "") !== (ev.sku || ""));
            })
            .map(v => ({ id: v.id, price: v.price, sku: v.sku }));
          if (updatePayload.variants.length === 0) delete updatePayload.variants;
        }
      }

      // Coffee Details: build metafields for fields that actually changed.
      // Keys map to Shopify custom.* metafields configured on the product.
      const originalElevation = product.coffee?.elevation_m
        ? String(product.coffee.elevation_m)
        : "";
      const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [];
      if (editOrigin !== (product.coffee?.origin || "")) {
        metafields.push({ namespace: "custom", key: "origin", value: editOrigin, type: "single_line_text_field" });
      }
      if (editElevation !== originalElevation) {
        metafields.push({ namespace: "custom", key: "elevation", value: editElevation, type: "single_line_text_field" });
      }
      if (editVariety !== (product.coffee?.variety || "")) {
        metafields.push({ namespace: "custom", key: "variety", value: editVariety, type: "single_line_text_field" });
      }
      if (editProcess !== (product.coffee?.process || "")) {
        metafields.push({ namespace: "custom", key: "processing", value: editProcess, type: "single_line_text_field" });
      }

      // Flavor Notes: send as list.metaobject_reference if changed.
      // Use the product's own metafield identity if available, otherwise fall back
      // to a sibling product's template so we can write the first flavor on a
      // product that didn't have any.
      const originalFlavorGids = (product.coffee?.flavor_refs || []).map(f => f.gid);
      const editedFlavorGids = editFlavors.map(f => f.gid);
      const flavorsChanged =
        originalFlavorGids.length !== editedFlavorGids.length ||
        originalFlavorGids.some((g, i) => g !== editedFlavorGids[i]);
      const fm = product.coffee?.flavor_metafield ?? flavorTemplate?.metafield;
      if (flavorsChanged && fm) {
        metafields.push({
          namespace: fm.namespace,
          key: fm.key,
          value: JSON.stringify(editedFlavorGids),
          type: fm.type || "list.metaobject_reference",
        });
      }

      if (metafields.length > 0) {
        updatePayload.metafields = metafields;
      }

      // Only call API if there are actual changes
      if (Object.keys(updatePayload).length <= 1) {
        toast({ title: "No changes", description: "No fields were modified." });
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("shopify-update-product", {
        body: updatePayload,
      });

      if (error) {
        // Try to parse error details from the response body. Shopify often returns
        // a structured `errors` object (e.g. { options: ["Option values provided for unknown options"] }).
        let detail: any = error.message;
        if (data && typeof data === 'object') {
          const errs = (data as any).errors;
          if (errs && typeof errs === 'object') {
            detail = Object.entries(errs)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ');
          } else {
            detail = (data as any).error || (data as any).details || (data as any).message || detail;
          }
        }
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      toast({ title: "Product updated", description: `"${editName}" synced to Shopify successfully.` });

      // Invalidate cache to refetch fresh data
      await queryClient.invalidateQueries({ queryKey: ["shopify-products"] });
      setIsEditing(false);
      onClose();
    } catch (err: any) {
      console.error("Failed to update product:", err);
      toast({
        title: "Update failed",
        description: err.message || "Could not sync changes to Shopify.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={() => { setSelectedImage(0); setIsEditing(false); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Hero Image */}
        {product.images.length > 0 && (
          <div className="relative">
            <div className="aspect-[16/10] bg-muted overflow-hidden rounded-t-lg">
              <img
                src={product.images[selectedImage] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-muted/30">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "w-14 h-14 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all",
                      selectedImage === i
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl font-display leading-tight">
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-bold"
                  />
                ) : product.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  canEdit ? (
                    <Button size="sm" variant="outline" onClick={enterEditMode}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Admin only
                    </div>
                  )
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Save & Sync
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={product.brand === "legendary" ? "default" : "secondary"}>
                {product.brand}
              </Badge>
              <Badge variant="outline">{product.category}</Badge>
              {isEditing ? (
                <div className="w-full mt-2">
                  <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
                  <Input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="e.g. limited, new, bestseller"
                    className="mt-1"
                  />
                </div>
              ) : (
                product.badges?.map((b) => (
                  <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                ))
              )}
            </div>
          </DialogHeader>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Description</Label>
            {isEditing ? (
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={5}
                placeholder="Product description..."
              />
            ) : (
              product.description && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {stripHtml(product.description)}
                </p>
              )
            )}
          </div>

          {/* Price */}
          <div>
            <span className="text-2xl font-bold text-primary">€{product.price}</span>
          </div>

          {/* Coffee Details */}
          {(product.coffee || isEditing) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-primary" />
                  Coffee Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {isEditing ? (
                    <DetailItem
                      icon={MapPin}
                      label="Origin"
                      value={editOrigin}
                      editable
                      onChange={setEditOrigin}
                      placeholder="e.g. Finca Las Marías, Quindío, Colombia"
                    />
                  ) : (
                    product.coffee?.origin && <DetailItem icon={MapPin} label="Origin" value={product.coffee.origin} />
                  )}

                  {isEditing ? (
                    <DetailItem
                      icon={Mountain}
                      label="Elevation"
                      value={editElevation}
                      editable
                      onChange={setEditElevation}
                      placeholder="e.g. 2050"
                      suffix="m"
                    />
                  ) : (
                    product.coffee?.elevation_m && product.coffee.elevation_m > 0 && (
                      <DetailItem icon={Mountain} label="Elevation" value={`${product.coffee.elevation_m}m`} />
                    )
                  )}

                  {isEditing ? (
                    <DetailItem
                      icon={Beaker}
                      label="Process"
                      value={editProcess}
                      editable
                      onChange={setEditProcess}
                      placeholder="e.g. Double Washed"
                    />
                  ) : (
                    product.coffee?.process && <DetailItem icon={Beaker} label="Process" value={product.coffee.process} />
                  )}

                  {isEditing ? (
                    <DetailItem
                      icon={Leaf}
                      label="Variety"
                      value={editVariety}
                      editable
                      onChange={setEditVariety}
                      placeholder="e.g. Red and Yellow Geisha"
                    />
                  ) : (
                    product.coffee?.variety && <DetailItem icon={Leaf} label="Variety" value={product.coffee.variety} />
                  )}

                  {/* Roast remains read-only in this phase */}
                  {product.coffee?.roast_style && <DetailItem icon={Flame} label="Roast" value={product.coffee.roast_style} />}

                  {/* Flavor Notes: read-only pills outside edit mode, multi-select inside */}
                  {(isEditing || (product.coffee?.flavor_notes && product.coffee.flavor_notes.length > 0)) && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Flavor Notes</p>
                      {isEditing ? (
                        <FlavorMultiSelect
                          selected={editFlavors}
                          onChange={setEditFlavors}
                          options={flavorOptions}
                          loading={flavorOptionsLoading}
                          disabled={!flavorMetaobjectType}
                          open={flavorPickerOpen}
                          onOpenChange={setFlavorPickerOpen}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {product.coffee?.flavor_notes.map((note) => (
                            <span key={note} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {note}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Variants */}
          {((isEditing && (editOptions.length > 0 || editVariants.length > 0)) || (!isEditing && product.variants && product.variants.length > 0)) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Variants
                </h4>

                {/* Options editor (edit mode) */}
                {isEditing && (
                  <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wide">Options</Label>
                      {editOptions.length < 3 && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addOption}>
                          <Plus className="w-3 h-3 mr-1" /> Add option
                        </Button>
                      )}
                    </div>
                    {editOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No options. Add one (e.g. Weight, Distribution) to generate the variant matrix.</p>
                    )}
                    {editOptions.map((opt, i) => (
                      <OptionEditor
                        key={i}
                        option={opt}
                        onNameChange={(n) => updateOptionName(i, n)}
                        onAddValue={(v) => addOptionValue(i, v)}
                        onRemoveValue={(v) => removeOptionValue(i, v)}
                        onRemove={() => removeOption(i)}
                      />
                    ))}
                  </div>
                )}

                {/* Variant matrix */}
                <div className="rounded-lg border overflow-hidden">
                  <div className={cn("grid px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b", isEditing ? "grid-cols-[1fr_1fr_110px_110px]" : "grid-cols-4")}>
                    <span>Variant</span>
                    <span>{isEditing ? "SKU" : "Type"}</span>
                    <span className={isEditing ? "text-right" : ""}>{isEditing ? "Price" : "Inventory"}</span>
                    {!isEditing && <span className="text-right">Price</span>}
                    {isEditing && <span className="text-right">Inventory</span>}
                  </div>
                  {(isEditing ? editVariants : product.variants || []).map((v: any, i) => {
                    const originalVariant = v.id ? product.variants?.find(ov => ov.id === v.id) : undefined;
                    const displayTitle = isEditing
                      ? [v.option1, v.option2, v.option3].filter(Boolean).join(" / ") || "Default"
                      : v.title;
                    return (
                      <div
                        key={v.id ?? `new-${i}`}
                        className={cn(
                          "grid items-center px-4 py-2.5 text-sm",
                          isEditing ? "grid-cols-[1fr_1fr_110px_110px] gap-2" : "grid-cols-4",
                          i !== (isEditing ? editVariants : product.variants || []).length - 1 && "border-b"
                        )}
                      >
                        <span className="font-medium truncate" title={displayTitle}>{displayTitle}</span>
                        {isEditing ? (
                          <Input
                            value={v.sku || ""}
                            onChange={(e) => updateVariantField(i, "sku", e.target.value)}
                            placeholder="SKU"
                            className="h-8 text-xs"
                          />
                        ) : (
                          <span>
                            <Badge variant={v.type === "Wholesale" ? "secondary" : "outline"} className="text-xs">
                              {v.type || "Retail"}
                            </Badge>
                          </span>
                        )}
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={v.price}
                            onChange={(e) => updateVariantField(i, "price", e.target.value)}
                            className="w-full text-right h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{originalVariant?.inventory_quantity ?? "—"}</span>
                        )}
                        {!isEditing && (
                          <span className="text-right font-semibold">€{v.price}</span>
                        )}
                        {isEditing && (
                          <span className="text-right text-xs text-muted-foreground">
                            {originalVariant?.inventory_quantity ?? "—"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Product ID */}
          <Separator />
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>Shopify ID: {product.id}</span>
            <span>Slug: {product.slug}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface DetailItemProps {
  icon: any;
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  suffix?: string;
}

const DetailItem = ({ icon: Icon, label, value, editable, onChange, placeholder, suffix }: DetailItemProps) => (
  <div className="flex items-start gap-2">
    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      {editable ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="h-7 text-sm"
          />
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
      ) : (
        <p className="text-sm font-medium capitalize">{value}</p>
      )}
    </div>
  </div>
);

interface FlavorMultiSelectProps {
  selected: Array<{ gid: string; name: string }>;
  onChange: (next: Array<{ gid: string; name: string }>) => void;
  options: Array<{ gid: string; name: string }>;
  loading: boolean;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FlavorMultiSelect = ({
  selected,
  onChange,
  options,
  loading,
  disabled,
  open,
  onOpenChange,
}: FlavorMultiSelectProps) => {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.gid)), [selected]);
  const remove = (gid: string) => onChange(selected.filter((s) => s.gid !== gid));
  const toggle = (opt: { gid: string; name: string }) => {
    if (selectedSet.has(opt.gid)) remove(opt.gid);
    else onChange([...selected, opt]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((s) => (
          <span
            key={s.gid}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
          >
            {s.name}
            <button
              type="button"
              onClick={() => remove(s.gid)}
              className="hover:text-primary/70"
              aria-label={`Remove ${s.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={disabled}
          onClick={() => onOpenChange(!open)}
          title={disabled ? "No flavor metaobjects detected" : "Add flavor"}
        >
          <Plus className="w-3 h-3 mr-1" />
          {open ? "Close" : "Add"}
        </Button>
      </div>
      {open && !disabled && (
        <div className="rounded-md border bg-popover shadow-sm overflow-hidden">
          <div className="p-2 border-b">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flavors..."
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground">Loading flavors...</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                {options.length === 0 ? "No flavors available." : "No matches."}
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selectedSet.has(opt.gid);
                return (
                  <button
                    key={opt.gid}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <Check
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{opt.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface OptionEditorProps {
  option: { id?: number; name: string; values: string[]; position?: number };
  onNameChange: (n: string) => void;
  onAddValue: (v: string) => void;
  onRemoveValue: (v: string) => void;
  onRemove: () => void;
}

const OptionEditor = ({ option, onNameChange, onAddValue, onRemoveValue, onRemove }: OptionEditorProps) => {
  const [newValue, setNewValue] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const nameMissing = !option.name.trim();

  // Auto-focus the name field when this is a brand-new option (no id, no name).
  useEffect(() => {
    if (!option.id && nameMissing) {
      nameRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    if (!newValue.trim() || nameMissing) return;
    onAddValue(newValue);
    setNewValue("");
  };
  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          ref={nameRef}
          value={option.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Option name (e.g. Distribution)"
          className="h-8 text-sm flex-1"
          disabled={!!option.id}
          title={option.id ? "Existing option name cannot be renamed" : ""}
        />
        <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={onRemove} title="Remove option">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {option.values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {v}
            <button type="button" onClick={() => onRemoveValue(v)} aria-label={`Remove ${v}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
          }}
          onBlur={commit}
          placeholder={nameMissing ? "Name option first…" : "Add value..."}
          className="h-7 text-xs w-32"
          disabled={nameMissing}
          title={nameMissing ? "Type the option name (e.g. Distribution) before adding values" : ""}
        />
      </div>
      {nameMissing && (
        <p className="text-[10px] text-muted-foreground italic">
          Name this option (e.g. <span className="font-medium">Distribution</span>) before adding values.
        </p>
      )}
    </div>
  );
};

export default ProductDetailPanel;
