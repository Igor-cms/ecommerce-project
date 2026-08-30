import { useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { useRawMaterialVariants } from "@/hooks/useRawMaterialVariants";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ArrowLeft, Package, History, Settings2, Loader2, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Product } from "@/types/product";

const AdminInventory = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const { data: materials, isLoading: materialsLoading, addMaterial, updateMaterial } = useRawMaterials();
  const { data: allVariantMappings, linkVariant, unlinkVariant } = useRawMaterialVariants();
  const { data: shopifyProducts, isLoading: productsLoading } = useShopifyProducts();
  const queryClient = useQueryClient();

  // Selected product for detail view
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Bulk quantity editing
  const [editingBulkQty, setEditingBulkQty] = useState("");
  const [bulkUnit, setBulkUnit] = useState("g");

  // Variant quantity editing
  const [variantQtyMap, setVariantQtyMap] = useState<Record<string, string>>({});

  // Sync/save state
  const [saving, setSaving] = useState(false);
  const [lastSyncDeductions, setLastSyncDeductions] = useState<any[] | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Deduction history pagination
  const DEDUCTIONS_PER_PAGE = 20;
  const [deductionPage, setDeductionPage] = useState(0);

  const { data: deductionResult } = useQuery({
    queryKey: ['inventory_deductions', deductionPage],
    queryFn: async () => {
      const from = deductionPage * DEDUCTIONS_PER_PAGE;
      const to = from + DEDUCTIONS_PER_PAGE - 1;
      const { data, error, count } = await supabase
        .from('inventory_deductions')
        .select('*', { count: 'exact' })
        
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: data || [], total: count || 0 };
    },
  });

  const deductionHistory = deductionResult?.data;
  const deductionTotal = deductionResult?.total || 0;
  const deductionTotalPages = Math.ceil(deductionTotal / DEDUCTIONS_PER_PAGE);

  // Auto-migrate: backfill shopify_product_id for existing materials that have variant mappings
  const materialsWithoutProductId = materials?.filter(m => !m.shopify_product_id) || [];
  if (materialsWithoutProductId.length > 0 && shopifyProducts && allVariantMappings) {
    for (const mat of materialsWithoutProductId) {
      const matMappings = allVariantMappings.filter(v => v.raw_material_id === mat.id);
      if (matMappings.length > 0) {
        const firstVariantId = matMappings[0].shopify_variant_id;
        const matchingProduct = shopifyProducts.find(p =>
          p.variants?.some((v: any) => v.id === firstVariantId)
        );
        if (matchingProduct) {
          supabase
            .from('raw_materials')
            .update({ shopify_product_id: matchingProduct.id, name: matchingProduct.name } as any)
            .eq('id', mat.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ['raw_materials'] }));
        }
      }
    }
  }

  if (authLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  // Only coffee products
  const coffeeProducts = (shopifyProducts || []).filter(p => p.category === 'coffee');

  // Build flat list of all Shopify variants for sync preview
  const allShopifyVariants = (shopifyProducts || []).flatMap(p =>
    (p.variants || []).map((v: any) => ({
      variantId: v.id,
      productName: p.name,
      variantTitle: v.title,
      variantType: v.type || 'Retail',
    }))
  );

  // Helper: find raw material for a product (by shopify_product_id, fallback to name)
  const getMaterialForProduct = (product: Product) => {
    return materials?.find(m => m.shopify_product_id === product.id) 
      || materials?.find(m => !m.shopify_product_id && m.name === product.name);
  };

  // Helper: get variant mappings for a material
  const getMappingsForMaterial = (materialId: string) => {
    return (allVariantMappings || []).filter(v => v.raw_material_id === materialId);
  };

  // Helper: calculate stock for a variant given material qty
  const calcStock = (materialQty: number, qtyPerUnit: number) => {
    return Math.max(0, Math.floor(materialQty / qtyPerUnit));
  };

  // Helper: parse weight in grams from variant title (e.g. "250g" → 250, "1kg" → 1000)
  const parseWeightFromTitle = (title: string): number => {
    const kgMatch = title.match(/([\d.,]+)\s*kg/i);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1].replace(',', '.')) * 1000);
    const gMatch = title.match(/([\d.,]+)\s*g/i);
    if (gMatch) return Math.round(parseFloat(gMatch[1].replace(',', '.')));
    return 0;
  };

  // Group product variants by title (dedup Retail/Wholesale)
  const getGroupedVariants = (product: Product) => {
    const variants = product.variants || [];
    return Object.values(
      variants.reduce<Record<string, { title: string; variantIds: string[]; types: string[] }>>((acc, v: any) => {
        if (!acc[v.title]) {
          acc[v.title] = { title: v.title, variantIds: [], types: [] };
        }
        acc[v.title].variantIds.push(v.id);
        acc[v.title].types.push(v.type || 'Retail');
        return acc;
      }, {})
    );
  };

  // Open product detail
  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    const material = getMaterialForProduct(product);
    setEditingBulkQty(material ? String(material.quantity_available) : "");
    setBulkUnit(material?.unit || "g");

    // Pre-fill variant quantities: from existing mappings first, then parse from Shopify title
    const grouped = getGroupedVariants(product);
    const qtyMap: Record<string, string> = {};
    const mappings = material ? getMappingsForMaterial(material.id) : [];
    for (const group of grouped) {
      const mapping = mappings.find(m => group.variantIds.includes(m.shopify_variant_id));
      if (mapping) {
        qtyMap[group.title] = String(mapping.quantity_per_unit);
      } else {
        // Auto-parse weight from title (e.g. "250g" → 250)
        const parsed = parseWeightFromTitle(group.title);
        if (parsed > 0) qtyMap[group.title] = String(parsed);
      }
    }
    setVariantQtyMap(qtyMap);

    setDetailOpen(true);
  };

  // Save product inventory config + auto-sync to Shopify (closes dialog immediately)
  const handleSaveProduct = async () => {
    if (!selectedProduct || !editingBulkQty) return;

    const productToSave = selectedProduct;
    const bulkQtyValue = parseFloat(editingBulkQty);
    const unitValue = bulkUnit;
    const variantQtySnapshot = { ...variantQtyMap };

    // Close dialog immediately
    setDetailOpen(false);
    toast.info("Saving and syncing...");

    try {
      let material = getMaterialForProduct(productToSave);

      if (!material) {
        const result = await addMaterial.mutateAsync({
          name: productToSave.name,
          quantity_available: bulkQtyValue,
          unit: unitValue,
        });
        material = result;
        // Set shopify_product_id on newly created material
        await supabase
          .from('raw_materials')
          .update({ shopify_product_id: productToSave.id, name: productToSave.name } as any)
          .eq('id', result.id);
      } else {
        await updateMaterial.mutateAsync({
          id: material.id,
          quantity_available: bulkQtyValue,
          unit: unitValue,
        });
        // Always sync shopify_product_id and name
        await supabase
          .from('raw_materials')
          .update({ shopify_product_id: productToSave.id, name: productToSave.name } as any)
          .eq('id', material.id);
      }

      await queryClient.invalidateQueries({ queryKey: ['raw_materials'] });

      const { data: freshMaterials } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('shopify_product_id', productToSave.id)
        .single();

      const materialId = freshMaterials?.id || material?.id;
      if (!materialId) throw new Error('Could not find material');

      const existingMappings = getMappingsForMaterial(materialId);
      const grouped = getGroupedVariants(productToSave);

      for (const group of grouped) {
        const qtyStr = variantQtySnapshot[group.title];
        const qty = qtyStr ? parseFloat(qtyStr) : 0;

        if (qty > 0) {
          const existingForGroup = existingMappings.filter(m => group.variantIds.includes(m.shopify_variant_id));
          if (existingForGroup.length > 0) {
            for (const existing of existingForGroup) {
              if (existing.quantity_per_unit !== qty) {
                await supabase.from('raw_material_variants').update({ quantity_per_unit: qty }).eq('id', existing.id);
              }
            }
          } else {
            for (const variantId of group.variantIds) {
              await linkVariant.mutateAsync({
                raw_material_id: materialId,
                shopify_variant_id: variantId,
                shopify_product_name: productToSave.name,
                shopify_variant_title: group.title,
                quantity_per_unit: qty,
              });
            }
          }
        } else {
          const existingForGroup = existingMappings.filter(m => group.variantIds.includes(m.shopify_variant_id));
          for (const existing of existingForGroup) {
            await unlinkVariant.mutateAsync(existing.id);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] });

      // Auto-reconcile: fix stale shopify_variant_ids by matching on variant title
      const { data: currentMappings } = await supabase
        .from('raw_material_variants')
        .select('*')
        .eq('raw_material_id', materialId);

      if (currentMappings && productToSave.variants) {
        for (const mapping of currentMappings) {
          const shopifyVariant = (productToSave.variants as any[]).find(
            (v: any) => String(v.id) === mapping.shopify_variant_id
          );
          if (!shopifyVariant) {
            // ID is stale — find the correct variant by matching title + type
            const correctVariant = (productToSave.variants as any[]).find((v: any) => {
              const titleMatch = v.title === mapping.shopify_variant_title;
              // Also check if no other mapping already uses this variant id
              const notAlreadyMapped = !currentMappings.some(
                m => m.id !== mapping.id && m.shopify_variant_id === String(v.id)
              );
              return titleMatch && notAlreadyMapped;
            });
            if (correctVariant) {
              await supabase
                .from('raw_material_variants')
                .update({ shopify_variant_id: String(correctVariant.id) })
                .eq('id', mapping.id);
              console.log(`[RECONCILE] Fixed variant mapping: ${mapping.shopify_variant_id} → ${correctVariant.id} (${mapping.shopify_variant_title})`);
            }
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['raw_material_variants'] });
      }

      // Auto-sync to Shopify in background
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-inventory', {
        body: { dry_run: false },
      });
      if (syncError) throw syncError;

      const successes = syncData.results?.filter((r: any) => r.success).length || 0;
      const deductionCount = syncData.deductions?.length || 0;
      setLastSyncDeductions(syncData.deductions || []);
      await queryClient.invalidateQueries({ queryKey: ['raw_materials'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory_deductions'] });

      toast.success(
        `${productToSave.name}: ${successes} variants synced${deductionCount > 0 ? `, ${deductionCount} deductions` : ''}`
      );
    } catch (e: any) {
      toast.error("Sync error: " + e.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link to="/admin/orders">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
           <p className="text-sm text-muted-foreground">
              Click on a coffee to configure bulk quantity and variants.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

      </div>

      {/* Product Cards Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {coffeeProducts.map((product) => {
            const material = getMaterialForProduct(product);
            const mappings = material ? getMappingsForMaterial(material.id) : [];
            const isConfigured = !!material && mappings.length > 0;

            return (
              <Card
                key={product.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden group",
                  isConfigured ? "border-primary/30" : "border-border/50 opacity-75"
                )}
                onClick={() => handleOpenProduct(product)}
              >
                <div className="aspect-square relative overflow-hidden">
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute top-2 right-2">
                    {isConfigured ? (
                      <Badge className="bg-primary text-primary-foreground text-xs">{material?.quantity_available?.toLocaleString()}{material?.unit}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-background/80 text-xs">Not configured</Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-background/90 rounded-full p-1.5"><Settings2 className="w-4 h-4 text-foreground" /></div>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                  {isConfigured ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.values(
                        (mappings.reduce as any)((acc: Record<string, { title: string; qtyPerUnit: number }>, m: any) => {
                          if (!acc[m.shopify_variant_title]) acc[m.shopify_variant_title] = { title: m.shopify_variant_title, qtyPerUnit: m.quantity_per_unit };
                          return acc;
                        }, {})
                      ).map(({ title, qtyPerUnit }) => (
                        <Badge key={title} variant="outline" className="text-xs">{title}: {calcStock(material!.quantity_available, qtyPerUnit)} un</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Click to configure</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Bulk Stock</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coffeeProducts.map((product) => {
                const material = getMaterialForProduct(product);
                const mappings = material ? getMappingsForMaterial(material.id) : [];
                const isConfigured = !!material && mappings.length > 0;

                return (
                  <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenProduct(product)}>
                    <TableCell>
                      <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded object-cover" />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {material ? (
                        <span className="font-mono text-sm">{material.quantity_available.toLocaleString()}{material.unit}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isConfigured ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.values(
                            (mappings.reduce as any)((acc: Record<string, { title: string; qtyPerUnit: number }>, m: any) => {
                              if (!acc[m.shopify_variant_title]) acc[m.shopify_variant_title] = { title: m.shopify_variant_title, qtyPerUnit: m.quantity_per_unit };
                              return acc;
                            }, {})
                          ).map(({ title, qtyPerUnit }) => (
                            <Badge key={title} variant="outline" className="text-xs">{title}: {calcStock(material!.quantity_available, qtyPerUnit)} un</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not mapped</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isConfigured ? (
                        <Badge className="bg-primary text-primary-foreground text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Deduction History */}
      {true ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4" />
                Deduction History
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={backfilling}
                  onClick={async () => {
                    setBackfilling(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-order-deductions`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${session?.access_token}`,
                          'Content-Type': 'application/json',
                        },
                      });
                      const result = await res.json();
                      if (result.error) throw new Error(result.error);
                      toast.success(`Backfill complete: ${result.processed} orders processed`);
                      queryClient.invalidateQueries({ queryKey: ['inventory_deductions'] });
                    } catch (e: any) {
                      toast.error(`Backfill failed: ${e.message}`);
                    } finally {
                      setBackfilling(false);
                    }
                  }}
                >
                  {backfilling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                  Refresh
                </Button>
              </div>
            </div>
            {lastSyncDeductions && lastSyncDeductions.length > 0 && (
              <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5">
                <p className="text-xs font-bold text-primary mb-2">Last sync</p>
                {lastSyncDeductions.map((d: any, i: number) => (
                  <p key={i} className="text-sm">
                    Order <span className="font-mono font-bold">{d.order_name}</span>: -{d.qty_deducted} from {d.material_name} ({d.product_name} - {d.variant_title})
                  </p>
                ))}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Deducted</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(deductionHistory || []).map((d: any) => {
                  const variantId = d.shopify_variant_id ? String(d.shopify_variant_id) : null;
                  const variantMapping = variantId
                    ? allVariantMappings?.find((v) => String(v.shopify_variant_id) === variantId)
                    : null;
                  const shopifyVariant = variantId
                    ? allShopifyVariants.find((v) => String(v.variantId) === variantId)
                    : null;
                  const isNoMapping = !d.shopify_variant_id && d.quantity_deducted === 0;
                  const variantLabel = isNoMapping
                    ? 'No mapped variants'
                    : (d.shopify_product_name && d.shopify_variant_title)
                      ? `${d.shopify_product_name} — ${d.shopify_variant_title}`
                      : variantMapping
                        ? `${variantMapping.shopify_product_name} — ${variantMapping.shopify_variant_title}`
                        : shopifyVariant
                          ? `${shopifyVariant.productName} — ${shopifyVariant.variantTitle}`
                          : d.shopify_variant_id || '—';

                  return (
                    <TableRow key={d.id} className={isNoMapping ? 'opacity-60' : ''}>
                      <TableCell className="font-mono text-sm">{d.shopify_order_name || d.shopify_order_id}</TableCell>
                      <TableCell className={cn("text-sm", isNoMapping && "italic text-muted-foreground")}>{variantLabel}</TableCell>
                      <TableCell className="text-right text-sm">{isNoMapping ? '—' : d.quantity_deducted}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleString('en-US')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {deductionTotalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t mt-3">
                <p className="text-xs text-muted-foreground">
                  {deductionPage * DEDUCTIONS_PER_PAGE + 1}–{Math.min((deductionPage + 1) * DEDUCTIONS_PER_PAGE, deductionTotal)} of {deductionTotal}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={deductionPage === 0}
                    onClick={() => setDeductionPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {deductionPage + 1} / {deductionTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={deductionPage >= deductionTotalPages - 1}
                    onClick={() => setDeductionPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Product Detail / Config Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedProduct && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <img
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div>
                    <DialogTitle>{selectedProduct.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.variants?.length || 0} variants on Shopify
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Bulk quantity */}
                <div>
                  <Label className="text-sm font-bold">Bulk Quantity</Label>
                  <p className="text-xs text-muted-foreground mb-2">How much of this coffee do you have in total stock (in grams, kg, etc.)</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Ex: 20000"
                      value={editingBulkQty}
                      onChange={e => setEditingBulkQty(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      value={bulkUnit}
                      onChange={e => setBulkUnit(e.target.value)}
                      className="w-16"
                      placeholder="g"
                    />
                  </div>
                </div>

                {/* Variant quantities */}
                <div>
                  <Label className="text-sm font-bold">Quantity per Variant</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    How much bulk each variant consumes (e.g. 1kg = 1000g)
                  </p>
                  <div className="space-y-2">
                    {getGroupedVariants(selectedProduct).map(group => {
                      const qty = variantQtyMap[group.title] || "";
                      const bulkQty = parseFloat(editingBulkQty) || 0;
                      const qtyPerUnit = parseFloat(qty) || 0;
                      const calculatedStock = qtyPerUnit > 0 ? Math.max(0, Math.floor(bulkQty / qtyPerUnit)) : 0;

                      return (
                        <div key={group.title} className="flex items-center gap-2 p-2 rounded-md border">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{group.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.types.join(' + ')}
                            </p>
                          </div>
                          <span className="text-sm font-medium w-24 text-right">{qty || "—"}</span>
                          <span className="text-xs text-muted-foreground w-6">{bulkUnit}</span>
                          {qtyPerUnit > 0 && (
                            <Badge variant={calculatedStock > 0 ? "default" : "destructive"} className="min-w-[3rem] justify-center">
                              {calculatedStock}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSaveProduct} disabled={!editingBulkQty}>
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminInventory;
