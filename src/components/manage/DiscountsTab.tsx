import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useShopifyDiscounts, ShopifyDiscount } from "@/hooks/useShopifyDiscounts";
import CouponModal from "./CouponModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusStyles: Record<ShopifyDiscount["status"], string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  scheduled: "bg-yellow-100 text-yellow-800 border-yellow-300",
  expired: "bg-gray-100 text-gray-700 border-gray-300",
};

const formatValue = (d: ShopifyDiscount) =>
  d.value_type === "percentage" ? `${d.value}%` : `€${d.value.toFixed(2)}`;

const formatDate = (iso: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yyyy") : "—";

const DiscountsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: discounts, isLoading, isError, refetch } = useShopifyDiscounts();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<ShopifyDiscount | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<ShopifyDiscount | null>(null);

  const filtered = useMemo(() => {
    if (!discounts) return [];
    if (!search.trim()) return discounts;
    const q = search.toLowerCase();
    return discounts.filter(
      (d) =>
        d.code?.toLowerCase().includes(q) ||
        d.title?.toLowerCase().includes(q)
    );
  }, [discounts, search]);

  const deleteMutation = useMutation({
    mutationFn: async (priceRuleId: number) => {
      const { data, error } = await supabase.functions.invoke("shopify-delete-discount", {
        body: { price_rule_id: priceRuleId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Coupon deleted" });
      queryClient.invalidateQueries({ queryKey: ["shopify-discounts"] });
      setDeletingCoupon(null);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to delete coupon",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async (d: ShopifyDiscount) => {
    if (!d.code) return;
    try {
      await navigator.clipboard.writeText(d.code);
      setCopiedId(d.id);
      toast({ title: "Code copied", description: d.code });
      setTimeout(() => setCopiedId((curr) => (curr === d.id ? null : curr)), 1500);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["shopify-discounts"] });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Coupons</CardTitle>
            <CardDescription>
              Discount codes synced from your Shopify store
              {discounts && (
                <span className="ml-1">· {filtered.length} shown</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Coupon
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-destructive">Failed to load coupons from Shopify.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !discounts?.length ? (
          <p className="text-muted-foreground text-center py-8">No coupons yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No coupons found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.code ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{d.code}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopy(d)}
                            aria-label={`Copy ${d.code}`}
                          >
                            {copiedId === d.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          {d.codes_count > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              +{d.codes_count - 1}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          {d.title || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatValue(d)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[d.status]}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(d.starts_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCoupon(d)}
                          disabled={!d.code}
                          title={!d.code ? "Automatic discount — edit in Shopify admin" : "Edit"}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingCoupon(d)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CouponModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />

      <CouponModal
        open={!!editingCoupon}
        onOpenChange={(open) => !open && setEditingCoupon(null)}
        coupon={editingCoupon}
        onSuccess={handleSuccess}
      />

      <AlertDialog
        open={!!deletingCoupon}
        onOpenChange={(open) => !open && setDeletingCoupon(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deletingCoupon?.code || deletingCoupon?.title}
              </span>
              ? This will remove it from Shopify and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deletingCoupon && deleteMutation.mutate(deletingCoupon.price_rule_id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default DiscountsTab;
