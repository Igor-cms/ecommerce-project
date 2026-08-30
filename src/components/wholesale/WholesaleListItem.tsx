import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useStockLevels } from "@/hooks/useStockLevels";
import { Product } from "@/types/product";
import { parseWeightFromTitle } from "@/utils/cartWeight";
import { isSamplePack } from "@/utils/samplePack";

interface WholesaleListItemProps {
  product: Product;
}

export const WholesaleListItem = ({ product }: WholesaleListItemProps) => {
  const { addItem, items, isSampleCheckLoading, sampleHasPurchased } = useCart();
  const { getAvailableUnits } = useStockLevels();
  const [isAdding, setIsAdding] = useState(false);

  const wholesaleVariants = (product.variants || [])
    .filter(v => v.type?.toLowerCase() === "wholesale")
    .sort((a, b) => a.price - b.price);

  const retailVariants = (product.variants || []).filter(
    v => !v.type || v.type.toLowerCase() !== "wholesale"
  );

  const [selectedVariant, setSelectedVariant] = useState(
    wholesaleVariants.length > 0 ? wholesaleVariants[0] : null
  );

  const displayPrice = selectedVariant ? selectedVariant.price : product.price;
  const matchingRetailVariant = retailVariants.find(
    rv => rv.title === selectedVariant?.title
  );
  const retailPrice = matchingRetailVariant?.price || product.price;
  const savingsPercent =
    retailPrice > displayPrice
      ? Math.round((1 - displayPrice / retailPrice) * 100)
      : 0;

  // Stock check
  const consolidatedMax = getAvailableUnits(selectedVariant?.id, items);
  const variantStock = selectedVariant?.inventory_quantity;
  const shopifyMax = typeof variantStock === 'number' ? Math.max(0, variantStock) : Infinity;
  const effectiveMax = Math.min(consolidatedMax, shopifyMax);
  const isOutOfStock = effectiveMax <= 0;

  const handleAddToCart = async () => {
    if (isOutOfStock || isAdding) return;
    setIsAdding(true);
    const productToAdd = selectedVariant
      ? { ...product, variantId: selectedVariant.id, price: selectedVariant.price }
      : product;
    const weightInGrams = selectedVariant
      ? parseWeightFromTitle(selectedVariant.title)
      : undefined;
    await addItem(productToAdd, 1, { weight: weightInGrams || undefined });
    setIsAdding(false);
  };

  return (
    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 border border-border/50 rounded-xl bg-card hover:shadow-product transition-all duration-300">
      {/* Image */}
      <Link
        to={`/product/${product.slug}?wholesale=true`}
        className="shrink-0"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link to={`/product/${product.slug}?wholesale=true`}>
          <h3 className="font-display font-semibold text-sm md:text-base leading-tight truncate">
            {product.name}
          </h3>
        </Link>

        {/* Variant selector */}
        {wholesaleVariants.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {wholesaleVariants.map(variant => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                className={cn(
                  "px-2 py-0.5 rounded-full border text-xs font-medium transition-colors",
                  selectedVariant?.id === variant.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                {variant.title}
              </button>
            ))}
          </div>
        )}

        {/* Coffee flavor notes */}
        {product.coffee && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {product.coffee.flavor_notes.slice(0, 2).map(note => (
              <Badge key={note} variant="outline" className="text-[10px] px-1.5 py-0">
                {note}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Price + Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1.5">
            {savingsPercent > 0 && (
              <span className="text-xs text-muted-foreground">
                RRP €{retailPrice.toFixed(2)}
              </span>
            )}
            <span className="font-display font-bold text-sm md:text-base">
              €{displayPrice.toFixed(2)}
            </span>
          </div>
        </div>
        {(() => {
          const isSample = isSamplePack(product.name);
          const sampleBlocked = isSample && sampleHasPurchased;
          return (
            <Button
              size="sm"
              className={cn(
                "min-h-[36px] font-semibold",
                product.brand === "legendary" ? "btn-legendary" : "btn-everyday"
              )}
              onClick={handleAddToCart}
              disabled={isOutOfStock || isAdding || isSampleCheckLoading || sampleBlocked}
            >
              <ShoppingCart className="w-4 h-4" />
              {sampleBlocked ? (
                <span className="ml-1 text-xs">Purchased</span>
              ) : isOutOfStock ? (
                <span className="ml-1 text-xs">Out</span>
              ) : null}
            </Button>
          );
        })()}
      </div>
    </div>
  );
};
