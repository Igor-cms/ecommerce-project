import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useIsMobile } from "@/hooks/use-mobile";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SamplePackConfirmDialog } from "@/components/cart/SamplePackConfirmDialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import Header from "@/components/Header";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Catalogue from "./pages/Catalogue";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Manage from "./pages/Manage";
import MeusPedidos from "./pages/MeusPedidos";
import OrderDetail from "./pages/OrderDetail";
import AdminOrders from "./pages/AdminOrders";
import AdminPages from "./pages/AdminPages";
import Carrinho from "./pages/Carrinho";
import Success from "./pages/Success";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Wholesale from "./pages/Wholesale";
import About from "./pages/About";
import Account from "./pages/Account";
import Favorites from "./pages/Favorites";
import AdminInventory from "./pages/AdminInventory";
import AdminRoastList from "./pages/AdminRoastList";
import { VatCollectionModal } from "@/components/wholesale/VatCollectionModal";

const queryClient = new QueryClient();

const VisibilityRoute = ({ slug, children }: { slug: string; children: React.ReactNode }) => {
  const { isPageVisible, isLoading } = usePageVisibility();
  if (isLoading) return <>{children}</>;
  return isPageVisible(slug) ? <>{children}</> : <Navigate to="/" replace />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  const location = useLocation();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuthContext();
  const location = useLocation();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RedirectIfAuthenticated = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  const [searchParams] = useSearchParams();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (user) return <Navigate to={searchParams.get("redirect") || "/account"} replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const hasShownLoading = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // If a password recovery link drops the user on any route with the recovery hash,
  // redirect to /reset-password preserving the hash so the recovery session is established there.
  const isRecoveryHash = typeof window !== 'undefined' && location.hash.includes('type=recovery');

  useEffect(() => {
    if (isRecoveryHash && location.pathname !== '/reset-password') {
      navigate('/reset-password' + location.hash, { replace: true });
    }
  }, [isRecoveryHash, location.pathname, location.hash, navigate]);

  useEffect(() => {
    // GA4 tracking is now handled by Google Tag Manager
  }, [location.pathname]);

  useEffect(() => {
    const isIndexPage = location.pathname === '/';

    if (isIndexPage && !hasShownLoading.current && !isMobile && !isRecoveryHash) {
      setIsLoading(true);
      setIsEntering(false);
    } else if (!isIndexPage) {
      setIsLoading(false);
    }
  }, [location.pathname, isMobile, isRecoveryHash]);

  const handleLoadingComplete = () => {
    setIsLoading(false);
    hasShownLoading.current = true;
    setIsEntering(true);
    setTimeout(() => setIsEntering(false), 1200);
  };

  return (
    <div className="mobile-nav-spacer">
      {isLoading ? (
        <LoadingScreen onComplete={handleLoadingComplete} />
      ) : (
        <Routes>
          <Route path="/" element={isMobile ? <Navigate to="/coffee" replace /> : <Index isEntering={isEntering} />} />
          <Route path="/shop" element={<VisibilityRoute slug="shop"><Header /><Catalogue /></VisibilityRoute>} />
          <Route path="/coffee" element={<VisibilityRoute slug="shop"><Header /><Catalogue /></VisibilityRoute>} />
          <Route path="/product/:id" element={<><Header /><ProductDetail /></>} />
          <Route path="/login" element={<VisibilityRoute slug="login"><RedirectIfAuthenticated><Header /><Login /></RedirectIfAuthenticated></VisibilityRoute>} />
          <Route path="/register" element={<VisibilityRoute slug="register"><RedirectIfAuthenticated><Header /><Register /></RedirectIfAuthenticated></VisibilityRoute>} />
          <Route path="/forgot-password" element={<VisibilityRoute slug="login"><Header /><ForgotPassword /></VisibilityRoute>} />
          <Route path="/reset-password" element={<VisibilityRoute slug="login"><Header /><ResetPassword /></VisibilityRoute>} />
          <Route path="/manage" element={<AdminRoute><Header /><Manage /></AdminRoute>} />
          <Route path="/my-orders" element={<VisibilityRoute slug="my-orders"><ProtectedRoute><Header /><MeusPedidos /></ProtectedRoute></VisibilityRoute>} />
          <Route path="/my-orders/:id" element={<VisibilityRoute slug="my-orders"><ProtectedRoute><Header /><OrderDetail /></ProtectedRoute></VisibilityRoute>} />
          <Route path="/admin/orders" element={<AdminRoute><Header /><AdminOrders /></AdminRoute>} />
          <Route path="/admin/pages" element={<AdminRoute><Header /><AdminPages /></AdminRoute>} />
          <Route path="/admin/inventory" element={<AdminRoute><Header /><AdminInventory /></AdminRoute>} />
          <Route path="/admin/roast-list" element={<AdminRoute><Header /><AdminRoastList /></AdminRoute>} />
          <Route path="/wholesale" element={<><Header /><Wholesale /></>} />
          <Route path="/about" element={<VisibilityRoute slug="about"><Header /><About /></VisibilityRoute>} />
          <Route path="/account" element={<ProtectedRoute><Header /><Account /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Header /><Favorites /></ProtectedRoute>} />
          <Route path="/cart" element={<VisibilityRoute slug="cart"><Header /><Carrinho /></VisibilityRoute>} />
          <Route path="/success" element={<><Header /><Success /></>} />
          <Route path="*" element={<><Header /><NotFound /></>} />
        </Routes>
        )}
        <VatCollectionModal />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <AppContent />
              <CartDrawer />
              <SamplePackConfirmDialog />
              <MobileBottomNav />
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
