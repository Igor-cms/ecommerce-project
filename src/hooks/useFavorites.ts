import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteSlugs(new Set());
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select("product_slug")
      .eq("user_id", user.id);

    if (data) {
      setFavoriteSlugs(new Set(data.map((f: any) => f.product_slug)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.has(slug),
    [favoriteSlugs]
  );

  const toggleFavorite = useCallback(
    async (slug: string) => {
      if (!user) return false;

      const currentlyFavorited = favoriteSlugs.has(slug);

      // Optimistic update
      setFavoriteSlugs((prev) => {
        const next = new Set(prev);
        if (currentlyFavorited) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        return next;
      });

      if (currentlyFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_slug", slug);

        if (error) {
          // Rollback
          setFavoriteSlugs((prev) => new Set(prev).add(slug));
          return false;
        }
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, product_slug: slug });

        if (error) {
          // Rollback
          setFavoriteSlugs((prev) => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
          });
          return false;
        }
      }

      // Invalidate admin's favorites count cache so counts update in real-time
      queryClient.invalidateQueries({ queryKey: ["product-favorites-counts"] });

      return !currentlyFavorited;
    },
    [user, favoriteSlugs]
  );

  const favoriteSlugList = useMemo(() => [...favoriteSlugs], [favoriteSlugs]);

  return { isFavorite, toggleFavorite, loading, favoriteSlugList, refreshFavorites: fetchFavorites };
};
