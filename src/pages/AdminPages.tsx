import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Loader2, Eye, EyeOff, Globe, UserCircle } from 'lucide-react';

const NAV_SLUGS = ['shop', 'subscriptions', 'about', 'brew-guides', 'support'];
const ACCOUNT_SLUGS = ['login', 'register', 'my-orders', 'cart'];

const AdminPages = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const { pageSettings, isLoading, togglePageVisibility } = usePageVisibility();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, isAdmin, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const navPages = pageSettings.filter((p) => NAV_SLUGS.includes(p.slug));
  const accountPages = pageSettings.filter((p) => ACCOUNT_SLUGS.includes(p.slug));

  const renderGroup = (
    title: string,
    description: string,
    icon: React.ReactNode,
    pages: typeof pageSettings
  ) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pages.map((page) => (
          <div
            key={page.slug}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              {page.is_visible ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{page.label}</p>
                <p className="text-sm text-muted-foreground">/{page.slug}</p>
              </div>
            </div>
            <Switch
              checked={page.is_visible}
              onCheckedChange={(checked) => togglePageVisibility(page.slug, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Page Visibility</h1>
        <p className="text-muted-foreground">
          Toggle pages on or off. Hidden pages won't appear in navigation and will redirect to home.
        </p>
      </div>

      {renderGroup(
        'Navigation Pages',
        'Main sections shown in the site menu',
        <Globe className="h-5 w-5 text-primary" />,
        navPages
      )}

      {renderGroup(
        'Account Pages',
        'User-facing account and cart pages',
        <UserCircle className="h-5 w-5 text-primary" />,
        accountPages
      )}
    </div>
  );
};

export default AdminPages;
