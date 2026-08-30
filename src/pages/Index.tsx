import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { BenQuote } from "@/components/BenQuote";
import { InteractiveHero } from "@/components/InteractiveHero";
import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { Product } from "@/types/product";
import featuredData from "@/data/featured.json";
import { Zap } from "lucide-react";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { usePageSEO } from "@/hooks/usePageSEO";
import { ComingSoon } from "@/components/ComingSoon";

interface IndexProps {
  isEntering?: boolean;
}

const Index = ({ isEntering = false }: IndexProps) => {
  const [brandSelected, setBrandSelected] = useState<"legendary" | "everyday" | null>(null);
  
  usePageSEO({
    title: "Legendary Everyday | Premium Specialty Coffee",
    description: "Discover Legendary Everyday's premium specialty coffee. Expertly roasted blends crafted for those who demand extraordinary taste in every cup.",
  });

  // JSON-LD Organization structured data
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Legendary Everyday",
      url: "https://legendaryeveryday.trhive.ai",
      logo: "https://legendaryeveryday.trhive.ai/favicon.png",
      description: "Premium specialty coffee roasted for extraordinary taste.",
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Fetch products from Shopify
  const { data: shopifyProducts, isLoading, isError } = useShopifyProducts();
  const products: Product[] = (shopifyProducts ?? []) as Product[];

  const legendaryProducts = products.filter(p => p.brand === "legendary" && p.category === "coffee");
  const everydayProducts = products.filter(p => p.brand === "everyday" && p.category === "coffee");
  const bensPicks = products.filter(p => p.bensPick);

  useEffect(() => {
    // Apply theme class to body based on selected brand
    document.body.className = brandSelected === "everyday" ? "theme-everyday" : "";
  }, [brandSelected]);

  const handleBrandSelect = (brand: "legendary" | "everyday" | null) => {
    setBrandSelected(brand);
    
    // Scroll to products when brand is selected
    if (brand) {
      setTimeout(() => {
        const productsSection = document.getElementById('products-section');
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  };

  return (
    <div className={`${!brandSelected ? 'hero-no-pad h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>
      {/* Brand-aware Header */}
      <Header 
        currentBrand={brandSelected}
        onBrandChange={handleBrandSelect}
        brandSwitchingEnabled={true}
        isEntering={isEntering}
      />
      
      {/* Interactive Hero Section */}
      <InteractiveHero onBrandSelect={handleBrandSelect} isEntering={isEntering} />

      {/* Products Section - Only visible when brand is selected */}
      {brandSelected && (
        <section id="products-section" className="py-16 bg-muted/30 animate-fade-in">
          <div className="container mx-auto px-4">
            {isLoading && (
              <div>
                <div className="mb-8">
                  <Skeleton className="h-10 w-64 mb-2" />
                  <Skeleton className="h-6 w-96" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && brandSelected === "legendary" && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-4xl font-display font-bold text-primary mb-2">
                      {featuredData.legendary.title}
                    </h2>
                    <p className="text-lg text-foreground">
                      {featuredData.legendary.subtitle}
                    </p>
                  </div>
                  <Link to="/coffee?brand=legendary">
                    <Button variant="outline" size="lg" className="border-[hsl(5_61%_68%)] text-[hsl(5_61%_68%)] hover:bg-[hsl(5_61%_68%/0.1)] hover:text-[hsl(5_61%_68%)]">View All Legendary</Button>
                  </Link>
                </div>
                
                {legendaryProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {legendaryProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="animate-stagger-fade-in"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ComingSoon />
                )}
              </div>
            )}

            {!isLoading && brandSelected === "everyday" && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-4xl font-display font-bold text-cream mb-2">
                      {featuredData.everyday.title}
                    </h2>
                    <p className="text-lg text-foreground">
                      {featuredData.everyday.subtitle}
                    </p>
                  </div>
                  <Link to="/coffee?brand=everyday">
                    <Button variant="outline" size="lg" className="border-[hsl(45_85%_95%)] text-[hsl(45_85%_95%)] hover:bg-[hsl(45_85%_95%/0.15)] hover:text-[hsl(45_85%_95%)]">View All Everyday</Button>
                  </Link>
                </div>
                
                {everydayProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {everydayProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="animate-stagger-fade-in"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ComingSoon />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Other sections only visible when no brand is selected */}
      {!brandSelected && (
        <>
          {/* Subscriptions Highlight */}
          <section className="py-16 bg-primary/5">
            <div className="container mx-auto px-4 text-center">
              <div className="max-w-3xl mx-auto">
                <Zap className="w-16 h-16 text-primary mx-auto mb-6" />
                <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                  Legendary taste, everyday ritual
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Never run out of your favorite coffee. Build your perfect subscription and save 15% on every delivery.
                </p>
                <Button size="lg" className="btn-legendary" asChild>
                  <Link to="/subscriptions">
                    Build-a-Box
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Ben's Corner */}
          <section className="py-16 bg-background">
            <div className="container mx-auto px-4">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
                    Ben's Corner
                  </h2>
                  
                  {/* BenCam Video Placeholder */}
                  <div className="aspect-video bg-muted rounded-xl mb-6 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold text-primary-foreground">▶</span>
                      </div>
                      <p className="text-sm text-muted-foreground">BenCam: Meet the guy behind the beans</p>
                    </div>
                  </div>
                  
                  <BenQuote 
                    quote="Coffee can be serious. We're not." 
                    size="lg"
                  />
                </div>

                <div>
                  <h3 className="text-2xl font-display font-bold mb-6">Ben's Picks</h3>
                  <div className="space-y-4">
                    {bensPicks.slice(0, 3).map((product) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-card">
                        <img 
                          src={product.images[0]} 
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-display font-semibold">{product.name}</h4>
                          <p className="text-sm text-muted-foreground">{product.description}</p>
                        </div>
                        <span className="font-display font-bold">€{product.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Footer */}
          <section className="py-16 gradient-hero">
            <div className="container mx-auto px-4 text-center text-cream">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Ready to find your perfect coffee?
              </h2>
                <p className="text-lg text-muted-foreground mb-8 opacity-90">
                  Join thousands of coffee lovers who've discovered their perfect blend with us.
                </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="outline" className="text-primary bg-cream hover:bg-cream/90" asChild>
                  <Link to="/coffee">
                    Shop All Coffee
                  </Link>
                </Button>
                <Button size="lg" className="bg-charcoal text-cream hover:bg-charcoal/90" asChild>
                  <Link to="/about">
                    Meet Ben & The Crew
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Index;
