import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AdminAuthState = {
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
};

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    user: null,
    isAdmin: false,
    mustChangePassword: false,
  });

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async (user: User | null) => {
      if (!user) {
        if (mounted) setState({ loading: false, user: null, isAdmin: false, mustChangePassword: false });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role, must_change_password")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (mounted) {
        setState({
          loading: false,
          user,
          isAdmin: !!data,
          mustChangePassword: !!(data as { must_change_password?: boolean } | null)?.must_change_password,
        });
      }
    };

    // onAuthStateChange fires INITIAL_SESSION on subscribe — that alone is
    // sufficient to bootstrap the state. The separate getSession() call was
    // redundant and caused a double DB query on every mount.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer to avoid Supabase recursive-listener deadlock
      setTimeout(() => void checkAdmin(session?.user ?? null), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
