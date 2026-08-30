import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePageSEO } from "@/hooks/usePageSEO";

const NotFound = () => {
  usePageSEO({ title: "Page Not Found" });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-8">
          <div className="text-8xl font-display font-bold text-primary mb-4">404</div>
          <div className="w-32 h-32 bg-muted rounded-full mx-auto mb-6 flex items-center justify-center">
            <span className="text-4xl">🏎️</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-display font-bold mb-4">
          Ben got lost in a roundabout
        </h1>
        <p className="text-muted-foreground mb-8">
          Looks like this page took a wrong turn. Don't worry, it happens to the best of us!
        </p>
        
        <div className="space-y-4">
          <Button size="lg" className="btn-legendary w-full" asChild>
            <Link to="/">
              Back to Home
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link to="/coffee">
              Shop Coffee Instead
            </Link>
          </Button>
        </div>
        
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground italic">
            "Sometimes the best discoveries happen when you're completely lost!"
          </p>
          <p className="text-xs font-medium mt-1 text-primary">- Ben</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
