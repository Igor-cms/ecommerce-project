import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProductCardSkeletonProps {
  className?: string;
}

export const ProductCardSkeleton = ({ className }: ProductCardSkeletonProps) => {
  return (
    <Card className={cn(
      "border-0 shadow-card overflow-hidden",
      className
    )}>
      <CardHeader className="p-0">
        <div className="aspect-square relative overflow-hidden">
          <Skeleton className="w-full h-full absolute inset-0 rounded-none" />
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex flex-wrap gap-1 mt-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <div className="flex gap-2 w-full">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </CardFooter>
    </Card>
  );
};
