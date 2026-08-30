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

// Transform frontend coffee to database insert format
const transformToDatabase = (coffee: Coffee) => {
  return {
    code: coffee.code,
    name: coffee.name,
    description: coffee.description,
    full_story: coffee.fullStory,
    origin: coffee.origin,
    farm: coffee.farm,
    region: coffee.region,
    country: coffee.country,
    variety: coffee.variety,
    altitude: coffee.altitude,
    producer: coffee.producer,
    tastes_like: coffee.tastesLike,
    processing: coffee.processing,
    roast_profile: coffee.roastProfile,
    category: coffee.category,
    pricing: coffee.pricing,
    size_availability: coffee.sizeAvailability,
    available: coffee.available,
    roast_options: coffee.roastOptions,
    image: coffee.image
  };
};

export const useCoffeeManagement = () => {
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
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

  const handleEdit = (id: number) => {
    setEditingId(id);
  };

  const handleSave = async (id: number) => {
    const coffee = coffees.find(c => c.id === id);
    if (!coffee) return;

    try {
      const updateData = {
        code: coffee.code,
        name: coffee.name,
        description: coffee.description,
        full_story: coffee.fullStory,
        origin: coffee.origin,
        farm: coffee.farm,
        region: coffee.region,
        country: coffee.country,
        variety: coffee.variety,
        altitude: coffee.altitude,
        producer: coffee.producer,
        tastes_like: coffee.tastesLike,
        processing: coffee.processing,
        roast_profile: coffee.roastProfile,
        category: coffee.category,
        pricing: coffee.pricing,
        size_availability: coffee.sizeAvailability,
        available: coffee.available,
        roast_options: coffee.roastOptions,
        image: coffee.image
      };

      const { error } = await (supabase as any)
        .from("coffees")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Coffee updated successfully"
      });
      setEditingId(null);
    } catch (error) {
      console.error("Error updating coffee:", error);
      toast({
        title: "Error",
        description: "Failed to update coffee",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await (supabase as any)
        .from("coffees")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCoffees(coffees.filter(coffee => coffee.id !== id));
      toast({
        title: "Success",
        description: "Coffee deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting coffee:", error);
      toast({
        title: "Error",
        description: "Failed to delete coffee",
        variant: "destructive"
      });
    }
  };

  const updateCoffee = (id: number, field: string, value: any) => {
    setCoffees(coffees.map(coffee => 
      coffee.id === id ? { ...coffee, [field]: value } : coffee
    ));
  };

  const addTaste = (id: number, newTaste: string) => {
    if (newTaste.trim()) {
      const coffee = coffees.find(c => c.id === id);
      if (coffee) {
        updateCoffee(id, 'tastesLike', [...coffee.tastesLike, newTaste.trim().toUpperCase()]);
      }
    }
  };

  const removeTaste = (id: number, tasteIndex: number) => {
    const coffee = coffees.find(c => c.id === id);
    if (coffee) {
      updateCoffee(id, 'tastesLike', coffee.tastesLike.filter((_, i) => i !== tasteIndex));
    }
  };

  const addNewCoffee = async () => {
    const uniqueCode = `NEW_${Date.now()}`;
    
    const newCoffeeData = {
      code: uniqueCode,
      name: "New Coffee",
      description: "",
      full_story: "",
      origin: "",
      farm: "",
      region: "",
      country: "",
      variety: "",
      altitude: "",
      producer: "",
      tastes_like: [],
      processing: "",
      roast_profile: "",
      category: "specialty",
      pricing: {
        "125g": 0,
        "250g": 0,
        "1kg": 0
      },
      size_availability: {
        "125g": true,
        "250g": true,
        "1kg": true
      },
      available: true,
      roast_options: [],
      image: ""
    };

    try {
      const { data, error } = await (supabase as any)
        .from("coffees")
        .insert(newCoffeeData)
        .select()
        .single();

      if (error) throw error;

      const newCoffee = transformDatabaseCoffee(data);
      setCoffees([newCoffee, ...coffees]);
      setEditingId(newCoffee.id);
      setIsAddingNew(false);
      
      toast({
        title: "Success",
        description: "New coffee created successfully"
      });
    } catch (error) {
      console.error("Error creating coffee:", error);
      toast({
        title: "Error",
        description: "Failed to create new coffee",
        variant: "destructive"
      });
    }
  };

  return {
    coffees,
    editingId,
    isAddingNew,
    loading,
    setIsAddingNew,
    handleEdit,
    handleSave: async (id: number) => {
      await handleSave(id);
      await fetchCoffees();
    },
    handleDelete,
    updateCoffee,
    addTaste,
    removeTaste,
    addNewCoffee,
    refetch: fetchCoffees
  };
};
