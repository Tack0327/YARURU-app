"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMyGroups, type MyGroupInfo } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

const SELECTED_GROUP_STORAGE_KEY = "yaruru:selectedGroupId";

type AuthContextValue = {
  user: User | null;
  /** 現在選択中の家族グループ */
  group: MyGroupInfo | null;
  /** 自分が所属している全ての家族グループ */
  groups: MyGroupInfo[];
  selectGroup: (groupId: string) => void;
  loading: boolean;
  refreshGroup: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<MyGroupInfo[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => (typeof window !== "undefined" && window.localStorage.getItem(SELECTED_GROUP_STORAGE_KEY)) || null
  );
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    try {
      const list = await fetchMyGroups(supabase);
      setGroups(list);
    } catch {
      setGroups([]);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      if (data.user) await loadGroups();
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadGroups();
      } else {
        setGroups([]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, loadGroups]);

  const selectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId);
  }, []);

  // 選択中のグループが所属グループ一覧に無い場合（未選択・脱退済みなど）は先頭のグループにフォールバックする
  const group = useMemo(
    () => groups.find((g) => g.group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGroups([]);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, group, groups, selectGroup, loading, refreshGroup: loadGroups, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
