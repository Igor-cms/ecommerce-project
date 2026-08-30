import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PageSetting {
  id: string;
  slug: string;
  label: string;
  is_visible: boolean;
  updated_at: string;
}

export const usePageVisibility = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pageSettings = [], isLoading } = useQuery<PageSetting[]>({
    queryKey: ['page-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_settings')
        .select('*')
        .order('label');

      if (error) throw error;
      return (data as PageSetting[]) ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const isPageVisible = (slug: string): boolean => {
    const setting = pageSettings.find((p) => p.slug === slug);
    return setting ? setting.is_visible : true; // default visible if not found
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ slug, isVisible }: { slug: string; isVisible: boolean }) => {
      const { error } = await supabase
        .from('page_settings')
        .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
        .eq('slug', slug);

      if (error) throw error;
    },
    onMutate: async ({ slug, isVisible }) => {
      await queryClient.cancelQueries({ queryKey: ['page-settings'] });
      const previous = queryClient.getQueryData<PageSetting[]>(['page-settings']);

      queryClient.setQueryData<PageSetting[]>(['page-settings'], (old) =>
        old?.map((p) => (p.slug === slug ? { ...p, is_visible: isVisible } : p)) ?? []
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['page-settings'], context?.previous);
      toast({
        title: 'Error',
        description: 'Failed to update page visibility.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Page visibility saved.' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['page-settings'] });
    },
  });

  const togglePageVisibility = (slug: string, isVisible: boolean) => {
    toggleMutation.mutate({ slug, isVisible });
  };

  return {
    pageSettings,
    isLoading,
    isPageVisible,
    togglePageVisibility,
  };
};
