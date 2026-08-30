import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Package } from "lucide-react";

interface Coffee {
  id: number;
  name: string;
  code: string;
  image: string;
  pricing: any;
}

interface InternalItem {
  id: string;
  coffee_id: number;
  quantity: number;
  size: string;
  roast_option: string | null;
  unit_price: number;
  total_price: number;
  coffee?: Coffee;
}

interface InternalItemsManagerProps {
  orderId: string;
}

const InternalItemsManager = ({ orderId }: InternalItemsManagerProps) => {
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [internalItems, setInternalItems] = useState<InternalItem[]>([]);
  const [selectedCoffee, setSelectedCoffee] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedRoast, setSelectedRoast] = useState<string>('none');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Load available coffees
  useEffect(() => {
    const fetchCoffees = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('coffees')
          .select('id, name, code, image, pricing')
          .eq('available', true);
        
        if (error) throw error;
        setCoffees((data || []) as Coffee[]);
      } catch (error) {
        console.error('Error fetching coffees:', error);
      }
    };

    fetchCoffees();
  }, []);

  // Load existing internal items
  useEffect(() => {
    const fetchInternalItems = async () => {
      try {
        const saved = localStorage.getItem(`internal_items_${orderId}`);
        if (saved) {
          setInternalItems(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading internal items:', error);
      }
    };

    fetchInternalItems();
  }, [orderId]);

  const getAvailableSizes = (coffeeId: string) => {
    const coffee = coffees.find(c => c.id.toString() === coffeeId);
    if (!coffee || !coffee.pricing) return [];
    return Object.keys(coffee.pricing).filter(size => coffee.pricing[size] > 0);
  };

  const getPrice = (coffeeId: string, size: string) => {
    const coffee = coffees.find(c => c.id.toString() === coffeeId);
    if (!coffee || !coffee.pricing) return 0;
    return coffee.pricing[size] || 0;
  };

  const addInternalItem = async () => {
    if (!selectedCoffee || !selectedSize || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const coffee = coffees.find(c => c.id.toString() === selectedCoffee);
      if (!coffee) return;

      const unitPrice = getPrice(selectedCoffee, selectedSize);
      const totalPrice = unitPrice * quantity;

      const newItem: InternalItem = {
        id: `internal_${Date.now()}_${Math.random()}`,
        coffee_id: coffee.id,
        quantity,
        size: selectedSize,
        roast_option: (selectedRoast && selectedRoast !== 'none') ? selectedRoast : null,
        unit_price: unitPrice,
        total_price: totalPrice,
        coffee
      };

      const updatedItems = [...internalItems, newItem];
      setInternalItems(updatedItems);
      localStorage.setItem(`internal_items_${orderId}`, JSON.stringify(updatedItems));

      setSelectedCoffee('');
      setSelectedSize('');
      setSelectedRoast('none');
      setQuantity(1);

      toast({
        title: "Success",
        description: "Item added for internal management",
      });
    } catch (error) {
      console.error('Error adding internal item:', error);
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeInternalItem = (itemId: string) => {
    const updatedItems = internalItems.filter(item => item.id !== itemId);
    setInternalItems(updatedItems);
    localStorage.setItem(`internal_items_${orderId}`, JSON.stringify(updatedItems));
    
    toast({
      title: "Success",
      description: "Item removed",
    });
  };

  const getInternalSubtotal = () => {
    return internalItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  if (coffees.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="text-sm">Loading coffees...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add item form */}
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select value={selectedCoffee} onValueChange={setSelectedCoffee}>
            <SelectTrigger>
              <SelectValue placeholder="Select coffee" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              {coffees.map((coffee) => (
                <SelectItem key={coffee.id} value={coffee.id.toString()}>
                  {coffee.name} ({coffee.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSize} onValueChange={setSelectedSize} disabled={!selectedCoffee}>
            <SelectTrigger>
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              {getAvailableSizes(selectedCoffee).map((size) => (
                <SelectItem key={size} value={size}>
                  {size} - €{getPrice(selectedCoffee, size).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={selectedRoast} onValueChange={setSelectedRoast}>
            <SelectTrigger>
              <SelectValue placeholder="Roast Type" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              <SelectItem value="none">Not selected</SelectItem>
              <SelectItem value="Espresso">Espresso</SelectItem>
              <SelectItem value="Filter">Filter</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Quantity"
          />

          <Button onClick={addInternalItem} disabled={loading || !selectedCoffee || !selectedSize} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Internal items list */}
      {internalItems.length > 0 && (
        <div className="space-y-3">
          <h6 className="font-medium text-sm">Added Items (Internal Management)</h6>
          {internalItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {item.coffee && (
                    <img src={item.coffee.image} alt={item.coffee.name} className="w-8 h-8 object-cover rounded" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{item.coffee?.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {item.coffee?.code}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Size</p>
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <Badge variant="outline" className="text-xs">{item.size}</Badge>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Roast</p>
                  <Badge variant="secondary" className="text-xs">
                    {item.roast_option || 'N/A'}
                  </Badge>
                </div>
                
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Qty</p>
                  <p className="font-medium text-sm">{item.quantity}</p>
                </div>
                
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium text-sm">€{item.total_price.toFixed(2)}</p>
                </div>

                <Button variant="ghost" size="sm" onClick={() => removeInternalItem(item.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Subtotal (Internal Management):
            </p>
            <p className="font-bold text-blue-700 dark:text-blue-300">
              €{getInternalSubtotal().toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalItemsManager;
