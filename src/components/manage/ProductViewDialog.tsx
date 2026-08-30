import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Mountain, Beaker, Leaf, Flame, Coffee } from "lucide-react";
import { Product } from "@/types/product";
import { cn } from "@/lib/utils";

interface ProductViewDialogProps {
  product: Product | null;
  onClose: () => void;
}

const ProductViewDialog = ({ product, onClose }: ProductViewDialogProps) => {
  const [selectedImage, setSelectedImage] = useState(0);

  if (!product) return null;

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  return (
    <Dialog open={!!product} onOpenChange={() => { setSelectedImage(0); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Hero Image */}
        {product.images.length > 0 && (
          <div className="relative">
            <div className="aspect-[16/10] bg-muted overflow-hidden rounded-t-lg">
              <img
                src={product.images[selectedImage] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-muted/30">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "w-14 h-14 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all",
                      selectedImage === i
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl font-display leading-tight">
                {product.name}
              </DialogTitle>
              <span className="text-2xl font-bold text-primary whitespace-nowrap">
                €{product.price}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={product.brand === "legendary" ? "default" : "secondary"}>
                {product.brand}
              </Badge>
              <Badge variant="outline">{product.category}</Badge>
              {product.badges?.map((b) => (
                <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
              ))}
            </div>
            {product.description && (
              <DialogDescription className="text-sm leading-relaxed pt-1">
                {stripHtml(product.description)}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Coffee Details */}
          {product.coffee && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-primary" />
                  Coffee Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailItem icon={MapPin} label="Origin" value={product.coffee.origin} />
                  <DetailItem icon={Mountain} label="Elevation" value={`${product.coffee.elevation_m}m`} />
                  <DetailItem icon={Beaker} label="Process" value={product.coffee.process} />
                  <DetailItem icon={Leaf} label="Variety" value={product.coffee.variety} />
                  <DetailItem icon={Flame} label="Roast" value={product.coffee.roast_style} />
                  {product.coffee.flavor_notes.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Flavor Notes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {product.coffee.flavor_notes.map((note) => (
                          <span key={note} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold">Variants</h4>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <span>Variant</span>
                    <span>Type</span>
                    <span className="text-right">Price</span>
                  </div>
                  {product.variants.map((v, i) => (
                    <div
                      key={v.id}
                      className={cn(
                        "grid grid-cols-3 items-center px-4 py-2.5 text-sm",
                        i !== product.variants!.length - 1 && "border-b"
                      )}
                    >
                      <span>{v.title}</span>
                      <span>
                        <Badge variant={v.type === "Wholesale" ? "secondary" : "outline"} className="text-xs">
                          {v.type || "Retail"}
                        </Badge>
                      </span>
                      <span className="font-semibold text-right">€{v.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DetailItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  </div>
);

export default ProductViewDialog;
