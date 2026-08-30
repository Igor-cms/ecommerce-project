import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShopifyCustomer } from "@/hooks/useShopifyCustomers";

interface ViewCustomerModalProps {
  customer: ShopifyCustomer;
  onClose: () => void;
}

const formatCurrency = (value: string, currency: string) => {
  const amount = parseFloat(value);
  if (Number.isNaN(amount)) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : "";
  return `${symbol}${amount.toFixed(2)}${symbol ? "" : ` ${currency}`}`;
};

const ViewCustomerModal = ({ customer, onClose }: ViewCustomerModalProps) => {
  const location = [customer.city, customer.country].filter(Boolean).join(", ") || "—";
  const tagList = customer.tags
    ? customer.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const address = customer.default_address;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name || customer.email || "Customer"}</DialogTitle>
          <DialogDescription className="sr-only">Customer details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">First Name</p>
              <p className="font-medium">{customer.first_name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Name</p>
              <p className="font-medium">{customer.last_name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium break-all">{customer.email || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{customer.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{location}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Marketing</p>
              <Badge variant="outline" className={customer.accepts_marketing ? "bg-green-100 text-green-800 border-green-300" : "text-muted-foreground"}>
                {customer.accepts_marketing ? "Subscribed" : "Not subscribed"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Orders</p>
              <p className="font-medium tabular-nums">{customer.orders_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount spent</p>
              <p className="font-medium tabular-nums">{formatCurrency(customer.total_spent, customer.currency || "EUR")}</p>
            </div>
          </div>

          {tagList.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {tagList.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {customer.note && (
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p className="font-medium whitespace-pre-wrap mt-1">{customer.note}</p>
            </div>
          )}

          {address && (address.address1 || address.city || address.country) && (
            <div>
              <p className="text-muted-foreground mb-1">Default Address</p>
              <div className="font-medium space-y-0.5">
                {address.address1 && <p>{address.address1}</p>}
                {address.address2 && <p>{address.address2}</p>}
                {(address.city || address.province || address.zip) && (
                  <p>{[address.city, address.province, address.zip].filter(Boolean).join(", ")}</p>
                )}
                {address.country && <p>{address.country}</p>}
                {address.phone && <p className="text-muted-foreground text-xs">{address.phone}</p>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewCustomerModal;
