import { useState, useEffect, useRef, useCallback } from "react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle, XCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";



/* ─── Scroll reveal hook ─── */
const useScrollReveal = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
};

const RevealSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`scroll-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

/* ─── Stats data ─── */
const stats = [
  { value: "200+", label: "Partners" },
  { value: "48h", label: "Response Time" },
  { value: "15%", label: "Avg Savings" },
];

/* ─── Why us data ─── */
const reasons = [
  { title: "Curated Quality", desc: "Single-origin beans roasted to order — no compromises, no shortcuts." },
  { title: "Flexible Volumes", desc: "From 1 kg to 100+ kg per month, we scale with your business." },
  { title: "Dedicated Support", desc: "A real person managing your account, tastings, and growth." },
];

/* ─── Steps data ─── */
const steps = [
  { num: "01", title: "Apply", desc: "Fill out the form with your business details." },
  { num: "02", title: "Review", desc: "We evaluate your application within 48 hours." },
  { num: "03", title: "Start Ordering", desc: "Once approved, unlock wholesale pricing instantly." },
];

/* ─── Inline Form ─── */
type Step = "form" | "login" | "signup";

const WholesaleInlineForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refetch } = useWholesaleStatus();
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

  const resetAuthFields = () => {
    setPassword("");
    setConfirmPassword("");
    setAcceptTerms(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass = "bg-transparent border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors duration-300";

  const saveVatInfo = async () => {
    await supabase.functions.invoke("save-wholesale-vat", {
      body: {
        vat_number: vatExempt ? null : formData.vatNumber.trim() || null,
        vat_exempt: vatExempt,
      },
    });
  };

  const insertApplication = async (userId: string) => {
    await supabase.functions.invoke("submit-wholesale-application", {
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
  };

  const onSuccess = () => {
    toast({ title: "Application Submitted!", description: "We'll review it and get back to you within 2–3 business days." });
    refetch();
    setFormData({ businessName: "", contactName: "", email: "", phone: "", businessType: "", expectedVolume: "", additionalInfo: "", vatNumber: "" });
    setVatExempt(false);
    resetAuthFields();
    setFirstName("");
    setLastName("");
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await insertApplication(session.user.id);
        try { await saveVatInfo(); } catch (e) { console.error("VAT save failed:", e); }
        onSuccess();
        return;
      }

      // Not logged in — check if email exists
      const { data, error } = await supabase.functions.invoke("check-email-exists", {
        body: { email: formData.email },
      });
      if (error) throw error;

      const [first, ...rest] = formData.contactName.trim().split(" ");
      setFirstName(first || "");
      setLastName(rest.join(" ") || "");

      if (data.exists) {
        setStep("login");
      } else {
        setStep("signup");
      }
    } catch (error: any) {
      toast({ title: "Something went wrong", description: error.message || "Please try again.", variant: "destructive" });
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
      onSuccess();
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message || "Please check your credentials and try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both password fields match.", variant: "destructive" });
      return;
    }

    if (!acceptTerms) {
      toast({ title: "Terms required", description: "Please accept the terms and conditions to continue.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Account creation failed. Please try again.");

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      await insertApplication(data.user.id);
      try { await saveVatInfo(); } catch (e) { console.error("VAT save failed:", e); }
      onSuccess();
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || !formData.businessName || !formData.contactName || !formData.email || !formData.businessType;

  if (step === "login") {
    return (
      <form onSubmit={handleLogin} className="space-y-6">
        <p className="text-sm text-muted-foreground mb-2">An account with this email already exists. Sign in to submit your application.</p>

        <div className="bg-muted/30 p-4 space-y-1">
          <p className="text-xs tracking-editorial uppercase text-muted-foreground">Email</p>
          <p className="font-medium text-sm">{formData.email}</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Password *</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
            placeholder="Enter your password"
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setStep("form"); resetAuthFields(); }}
            className="flex-1 rounded-none py-6 text-sm tracking-editorial uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !password}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none py-6 text-sm tracking-editorial uppercase"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Signing in...</> : "Sign In & Submit"}
          </Button>
        </div>
      </form>
    );
  }

  if (step === "signup") {
    return (
      <form onSubmit={handleSignup} className="space-y-6">
        <p className="text-sm text-muted-foreground mb-2">Create an account to submit your wholesale application.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Label className="text-xs tracking-editorial uppercase text-muted-foreground">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} placeholder="First name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Last Name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Last name" />
          </div>
        </div>

        <div className="bg-muted/30 p-4 space-y-1">
          <p className="text-xs tracking-editorial uppercase text-muted-foreground">Email</p>
          <p className="font-medium text-sm">{formData.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="Min. 6 characters" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Confirm Password *</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} placeholder="Confirm password" />
          </div>
        </div>

        <div className="flex items-start space-x-3 pt-2">
          <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(checked === true)} className="mt-0.5" />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
            I accept the terms and conditions and privacy policy *
          </label>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setStep("form"); resetAuthFields(); }}
            className="flex-1 rounded-none py-6 text-sm tracking-editorial uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !password || !confirmPassword || !firstName || !acceptTerms}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none py-6 text-sm tracking-editorial uppercase"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : "Create & Submit"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Business Name *</Label>
        <Input value={formData.businessName} onChange={(e) => handleChange("businessName", e.target.value)} required className={inputClass} placeholder="Your business name" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Contact Name *</Label>
        <Input value={formData.contactName} onChange={(e) => handleChange("contactName", e.target.value)} required className={inputClass} placeholder="Your full name" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Email *</Label>
          <Input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} required className={inputClass} placeholder="your@email.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Phone</Label>
          <Input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} className={inputClass} placeholder="+1 (555) 123-4567" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Business Type *</Label>
          <Select value={formData.businessType} onValueChange={(v) => handleChange("businessType", v)}>
            <SelectTrigger className="bg-transparent border-0 border-b border-border rounded-none px-0 focus:ring-0 transition-colors duration-300">
              <SelectValue placeholder="Select type" />
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
        <div className="space-y-1">
          <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Monthly Volume</Label>
          <Select value={formData.expectedVolume} onValueChange={(v) => handleChange("expectedVolume", v)}>
            <SelectTrigger className="bg-transparent border-0 border-b border-border rounded-none px-0 focus:ring-0 transition-colors duration-300">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1-10kg">1–10 kg</SelectItem>
              <SelectItem value="11-50kg">11–50 kg</SelectItem>
              <SelectItem value="51-100kg">51–100 kg</SelectItem>
              <SelectItem value="100kg+">100+ kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs tracking-editorial uppercase text-muted-foreground">VAT Number</Label>
        <Input
          value={formData.vatNumber}
          onChange={(e) => handleChange("vatNumber", e.target.value)}
          disabled={vatExempt}
          maxLength={50}
          className={inputClass}
          placeholder="e.g. GB123456789"
        />
        <div className="flex items-start space-x-2 mt-2">
          <Checkbox
            id="vatExemptInline"
            checked={vatExempt}
            onCheckedChange={(checked) => {
              setVatExempt(!!checked);
              if (checked) handleChange("vatNumber", "");
            }}
            className="mt-0.5"
          />
          <label htmlFor="vatExemptInline" className="text-sm text-muted-foreground leading-tight cursor-pointer">
            I do not have a VAT number
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs tracking-editorial uppercase text-muted-foreground">Additional Information</Label>
        <Textarea
          value={formData.additionalInfo}
          onChange={(e) => handleChange("additionalInfo", e.target.value)}
          className="bg-transparent border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors duration-300 min-h-[80px] resize-none"
          placeholder="Tell us about your needs..."
        />
      </div>

      <Button
        type="submit"
        disabled={isDisabled}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-none py-6 text-sm tracking-editorial uppercase transition-all duration-300 hover:shadow-lg group"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking...</>
        ) : (
          <>Submit Application <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" /></>
        )}
      </Button>
    </form>
  );
};

/* ─── Status Card ─── */
const StatusCard = ({ status, isWholesale }: { status: string | null; isWholesale: boolean }) => {
  if (status === "pending") {
    return (
      <div className="text-center py-12 space-y-4">
        <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
        <h3 className="font-display text-2xl font-semibold">Under Review</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">Your application is being reviewed. We'll get back to you within 2–3 business days.</p>
        <div className="inline-block border border-border px-4 py-1.5 text-xs tracking-editorial uppercase text-muted-foreground">Pending</div>
      </div>
    );
  }

  if (isWholesale) {
    return (
      <div className="text-center py-12 space-y-4">
        <CheckCircle className="w-10 h-10 text-primary mx-auto" />
        <h3 className="font-display text-2xl font-semibold">You're Approved</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">Wholesale pricing is unlocked. Head to the shop to start ordering.</p>
        <div className="inline-block border border-primary px-4 py-1.5 text-xs tracking-editorial uppercase text-primary">Approved</div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="text-center py-12 space-y-4">
        <XCircle className="w-10 h-10 text-destructive mx-auto" />
        <h3 className="font-display text-2xl font-semibold">Not Approved</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">Unfortunately your application wasn't approved this time. Feel free to reach out for more information.</p>
        <div className="inline-block border border-destructive px-4 py-1.5 text-xs tracking-editorial uppercase text-destructive">Rejected</div>
      </div>
    );
  }

  return null;
};

/* ─── Main Page ─── */
const Wholesale = () => {
  usePageSEO({ title: "Wholesale", description: "Request wholesale access for bulk specialty coffee pricing from Legendary Everyday." });
  const { isWholesale, status } = useWholesaleStatus();
  const hasApplication = !!status;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-16 pb-10 md:pt-24 md:pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <RevealSection>
            <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-4">Partnership Program</p>
            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[0.95] mb-6">
              Wholesale
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground italic max-w-xl mx-auto">
              Specialty coffee for businesses that care about quality.
            </p>
          </RevealSection>

          {/* Decorative expanding line */}
          <div className="mt-8 flex justify-center">
            <div className="w-24 border-t border-primary/40 animate-expand-line origin-center" />
          </div>

          {/* Shipping info banner */}
          <RevealSection delay={100}>
            <div className="mt-8 mx-auto max-w-md border border-primary/30 bg-primary/5 rounded-sm px-6 py-4">
              <p className="text-xs tracking-editorial uppercase text-primary font-semibold mb-1">Wholesale Shipping</p>
              <p className="text-sm text-muted-foreground">Free shipping on wholesale orders above <span className="font-semibold text-foreground">€300</span></p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Two-column content + form */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">

          {/* Left — Content */}
          <div className="space-y-16">
            {/* Why Us */}
            <RevealSection delay={100}>
              <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-6">Why Partner With Us</p>
              <div className="space-y-6">
                {reasons.map((r) => (
                  <div key={r.title} className="border-l-2 border-primary/30 pl-5 transition-all duration-300 hover:border-primary">
                    <h3 className="font-display text-lg font-semibold mb-1">{r.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
            </RevealSection>



            {/* How it works */}
            <RevealSection delay={300}>
              <div className="border-t border-border pt-10">
                <p className="text-xs tracking-editorial uppercase text-muted-foreground mb-6">How It Works</p>
                <div className="space-y-5">
                  {steps.map((s) => (
                    <div key={s.num} className="flex gap-4 items-start">
                      <span className="font-display text-2xl font-semibold text-primary/40 leading-none mt-0.5">{s.num}</span>
                      <div>
                        <h4 className="font-display font-semibold text-sm">{s.title}</h4>
                        <p className="text-muted-foreground text-sm">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </RevealSection>
          </div>

          {/* Right — Form or Status */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <RevealSection delay={150}>
              <div className="border-2 border-primary/25 bg-primary/3 p-8 md:p-10 transition-all duration-300 hover:border-primary/50 hover:bg-primary/8">
                {hasApplication ? (
                  <StatusCard status={status} isWholesale={isWholesale} />
                ) : (
                  <>
                    <h2 className="font-display text-2xl font-semibold mb-1">Apply Now</h2>
                    <p className="text-sm text-muted-foreground mb-8">Fill out the form and we'll be in touch shortly.</p>
                    <WholesaleInlineForm />
                  </>
                )}
              </div>
            </RevealSection>
          </div>

        </div>
      </section>
    </div>
  );
};

export default Wholesale;
