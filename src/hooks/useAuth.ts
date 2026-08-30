import { useAuthContext } from "@/contexts/AuthContext";

export const useAuth = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuthContext();
  return { user, profile, loading, signOut, refreshProfile };
};
