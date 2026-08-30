import { useState, useMemo } from "react";
import { useRoastList, RoastItem, useRoastWindow } from "@/hooks/useRoastList";
import { useSeparationList, SeparationItem } from "@/hooks/useSeparationList";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { RefreshCw, Flame, Coffee, Printer, Mail, Send, Loader2, PackageOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SAVED_EMAILS_KEY = "roast_list_emails";

const getSavedEmails = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_EMAILS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveEmail = (email: string) => {
  const emails = getSavedEmails().filter((e) => e !== email);
  emails.unshift(email);
  localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify(emails.slice(0, 10)));
};

const AdminRoastList = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const defaultWindow = useRoastWindow();
  const [startDate, setStartDate] = useState<Date>(defaultWindow.start);
  const [endDate, setEndDate] = useState<Date>(defaultWindow.end);
  const isCustomRange = startDate.getTime() !== defaultWindow.start.getTime() || endDate.getTime() !== defaultWindow.end.getTime();
  const roast = useRoastList(startDate, endDate);
  const separation = useSeparationList(startDate, endDate);
  const [activeTab, setActiveTab] = useState("roast");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const fridayDate = new Date(endDate);
  fridayDate.setDate(fridayDate.getDate() + 1);

  const resetToDefault = () => {
    setStartDate(defaultWindow.start);
    setEndDate(defaultWindow.end);
  };

  const handlePrint = () => window.print();

  const currentLoading = activeTab === "roast" ? roast.loading : separation.loading;
  const currentLastFetched = activeTab === "roast" ? roast.lastFetched : separation.lastFetched;
  const currentRefetch = activeTab === "roast" ? roast.refetch : separation.refetch;
  const hasItems = activeTab === "roast" ? roast.items.length > 0 : separation.items.length > 0;

  const savedEmails = getSavedEmails();

  const handleSendEmail = async () => {
    if (!emailTo || !emailTo.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const body = activeTab === "roast"
        ? {
            type: "roast",
            to: emailTo.trim(),
            items: roast.items,
            fridayDate: format(fridayDate, "dd/MM/yyyy"),
            windowStart: format(startDate, "dd/MM"),
            windowEnd: format(endDate, "dd/MM"),
          }
        : {
            type: "separation",
            to: emailTo.trim(),
            items: separation.items,
            fridayDate: format(fridayDate, "dd/MM/yyyy"),
            windowStart: format(startDate, "dd/MM"),
            windowEnd: format(endDate, "dd/MM"),
          };

      const { data, error } = await supabase.functions.invoke("send-roast-list-email", { body });

      if (error) throw error;

      saveEmail(emailTo.trim());
      const label = activeTab === "roast" ? "Roast list" : "Separation list";
      toast({ title: "Email sent", description: `${label} sent to ${emailTo}` });
      setEmailDialogOpen(false);
      setEmailTo("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast({ title: "Error", description: "Failed to send email. Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">
          {activeTab === "roast" ? "Roast List" : "Separation List"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Orders from {format(startDate, "dd/MM")} to {format(endDate, "dd/MM")}
        </p>
        {activeTab === "roast" && (
          <p className="text-xs text-gray-400 mt-1">
            {roast.items.length} items · {roast.items.reduce((s, i) => s + i.totalKg, 0).toFixed(2)} kg total
            {roast.lastFetched && ` · Generated ${format(roast.lastFetched, "dd/MM/yyyy HH:mm")}`}
          </p>
        )}
        {activeTab === "separation" && (
          <p className="text-xs text-gray-400 mt-1">
            {separation.items.length} items · {separation.items.reduce((s, i) => s + i.quantity, 0)} units total
            {separation.lastFetched && ` · Generated ${format(separation.lastFetched, "dd/MM/yyyy HH:mm")}`}
          </p>
        )}
        <hr className="mt-3 border-gray-300" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl print:px-0 print:py-0 print:max-w-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {activeTab === "roast" ? (
                <Flame className="w-6 h-6 text-primary" />
              ) : (
                <PackageOpen className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Production</h1>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>Orders from</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary transition-colors cursor-pointer">
                      {format(startDate, "dd/MM")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <span>to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary transition-colors cursor-pointer">
                      {format(endDate, "dd/MM")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {isCustomRange && (
                  <button onClick={resetToDefault} className="ml-1 text-muted-foreground hover:text-primary transition-colors" title="Reset to default">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentLastFetched && (
              <span className="text-xs text-muted-foreground">
                Updated at {format(currentLastFetched, "HH:mm")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={currentRefetch} disabled={currentLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${currentLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={currentLoading || !hasItems}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button size="sm" onClick={() => setEmailDialogOpen(true)} disabled={currentLoading || !hasItems}>
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
          </div>
        </div>


        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden mb-6">
          <TabsList>
            <TabsTrigger value="roast" className="gap-2">
              <Flame className="w-4 h-4" />
              Roast
            </TabsTrigger>
            <TabsTrigger value="separation" className="gap-2">
              <PackageOpen className="w-4 h-4" />
              Separation
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Roast List Content */}
        {activeTab === "roast" && (
          <>
            {roast.loading ? (
              <div className="space-y-3 print:hidden">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : roast.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center print:hidden">
                <Coffee className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h2 className="text-lg font-medium text-muted-foreground">No coffees sold this week</h2>
                <p className="text-sm text-muted-foreground/60 mt-1">No paid orders in the selected period</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4 print:hidden">
                  <Badge variant="secondary" className="text-xs">
                    {roast.items.length} {roast.items.length === 1 ? "coffee" : "coffees"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {roast.items.reduce((sum, i) => sum + i.totalKg, 0).toFixed(2)} kg total
                  </Badge>
                </div>
                <div className="rounded-lg border print:border-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="print:border-b-2 print:border-black">
                        <TableHead className="print:text-black print:font-bold">Coffee</TableHead>
                        <TableHead className="text-right print:text-black print:font-bold">Total to Roast (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roast.items.map((item, idx) => (
                        <TableRow key={idx} className="print:border-b print:border-gray-300">
                          <TableCell className="font-medium print:text-black">{item.title}</TableCell>
                          <TableCell className="text-right font-semibold print:text-black">{item.totalKg} kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        )}

        {/* Separation List Content */}
        {activeTab === "separation" && (
          <>
            {separation.loading ? (
              <div className="space-y-3 print:hidden">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : separation.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center print:hidden">
                <Coffee className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h2 className="text-lg font-medium text-muted-foreground">No items this week</h2>
                <p className="text-sm text-muted-foreground/60 mt-1">No paid orders in the selected period</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4 print:hidden">
                  <Badge variant="secondary" className="text-xs">
                    {separation.items.length} {separation.items.length === 1 ? "item" : "items"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {separation.items.reduce((s, i) => s + i.quantity, 0)} units total
                  </Badge>
                </div>
                <div className="rounded-lg border print:border-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="print:border-b-2 print:border-black">
                        <TableHead className="print:text-black print:font-bold">Coffee</TableHead>
                        <TableHead className="print:text-black print:font-bold">Variant</TableHead>
                        <TableHead className="text-right print:text-black print:font-bold">Qty to Separate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {separation.items.map((item, idx) => (
                        <TableRow key={idx} className="print:border-b print:border-gray-300">
                          <TableCell className="font-medium print:text-black">{item.title}</TableCell>
                          <TableCell className="print:text-black">{item.variant}</TableCell>
                          <TableCell className="text-right font-semibold print:text-black">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              {activeTab === "roast" ? "Send Roast List" : "Send Separation List"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Recipient email</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
              />
            </div>
            {savedEmails.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Recent emails</label>
                <div className="flex flex-wrap gap-1.5">
                  {savedEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setEmailTo(email)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        emailTo === email
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border"
                      }`}
                    >
                      {email}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending || !emailTo}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminRoastList;
