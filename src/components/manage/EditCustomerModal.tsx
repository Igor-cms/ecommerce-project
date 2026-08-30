import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShopifyCustomer } from "@/hooks/useShopifyCustomers";
import { sanitizePhoneOrThrow } from "@/utils/phoneValidation";

interface EditCustomerModalProps {
  customer: ShopifyCustomer;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditCustomerModal = ({ customer, onClose, onSuccess }: EditCustomerModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFirstName(customer.first_name ?? "");
    setLastName(customer.last_name ?? "");
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setTags(customer.tags ?? "");
    setNote(customer.note ?? "");
    setAcceptsMarketing(!!customer.accepts_marketing);
  }, [customer]);

  const canSubmit = (email || "").trim() !== "" || (phone || "").trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    let normalizedPhone: string | null = null;
    try {
      normalizedPhone = sanitizePhoneOrThrow(phone);
    } catch (err: any) {
      toast({
        title: "Invalid phone format",
        description: err?.message || "Please enter a valid international phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {
        customerId: customer.id,
        first_name: (firstName || "").trim(),
        last_name: (lastName || "").trim(),
        email: (email || "").trim(),
        phone: normalizedPhone,
        tags: (tags || "").trim(),
        note: (note || "").trim(),
        accepts_marketing: acceptsMarketing,
      };

      const { data, error } = await supabase.functions.invoke('admin-update-shopify-customer', {
        body: payload,
      });

      // Extract real Shopify error from FunctionsHttpError context if present
      let errorMessage: string | null = null;
      if (data?.error) {
        errorMessage = data.error;
      } else if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            errorMessage = body?.error || error.message;
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      if (errorMessage) throw new Error(errorMessage);

      const name = [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(" ") || data.customer?.email;
      toast({
        title: "Customer updated",
        description: name ? `${name} has been updated` : "Customer has been updated",
      });

      queryClient.invalidateQueries({ queryKey: ["shopify-customers"] });
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Customer update failed:', err);
      toast({
        title: "Failed to update customer",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Edit Customer</DialogTitle>
          <DialogDescription className="sr-only">Edit customer information in Shopify</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">First Name</label>
              <Input
                placeholder="First name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Last Name</label>
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Email and Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <Input
                type="tel"
                placeholder="+353871234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">International format with + (e.g. +353871234567)</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Tags</label>
            <Input
              placeholder="Tags (e.g. wholesale, cafe, priority)"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              placeholder="Internal notes about this customer..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Accepts Marketing */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="acceptsMarketing"
              checked={acceptsMarketing}
              onCheckedChange={(checked) => setAcceptsMarketing(checked === true)}
            />
            <label htmlFor="acceptsMarketing" className="text-sm cursor-pointer">
              Customer agreed to receive marketing emails
            </label>
          </div>

        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerModal;
