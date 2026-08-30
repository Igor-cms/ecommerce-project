import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FedexLabelResult {
  trackingNumber: string;
  masterTracking?: string;
  serviceType: string;
  weightKg: number;
  pdfDownloadUrl?: string;
  trackingUrl: string;
}

export const useFedexLabel = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FedexLabelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createLabel = async (orderId: number, opts?: { serviceType?: string; weightKg?: number }) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("fedex-create-label", {
        body: { orderId, ...opts },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!data?.success) {
        const detailStr = data?.details ? ` — ${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}` : '';
        throw new Error((data?.error || data?.message || "Failed to create label") + detailStr);
      }
      setResult(data as FedexLabelResult);
      toast({ title: "FedEx label created", description: `Tracking: ${data.trackingNumber}` });
      return data as FedexLabelResult;
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
      setError(msg);
      toast({ title: "Label generation failed", description: msg, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { createLabel, loading, result, error, reset };
};
