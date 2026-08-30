import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ShoppingCart, Heart, Share2, Star, MapPin, Droplets, Coffee, ChevronDown, Wheat, User } from "lucide-react";
import { ElevationDisplay } from "@/components/product/ElevationDisplay";
import { FlavorWheel } from "@/components/product/FlavorWheel";
import { cn } from "@/lib/utils";
import { BenQuote } from "@/components/BenQuote";
import { Product } from "@/types/product";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { parseWeightFromTitle } from "@/utils/cartWeight";
import { useStockLevels } from "@/hooks/useStockLevels";
import { isSamplePack } from "@/utils/samplePack";
import { useSamplePackEligibility } from "@/hooks/useSamplePackEligibility";

interface ProductInfoProps {
  product: Product;
  showWholesale?: boolean;
}

export const ProductInfo = ({ product, showWholesale = false }: ProductInfoProps) => {
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const isSample = isSamplePack(product.name);
  const { eligible: sampleEligible, hasPurchased: sampleAlreadyPurchased } = useSamplePackEligibility();

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

  const { getAvailableUnits } = useStockLevels();
  const consolidatedMax = getAvailableUnits(selectedVariant?.id, items);
  const inventoryQty = selectedVariant?.inventory_quantity;
  const hasInventoryTracking = inventoryQty !== undefined && inventoryQty !== null;
  const shopifyMax = hasInventoryTracking ? inventoryQty : Infinity;
  const maxQuantity = isSample ? Math.min(1, shopifyMax, consolidatedMax) : Math.min(shopifyMax, consolidatedMax);
  const isOutOfStock = maxQuantity <= 0;
  const isSampleBlocked = isSample && sampleAlreadyPurchased;

  useEffect(() => {
    if (hasInventoryTracking && quantity > maxQuantity) {
      setQuantity(Math.max(1, maxQuantity));
    }
  }, [selectedVariant]);

  const handleAddToCart = () => {
    if (isSampleBlocked) {
      toast({
        title: "Already purchased",
        description: "This product is limited to one purchase per customer.",
        variant: "destructive",
      });
      return;
    }
    const productToAdd = selectedVariant
      ? { ...product, variantId: selectedVariant.id, price: selectedVariant.price }
      : product;
    const weightInGrams = selectedVariant
      ? parseWeightFromTitle(selectedVariant.title)
      : undefined;
    addItem(productToAdd, quantity, { weight: weightInGrams });
  };

  const handleAddToWishlist = async () => {
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
  };

  const isCoffee = product.category === "coffee" && product.coffee;
  const isLegendary = product.brand === "legendary";

  return (
    <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      {/* Badges */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge
            variant="default"
            className="font-display uppercase tracking-wider"
          >
            {product.brand}
          </Badge>
          {product.bensPick && (
            <Badge variant="outline" className="border-secondary text-secondary-foreground bg-secondary/20">
              ⭐ Ben's Pick
            </Badge>
          )}
          {product.badges?.map((badge) => (
            <Badge key={badge} variant="outline" className="text-xs">
              {badge}
            </Badge>
          ))}
        </div>

        <h1 className="text-3xl lg:text-5xl font-display font-bold tracking-tight mb-3">
          {product.name}
        </h1>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">(24 reviews)</span>
        </div>

        {showWholesale && savingsPercent > 0 && (
          <p className="text-xs font-medium font-display uppercase tracking-wider text-muted-foreground">
            Wholesale Price
          </p>
        )}
        <p className="text-3xl font-display font-bold text-primary">
          €{displayPrice.toFixed(2)}
        </p>
        {showWholesale && retailPrice > displayPrice && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              RRP €{retailPrice.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-border/60" />

      {/* Description */}
      {product.description && (() => {
        const cleanedDescription = product.description.replace(/^Description:\s*/i, '');
        const firstSentenceMatch = cleanedDescription.match(/^[^.!?]+[.!?]/);
        const leadSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : cleanedDescription;
        const restOfDescription = firstSentenceMatch
          ? cleanedDescription.slice(firstSentenceMatch[0].length).trim()
          : "";
        const hasMore = restOfDescription.length > 0;

        return (
          <div className="space-y-3">
            <h3 className="text-sm font-medium font-display uppercase tracking-wider text-muted-foreground">
              {isCoffee ? "About This Coffee" : "About This Product"}
            </h3>
            <div className="border-l-2 border-primary/50 pl-4 space-y-2">
              <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
                {leadSentence}
              </p>
              {hasMore && (
                <Collapsible>
                  <CollapsibleContent>
                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base whitespace-pre-line pt-2">
                      {restOfDescription}
                    </p>
                  </CollapsibleContent>
                  <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-1 group">
                    <span className="group-data-[state=open]:hidden">Read more</span>
                    <span className="hidden group-data-[state=open]:inline">Read less</span>
                    <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                </Collapsible>
              )}
              {!hasMore && null}
            </div>
          </div>
        );
      })()}

      {/* Coffee-specific details */}
      {isCoffee && (
        <>
          {/* Coffee Specifications */}
          {(() => {
            const isValidSpec = (val?: string) => {
              if (!val?.trim()) return false;
              const placeholders = ['unknown', 'desconhecido', 'n/a', '—', '-'];
              return !placeholders.includes(val.trim().toLowerCase());
            };
            const hasOrigin = isValidSpec(product.coffee!.origin);
            const hasProducer = isValidSpec(product.coffee!.producer);
            const hasHarvest = isValidSpec(product.coffee!.harvest);
            const hasElevation = !!product.coffee!.elevation_m && product.coffee!.elevation_m > 0;
            const hasVariety = isValidSpec(product.coffee!.variety);
            const hasProcessing = isValidSpec(product.coffee!.process);
            const hasAnySpec = hasOrigin || hasProducer || hasHarvest || hasElevation || hasVariety || hasProcessing;
            if (!hasAnySpec) return null;

            const SpecCard = ({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: string }) => (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
                <Icon className="w-6 h-6 text-primary shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            );

            return (
              <div className="space-y-3">
                <h3 className="text-sm font-medium font-display uppercase tracking-wider text-muted-foreground">
                  Coffee Specifications
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {hasOrigin && (
                    <SpecCard icon={MapPin} label="Origin" value={product.coffee!.origin} />
                  )}
                  {hasProducer && (
                    <SpecCard icon={User} label="Producer" value={product.coffee!.producer!} />
                  )}
                  {hasHarvest && (
                    <SpecCard icon={Wheat} label="Harvest" value={product.coffee!.harvest!} />
                  )}
                  {hasElevation && (
                    <ElevationDisplay elevation_m={product.coffee!.elevation_m} />
                  )}
                  {hasVariety && (
                    <SpecCard icon={Coffee} label="Variety" value={product.coffee!.variety} />
                  )}
                  {hasProcessing && (
                    <SpecCard icon={Droplets} label="Processing" value={product.coffee!.process} />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Flavor Wheel */}
          {product.coffee!.flavor_notes && product.coffee!.flavor_notes.length > 0 && (
            <FlavorWheel flavorNotes={product.coffee!.flavor_notes} />
          )}

          {/* Ben's Quote */}
          {product.coffee!.benQuote && (
            <BenQuote quote={product.coffee!.benQuote} size="sm" />
          )}
        </>
      )}

      <Separator className="bg-border/60" />

      {/* Weight Variant Selector */}
      {hasVariants && (
        <div className="space-y-2">
          <label className="text-sm font-medium font-display uppercase tracking-wider">
            Weight
          </label>
          <div className="flex flex-wrap gap-2">
            {filteredVariants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  selectedVariant?.id === variant.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {variant.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator className="bg-border/60" />

      {/* Sample Pack limit warning */}
      {isSampleBlocked && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">
            This product is limited to one purchase per customer. You have already purchased it.
          </p>
        </div>
      )}

      {/* Quantity & Add to Cart */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium font-display uppercase tracking-wider">
            Quantity
          </label>
          <div className="flex items-center rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-4 py-2.5 hover:bg-muted transition-colors text-lg font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
              disabled={isOutOfStock}
            >
              −
            </button>
            <span className="px-5 py-2.5 min-w-[3.5rem] text-center font-medium border-x border-border">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={isOutOfStock || quantity >= maxQuantity}
              className={`px-4 py-2.5 hover:bg-muted transition-colors text-lg font-medium min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isOutOfStock || quantity >= maxQuantity ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              +
            </button>
          </div>
          {maxQuantity < Infinity && !isOutOfStock && (
            <span className="text-sm text-muted-foreground">
              {consolidatedMax < shopifyMax ? `${maxQuantity} available (shared stock)` : `${maxQuantity} available`}
            </span>
          )}
        </div>

        {/* Desktop action buttons */}
        <div className="hidden md:flex gap-3">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isSampleBlocked}
            className={`flex-1 flex items-center justify-center gap-2 btn-legendary ${
              isOutOfStock || isSampleBlocked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            {isSampleBlocked ? 'Already Purchased' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>

          <Button
            size="lg"
            variant="outline"
            className="rounded-xl h-auto py-4 px-4"
            onClick={handleAddToWishlist}
          >
            <Heart className={cn("w-5 h-5", isFavorite(product.slug) && "fill-current text-pink-500")} />
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="rounded-xl h-auto py-4 px-4"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile sticky add-to-cart */}
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-background/95 backdrop-blur-lg border-t border-border md:hidden z-40 flex gap-2">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isSampleBlocked}
            className={`flex-1 flex items-center justify-center gap-2 btn-legendary min-h-[48px] ${
              isOutOfStock || isSampleBlocked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            {isSampleBlocked ? 'Already Purchased' : isOutOfStock ? 'Out of Stock' : `Add to Cart — €${(displayPrice * quantity).toFixed(2)}`}
          </button>
          <Button
            variant="outline"
            onClick={handleAddToWishlist}
            className="rounded-xl min-h-[48px] min-w-[48px] px-3"
            aria-label={isFavorite(product.slug) ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-5 h-5", isFavorite(product.slug) && "fill-current text-pink-500")} />
          </Button>
        </div>
      </div>
    </div>
  );
};
