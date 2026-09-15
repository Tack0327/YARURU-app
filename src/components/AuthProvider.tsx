"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMyGroup, type MyGroupInfo } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  group: MyGroupInfo | null;
  loading: boolean;
  refreshGroup: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<MyGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGroup = useCallback(async () => {
    try {
      const info = await fetchMyGroup(supabase);
      setGroup(info);
    } catch {
      setGroup(null);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      if (data.user) await loadGroup();
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadGroup();
      } else {
        setGroup(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, loadGroup]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGroup(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, group, loading, refreshGroup: loadGroup, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
