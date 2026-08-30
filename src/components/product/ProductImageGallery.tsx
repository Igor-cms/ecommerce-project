import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

export const ProductImageGallery = ({ images, productName }: ProductImageGalleryProps) => {
  const [selectedImage, setSelectedImage] = useState(0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Main Image */}
      <div className="aspect-square bg-muted rounded-2xl overflow-hidden shadow-product group">
        <img
          src={images[selectedImage]}
          alt={productName}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3 overflow-x-auto pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(index)}
              className={cn(
                "aspect-square bg-muted rounded-xl overflow-hidden transition-all duration-200 hover:opacity-90 shrink-0 w-16 md:w-auto",
                selectedImage === index
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <img
                src={image}
                alt={`${productName} ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
