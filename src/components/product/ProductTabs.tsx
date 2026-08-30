import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Thermometer, Clock, Scale, Scissors } from "lucide-react";
import { Product } from "@/types/product";

interface ProductTabsProps {
  product: Product;
}

export const ProductTabs = ({ product }: ProductTabsProps) => {
  const isCoffee = product.category === "coffee" && product.coffee;

  return (
    <div className="mt-16 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <Tabs defaultValue="description" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-xl h-12">
          <TabsTrigger value="description" className="rounded-lg font-display uppercase tracking-wider text-xs">
            Description
          </TabsTrigger>
          {isCoffee && (
            <TabsTrigger value="brewing" className="rounded-lg font-display uppercase tracking-wider text-xs">
              Brewing Guide
            </TabsTrigger>
          )}
          <TabsTrigger value="reviews" className="rounded-lg font-display uppercase tracking-wider text-xs">
            Reviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="mt-8">
          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed text-base whitespace-pre-line">
              {product.description}
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <h4 className="font-display font-semibold mb-3 uppercase tracking-wider text-sm">
                  Product Details
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span>Category</span>
                    <span className="font-medium text-foreground capitalize">{product.category}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Brand</span>
                    <span className="font-medium text-foreground capitalize">{product.brand}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Availability</span>
                    <span className="font-medium text-foreground">In Stock</span>
                  </li>
                </ul>
              </div>

              {isCoffee && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <h4 className="font-display font-semibold mb-3 uppercase tracking-wider text-sm">
                    Coffee Specs
                  </h4>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Process</span>
                      <span className="font-medium text-foreground">{product.coffee!.process}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Variety</span>
                      <span className="font-medium text-foreground">{product.coffee!.variety}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Elevation</span>
                      <span className="font-medium text-foreground">{product.coffee!.elevation_m}m</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Roast Style</span>
                      <span className="font-medium text-foreground capitalize">{product.coffee!.roast_style}</span>
                    </li>
                  </ul>
                </div>
              )}

              {product.apparelOrMerch && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <h4 className="font-display font-semibold mb-3 uppercase tracking-wider text-sm">
                    Material & Sizing
                  </h4>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Material</span>
                      <span className="font-medium text-foreground">{product.apparelOrMerch.material}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Color</span>
                      <span className="font-medium text-foreground">{product.apparelOrMerch.color}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Sizes</span>
                      <span className="font-medium text-foreground">{product.apparelOrMerch.sizes.join(", ")}</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {isCoffee && (
          <TabsContent value="brewing" className="mt-8">
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { icon: Scale, title: "Ratio", desc: "1:15 to 1:17 coffee to water ratio" },
                { icon: Thermometer, title: "Temperature", desc: "195°F - 205°F (90°C - 96°C)" },
                { icon: Scissors, title: "Grind Size", desc: "Medium-coarse for pour over" },
                { icon: Clock, title: "Brew Time", desc: "4-6 minutes total brew time" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h5 className="font-display font-semibold text-sm uppercase tracking-wider mb-1">{title}</h5>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="reviews" className="mt-8">
          <div className="text-center py-12 rounded-xl bg-muted/20 border border-border/30">
            <div className="flex justify-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-secondary/40" />
              ))}
            </div>
            <p className="text-muted-foreground font-body">Reviews coming soon...</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Be the first to review this product</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
