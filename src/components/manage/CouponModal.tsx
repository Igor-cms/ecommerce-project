import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Loader2 } from "lucide-react";
import { ShopifyDiscount } from "@/hooks/useShopifyDiscounts";

interface CouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: ShopifyDiscount | null;
  onSuccess?: () => void;
}

type StatusValue = "active" | "disabled";

const CouponModal = ({ open, onOpenChange, coupon, onSuccess }: CouponModalProps) => {
  const { toast } = useToast();
  const isEdit = !!coupon;

  const [code, setCode] = useState("");
  const [percentage, setPercentage] = useState<string>("");
  const [status, setStatus] = useState<StatusValue>("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (coupon) {
        setCode(coupon.code ?? "");
        setPercentage(coupon.value_type === "percentage" ? String(coupon.value) : "");
        setStatus(coupon.status === "expired" ? "disabled" : "active");
      } else {
        setCode("");
        setPercentage("");
        setStatus("active");
      }
    }
  }, [open, coupon]);

  const pctNumber = Number(percentage);
  const canSubmit =
    code.trim() !== "" &&
    Number.isFinite(pctNumber) &&
    pctNumber >= 1 &&
    pctNumber <= 100;

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      if (isEdit && coupon) {
        const { data, error } = await supabase.functions.invoke("shopify-update-discount", {
          body: {
            price_rule_id: coupon.price_rule_id,
            discount_code_id: coupon.discount_code_id,
            code: code.trim().toUpperCase(),
            previous_code: coupon.code,
            percentage: pctNumber,
            status,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Coupon updated", description: code.trim().toUpperCase() });
      } else {
        const { data, error } = await supabase.functions.invoke("shopify-create-discount", {
          body: {
            code: code.trim().toUpperCase(),
            percentage: pctNumber,
            status,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Coupon created", description: code.trim().toUpperCase() });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Coupon save failed:", err);
      toast({
        title: isEdit ? "Failed to update coupon" : "Failed to create coupon",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {isEdit ? "Edit Coupon" : "Create Coupon"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Update this Shopify discount code" : "Create a new Shopify discount code"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Coupon Details
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Code</label>
            <Input
              placeholder="E.g. WELCOME10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Discount percentage</label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="10"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Coupon"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CouponModal;
