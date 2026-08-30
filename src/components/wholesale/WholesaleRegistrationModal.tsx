import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";

interface WholesaleRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagonal?: boolean;
  onSubmitSuccess?: () => void;
}

type Step = "form" | "login" | "signup";

export const WholesaleRegistrationModal = ({ open, onOpenChange, diagonal = false, onSubmitSuccess }: WholesaleRegistrationModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    businessType: "",
    expectedVolume: "",
    additionalInfo: "",
    vatNumber: "",
  });
  const [vatExempt, setVatExempt] = useState(false);

  // Auth fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  const resetAuthFields = () => {
    setPassword("");
    setConfirmPassword("");
    setAcceptTerms(false);
    setNewsletter(false);
  };

  const resetAll = () => {
    setStep("form");
    setFormData({
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      businessType: "",
      expectedVolume: "",
      additionalInfo: "",
      vatNumber: "",
    });
    setVatExempt(false);
    resetAuthFields();
    setFirstName("");
    setLastName("");
  };

  const saveVatInfo = async () => {
    await supabase.functions.invoke("save-wholesale-vat", {
      body: {
        vat_number: vatExempt ? null : formData.vatNumber.trim() || null,
        vat_exempt: vatExempt,
      },
    });
  };

  const insertApplication = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("submit-wholesale-application", {
      body: {
        user_id: userId,
        business_name: formData.businessName,
        contact_name: formData.contactName,
        email: formData.email,
        phone: formData.phone || null,
        business_type: formData.businessType,
        expected_volume: formData.expectedVolume || null,
        additional_info: formData.additionalInfo || null,
      },
    });
    if (error) throw error;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Already logged in — insert directly
        await insertApplication(session.user.id);
        try { await saveVatInfo(); } catch (e) { console.error("VAT save failed:", e); }
        toast({
          title: "Application Submitted!",
          description: "We'll review your wholesale application and get back to you within 2-3 business days.",
        });
        onSubmitSuccess?.();
        onOpenChange(false);
        resetAll();
        return;
      }

      // Not logged in — check if email exists
      const { data, error } = await supabase.functions.invoke("check-email-exists", {
        body: { email: formData.email },
      });

      if (error) throw error;

      // Split contactName for pre-filling
      const [first, ...rest] = formData.contactName.trim().split(" ");
      setFirstName(first || "");
      setLastName(rest.join(" ") || "");

      if (data.exists) {
        setStep("login");
      } else {
        setStep("signup");
      }
    } catch (error: any) {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password,
      });

      if (error) throw error;

      await insertApplication(data.user.id);
      try { await saveVatInfo(); } catch (e) { console.error("VAT save failed:", e); }

      toast({
        title: "Application Submitted!",
        description: "We'll review your wholesale application and get back to you within 2-3 business days.",
      });
      onSubmitSuccess?.();
      onOpenChange(false);
      resetAll();
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms required",
        description: "Please accept the terms and conditions to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Account creation failed. Please try again.");

      // Set session explicitly so auth.uid() works for RLS
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      await insertApplication(data.user.id);
      try { await saveVatInfo(); } catch (e) { console.error("VAT save failed:", e); }

      toast({
        title: "Application Submitted!",
        description: "Your account was created and your wholesale application is under review. We'll get back to you within 2-3 business days.",
      });
      onSubmitSuccess?.();
      onOpenChange(false);
      resetAll();
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetAll();
    }
    onOpenChange(open);
  };

  const stepTitle = {
    form: "Join Our Wholesale Family",
    login: "Sign In to Submit",
    signup: "Create Account to Submit",
  };

  const stepDescription = {
    form: "Partner with us to bring exceptional coffee to your customers",
    login: "An account with this email already exists. Sign in to submit your application.",
    signup: "Complete your registration to submit your wholesale application.",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${diagonal ? 'animate-diagonal-open' : 'animate-scale-in'}`}>
        <DialogHeader>
          <DialogTitle className="text-3xl font-display text-center mb-2">
            {stepTitle[step]}
          </DialogTitle>
          <p className="text-center text-muted-foreground">
            {stepDescription[step]}
          </p>
        </DialogHeader>

        {step === "form" && (
          <form onSubmit={handleSubmitForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="font-semibold">Business Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="Your business name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName" className="font-semibold">Contact Name *</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange("contactName", e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessType" className="font-semibold">Business Type *</Label>
                <Select value={formData.businessType} onValueChange={(value) => handleInputChange("businessType", value)}>
                  <SelectTrigger className="border-primary/20 focus:border-primary rounded-xl">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cafe">Café / Coffee Shop</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="retailer">Retailer</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedVolume" className="font-semibold">Expected Monthly Volume</Label>
                <Select value={formData.expectedVolume} onValueChange={(value) => handleInputChange("expectedVolume", value)}>
                  <SelectTrigger className="border-primary/20 focus:border-primary rounded-xl">
                    <SelectValue placeholder="Select volume range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10kg">1-10 kg</SelectItem>
                    <SelectItem value="11-50kg">11-50 kg</SelectItem>
                    <SelectItem value="51-100kg">51-100 kg</SelectItem>
                    <SelectItem value="100kg+">100+ kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatNumber" className="font-semibold">VAT Number</Label>
              <Input
                id="vatNumber"
                value={formData.vatNumber}
                onChange={(e) => handleInputChange("vatNumber", e.target.value)}
                disabled={vatExempt}
                maxLength={50}
                className="border-primary/20 focus:border-primary rounded-xl"
                placeholder="e.g. GB123456789"
              />
              <div className="flex items-start space-x-2 mt-2">
                <Checkbox
                  id="vatExemptForm"
                  checked={vatExempt}
                  onCheckedChange={(checked) => {
                    setVatExempt(!!checked);
                    if (checked) handleInputChange("vatNumber", "");
                  }}
                />
                <Label htmlFor="vatExemptForm" className="text-sm leading-tight cursor-pointer">
                  I do not have a VAT number
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalInfo" className="font-semibold">Additional Information</Label>
              <Textarea
                id="additionalInfo"
                value={formData.additionalInfo}
                onChange={(e) => handleInputChange("additionalInfo", e.target.value)}
                placeholder="Tell us about your business, specific requirements, or any questions you have..."
                className="border-primary/20 focus:border-primary min-h-[100px] rounded-xl"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.businessName || !formData.contactName || !formData.email || !formData.businessType}
                className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-semibold"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</> : "Submit Application"}
              </Button>
            </div>
          </form>
        )}

        {step === "login" && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-xl space-y-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{formData.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-primary/20 focus:border-primary rounded-xl"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("form"); resetAuthFields(); }}
                className="flex-1 rounded-xl gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !password}
                className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-semibold"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In & Submit"}
              </Button>
            </div>
          </form>
        )}

        {step === "signup" && (
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-semibold">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-semibold">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="font-semibold">Email</Label>
              <Input
                id="signupEmail"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                className="border-primary/20 focus:border-primary rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signupPassword" className="font-semibold">Password *</Label>
                <Input
                  id="signupPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="Min. 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-primary/20 focus:border-primary rounded-xl"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                />
                <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                  I accept the terms and conditions *
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="newsletter"
                  checked={newsletter}
                  onCheckedChange={(checked) => setNewsletter(checked === true)}
                />
                <Label htmlFor="newsletter" className="text-sm leading-tight cursor-pointer">
                  Subscribe to our newsletter for updates and offers
                </Label>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("form"); resetAuthFields(); }}
                className="flex-1 rounded-xl gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !password || !confirmPassword || !acceptTerms || !firstName}
                className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-semibold"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Account & Submit"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
