import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaobjectOption {
  gid: string;
  name: string;
}

interface ListMetaobjectsResponse {
  type: string;
  items: MetaobjectOption[];
}

/**
 * Lists all metaobjects of a given Shopify type (e.g. "flavor").
 * Admin-only — the edge function rejects non-admin callers.
 */
export const useMetaobjects = (type: string | undefined) => {
  return useQuery<MetaobjectOption[]>({
    queryKey: ["shopify-metaobjects", type],
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!type) return [];
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/shopify-list-metaobjects?type=${encodeURIComponent(type)}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Failed to list metaobjects: ${res.status} ${errBody}`);
      }

      const data: ListMetaobjectsResponse = await res.json();
      return data.items || [];
    },
  });
};
