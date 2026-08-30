import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizePhoneOrThrow } from "@/utils/phoneValidation";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
};

const WholesaleTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [deletingApp, setDeletingApp] = useState<any>(null);
  const [searchWholesale, setSearchWholesale] = useState("");
  const { data: applications, isLoading } = useQuery({
    queryKey: ["wholesale-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const applicationEmails = useMemo(
    () =>
      Array.from(
        new Set(
          (applications || [])
            .map((a: any) => a.email?.toLowerCase())
            .filter((e: string | undefined): e is string => !!e)
        )
      ),
    [applications]
  );

  const { data: vatMapData } = useQuery({
    queryKey: ["wholesale-vat-map", applicationEmails],
    enabled: applicationEmails.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "admin-list-wholesale-vat",
        { body: { emails: applicationEmails } }
      );
      if (error) throw error;
      return (data?.results || {}) as Record<
        string,
        { vat_number: string | null; vat_exempt: boolean; source: string }
      >;
    },
  });

  const getVat = useCallback(
    (email?: string | null) => {
      if (!email || !vatMapData) return undefined;
      return vatMapData[email.toLowerCase()];
    },
    [vatMapData]
  );

  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    if (!searchWholesale.trim()) return applications;
    const q = searchWholesale.toLowerCase();
    return applications.filter((app) => {
      const vat = getVat(app.email);
      return (
        app.business_name?.toLowerCase().includes(q) ||
        app.contact_name?.toLowerCase().includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        vat?.vat_number?.toLowerCase().includes(q)
      );
    });
  }, [applications, searchWholesale, getVat]);

  const sendNotification = useCallback(async (type: string, app: any) => {
    try {
      await supabase.functions.invoke("wholesale-notification", {
        body: {
          type,
          email: app.email,
          contact_name: app.contact_name,
          business_name: app.business_name,
          business_type: app.business_type,
        },
      });
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }, []);

  const extractInvokeError = async (invokeError: any, invokeData: any): Promise<string | null> => {
    if (invokeData?.error) return invokeData.error;
    if (!invokeError) return null;
    try {
      const ctx: any = (invokeError as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) return body.error;
      }
    } catch {
      // ignore parse errors
    }
    return invokeError.message || "Unknown error";
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, form, originalEmail }: { id: string; form: any; originalEmail: string }) => {
      // Validate + normalize phone BEFORE doing any writes, so we never send
      // junk to Shopify (which rejects with 422 "phone is invalid").
      let normalizedPhone: string | null = null;
      try {
        normalizedPhone = sanitizePhoneOrThrow(form.phone);
      } catch (err: any) {
        throw new Error(err?.message || "Invalid phone number");
      }

      // Step 1: Update Supabase wholesale_applications
      const { error: supabaseError } = await supabase
        .from("wholesale_applications")
        .update({
          contact_name: form.contact_name,
          email: form.email,
          phone: normalizedPhone,
          business_name: form.business_name,
          business_type: form.business_type,
          expected_volume: form.expected_volume || null,
          additional_info: form.additional_info || null,
          status: form.status,
        })
        .eq("id", id);

      if (supabaseError) throw supabaseError;

      // Step 2: Update Shopify customer
      const emailToSearch = form.email || originalEmail;
      const nameParts = (form.contact_name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke(
        "admin-update-shopify-customer",
        {
          body: {
            email: emailToSearch,
            first_name: firstName,
            last_name: lastName,
            phone: normalizedPhone,
          },
        }
      );

      const shopifyErrorMessage = await extractInvokeError(shopifyError, shopifyData);
      const shopifyNotFound = !!shopifyData?.shopify_not_found;

      // Step 3: Save VAT only if there is something to save
      // (skip when no VAT number AND not exempt — avoids 400 from validation)
      const hasVatToSave = !!form.vat_exempt || !!form.vat_number?.trim();
      let vatErrorMessage: string | null = null;
      let vatSkipped = false;

      if (hasVatToSave) {
        const { data: vatData, error: vatError } = await supabase.functions.invoke(
          "save-wholesale-vat",
          {
            body: {
              target_email: form.email,
              vat_number: form.vat_number?.trim() || "",
              vat_exempt: !!form.vat_exempt,
            },
          }
        );
        vatErrorMessage = await extractInvokeError(vatError, vatData);
      } else {
        vatSkipped = true;
      }

      return {
        shopify_synced: !shopifyErrorMessage && !shopifyNotFound,
        shopify_error: shopifyErrorMessage,
        shopify_not_found: shopifyNotFound,
        vat_synced: !vatErrorMessage,
        vat_error: vatErrorMessage,
        vat_skipped: vatSkipped,
      };
    },
    onSuccess: (result, { form }) => {
      const wasStatusChange = form.status === "approved" || form.status === "rejected";
      if (wasStatusChange) {
        sendNotification(form.status, { email: form.email, contact_name: form.contact_name, business_name: form.business_name, business_type: form.business_type });
      }

      // When an application is approved, clean up the user's retail-only favorites
      // so that only products available in the wholesale experience remain.
      if (form.status === "approved" && editingApp?.user_id) {
        supabase.functions
          .invoke("recalculate-wholesale-favorites", {
            body: { user_id: editingApp.user_id },
          })
          .catch((err) => {
            console.error("Failed to recalculate wholesale favorites:", err);
          });
      }

      queryClient.invalidateQueries({ queryKey: ["wholesale-applications"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-vat-map"] });
      queryClient.invalidateQueries({ queryKey: ["shopify-customers"] });
      queryClient.invalidateQueries({ queryKey: ["product-favorites-counts"] });

      // Build status message from the three steps
      const problems: string[] = [];
      if (result.shopify_not_found) {
        problems.push("Shopify customer not found for this email");
      } else if (!result.shopify_synced) {
        problems.push(`Shopify sync failed: ${result.shopify_error}`);
      }
      if (!result.vat_synced && !result.vat_skipped) {
        problems.push(`VAT save failed: ${result.vat_error}`);
      }

      if (problems.length > 0) {
        toast({
          title: "Application saved with issues",
          description: problems.join(" · "),
          variant: "destructive",
        });
      } else {
        toast({ title: "Application updated", description: "Changes saved and Shopify synced." });
      }
      setEditingApp(null);
      setEditForm(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to save application.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wholesale_applications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Application deleted", description: "The application has been removed." });
      queryClient.invalidateQueries({ queryKey: ["wholesale-applications"] });
      setDeletingApp(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete application.", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Wholesale Applications</CardTitle>
            <CardDescription>
              Review and manage wholesale access requests
              {applications && (
                <span className="ml-1">· {filteredApplications.length} shown</span>
              )}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by business, contact or email..."
              value={searchWholesale}
              onChange={(e) => setSearchWholesale(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !applications?.length ? (
          <p className="text-muted-foreground">No wholesale applications yet.</p>
        ) : filteredApplications.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No applications found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedApp(app)}
                >
                  <TableCell className="font-medium">{app.business_name}</TableCell>
                  <TableCell>{app.contact_name}</TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[app.status] || ""}>
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedApp(app);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          const vat = getVat(app.email);
                          setEditingApp(app);
                          setEditForm({
                            contact_name: app.contact_name || "",
                            email: app.email || "",
                            phone: app.phone || "",
                            business_name: app.business_name || "",
                            business_type: app.business_type || "",
                            expected_volume: app.expected_volume || "",
                            additional_info: app.additional_info || "",
                            status: app.status || "pending",
                            vat_number: vat?.vat_number || "",
                            vat_exempt: vat?.vat_exempt || false,
                          });
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingApp(app);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedApp?.business_name}</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{selectedApp.contact_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedApp.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedApp.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">VAT / Tax ID</p>
                  {(() => {
                    const vat = getVat(selectedApp.email);
                    if (vat?.vat_number) {
                      return <p className="font-mono text-xs">{vat.vat_number}</p>;
                    }
                    if (vat?.vat_exempt) {
                      return <p className="font-medium">Exempt</p>;
                    }
                    return <p className="font-medium text-muted-foreground">Not set</p>;
                  })()}
                </div>
                <div>
                  <p className="text-muted-foreground">Business Type</p>
                  <p className="font-medium">{selectedApp.business_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Volume</p>
                  <p className="font-medium">{selectedApp.expected_volume || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusStyles[selectedApp.status] || ""}>
                    {selectedApp.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {selectedApp.created_at ? format(new Date(selectedApp.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">
                    {selectedApp.updated_at ? format(new Date(selectedApp.updated_at), "dd/MM/yyyy HH:mm") : "—"}
                  </p>
                </div>
              </div>
              {selectedApp.additional_info && (
                <div>
                  <p className="text-muted-foreground">Additional Info</p>
                  <p className="font-medium mt-1">{selectedApp.additional_info}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingApp} onOpenChange={(open) => {
        if (!open) {
          setEditingApp(null);
          setEditForm(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Application — {editingApp?.business_name}</DialogTitle>
            <DialogDescription className="sr-only">Edit wholesale application details</DialogDescription>
          </DialogHeader>
          {editingApp && editForm && (
            <div className="space-y-4 py-2">
              {/* Business Info section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Business Name</label>
                  <Input
                    value={editForm.business_name}
                    onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Business Type</label>
                  <Input
                    value={editForm.business_type}
                    onChange={e => setEditForm(f => ({ ...f, business_type: e.target.value }))}
                  />
                </div>
              </div>

              {/* Contact Info section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input
                    value={editForm.contact_name}
                    onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+353871234567"
                  />
                  <p className="text-xs text-muted-foreground">International format with + (e.g. +353871234567)</p>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              {/* Expected Volume */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Expected Volume</label>
                <Input
                  value={editForm.expected_volume}
                  onChange={e => setEditForm(f => ({ ...f, expected_volume: e.target.value }))}
                />
              </div>

              {/* VAT / Tax ID */}
              <div className="space-y-1">
                <label className="text-sm font-medium">VAT / Tax ID</label>
                <Input
                  value={editForm.vat_number}
                  onChange={e => setEditForm(f => ({ ...f, vat_number: e.target.value }))}
                  placeholder="e.g. IE1234567X"
                  disabled={editForm.vat_exempt}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="vat_exempt"
                    checked={editForm.vat_exempt}
                    onCheckedChange={(checked) => setEditForm(f => ({
                      ...f,
                      vat_exempt: checked === true,
                      vat_number: checked === true ? "" : f.vat_number,
                    }))}
                  />
                  <label htmlFor="vat_exempt" className="text-sm cursor-pointer">VAT exempt</label>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Additional Info</label>
                <Textarea
                  value={editForm.additional_info}
                  onChange={e => setEditForm(f => ({ ...f, additional_info: e.target.value }))}
                  className="min-h-[60px] text-sm"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setEditingApp(null);
                setEditForm(null);
              }}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editForm) return;
                const trimmedPhone = editForm.phone?.trim() || "";
                if (trimmedPhone && !/^\+\d{6,}$/.test(trimmedPhone)) {
                  toast({
                    title: "Invalid phone format",
                    description: "Phone must be in international E.164 format (e.g. +353871234567).",
                    variant: "destructive",
                  });
                  return;
                }
                editMutation.mutate({ id: editingApp.id, form: editForm, originalEmail: editingApp.email });
              }}
              disabled={editMutation.isPending || !editForm}
            >
              {editMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingApp} onOpenChange={(open) => !open && setDeletingApp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the wholesale application from{" "}
              <span className="font-semibold text-foreground">{deletingApp?.business_name}</span> ({deletingApp?.contact_name})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingApp && deleteMutation.mutate(deletingApp.id)}
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

export default WholesaleTab;
