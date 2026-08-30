import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  ShoppingCart, 
  Menu, 
  User,
  Heart,
  Package,
  FileText,
  Settings,
  Warehouse,
  Flame,
  ExternalLink
} from "lucide-react";
import { isRoastDay } from "@/hooks/useRoastList";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import FreeShippingBanner from "@/components/FreeShippingBanner";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface HeaderProps {
  currentBrand?: "legendary" | "everyday" | null;
  onBrandChange?: (brand: "legendary" | "everyday") => void;
  brandSwitchingEnabled?: boolean;
  isEntering?: boolean;
}

export const Header = ({ 
  currentBrand, 
  onBrandChange, 
  brandSwitchingEnabled = false,
  isEntering = false
}: HeaderProps) => {
  const { totalItems, setCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isPageVisible } = usePageVisibility();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();

  const slugMap: Record<string, string> = {
    '/shop': 'shop',
    '/coffee': 'shop',
    '/subscriptions': 'subscriptions',
    '/about': 'about',
    '/brew-guides': 'brew-guides',
    '/support': 'support',
    '/wholesale': 'wholesale',
  };

  const navigationItems = [
    {
      title: "Shop",
      href: "/coffee",
    },
    {
      title: "Subscriptions",
      href: "/subscriptions",
    },
    {
      title: "About",
      href: "/about",
    },
    {
      title: "Brew Guides",
      href: "/brew-guides",
    },
    {
      title: "Support",
      href: "/support",
    },
    {
      title: "Wholesale",
      href: "/wholesale",
    },
    ...(isAdmin ? [{
      title: "Admin",
      href: "/admin/orders",
      items: [
        { title: "Orders", href: "/admin/orders", icon: Package, description: "View and manage orders" },
        { title: "Pages", href: "/admin/pages", icon: FileText, description: "Toggle page visibility" },
        { title: "Manage", href: "/manage", icon: Settings, description: "Manage products & content" },
        { title: "Inventory", href: "/admin/inventory", icon: Warehouse, description: "Raw materials & stock sync" },
        { title: "Production", href: "/admin/roast-list", icon: Flame, description: "Weekly roast schedule", badge: isRoastDay() },
        { title: "Cogs System", href: "https://coffee.trhive.ai/dashboard/roaster", icon: ExternalLink, description: "Cost of goods & operations", external: true },
      ]
    }] : []),
  ].filter((item) => {
    const slug = slugMap[item.href];
    return slug ? isPageVisible(slug) : true;
  });

  const isActivePath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <>
    <div className={cn(
      "sticky top-0 z-50 w-full transition-transform duration-700 ease-out",
      isEntering ? "animate-slide-in-from-top" : ""
    )}>
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <BrandLogo
            currentBrand={currentBrand || "legendary"}
            onBrandChange={onBrandChange}
            interactive={true}
            linkTo={!brandSwitchingEnabled ? "/" : undefined}
          />

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  {item.items ? (
                    <>
                      <NavigationMenuTrigger className={cn(
                        "font-medium hover:bg-[hsl(5_61%_68%/0.1)] hover:text-[hsl(0_0%_17%)] focus:bg-[hsl(5_61%_68%/0.1)] focus:text-[hsl(0_0%_17%)] data-[state=open]:bg-[hsl(5_61%_68%/0.1)]",
                        isActivePath(item.href) && "text-primary"
                      )}>
                        {item.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid gap-3 p-6 w-[400px] lg:w-[500px] lg:grid-cols-2">
                          {item.items.map((subItem) => (
                            <NavigationMenuLink key={subItem.title} asChild>
                              {subItem.external ? (
                                <a
                                  href={subItem.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[hsl(5_61%_68%/0.1)] hover:text-[hsl(0_0%_17%)] focus:bg-[hsl(5_61%_68%/0.1)] focus:text-[hsl(0_0%_17%)]"
                                >
                                  <div className="flex items-center gap-2">
                                    <subItem.icon className="w-4 h-4 text-primary" />
                                    <div className="text-sm font-medium leading-none">
                                      {subItem.title}
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                    {subItem.description}
                                  </p>
                                </a>
                              ) : (
                                <Link
                                  to={subItem.href}
                                  className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[hsl(5_61%_68%/0.1)] hover:text-[hsl(0_0%_17%)] focus:bg-[hsl(5_61%_68%/0.1)] focus:text-[hsl(0_0%_17%)]"
                                >
                                  <div className="flex items-center gap-2">
                                    <subItem.icon className="w-4 h-4 text-primary" />
                                    <div className="text-sm font-medium leading-none">
                                      {subItem.title}
                                    </div>
                                    {subItem.badge && (
                                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    )}
                                  </div>
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                    {subItem.description}
                                  </p>
                                </Link>
                              )}
                            </NavigationMenuLink>
                          ))}
                        </div>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <NavigationMenuLink asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-[hsl(5_61%_68%/0.1)] hover:text-[hsl(0_0%_17%)] focus:bg-[hsl(5_61%_68%/0.1)] focus:text-[hsl(0_0%_17%)] focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-[hsl(5_61%_68%/0.1)] data-[state=open]:bg-[hsl(5_61%_68%/0.1)]",
                          isActivePath(item.href) && "text-primary"
                        )}
                      >
                        {item.title}
                      </Link>
                    </NavigationMenuLink>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right Actions */}
          <div className="flex items-center space-x-2">
            {/* Wishlist */}
            <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
              <Link
                to={user ? "/favorites" : "/login?redirect=%2Ffavorites"}
                aria-label="Favorites"
              >
                <Heart className={cn("w-4 h-4", isActivePath("/favorites") && "text-primary")} />
              </Link>
            </Button>

            {/* Account */}
            <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-1.5" asChild>
              <Link to={user ? "/account" : "/login"}>
                <User className="w-4 h-4" />
                {!user && <span className="text-xs font-medium">Log-in</span>}
              </Link>
            </Button>

            {/* Cart - hidden on mobile (in bottom nav) */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative hidden sm:flex"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="w-4 h-4" />
              {totalItems > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 px-1.5 py-0.5 text-xs min-w-[1.2rem] h-5"
                >
                  {totalItems}
                </Badge>
              )}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  {navigationItems.map((item) => (
                    <div key={item.title} className="space-y-2">
                      <Link
                        to={item.href}
                        className={cn(
                          "font-medium text-lg hover:text-primary transition-colors",
                          isActivePath(item.href) && "text-primary"
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.title}
                      </Link>
                      {item.items && (
                        <div className="grid gap-2 pl-4">
                          {item.items.map((subItem) => (
                            subItem.external ? (
                              <a
                                key={subItem.title}
                                href={subItem.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <subItem.icon className="w-4 h-4" />
                                {subItem.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <Link
                                key={subItem.title}
                                to={subItem.href}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <subItem.icon className="w-4 h-4" />
                                {subItem.title}
                                {subItem.badge && (
                                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                )}
                              </Link>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
    </div>
    <FreeShippingBanner />
    </>
  );
};

export default Header;