"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { deleteAccountWithTransfers, fetchAllAccounts, fetchAllGroups, fetchGroupOwners, fetchGroupStats } from "@/lib/admin";
import { toErrorMessage } from "@/lib/errors";
import { deleteFamilyGroup, fetchGroupMembersForGroups, type MemberWithProfile } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";
import type { AdminAccount, FamilyGroup } from "@/types/database";

type AccountDeleteFlow = {
  account: AdminAccount;
  soloGroups: FamilyGroup[];
  transferGroups: { group: FamilyGroup; members: MemberWithProfile[] }[];
  selectedNewOwner: Record<string, string>;
};

const PAGE_SIZE = 20;

function AdminContent() {
  const router = useRouter();
  const { user, isSuperAdmin, viewGroupAsAdmin, signOut } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [groups, setGroups] = useState<FamilyGroup[] | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [groupOwners, setGroupOwners] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [confirmingDeleteGroupId, setConfirmingDeleteGroupId] = useState<string | null>(null);
  const [preparingGroupDeleteId, setPreparingGroupDeleteId] = useState<string | null>(null);
  const [groupStats, setGroupStats] = useState<{ id: string; memberCount: number; itemCount: number } | null>(null);
  const [groupDeleteError, setGroupDeleteError] = useState<{ id: string; message: string } | null>(null);
  const [deleteFlow, setDeleteFlow] = useState<AccountDeleteFlow | null>(null);
  const [preparingDeleteId, setPreparingDeleteId] = useState<string | null>(null);
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
  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const load = useCallback(async () => {
    setError(null);
    const [groupsResult, accountsResult] = await Promise.allSettled([fetchAllGroups(supabase), fetchAllAccounts(supabase)]);

    if (groupsResult.status === "fulfilled") {
      setGroups(groupsResult.value);
      fetchGroupOwners(
        supabase,
        groupsResult.value.map((g) => g.id)
      )
        .then(setGroupOwners)
        .catch(() => setGroupOwners(new Map()));
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

  // グループ削除できなかった理由を、確認前の通常表示に戻したうえで3秒だけそのまま見せる
  useEffect(() => {
    if (!groupDeleteError) return;
    const timer = setTimeout(() => setGroupDeleteError(null), 3000);
    return () => clearTimeout(timer);
  }, [groupDeleteError]);

  function handleViewGroup(group: FamilyGroup) {
    viewGroupAsAdmin(group);
    router.push("/home");
  }

  // 削除ボタン押下時、メンバー数・チケット数を確認画面で警告として見せてから、本当に削除するかを判断してもらう
  async function handleStartDeleteGroup(group: FamilyGroup) {
    setPreparingGroupDeleteId(group.id);
    try {
      const stats = await fetchGroupStats(supabase, group.id);
      setGroupStats({ id: group.id, ...stats });
      setConfirmingDeleteGroupId(group.id);
    } catch {
      showToast("グループ情報の取得に失敗しました。もう一度お試しください。", "error");
    } finally {
      setPreparingGroupDeleteId(null);
    }
  }

  async function handleDeleteGroup(group: FamilyGroup) {
    setDeletingGroupId(group.id);
    try {
      await deleteFamilyGroup(supabase, group.id);
      showToast("グループを削除しました");
      await load();
    } catch (err) {
      setGroupDeleteError({ id: group.id, message: toErrorMessage(err, "削除に失敗しました。もう一度お試しください。") });
    } finally {
      setDeletingGroupId(null);
      setConfirmingDeleteGroupId(null);
      setGroupStats(null);
    }
  }

  // 削除ボタン押下時、このアカウントが管理者になっているグループを調べ、
  // ひとりだけのグループは削除警告、他にメンバーがいるグループは委譲先の選択を確認画面に出す
  async function handleStartDeleteAccount(account: AdminAccount) {
    setPreparingDeleteId(account.id);
    try {
      const ownedGroupIds = (groups ?? []).filter((g) => groupOwners.get(g.id) === account.id).map((g) => g.id);
      if (ownedGroupIds.length === 0) {
        setDeleteFlow({ account, soloGroups: [], transferGroups: [], selectedNewOwner: {} });
        return;
      }

      const members = await fetchGroupMembersForGroups(supabase, ownedGroupIds);
      const membersByGroup = new Map<string, MemberWithProfile[]>();
      members.forEach((m) => {
        const list = membersByGroup.get(m.group_id) ?? [];
        list.push(m);
        membersByGroup.set(m.group_id, list);
      });

      const soloGroups: FamilyGroup[] = [];
      const transferGroups: { group: FamilyGroup; members: MemberWithProfile[] }[] = [];
      ownedGroupIds.forEach((gid) => {
        const targetGroup = (groups ?? []).find((g) => g.id === gid);
        if (!targetGroup) return;
        const others = (membersByGroup.get(gid) ?? []).filter((m) => m.profile_id !== account.id);
        if (others.length === 0) soloGroups.push(targetGroup);
        else transferGroups.push({ group: targetGroup, members: others });
      });

      setDeleteFlow({ account, soloGroups, transferGroups, selectedNewOwner: {} });
    } catch {
      showToast("グループ情報の取得に失敗しました。もう一度お試しください。", "error");
    } finally {
      setPreparingDeleteId(null);
    }
  }

  async function handleConfirmDeleteAccount() {
    if (!deleteFlow) return;
    const { account, transferGroups, selectedNewOwner } = deleteFlow;
    const missing = transferGroups.find(({ group }) => !selectedNewOwner[group.id]);
    if (missing) {
      showToast(`「${missing.group.name}」の新しい管理者を選択してください`, "error");
      return;
    }

    setDeletingId(account.id);
    try {
      await deleteAccountWithTransfers(
        supabase,
        account.id,
        transferGroups.map(({ group }) => ({ groupId: group.id, newOwnerId: selectedNewOwner[group.id] }))
      );
      showToast("アカウントを削除しました");
      if (account.id === user?.id) {
        await signOut();
        router.replace("/login");
        return;
      }
      await load();
    } catch (err) {
      showToast(toErrorMessage(err, "削除に失敗しました。もう一度お試しください。"), "error");
    } finally {
      setDeletingId(null);
      setDeleteFlow(null);
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
                    {groupStats?.id === g.id && (
                      <p className="text-sm font-semibold text-red-700">
                        メンバー{groupStats.memberCount}人、チケット{groupStats.itemCount}件が削除されます。
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteGroupId(null);
                          setGroupStats(null);
                        }}
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
                  <div className="flex flex-col gap-2">
                    {groupDeleteError?.id === g.id && (
                      <p className="text-xs font-semibold text-red-600">{groupDeleteError.message}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                        <p className="font-mono text-xs text-gray-400">{g.invite_code}</p>
                        {(() => {
                          const owner = accountsById.get(groupOwners.get(g.id) ?? "");
                          return (
                            <p className="text-xs text-gray-400">
                              管理者: {owner ? `${owner.display_name}（${owner.email}）` : "不明"}
                            </p>
                          );
                        })()}
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
                          onClick={() => handleStartDeleteGroup(g)}
                          disabled={preparingGroupDeleteId === g.id}
                          className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                        >
                          {preparingGroupDeleteId === g.id ? "確認中..." : "削除"}
                        </button>
                      </div>
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
                {deleteFlow?.account.id === account.id ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-red-700">
                      {account.display_name}（{account.email}）のアカウントを削除しますか？この操作は取り消せません。
                    </p>
                    {deleteFlow.soloGroups.length > 0 && (
                      <p className="text-sm font-semibold text-red-700">
                        このアカウントが唯一のメンバーである次の家族グループも、同時に削除されます：
                        {deleteFlow.soloGroups.map((g) => g.name).join("、")}
                      </p>
                    )}
                    {deleteFlow.transferGroups.map(({ group, members }) => (
                      <div key={group.id} className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-blue-700">
                          「{group.name}」の新しい管理者を選択してください
                        </p>
                        <select
                          value={deleteFlow.selectedNewOwner[group.id] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDeleteFlow((prev) =>
                              prev ? { ...prev, selectedNewOwner: { ...prev.selectedNewOwner, [group.id]: value } } : prev
                            );
                          }}
                          className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm"
                        >
                          <option value="">選択してください</option>
                          {members.map((m) => (
                            <option key={m.profile_id} value={m.profile_id}>
                              {m.profile.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteFlow(null)}
                        disabled={deletingId === account.id}
                        className="min-h-9 flex-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteAccount}
                        disabled={
                          deletingId === account.id ||
                          deleteFlow.transferGroups.some(({ group }) => !deleteFlow.selectedNewOwner[group.id])
                        }
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
                      onClick={() => handleStartDeleteAccount(account)}
                      disabled={preparingDeleteId === account.id}
                      className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      {preparingDeleteId === account.id ? "確認中..." : "削除"}
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
