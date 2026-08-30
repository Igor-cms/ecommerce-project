import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Trash2 } from "lucide-react";

export const SamplePackConfirmDialog = () => {
  const { pendingSampleConfirm, confirmSampleReplace, cancelSampleReplace } = useCart();

  return (
    <AlertDialog open={!!pendingSampleConfirm} onOpenChange={(open) => { if (!open) cancelSampleReplace(); }}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center font-display">
            Replace cart with Sample Box?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            The Sample Box must be purchased on its own. Adding it will clear your current cart items.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="rounded-xl">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmSampleReplace}
            className="rounded-xl gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear cart & add Sample Box
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
