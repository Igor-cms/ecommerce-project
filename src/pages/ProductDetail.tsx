import { useMemo, useEffect } from "react";
import { useParams, Link, useSearchParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Product } from "@/types/product";
import productsData from "@/data/products.json";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { usePageSEO } from "@/hooks/usePageSEO";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductTabs } from "@/components/product/ProductTabs";
import { ProductDetailSkeleton } from "@/components/product/ProductDetailSkeleton";

const ProductDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isWholesaleMode = searchParams.get('wholesale') === 'true';
  const { data: shopifyProducts, isLoading } = useShopifyProducts();
  const { isWholesale: isApprovedWholesale, isLoading: isWholesaleLoading } = useWholesaleStatus();

  const product = useMemo(() => {
    const allProducts = [
      ...(shopifyProducts || []),
      ...(productsData as Product[]),
    ];
    return allProducts.find(p => p.slug === id) || null;
  }, [shopifyProducts, id]);

  usePageSEO({
    title: product ? product.name : "Product",
    description: product?.description || "Premium specialty coffee from Legendary Everyday.",
  });

  // JSON-LD Product structured data
  useEffect(() => {
    if (!product) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.images?.[0],
      description: product.description,
      brand: { "@type": "Brand", name: "Legendary Everyday" },
      offers: {
        "@type": "Offer",
        price: product.price,
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [product]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (isLoading || (isWholesaleMode && isWholesaleLoading)) {
    return <ProductDetailSkeleton />;
  }

  if (isWholesaleMode && !isApprovedWholesale) {
    return <Navigate to="/wholesale" replace />;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <h2 className="text-2xl font-display font-semibold mb-4">Product not found</h2>
          <Link to="/shop">
            <Button className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 md:py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-4 md:mb-8 animate-fade-in hidden md:block">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={isWholesaleMode ? "/wholesale" : "/shop"}>
                    {isWholesaleMode ? "Wholesale" : "Shop"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{product.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Product Grid */}
        <div className="grid lg:grid-cols-2 gap-6 md:gap-12">
          <ProductImageGallery images={product.images} productName={product.name} />
          <ProductInfo product={product} showWholesale={isWholesaleMode} />
        </div>

        {/* Tabs section removed */}
      </div>
    </div>
  );
};

export default ProductDetail;
