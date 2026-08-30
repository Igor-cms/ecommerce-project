import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser as User, AuthSession as Session } from "@supabase/supabase-js";



interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    const [profileResult, rolesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .in("role", ["admin", "owner"]),
    ]);

    setProfile(profileResult.data);

    if (rolesResult.error) {
      console.error("Error checking admin role:", rolesResult.error);
      setIsAdmin(false);
    } else {
      setIsAdmin(rolesResult.data != null && rolesResult.data.length > 0);
    }
  }, []);

  const processSession = useCallback(async (session: Session | null) => {
    const currentUser = session?.user ?? null;
    setUser(currentUser);
    await fetchUserData(currentUser);
    setLoading(false);
  }, [fetchUserData]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        // Defer data fetch to avoid deadlock with auth state change
        setTimeout(async () => {
          if (!mounted) return;
          await fetchUserData(currentUser);
          if (mounted) setLoading(false);
        }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) processSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, processSession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
