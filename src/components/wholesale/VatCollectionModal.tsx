import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useWholesaleVat } from "@/hooks/useWholesaleVat";
import { useScrollLock } from "@/hooks/useScrollLock";
import { Loader2, FileText } from "lucide-react";

export const VatCollectionModal = () => {
  const { needsVatCollection, submitVat, isSubmitting } = useWholesaleVat();
  const [vatNumber, setVatNumber] = useState("");
  const [isExempt, setIsExempt] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useScrollLock(needsVatCollection);

  if (!needsVatCollection) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isExempt && vatNumber.trim().length === 0) {
      setError("Please enter your VAT number or check the box below.");
      return;
    }

    try {
      await submitVat({
        vat_number: isExempt ? null : vatNumber.trim(),
        vat_exempt: isExempt,
      });
      toast({
        title: "VAT information saved",
        description: "Thank you for providing your tax details.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save VAT information. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-primary" />
            <DialogTitle>VAT Number Required</DialogTitle>
          </div>
          <DialogDescription>
            As a wholesale customer, we need your VAT number for tax compliance.
            Please provide it below to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="vat-number">VAT Number</Label>
            <Input
              id="vat-number"
              placeholder="e.g. GB123456789"
              value={vatNumber}
              onChange={(e) => {
                setVatNumber(e.target.value);
                setError("");
              }}
              disabled={isExempt || isSubmitting}
              maxLength={50}
              className="text-base"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="vat-exempt"
              checked={isExempt}
              onCheckedChange={(checked) => {
                setIsExempt(!!checked);
                if (checked) {
                  setVatNumber("");
                  setError("");
                }
              }}
              disabled={isSubmitting}
            />
            <Label htmlFor="vat-exempt" className="text-sm leading-tight cursor-pointer">
              I do not have a VAT number
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
