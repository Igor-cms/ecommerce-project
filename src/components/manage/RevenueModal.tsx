import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface RevenueMonthlyResponse {
  months: MonthlyRevenue[];
  totalRevenue: string;
  currency: string;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const chartConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
};

const formatCurrency = (value: number) =>
  `€${value.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface RevenueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RevenueModal({ open, onOpenChange }: RevenueModalProps) {
  const { data, isLoading } = useQuery<RevenueMonthlyResponse>({
    queryKey: ["shopify-revenue-monthly"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/shopify-orders?mode=revenue-monthly`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
    staleTime: 120_000,
  });

  const chartData = (data?.months || []).map((m) => ({
    name: MONTH_LABELS[m.month.split("-")[1]] || m.month,
    revenue: m.revenue,
  }));

  const total = data ? formatCurrency(parseFloat(data.totalRevenue)) : "--";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-3">
            Revenue Overview
            {data && (
              <span className="text-muted-foreground font-normal text-base">
                {total} total
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground text-center">Loading revenue...</p>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No revenue data available</p>
        )}

        {!isLoading && chartData.length > 0 && (
          <Tabs defaultValue="bar" className="mt-2">
            <TabsList className="grid w-full max-w-[200px] grid-cols-2 mx-auto">
              <TabsTrigger value="bar">Bar</TabsTrigger>
              <TabsTrigger value="line">Line</TabsTrigger>
            </TabsList>

            <TabsContent value="bar" className="mt-4">
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `€${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k`}
                    width={55}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number)}
                      />
                    }
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="line" className="mt-4">
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <LineChart data={chartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `€${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k`}
                    width={55}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number)}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--color-revenue)" }}
                  />
                </LineChart>
              </ChartContainer>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
