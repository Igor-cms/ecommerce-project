import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useWholesaleStatus } from "@/hooks/useWholesaleStatus";
import { useWholesaleVat } from "@/hooks/useWholesaleVat";
import { useShopifyOrders } from "@/hooks/useShopifyOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  LogOut,
  Package,
  ShoppingBag,
  Pencil,
  Save,
  X,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  getDisplayStatus,
  getStatusIcon,
  getStatusVariant,
  getStatusLabel,
} from "@/lib/orderStatus";

const Account = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  const { isWholesale } = useWholesaleStatus();
  const { vatInfo, isLoading: vatLoading, submitVat, isSubmitting } = useWholesaleVat();
  const [isEditingVat, setIsEditingVat] = useState(false);
  const [vatData, setVatData] = useState({ vat_number: "", vat_exempt: false });

  const { orders, loading: ordersLoading } = useShopifyOrders();

  usePageSEO({ title: "My Account", description: "Manage your Legendary Everyday account and order history." });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login?redirect=/account");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setEditData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (vatInfo) {
      setVatData({
        vat_number: vatInfo.vat_number || "",
        vat_exempt: vatInfo.vat_exempt,
      });
    }
  }, [vatInfo]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: editData.first_name || null,
        last_name: editData.last_name || null,
        phone: editData.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setIsEditing(false);

      // Sync profile data to Shopify (fire-and-forget)
      supabase.functions.invoke("sync-shopify-customer", {
        body: {
          first_name: editData.first_name,
          last_name: editData.last_name,
          phone: editData.phone,
        },
      }).catch((err) => console.error("Shopify sync error:", err));
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditData({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      phone: profile?.phone || "",
    });
    setIsEditing(false);
  };

  const handleSaveVat = async () => {
    try {
      await submitVat({
        vat_number: vatData.vat_exempt ? null : vatData.vat_number.trim() || null,
        vat_exempt: vatData.vat_exempt,
      });
      toast({ title: "VAT info updated", description: "Your VAT details have been saved and synced." });
      setIsEditingVat(false);
    } catch {
      toast({ title: "Error", description: "Failed to update VAT info.", variant: "destructive" });
    }
  };

  const handleCancelVat = () => {
    setVatData({
      vat_number: vatInfo?.vat_number || "",
      vat_exempt: vatInfo?.vat_exempt || false,
    });
    setIsEditingVat(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "User";

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-display font-bold mb-6">My Account</h1>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={editData.first_name}
                      onChange={(e) => setEditData((d) => ({ ...d, first_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={editData.last_name}
                      onChange={(e) => setEditData((d) => ({ ...d, last_name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editData.phone}
                    onChange={(e) => setEditData((d) => ({ ...d, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email (read-only)</Label>
                  <Input value={user.email || ""} disabled className="opacity-60" />
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{displayName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </p>
                    {profile?.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {profile.phone}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Member since</span>
                  <span>{new Date(user.created_at).toLocaleDateString('en-US')}</span>
                </div>
              </>
            )}

            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* VAT Card - only for wholesale users */}
        {isWholesale && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  VAT Information
                </CardTitle>
                <CardDescription>Your tax details (synced with Shopify)</CardDescription>
              </div>
              {!isEditingVat && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingVat(true)}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {vatLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : isEditingVat ? (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="vat_exempt"
                      checked={vatData.vat_exempt}
                      onCheckedChange={(checked) =>
                        setVatData((d) => ({ ...d, vat_exempt: !!checked }))
                      }
                    />
                    <Label htmlFor="vat_exempt">I do not have a VAT number</Label>
                  </div>
                  {!vatData.vat_exempt && (
                    <div className="space-y-2">
                      <Label htmlFor="vat_number">VAT Number</Label>
                      <Input
                        id="vat_number"
                        value={vatData.vat_number}
                        onChange={(e) => setVatData((d) => ({ ...d, vat_number: e.target.value }))}
                        placeholder="e.g. IE1234567T"
                      />
                    </div>
                  )}
                  <Separator />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={handleCancelVat} disabled={isSubmitting}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveVat} disabled={isSubmitting}>
                      <Save className="w-4 h-4 mr-1" />
                      {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </>
              ) : vatInfo ? (
                <div className="space-y-2 text-sm">
                  {vatInfo.vat_exempt ? (
                    <p className="text-muted-foreground">VAT exempt (no VAT number)</p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">VAT Number</span>
                      <span className="font-medium">{vatInfo.vat_number}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No VAT information on file.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Orders Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order History
              </CardTitle>
              <CardDescription>Your recent purchases</CardDescription>
            </div>
            {orders.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/my-orders">View All</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No orders yet</p>
                <Button asChild>
                  <a href="/shop">Start Shopping</a>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => {
                  const status = getDisplayStatus(order);
                  const StatusIcon = getStatusIcon(status);
                  const currency = order.currency === "EUR" ? "€" : order.currency;

                  return (
                    <Link
                      key={order.id}
                      to={`/my-orders/${order.id}`}
                      className="block group"
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">Order {order.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {order.line_items.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {order.line_items.slice(0, 2).map(item => item.title).join(", ")}
                              {order.line_items.length > 2 ? ` +${order.line_items.length - 2}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <div className="text-right">
                            <p className="font-semibold text-sm">
                              {currency}
                              {parseFloat(order.total_price).toFixed(2)}
                            </p>
                            <Badge
                              variant={getStatusVariant(status)}
                              className="text-xs mt-1 flex items-center gap-1 w-fit ml-auto"
                            >
                              <StatusIcon className="w-3 h-3" />
                              {getStatusLabel(status)}
                            </Badge>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {orders.length > 5 && (
                  <Button variant="outline" size="sm" asChild className="w-full mt-3">
                    <Link to="/my-orders">View All {orders.length} Orders</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;
