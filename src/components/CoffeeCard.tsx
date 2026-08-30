import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, X, Upload } from "lucide-react";
import { Coffee } from "@/types/coffee";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoffeeCardProps {
  coffee: Coffee;
  editingId: number | null;
  onEdit: (id: number) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, field: string, value: any) => void;
  onAddTaste: (id: number, taste: string) => void;
  onRemoveTaste: (id: number, tasteIndex: number) => void;
}

export const CoffeeCard = ({
  coffee,
  editingId,
  onEdit,
  onSave,
  onDelete,
  onUpdate,
  onAddTaste,
  onRemoveTaste
}: CoffeeCardProps) => {
  const [newTaste, setNewTaste] = useState("");
  const [newRoastOption, setNewRoastOption] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${coffee.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('coffee-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('coffee-images')
        .getPublicUrl(filePath);

      // Update local state
      onUpdate(coffee.id, 'image', data.publicUrl);
      
      // Save to database immediately
      const { error: updateError } = await (supabase as any)
        .from('coffees')
        .update({ image: data.publicUrl })
        .eq('id', coffee.id);

      if (updateError) throw updateError;
      
      toast({
        title: "Success",
        description: "Image uploaded and saved successfully"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddTaste = () => {
    onAddTaste(coffee.id, newTaste);
    setNewTaste("");
  };

  const handleAddRoastOption = () => {
    if (newRoastOption.trim() && !coffee.roastOptions?.includes(newRoastOption.trim())) {
      const updatedRoastOptions = [...(coffee.roastOptions || []), newRoastOption.trim()];
      onUpdate(coffee.id, 'roastOptions', updatedRoastOptions);
      setNewRoastOption("");
    }
  };

  const handleRemoveRoastOption = (optionIndex: number) => {
    const updatedRoastOptions = coffee.roastOptions?.filter((_, index) => index !== optionIndex) || [];
    onUpdate(coffee.id, 'roastOptions', updatedRoastOptions);
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-4">
          <span className="text-2xl font-headline">{coffee.name}</span>
          <Badge variant={coffee.available ? "default" : "secondary"}>
            {coffee.available ? "Available" : "Unavailable"}
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          {editingId === coffee.id ? (
            <Button 
              size="sm" 
              onClick={() => onSave(coffee.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onEdit(coffee.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => onDelete(coffee.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`code-${coffee.id}`}>Coffee Code</Label>
            <Input
              id={`code-${coffee.id}`}
              value={coffee.code}
              onChange={(e) => onUpdate(coffee.id, 'code', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>
          
          <div>
            <Label htmlFor={`name-${coffee.id}`}>Name</Label>
            <Input
              id={`name-${coffee.id}`}
              value={coffee.name}
              onChange={(e) => onUpdate(coffee.id, 'name', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>

          <div>
            <Label htmlFor={`image-${coffee.id}`}>Image</Label>
            {editingId === coffee.id ? (
              <div className="space-y-2">
                <Input
                  id={`image-${coffee.id}`}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Upload new image"}
                  </span>
                </div>
              </div>
            ) : (
              <Input
                value={coffee.image}
                disabled
                placeholder="Image URL"
              />
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor={`description-${coffee.id}`}>Description</Label>
          <Textarea
            id={`description-${coffee.id}`}
            value={coffee.description}
            onChange={(e) => onUpdate(coffee.id, 'description', e.target.value)}
            disabled={editingId !== coffee.id}
            placeholder="Short description of the coffee"
          />
        </div>

        {/* Full Story */}
        <div>
          <Label htmlFor={`fullStory-${coffee.id}`}>Full Story</Label>
          <Textarea
            id={`fullStory-${coffee.id}`}
            value={coffee.fullStory}
            onChange={(e) => onUpdate(coffee.id, 'fullStory', e.target.value)}
            disabled={editingId !== coffee.id}
            placeholder="Detailed story about the coffee, farm, and producer"
            className="min-h-[120px]"
          />
        </div>

        {/* Farm Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`farm-${coffee.id}`}>Farm</Label>
            <Input
              id={`farm-${coffee.id}`}
              value={coffee.farm}
              onChange={(e) => onUpdate(coffee.id, 'farm', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>
          
          <div>
            <Label htmlFor={`region-${coffee.id}`}>Region</Label>
            <Input
              id={`region-${coffee.id}`}
              value={coffee.region}
              onChange={(e) => onUpdate(coffee.id, 'region', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>

          <div>
            <Label htmlFor={`country-${coffee.id}`}>Country</Label>
            <Input
              id={`country-${coffee.id}`}
              value={coffee.country}
              onChange={(e) => onUpdate(coffee.id, 'country', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`producer-${coffee.id}`}>Producer</Label>
            <Input
              id={`producer-${coffee.id}`}
              value={coffee.producer}
              onChange={(e) => onUpdate(coffee.id, 'producer', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>

          <div>
            <Label htmlFor={`variety-${coffee.id}`}>Variety</Label>
            <Input
              id={`variety-${coffee.id}`}
              value={coffee.variety}
              onChange={(e) => onUpdate(coffee.id, 'variety', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>

          <div>
            <Label htmlFor={`altitude-${coffee.id}`}>Altitude</Label>
            <Input
              id={`altitude-${coffee.id}`}
              value={coffee.altitude}
              onChange={(e) => onUpdate(coffee.id, 'altitude', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>
          <div>
            <Label htmlFor={`processing-${coffee.id}`}>Processing</Label>
            <Input
              id={`processing-${coffee.id}`}
              value={coffee.processing}
              onChange={(e) => onUpdate(coffee.id, 'processing', e.target.value)}
              disabled={editingId !== coffee.id}
            />
          </div>
        </div>

        {/* Pricing and Size Availability */}
        <div>
          <Label>Pricing and Size Availability</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`size-125g-${coffee.id}`}
                  checked={coffee.sizeAvailability["125g"]}
                  onCheckedChange={(checked) => onUpdate(coffee.id, 'sizeAvailability', { ...coffee.sizeAvailability, "125g": checked })}
                  disabled={editingId !== coffee.id}
                />
                <Label htmlFor={`size-125g-${coffee.id}`}>125g Available</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                value={coffee.pricing["125g"]}
                onChange={(e) => onUpdate(coffee.id, 'pricing', { ...coffee.pricing, "125g": parseFloat(e.target.value) })}
                disabled={editingId !== coffee.id || !coffee.sizeAvailability["125g"]}
                placeholder="Price (€)"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`size-250g-${coffee.id}`}
                  checked={coffee.sizeAvailability["250g"]}
                  onCheckedChange={(checked) => onUpdate(coffee.id, 'sizeAvailability', { ...coffee.sizeAvailability, "250g": checked })}
                  disabled={editingId !== coffee.id}
                />
                <Label htmlFor={`size-250g-${coffee.id}`}>250g Available</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                value={coffee.pricing["250g"]}
                onChange={(e) => onUpdate(coffee.id, 'pricing', { ...coffee.pricing, "250g": parseFloat(e.target.value) })}
                disabled={editingId !== coffee.id || !coffee.sizeAvailability["250g"]}
                placeholder="Price (€)"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`size-1kg-${coffee.id}`}
                  checked={coffee.sizeAvailability["1kg"]}
                  onCheckedChange={(checked) => onUpdate(coffee.id, 'sizeAvailability', { ...coffee.sizeAvailability, "1kg": checked })}
                  disabled={editingId !== coffee.id}
                />
                <Label htmlFor={`size-1kg-${coffee.id}`}>1kg Available</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                value={coffee.pricing["1kg"]}
                onChange={(e) => onUpdate(coffee.id, 'pricing', { ...coffee.pricing, "1kg": parseFloat(e.target.value) })}
                disabled={editingId !== coffee.id || !coffee.sizeAvailability["1kg"]}
                placeholder="Price (€)"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor={`category-${coffee.id}`}>Category</Label>
          <Select
            value={coffee.category}
            onValueChange={(value) => onUpdate(coffee.id, 'category', value)}
            disabled={editingId !== coffee.id}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border">
              <SelectItem value="specialty">Specialty</SelectItem>
              <SelectItem value="rare">Rare</SelectItem>
              <SelectItem value="exceptional">Exceptional</SelectItem>
              <SelectItem value="competition">Competition</SelectItem>
              <SelectItem value="world-class">World Class</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Tastes Like</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {coffee.tastesLike.map((taste, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {taste}
                {editingId === coffee.id && (
                  <button
                    onClick={() => onRemoveTaste(coffee.id, index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {editingId === coffee.id && (
            <div className="flex gap-2">
              <Input
                placeholder="Add new taste"
                value={newTaste}
                onChange={(e) => setNewTaste(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTaste()}
              />
              <Button size="sm" onClick={handleAddTaste}>
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Roast Options */}
        <div>
          <Label>Roast Options</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {coffee.roastOptions?.map((option, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {option}
                {editingId === coffee.id && (
                  <button
                    onClick={() => handleRemoveRoastOption(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {editingId === coffee.id && (
            <div className="flex gap-2">
              <Input
                placeholder="Add roast option (e.g., Espresso, Filter)"
                value={newRoastOption}
                onChange={(e) => setNewRoastOption(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRoastOption()}
              />
              <Button size="sm" onClick={handleAddRoastOption}>
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id={`available-${coffee.id}`}
            checked={coffee.available}
            onCheckedChange={(checked) => onUpdate(coffee.id, 'available', checked)}
            disabled={editingId !== coffee.id}
          />
          <Label htmlFor={`available-${coffee.id}`}>Available for purchase</Label>
        </div>
      </CardContent>
    </Card>
  );
};