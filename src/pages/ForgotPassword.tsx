import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for recovery instructions.",
      });
    } catch (error) {
      toast({
        title: "Error sending email",
        description: "An error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-display font-bold">Email Sent!</h1>
            <p className="text-muted-foreground mt-2">
              Check your inbox
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  We've sent password recovery instructions to:
                </p>
                <p className="font-semibold text-primary">{email}</p>
                <p className="text-sm text-muted-foreground">
                  If you don't receive the email within a few minutes, check your spam folder.
                </p>
                
                <div className="space-y-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setEmailSent(false);
                      setEmail("");
                    }}
                  >
                    Try again
                  </Button>
                  
                  <Button variant="ghost" className="w-full" asChild>
                    <Link to="/login">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Login
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Coffee className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold">Forgot Password?</h1>
          <p className="text-muted-foreground mt-2">
            No worries! Enter your email to recover access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recover Password</CardTitle>
            <CardDescription>
              Enter the email associated with your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Instructions"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Need help?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            If you're still having trouble accessing your account, contact us:
          </p>
          <div className="space-y-1 text-sm">
            <p>📧 Email: support@legendaryeveryday.com</p>
            <p>📞 Phone: +351 XXX XXX XXX</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
