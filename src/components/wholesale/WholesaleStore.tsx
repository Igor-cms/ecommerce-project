import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/ProductCard";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { Button } from "@/components/ui/button";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { Product } from "@/types/product";
import { Loader2, Filter, Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import { WholesaleListItem } from "@/components/wholesale/WholesaleListItem";
import { useSamplePackEligibility } from "@/hooks/useSamplePackEligibility";
import { isSamplePack } from "@/utils/samplePack";
import { ComingSoon } from "@/components/ComingSoon";

export const WholesaleStore = () => {
  const { data: shopifyProducts, isLoading } = useShopifyProducts();
  const { hasPurchased: sampleHasPurchased } = useSamplePackEligibility();

  const products = (shopifyProducts ?? []) as Product[];

  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [currentBrand, setCurrentBrand] = useState<"legendary" | "everyday" | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const hasActiveFilters = searchTerm !== "" || categoryFilter !== "all";

  useEffect(() => {
    let filtered = products.filter(p => 
      !(sampleHasPurchased && isSamplePack(p.name))
    );
    if (currentBrand !== "all") {
      filtered = filtered.filter(p => p.brand === currentBrand);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  }, [products, currentBrand, searchTerm, categoryFilter, sortBy, sampleHasPurchased]);

  const categories = [...new Set(products.map(p => p.category))] as string[];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 md:py-8">
      <div className="container mx-auto px-4">
        <div className="mb-4 md:mb-8">
          <div className="flex items-baseline justify-between mb-2 md:mb-4">
            <h1 className="text-2xl md:text-4xl font-display font-bold">Wholesale Store</h1>
             <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="relative shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                <span className="text-xs">Filters</span>
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm md:text-lg text-foreground mb-2">
            Everyday coffee's for your everyday,<br />
            Legendary coffee's for when<br />
            You want to be Legendary
          </p>

          <p className="text-xs md:text-sm text-muted-foreground/70 italic mt-1 mb-3 md:mb-4">
            * Images are renders of what our bags will look like. Until they arrive, products will come in stock white bags.
          </p>

          {/* Sticky Brand Switcher */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 md:relative md:bg-transparent md:backdrop-blur-none md:py-0 md:mx-0 md:px-0">
            <div className="flex justify-center mb-2 md:mb-4">
              <BrandSwitcher
                currentBrand={currentBrand}
                onBrandChange={setCurrentBrand}
                showAll
              />
            </div>

            {/* Mobile filters */}
            {filtersOpen && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-2 md:hidden mb-2">
                  <button
                    onClick={() => setSearchOpen(!searchOpen)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-background"
                  >
                    <Search className="w-4 h-4 text-foreground" />
                  </button>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="flex-1 h-10 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="flex-1 h-10 text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name A-Z</SelectItem>
                      <SelectItem value="price-low">Price ↑</SelectItem>
                      <SelectItem value="price-high">Price ↓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile search expanded */}
                {searchOpen && (
                  <div className="relative md:hidden mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 text-base placeholder:text-foreground"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop filters */}
          {filtersOpen && (
            <div className="hidden md:grid md:grid-cols-4 gap-4 mb-8 animate-fade-in">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 placeholder:text-foreground"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="price-low">Price Low-High</SelectItem>
                  <SelectItem value="price-high">Price High-Low</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center">
                <Badge variant="outline" className="text-sm">
                  {filteredProducts.length} products
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} showWholesale />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredProducts.map((product) => (
                <WholesaleListItem key={product.id} product={product} />
              ))}
            </div>
          )
        ) : hasActiveFilters ? (
          <div className="text-center py-16">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your filters.</p>
          </div>
        ) : (
          <ComingSoon />
        )}
      </div>
    </div>
  );
};
