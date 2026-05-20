import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let authSession: Session | null | undefined;
const authListeners = new Set<(session: Session | null) => void>();

function setAuthSession(session: Session | null) {
  authSession = session;
  authListeners.forEach((listener) => listener(session));
}

export async function refreshAuthSession() {
  const { data } = await supabase.auth.getSession();
  setAuthSession(data.session);
  return data.session;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(authSession ?? null);
  const [loading, setLoading] = useState(authSession === undefined);

  useEffect(() => {
    const handleSession = (s: Session | null) => {
      setSession(s);
      setLoading(false);
    };

    authListeners.add(handleSession);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setAuthSession(s);
    });

    refreshAuthSession().catch(() => setLoading(false));

    return () => {
      authListeners.delete(handleSession);
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null as User | null,
    loading,
    isAuthenticated: !!session,
  };
}
