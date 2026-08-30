import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Tag, Loader2 } from "lucide-react";

interface CreateCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CreateCustomerModal = ({ open, onOpenChange, onSuccess }: CreateCustomerModalProps) => {
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim() !== "" || phone.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {};
      if (firstName.trim()) payload.firstName = firstName.trim();
      if (lastName.trim()) payload.lastName = lastName.trim();
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (company.trim()) payload.company = company.trim();
      if (tags.trim()) payload.tags = tags.trim();
      if (note.trim()) payload.note = note.trim();
      if (acceptsMarketing) payload.acceptsMarketing = true;

      const { data, error } = await supabase.functions.invoke('shopify-create-customer', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const name = [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(" ") || data.customer?.email;
      toast({
        title: "Customer created",
        description: name ? `${name} has been added` : "New customer has been added",
      });

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Customer creation failed:', err);
      toast({
        title: "Failed to create customer",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setTags("");
    setNote("");
    setAcceptsMarketing(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Add Customer</DialogTitle>
          <DialogDescription className="sr-only">Create a new customer in Shopify</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* Customer Details */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Customer Details</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Phone (e.g. +353...)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <Input
                placeholder="Company"
                value={company}
                onChange={e => setCompany(e.target.value)}
              />
            </div>
          </section>

          {/* Additional Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Additional Info</h3>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Tags (e.g. wholesale, cafe, priority)"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
              <Textarea
                placeholder="Internal notes about this customer..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="min-h-[60px] text-sm"
              />
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
          </section>

        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    style={{ pointerEvents: !canSubmit ? 'none' : 'auto' }}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      "Create Customer"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canSubmit && (
                <TooltipContent>
                  Provide an email or phone number to create a customer
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCustomerModal;
