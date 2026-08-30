import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RevenueModal from "@/components/manage/RevenueModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  Package,
  Users,
  BarChart3,
  Plus,
  Search,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useShopifyCustomers } from "@/hooks/useShopifyCustomers";
import { Skeleton } from "@/components/ui/skeleton";
import WholesaleTab from "@/components/manage/WholesaleTab";
import CustomersTab from "@/components/manage/CustomersTab";
import DiscountsTab from "@/components/manage/DiscountsTab";
import ProductDetailPanel from "@/components/manage/ProductDetailPanel";

import { Product } from "@/types/product";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateProductModal } from "@/components/CreateProductModal";

const Manage = () => {
  const queryClient = useQueryClient();
  const { data: products, isLoading, isError } = useShopifyProducts();
  const [activeTab, setActiveTab] = useState("products");
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [statsModal, setStatsModal] = useState<string | null>(null);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [searchProducts, setSearchProducts] = useState("");

  const { data: customerCount } = useQuery({
    queryKey: ["shopify-customers-count"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/shopify-customers?mode=count`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
      );
      if (!res.ok) throw new Error("Failed");
      return (await res.json()).count as number;
    },
    staleTime: 120_000,
  });

  // Fetch revenue from Shopify paid orders (admin-only on the edge function)
  const { data: revenueData } = useQuery({
    queryKey: ["shopify-revenue"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/shopify-orders?mode=revenue`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as { revenue: string; currency: string };
    },
    staleTime: 120_000,
  });

  // Fetch customers for modal (only when modal is open)
  const { data: customersData, isLoading: customersLoading } = useShopifyCustomers(
    "", ""
  );

  // Fetch favorites counts per product_slug (admin-only view)
  // Refetch every 30s as fallback; Supabase realtime will push updates on INSERT/DELETE
  const { data: favoriteCounts } = useQuery({
    queryKey: ["product-favorites-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_favorites_counts" as any)
        .select("product_slug, favorites_count");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        map[row.product_slug] = row.favorites_count;
      });
      return map;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchProducts.trim()) return products;
    const q = searchProducts.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q)
    );
  }, [products, searchProducts]);

  const formattedRevenue = revenueData
    ? `€${parseFloat(revenueData.revenue).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "--";

  const stats = {
    totalProducts: products?.length || 0,
    totalCustomers: customerCount ?? "--",
    revenue: formattedRevenue
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-4">Management Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Manage your products, orders, and business analytics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { key: "products", title: "Total Products", value: stats.totalProducts, icon: <Package className="h-4 w-4 text-muted-foreground" />, sub: products ? `${products.length} synced from Shopify` : "Loading..." },
            { key: "customers", title: "Customers", value: stats.totalCustomers, icon: <Users className="h-4 w-4 text-muted-foreground" />, sub: customerCount != null ? `${customerCount} synced from Shopify` : "Loading..." },
            { key: "revenue", title: "Revenue", value: stats.revenue, icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />, sub: revenueData ? "Total from paid orders" : "Loading..." },
          ].map((stat) => (
            <Card
              key={stat.key}
              className="cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/30"
              onClick={() => stat.key === "revenue" ? setRevenueModalOpen(true) : setStatsModal(stat.key)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                {stat.icon}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Modal */}
        <Dialog open={statsModal !== null} onOpenChange={(open) => !open && setStatsModal(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {statsModal === "products" && "All Products"}
                
                {statsModal === "customers" && "Customers"}
                {statsModal === "revenue" && "Revenue"}
                {statsModal === "products" && products && (
                  <span className="text-muted-foreground font-normal text-base ml-2">({products.length})</span>
                )}
                {statsModal === "customers" && customerCount != null && (
                  <span className="text-muted-foreground font-normal text-base ml-2">({customerCount})</span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {statsModal === "products" && products && products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => { setStatsModal(null); setViewProduct(product); }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={product.images[0]} alt={product.name} className="w-10 h-10 object-cover rounded" />
                    <div className="min-w-0">
                      <span className="font-semibold text-sm block truncate">{product.name}</span>
                      <span className="text-xs text-muted-foreground">€{product.price}</span>
                    </div>
                  </div>
                  <Badge variant={product.brand === "legendary" ? "default" : "secondary"}>
                    {product.brand}
                  </Badge>
                </div>
              ))}
              {statsModal === "products" && isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )}
              {statsModal === "customers" && customersData?.customers && customersData.customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-sm block truncate">{customer.name}</span>
                    <span className="text-xs text-muted-foreground">{customer.email}</span>
                  </div>
                  <div className="text-right text-sm shrink-0 ml-3">
                    <span className="font-medium">€{parseFloat(customer.total_spent).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground block">{customer.orders_count} orders</span>
                  </div>
                </div>
              ))}
              {statsModal === "customers" && customersLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <RevenueModal open={revenueModalOpen} onOpenChange={setRevenueModalOpen} />

        {/* Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Product Management</CardTitle>
                    <CardDescription>
                      Products synced from your Shopify store
                      {products && (
                        <span className="ml-1">· {filteredProducts.length} shown</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, description or brand..."
                        value={searchProducts}
                        onChange={(e) => setSearchProducts(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button size="sm" onClick={() => setCreateProductOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Create Product
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                        <Skeleton className="w-16 h-16 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-72" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isError && (
                  <p className="text-destructive">Failed to load products from Shopify. Please try again later.</p>
                )}
                {products && filteredProducts.length === 0 && searchProducts.trim() && (
                  <p className="text-muted-foreground text-center py-8">
                    No products found.
                  </p>
                )}
                {products && filteredProducts.length > 0 && (
                  <div className="space-y-4">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setViewProduct(product)}
                      >
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold">{product.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={product.brand === "legendary" ? "default" : "secondary"}>
                              {product.brand}
                            </Badge>
                            <span className="text-sm font-medium">€{product.price}</span>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0"
                          title={`${favoriteCounts?.[product.slug] ?? 0} favorites`}
                        >
                          <Heart className="w-4 h-4 text-pink-500" />
                          <span className="font-medium tabular-nums">
                            {favoriteCounts?.[product.slug] ?? 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>




          <TabsContent value="customers">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="coupons">
            <DiscountsTab />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Store Settings</CardTitle>
                <CardDescription>
                  Configure your store preferences and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input id="storeName" defaultValue="LEGENDARY EVERYDAY" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Store Description</Label>
                  <Textarea 
                    id="storeDescription" 
                    defaultValue="Premium coffee for legendary moments and everyday greatness."
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select defaultValue="eur">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button>Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="wholesale">
            <WholesaleTab />
          </TabsContent>
        </Tabs>

        <ProductDetailPanel product={viewProduct} onClose={() => setViewProduct(null)} />
        <CreateProductModal
          open={createProductOpen}
          onOpenChange={setCreateProductOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['shopify-products'] })}
        />
      </div>
    </div>
  );
};

export default Manage;