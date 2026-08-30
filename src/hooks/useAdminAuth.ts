import { useAuthContext } from "@/contexts/AuthContext";

export const useAdminAuth = () => {
  const { user, isAdmin, loading, signIn, signOut } = useAuthContext();
  return { user, isAdmin, loading, signIn, signOut };
};
