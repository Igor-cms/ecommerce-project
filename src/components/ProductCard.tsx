import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Product } from "@/types/product";
import { ShoppingCart, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { parseWeightFromTitle } from "@/utils/cartWeight";
import { useStockLevels } from "@/hooks/useStockLevels";
import { isSamplePack } from "@/utils/samplePack";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  className?: string;
  showWholesale?: boolean;
}

export const ProductCard = ({ product, onAddToCart, className, showWholesale = false }: ProductCardProps) => {
  const { addItem, items, isSampleCheckLoading, sampleHasPurchased } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getAvailableUnits } = useStockLevels();
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const filteredVariants = (product.variants || []).filter(v =>
    showWholesale
      ? v.type?.toLowerCase() === 'wholesale'
      : !v.type || v.type.toLowerCase() !== 'wholesale'
  ).sort((a, b) => a.price - b.price);
  const hasVariants = filteredVariants.length > 1;
  const [selectedVariant, setSelectedVariant] = useState(
    filteredVariants.length > 0 ? filteredVariants[0] : null
  );
  const displayPrice = selectedVariant ? selectedVariant.price : product.price;

  // Wholesale savings calculation
  const retailVariants = (product.variants || []).filter(v =>
    !v.type || v.type.toLowerCase() !== 'wholesale'
  );
  const matchingRetailVariant = retailVariants.find(rv => rv.title === selectedVariant?.title);
  const retailPrice = matchingRetailVariant?.price || product.price;
  const savingsPercent = showWholesale && retailPrice > displayPrice
    ? Math.round((1 - displayPrice / retailPrice) * 100)
    : 0;

  const getBrandGradient = () => {
    return product.brand === "legendary" 
      ? "gradient-legendary" 
      : "gradient-everyday";
  };

  const getBadgeVariant = (badge: string) => {
    if (badge.includes("Limited") || badge.includes("Championship")) return "destructive";
    if (badge.includes("Ben")) return "secondary";
    return "default";
  };

  return (
    <TooltipProvider>
      <Card className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-product hover:-translate-y-1",
        "border border-border/50 shadow-card overflow-hidden flex flex-col h-full",
        className
      )}>
        <Link to={showWholesale ? `/product/${product.slug}?wholesale=true` : `/product/${product.slug}`}>
          <CardHeader className={cn("p-0 relative", getBrandGradient())}>
            <div className="aspect-square relative overflow-hidden">
              <img
                src={product.images[0]}
                alt={product.name}
                className={cn(
                  "w-full h-full object-cover transition-all duration-500",
                  "group-hover:scale-105",
                  !imageLoaded && "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" />
              )}
              
              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-1">
                {product.badges.map((badge) => (
                  <Badge 
                    key={badge} 
                    variant={getBadgeVariant(badge)}
                    className="text-xs font-medium wobble"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>

              {/* Ben's Pick Star */}
              {product.bensPick && (
                <div className="absolute top-3 right-3">
                  <div className="bg-gold/90 rounded-full p-1.5">
                    <Star className="w-4 h-4 text-charcoal fill-current" />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </Link>

        <CardContent className="p-2 md:p-4">
          <div className="space-y-1 md:space-y-2">
            <h3 className="font-display font-semibold text-sm md:text-lg leading-tight line-clamp-2">
              {product.name}
            </h3>
            <div className="flex items-center gap-1.5">
              {showWholesale && savingsPercent > 0 && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  Retail: <span>€{retailPrice.toFixed(2)}</span>
                </span>
              )}
              <span className="font-display font-bold text-sm md:text-lg">
                €{displayPrice.toFixed(2)}
              </span>
            </div>

            {/* Coffee specific info */}
            {product.coffee && (
              <div className="flex flex-wrap gap-0.5 md:gap-1 mt-1 md:mt-2">
                {product.coffee.flavor_notes.slice(0, 3).map((note) => (
                  <Badge key={note} variant="outline" className="text-[9px] md:text-xs px-1.5 py-0 md:px-2.5 md:py-0.5">
                    {note}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-2 md:p-4 pt-0 flex flex-col space-y-2 md:space-y-3 mt-auto">
          {/* Weight Variant Selector */}
          {hasVariants && (
            <div className="flex flex-wrap gap-1.5 w-full">
              {filteredVariants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedVariant(variant);
                  }}
                  className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full border text-xs font-medium transition-colors ${
                    selectedVariant?.id === variant.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {variant.title}
                </button>
              ))}
            </div>
          )}
          {/* Action Buttons */}
          <div className="flex gap-2 w-full">
            {(() => {
              const variantId = selectedVariant?.id;
              const consolidatedMax = getAvailableUnits(variantId, items);
              const variantStock = selectedVariant?.inventory_quantity;
              const shopifyMax = typeof variantStock === 'number' ? Math.max(0, variantStock) : Infinity;
              const effectiveMax = Math.min(consolidatedMax, shopifyMax);
              const isOutOfStock = effectiveMax <= 0;
              const isSample = isSamplePack(product.name);
              const sampleBlocked = isSample && sampleHasPurchased;
              return (
                <Button
                  size="sm"
                  className={cn(
                    "flex-1 font-semibold min-h-[44px]",
                    product.brand === "legendary" ? "btn-legendary" : "btn-everyday"
                  )}
                  disabled={isOutOfStock || isAdding || isSampleCheckLoading || sampleBlocked}
                  onClick={async () => {
                    const productToAdd = selectedVariant
                      ? { ...product, variantId: selectedVariant.id, price: selectedVariant.price }
                      : product;
                    const weightInGrams = selectedVariant
                      ? parseWeightFromTitle(selectedVariant.title)
                      : undefined;
                    if (onAddToCart) {
                      onAddToCart(productToAdd);
                    } else {
                      setIsAdding(true);
                      await addItem(productToAdd, 1, { weight: weightInGrams || undefined });
                      setIsAdding(false);
                    }
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-1 md:mr-2" />
                  {sampleBlocked ? (
                    <span>Already Purchased</span>
                  ) : isOutOfStock ? (
                    <span>Out of Stock</span>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Add to Cart</span>
                      <span className="sm:hidden">Add</span>
                    </>
                  )}
                </Button>
              );
            })()}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex min-h-[44px]"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!user) {
                      toast({
                        title: "Faça login para favoritar",
                        description: "Crie uma conta ou faça login para salvar seus cafés favoritos.",
                        action: <Button size="sm" variant="outline" onClick={() => navigate("/login")}>Login</Button>,
                      });
                      return;
                    }
                    const added = await toggleFavorite(product.slug);
                    toast({
                      title: added ? "Adicionado aos favoritos" : "Removido dos favoritos",
                      description: product.name,
                    });
                  }}
                >
                  <Heart className={cn("w-4 h-4", isFavorite(product.slug) && "fill-current text-pink-500")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFavorite(product.slug) ? "Remover dos favoritos" : "Adicionar aos favoritos"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
};