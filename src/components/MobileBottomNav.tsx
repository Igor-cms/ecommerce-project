import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, ShoppingCart, User, Heart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: typeof ShoppingBag;
  label: string;
  href: string;
  isCart?: boolean;
  authHref?: string;
};

const navItems: NavItem[] = [
  { icon: ShoppingBag, label: "Shop", href: "/coffee" },
  { icon: Heart, label: "Saved", href: "/favorites", authHref: "/login" },
  { icon: ShoppingCart, label: "Cart", href: "/cart", isCart: true },
  { icon: User, label: "Account", href: "/account", authHref: "/login" },
];

export const MobileBottomNav = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { totalItems, setCartOpen } = useCart();
  const { user } = useAuth();

  if (!isMobile) return null;

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ icon: Icon, label, href, isCart, authHref }) => {
          const targetHref = authHref && !user ? authHref : href;
          const active = isActive(href);

          if (isCart) {
            return (
              <button
                key={label}
                onClick={() => setCartOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors relative",
                  "text-muted-foreground active:scale-95"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={label}
              to={targetHref}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors active:scale-95",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
