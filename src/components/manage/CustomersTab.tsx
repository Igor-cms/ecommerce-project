import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Plus, Pencil, Eye } from "lucide-react";
import { useShopifyCustomers, ShopifyCustomer } from "@/hooks/useShopifyCustomers";
import { useQueryClient } from "@tanstack/react-query";
import CreateCustomerModal from "./CreateCustomerModal";
import EditCustomerModal from "./EditCustomerModal";
import ViewCustomerModal from "./ViewCustomerModal";

type SortKey = "orders_count" | "total_spent";
type SortDir = "asc" | "desc";

const CustomersTab = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ShopifyCustomer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<ShopifyCustomer | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageInfo, setPageInfo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setPageInfo(""); // reset pagination on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError } = useShopifyCustomers(debouncedQuery, pageInfo);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!data?.customers) return [];
    if (!sortKey) return data.customers;
    return [...data.customers].sort((a, b) => {
      const aVal = sortKey === "total_spent" ? parseFloat(a.total_spent) : a.orders_count;
      const bVal = sortKey === "total_spent" ? parseFloat(b.total_spent) : b.orders_count;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data?.customers, sortKey, sortDir]);

  const SortButton = ({ field, label }: { field: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Customer Management</CardTitle>
            <CardDescription>
              Customers synced from your Shopify store
              {data?.customers && (
                <span className="ml-1">· {data.customers.length} shown</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Customer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive text-center py-8">
            Failed to load customers from Shopify. Please try again later.
          </p>
        )}

        {data && !isLoading && sorted.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No customers found.
          </p>
        )}

        {data && sorted.length > 0 && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">
                      <SortButton field="orders_count" label="Orders" />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="total_spent" label="Amount spent" />
                    </TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewingCustomer(customer)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {customer.orders_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        €{parseFloat(customer.total_spent).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCustomer(customer);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCustomer(customer);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.previous}
                onClick={() => setPageInfo(data.pagination.previous || "")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.next}
                onClick={() => setPageInfo(data.pagination.next || "")}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <CreateCustomerModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["shopify-customers"] })}
      />
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["shopify-customers"] });
            setEditingCustomer(null);
          }}
        />
      )}
      {viewingCustomer && (
        <ViewCustomerModal
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
        />
      )}
    </Card>
  );
};

export default CustomersTab;
