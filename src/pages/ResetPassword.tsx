import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Coffee, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecoverySession(true);
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    return { minLength, hasNumber, hasLetter, isValid: minLength && hasNumber && hasLetter };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", description: "The passwords you entered are not the same.", variant: "destructive" });
      return;
    }

    const pv = validatePassword(formData.password);
    if (!pv.isValid) {
      toast({ title: "Invalid password", description: "Password must be at least 8 characters, including letters and numbers.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: formData.password });
      if (error) throw error;
      
      setPasswordReset(true);
      toast({ title: "Password changed!", description: "Your password has been reset successfully." });
    } catch (error: any) {
      toast({ title: "Error resetting password", description: error.message || "An error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Coffee className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!isRecoverySession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center">
          <Coffee className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-4">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">
            The password reset link is invalid or has expired.
          </p>
          <div className="space-y-3">
            <Button asChild><Link to="/forgot-password">Request New Link</Link></Button>
            <Button variant="outline" asChild><Link to="/login">Back to Login</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  if (passwordReset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold">Password Changed!</h1>
            <p className="text-muted-foreground mt-2">Your password has been reset successfully.</p>
          </div>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-6">You can now sign in with your new password.</p>
              <Button size="lg" className="w-full" asChild><Link to="/login">Sign In</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const passwordValidation = validatePassword(formData.password);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Coffee className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold">New Password</h1>
          <p className="text-muted-foreground mt-2">Create a new password for your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your new password" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} required />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.password && (
                  <div className="text-xs space-y-1 mt-2">
                    <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.minLength ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.hasLetter ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasLetter ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      At least one letter
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasNumber ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      At least one number
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your new password" value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} required />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !passwordValidation.isValid}>
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Remember your password? Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
