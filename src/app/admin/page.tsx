"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { deleteAccount, fetchAllAccounts, fetchAllGroups } from "@/lib/admin";
import { deleteFamilyGroup } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";
import type { AdminAccount, FamilyGroup } from "@/types/database";

const PAGE_SIZE = 20;

function AdminContent() {
  const router = useRouter();
  const { user, isSuperAdmin, viewGroupAsAdmin, signOut } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [groups, setGroups] = useState<FamilyGroup[] | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [confirmingDeleteGroupId, setConfirmingDeleteGroupId] = useState<string | null>(null);
  const [confirmingDeleteAccountId, setConfirmingDeleteAccountId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [visibleGroupCount, setVisibleGroupCount] = useState(PAGE_SIZE);
  const [visibleAccountCount, setVisibleAccountCount] = useState(PAGE_SIZE);

  const filteredGroups = (groups ?? []).filter((g) => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.invite_code.toLowerCase().includes(q);
  });
  const filteredAccounts = (accounts ?? []).filter((a) => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return true;
    return a.display_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  const load = useCallback(async () => {
    setError(null);
    const [groupsResult, accountsResult] = await Promise.allSettled([fetchAllGroups(supabase), fetchAllAccounts(supabase)]);

    if (groupsResult.status === "fulfilled") {
      setGroups(groupsResult.value);
    } else {
      console.error("fetchAllGroups failed:", groupsResult.reason);
    }

    if (accountsResult.status === "fulfilled") {
      setAccounts(accountsResult.value);
    } else {
      console.error("fetchAllAccounts failed:", accountsResult.reason);
    }

    if (groupsResult.status === "rejected" || accountsResult.status === "rejected") {
      const messages = [
        groupsResult.status === "rejected" ? `グループ取得: ${String(groupsResult.reason?.message ?? groupsResult.reason)}` : null,
        accountsResult.status === "rejected"
          ? `アカウント取得: ${String(accountsResult.reason?.message ?? accountsResult.reason)}`
          : null,
      ].filter(Boolean);
      setError(`データの取得に失敗しました。\n${messages.join("\n")}`);
    }
  }, [supabase]);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  function handleViewGroup(group: FamilyGroup) {
    viewGroupAsAdmin(group);
    router.push("/home");
  }

  async function handleDeleteGroup(group: FamilyGroup) {
    setDeletingGroupId(group.id);
    try {
      await deleteFamilyGroup(supabase, group.id);
      showToast("グループを削除しました");
      await load();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeletingGroupId(null);
      setConfirmingDeleteGroupId(null);
    }
  }

  async function handleDeleteAccount(account: AdminAccount) {
    setDeletingId(account.id);
    try {
      await deleteAccount(supabase, account.id);
      showToast("アカウントを削除しました");
      if (account.id === user?.id) {
        await signOut();
        router.replace("/login");
        return;
      }
      await load();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeletingId(null);
      setConfirmingDeleteAccountId(null);
    }
  }

  if (!isSuperAdmin) {
    return <p className="text-sm text-gray-500">このページを表示する権限がありません。</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-gray-900">管理者ページ</h1>
      {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">全ての家族グループ（{filteredGroups.length}件）</h2>
        {!groups ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : (
          <>
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => {
                setGroupSearch(e.target.value);
                setVisibleGroupCount(PAGE_SIZE);
              }}
              placeholder="グループ名・招待コードで検索"
              className="mb-2 min-h-9 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
            <ul className="flex flex-col gap-2">
              {filteredGroups.slice(0, visibleGroupCount).map((g) => (
              <li key={g.id} className="rounded-lg border border-gray-200 px-4 py-3">
                {confirmingDeleteGroupId === g.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-red-700">
                      「{g.name}」を削除しますか？このグループの予定・実施作業とメンバー情報がすべて削除され、取り消せません。
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteGroupId(null)}
                        disabled={deletingGroupId === g.id}
                        className="min-h-9 flex-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(g)}
                        disabled={deletingGroupId === g.id}
                        className="min-h-9 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {deletingGroupId === g.id ? "削除中..." : "削除する"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                      <p className="font-mono text-xs text-gray-400">{g.invite_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewGroup(g)}
                        className="min-h-9 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600"
                      >
                        このグループを操作する
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteGroupId(g.id)}
                        className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </li>
              ))}
            </ul>
            {visibleGroupCount < filteredGroups.length && (
              <button
                type="button"
                onClick={() => setVisibleGroupCount((c) => c + PAGE_SIZE)}
                className="mt-2 min-h-9 w-full rounded-lg border border-gray-300 text-xs font-semibold text-gray-600"
              >
                もっと見る（残り{filteredGroups.length - visibleGroupCount}件）
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">全てのアカウント（{filteredAccounts.length}件）</h2>
        {!accounts ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : (
          <>
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => {
                setAccountSearch(e.target.value);
                setVisibleAccountCount(PAGE_SIZE);
              }}
              placeholder="表示名・メールアドレスで検索"
              className="mb-2 min-h-9 w-full rounded-lg border border-gray-300 px-3 text-sm"
            />
            <ul className="flex flex-col gap-2">
              {filteredAccounts.slice(0, visibleAccountCount).map((account) => (
              <li key={account.id} className="rounded-lg border border-gray-200 px-4 py-3">
                {confirmingDeleteAccountId === account.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-red-700">
                      {account.display_name}（{account.email}）のアカウントを削除しますか？この操作は取り消せません。
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteAccountId(null)}
                        disabled={deletingId === account.id}
                        className="min-h-9 flex-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(account)}
                        disabled={deletingId === account.id}
                        className="min-h-9 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {deletingId === account.id ? "削除中..." : "削除する"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {account.display_name}
                        {account.id === user?.id && <span className="ml-1 text-xs text-gray-400">(自分)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{account.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteAccountId(account.id)}
                      className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600"
                    >
                      削除
                    </button>
                  </div>
                )}
              </li>
              ))}
            </ul>
            {visibleAccountCount < filteredAccounts.length && (
              <button
                type="button"
                onClick={() => setVisibleAccountCount((c) => c + PAGE_SIZE)}
                className="mt-2 min-h-9 w-full rounded-lg border border-gray-300 text-xs font-semibold text-gray-600"
              >
                もっと見る（残り{filteredAccounts.length - visibleAccountCount}件）
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth showNav>
      <AdminContent />
    </RequireAuth>
  );
}
