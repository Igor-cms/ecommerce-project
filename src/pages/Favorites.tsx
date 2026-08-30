import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePageSEO } from "@/hooks/usePageSEO";
import productsData from "@/data/products.json";
import { Product } from "@/types/product";

const hasWholesaleVariant = (p: Product) =>
  (p.variants || []).some(v => v.type?.toLowerCase() === "wholesale");

const hasRetailVariant = (p: Product) =>
  (p.variants || []).some(v => !v.type || v.type.toLowerCase() !== "wholesale");

const Favorites = () => {
  usePageSEO({
    title: "Your Favorites",
    description: "Your saved products at Legendary Everyday.",
  });

  const { user } = useAuth();
  const { favoriteSlugList, refreshFavorites, loading: favLoading } = useFavorites();
  const { data: shopifyProducts, isLoading: productsLoading } = useShopifyProducts();
  const { isWholesale, isLoading: wholesaleLoading } = useWholesaleStatus();

  const products: Product[] =
    shopifyProducts && shopifyProducts.length > 0
      ? shopifyProducts
      : (productsData as Product[]);

  // When a user becomes wholesale, clean up retail-only favorites server-side (self-service).
  // This is a safety net in case the admin-side trigger was skipped or failed.
  const [recalculated, setRecalculated] = useState(false);
  useEffect(() => {
    if (!user || wholesaleLoading || recalculated) return;
    if (!isWholesale) return;
    if (favoriteSlugList.length === 0) return;
    setRecalculated(true);
    supabase.functions
      .invoke("recalculate-wholesale-favorites", { body: { user_id: user.id } })
      .then(({ data }) => {
        if (data?.count && data.count > 0) {
          refreshFavorites();
        }
      })
      .catch(() => {
        // Non-blocking — the UI filter below still hides incompatible products.
      });
  }, [user, isWholesale, wholesaleLoading, favoriteSlugList.length, recalculated, refreshFavorites]);

  const favoriteProducts = useMemo(() => {
    const slugSet = new Set(favoriteSlugList);
    return products
      .filter(p => slugSet.has(p.slug))
      .filter(p => (isWholesale ? hasWholesaleVariant(p) : hasRetailVariant(p)));
  }, [products, favoriteSlugList, isWholesale]);

  const isLoading = favLoading || productsLoading || wholesaleLoading;

  return (
    <div className="min-h-screen bg-background py-4 md:py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 md:mb-8 flex items-baseline gap-3">
          <Heart className="w-6 h-6 md:w-8 md:h-8 text-pink-500 fill-current" />
          <h1 className="text-2xl md:text-4xl font-display font-bold">Your Favorites</h1>
          {isWholesale && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              ✓ Wholesale
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {favoriteProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                showWholesale={isWholesale}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
            <p className="text-muted-foreground mb-6">
              Tap the heart on any product to save it here.
            </p>
            <Button asChild>
              <Link to={isWholesale ? "/coffee" : "/coffee"}>Browse coffee</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
