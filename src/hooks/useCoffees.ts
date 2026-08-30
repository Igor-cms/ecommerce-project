import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coffee } from "@/types/coffee";
import { useToast } from "@/hooks/use-toast";

// Transform database coffee to frontend coffee type
const transformDatabaseCoffee = (dbCoffee: any): Coffee => {
  return {
    id: dbCoffee.id,
    code: dbCoffee.code,
    name: dbCoffee.name,
    description: dbCoffee.description || "",
    fullStory: dbCoffee.full_story || "",
    origin: dbCoffee.origin || "",
    farm: dbCoffee.farm || "",
    region: dbCoffee.region || "",
    country: dbCoffee.country || "",
    variety: dbCoffee.variety || "",
    altitude: dbCoffee.altitude || "",
    producer: dbCoffee.producer || "",
    tastesLike: dbCoffee.tastes_like || [],
    processing: dbCoffee.processing || "",
    roastProfile: dbCoffee.roast_profile || "",
    category: dbCoffee.category,
    pricing: dbCoffee.pricing as Coffee["pricing"],
    sizeAvailability: dbCoffee.size_availability as Coffee["sizeAvailability"],
    available: dbCoffee.available,
    roastOptions: dbCoffee.roast_options || [],
    image: dbCoffee.image || ""
  };
};

export const useCoffees = () => {
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoffees = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("coffees")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      
      const transformedCoffees = (data || []).map(transformDatabaseCoffee);
      setCoffees(transformedCoffees);
    } catch (error) {
      console.error("Error fetching coffees:", error);
      toast({
        title: "Error",
        description: "Failed to fetch coffees",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoffees();
  }, []);

  return {
    coffees,
    loading,
    refetch: fetchCoffees
  };
};
