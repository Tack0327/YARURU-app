"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { checkIsSuperAdmin } from "@/lib/admin";
import { fetchMyGroups, fetchMyProfile, updateDefaultGroup, type MyGroupInfo } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";
import type { FamilyGroup } from "@/types/database";

const SELECTED_GROUP_STORAGE_KEY = "yaruru:selectedGroupId";

type AuthContextValue = {
  user: User | null;
  /** 現在選択中の家族グループ（管理者ビュー中は閲覧対象のグループ） */
  group: MyGroupInfo | null;
  /** 自分が所属している全ての家族グループ */
  groups: MyGroupInfo[];
  /** 家族グループの取得に失敗した場合のエラーメッセージ（成功していればnull） */
  groupsError: string | null;
  selectGroup: (groupId: string) => void;
  /** ログイン後に最初に表示する家族グループのID（未設定ならnull） */
  defaultGroupId: string | null;
  /** ログイン後に最初に表示する家族グループを設定する */
  setDefaultGroup: (groupId: string | null) => Promise<void>;
  isSuperAdmin: boolean;
  /** スーパー管理者が、自分が所属していないグループを一時的に閲覧・操作する */
  viewGroupAsAdmin: (group: FamilyGroup) => void;
  /** 管理者ビューを終了し、自分の所属グループに戻る */
  exitAdminView: () => void;
  isAdminViewing: boolean;
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
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminViewGroup, setAdminViewGroup] = useState<FamilyGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(
    async (userId: string) => {
      try {
        const [list, superAdmin, profile] = await Promise.all([
          fetchMyGroups(supabase, userId),
          checkIsSuperAdmin(supabase),
          fetchMyProfile(supabase, userId),
        ]);
        setGroups(list);
        setIsSuperAdmin(superAdmin);
        setGroupsError(null);
        const defaultId = profile?.default_group_id ?? null;
        setDefaultGroupId(defaultId);

        setSelectedGroupId((prev) => {
          // 選択中のグループが最新の所属一覧に無い場合（脱退・削除済みなど）は選択状態をクリアする
          const isStillMember = !!prev && list.some((g) => g.group.id === prev);
          if (prev && !isStillMember && typeof window !== "undefined") {
            window.localStorage.removeItem(SELECTED_GROUP_STORAGE_KEY);
          }
          if (isStillMember) return prev;

          // このブラウザでまだ何も選択していない場合（ログイン直後など）は、
          // 設定済みのデフォルトグループを初期表示に使う
          if (defaultId && list.some((g) => g.group.id === defaultId)) {
            if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, defaultId);
            return defaultId;
          }
          return null;
        });
      } catch {
        // 一時的な通信エラー等で取得に失敗しても、既存のgroups/isSuperAdminは保持する
        // （空にすると「所属グループがない」と誤解され、/groups/newへ誘導されてしまうため）
        setGroupsError("家族グループの取得に失敗しました。通信状況をご確認のうえ、再読み込みしてください。");
      }
    },
    [supabase]
  );

  const refreshGroup = useCallback(async () => {
    if (!user) return;
    await loadGroups(user.id);
  }, [user, loadGroups]);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      if (data.user) await loadGroups(data.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // setLoading(false)を先に呼ぶと、groups未取得のまま「所属グループが無い」と
        // 誤判定されて/groups/newへ一瞬遷移してしまうため、取得完了を待ってから解除する
        await loadGroups(session.user.id);
      } else {
        setGroups([]);
        setIsSuperAdmin(false);
        setGroupsError(null);
        setAdminViewGroup(null);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, loadGroups]);

  const selectGroup = useCallback((groupId: string) => {
    setAdminViewGroup(null);
    setSelectedGroupId(groupId);
    if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId);
  }, []);

  const setDefaultGroup = useCallback(
    async (groupId: string | null) => {
      if (!user) return;
      await updateDefaultGroup(supabase, groupId);
      setDefaultGroupId(groupId);
    },
    [supabase, user]
  );

  const viewGroupAsAdmin = useCallback((targetGroup: FamilyGroup) => {
    setAdminViewGroup(targetGroup);
  }, []);

  const exitAdminView = useCallback(() => {
    setAdminViewGroup(null);
  }, []);

  // 選択中のグループが所属グループ一覧に無い場合（未選択・脱退済みなど）は先頭のグループにフォールバックする
  const group = useMemo<MyGroupInfo | null>(() => {
    if (adminViewGroup) return { group: adminViewGroup, role: "owner" };
    return groups.find((g) => g.group.id === selectedGroupId) ?? groups[0] ?? null;
  }, [groups, selectedGroupId, adminViewGroup]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGroups([]);
    setIsSuperAdmin(false);
    setGroupsError(null);
    setAdminViewGroup(null);
    // 次回ログイン時にデフォルトの家族グループへ戻れるよう、このブラウザでの選択状態をクリアする
    setSelectedGroupId(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(SELECTED_GROUP_STORAGE_KEY);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        group,
        groups,
        groupsError,
        selectGroup,
        defaultGroupId,
        setDefaultGroup,
        isSuperAdmin,
        viewGroupAsAdmin,
        exitAdminView,
        isAdminViewing: adminViewGroup !== null,
        loading,
        refreshGroup,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
