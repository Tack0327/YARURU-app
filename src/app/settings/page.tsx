"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { deleteAccount } from "@/lib/admin";
import { toErrorMessage } from "@/lib/errors";
import {
  deleteFamilyGroup,
  fetchGroupMembers,
  fetchSoleMemberGroupIds,
  leaveFamilyGroup,
  regenerateInviteCode,
  removeFamilyMember,
  transferGroupOwnership,
  type MemberWithProfile,
} from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function SettingsContent() {
  const router = useRouter();
  const { user, group, groups, selectGroup, defaultGroupId, setDefaultGroup, refreshGroup, signOut } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [confirmingDeleteGroup, setConfirmingDeleteGroup] = useState(false);
  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);
  const [savingDefaultGroup, setSavingDefaultGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [confirmingLeaveGroup, setConfirmingLeaveGroup] = useState(false);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);
  const [soleMemberGroupNames, setSoleMemberGroupNames] = useState<string[]>([]);

  const isOwner = group?.role === "owner";

  // 退会できなかった理由を、ボタンの近くにしばらく表示する（トーストは消えるのが早く見逃しやすいため）
  useEffect(() => {
    if (!accountDeleteError) return;
    const timer = setTimeout(() => setAccountDeleteError(null), 8000);
    return () => clearTimeout(timer);
  }, [accountDeleteError]);

  // 自分ひとりだけが所属している家族グループは、退会と同時に削除されるため、確認画面で警告するために調べておく
  useEffect(() => {
    if (groups.length === 0) {
      setSoleMemberGroupNames([]);
      return;
    }
    fetchSoleMemberGroupIds(supabase, groups.map((g) => g.group.id))
      .then((ids) => {
        const idSet = new Set(ids);
        setSoleMemberGroupNames(groups.filter((g) => idSet.has(g.group.id)).map((g) => g.group.name));
      })
      .catch(() => setSoleMemberGroupNames([]));
  }, [supabase, groups]);

  const loadMembers = useCallback(() => {
    if (!group) return;
    fetchGroupMembers(supabase, group.group.id)
      .then(setMembers)
      .catch(() => setError("メンバー情報の取得に失敗しました。"));
  }, [supabase, group]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleCopyInviteCode() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.group.invite_code);
      showToast("招待コードをコピーしました");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  }

  async function handleRegenerateInviteCode() {
    if (!group) return;
    if (!window.confirm("招待コードを再発行しますか？古いコードは使えなくなります。")) return;
    setRegenerating(true);
    try {
      await regenerateInviteCode(supabase, group.group.id);
      await refreshGroup();
      showToast("招待コードを再発行しました");
    } catch {
      showToast("再発行に失敗しました。もう一度お試しください。", "error");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRemoveMember(profileId: string, displayName: string) {
    if (!group) return;
    if (!window.confirm(`${displayName}さんをこのグループから削除しますか？`)) return;
    setRemovingId(profileId);
    try {
      await removeFamilyMember(supabase, group.group.id, profileId);
      showToast("メンバーを削除しました");
      loadMembers();
    } catch (err) {
      showToast(toErrorMessage(err, "削除に失敗しました。もう一度お試しください。"), "error");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleTransferOwnership(profileId: string, displayName: string) {
    if (!group) return;
    setTransferringId(profileId);
    try {
      await transferGroupOwnership(supabase, group.group.id, profileId);
      showToast(`${displayName}さんを管理者にしました`);
      await refreshGroup();
      loadMembers();
    } catch (err) {
      showToast(toErrorMessage(err, "管理者の変更に失敗しました。もう一度お試しください。"), "error");
    } finally {
      setTransferringId(null);
      setConfirmingTransferId(null);
    }
  }

  async function handleChangeDefaultGroup(groupId: string) {
    setSavingDefaultGroup(true);
    try {
      await setDefaultGroup(groupId || null);
      showToast("ログイン後に表示する家族を設定しました");
    } catch {
      showToast("設定に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSavingDefaultGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;
    setDeletingGroup(true);
    try {
      await deleteFamilyGroup(supabase, group.group.id);
      await refreshGroup();
      showToast("グループを削除しました");
      router.replace("/home");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeletingGroup(false);
      setConfirmingDeleteGroup(false);
    }
  }

  async function handleLeaveGroup() {
    if (!group) return;
    setLeavingGroup(true);
    try {
      await leaveFamilyGroup(supabase, group.group.id);
      await refreshGroup();
      showToast("グループから脱退しました");
      router.replace("/home");
    } catch (err) {
      showToast(toErrorMessage(err, "脱退に失敗しました。もう一度お試しください。"), "error");
    } finally {
      setLeavingGroup(false);
      setConfirmingLeaveGroup(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeletingAccount(true);
    setAccountDeleteError(null);
    try {
      await deleteAccount(supabase, user.id);
      await signOut();
      router.replace("/login");
    } catch (err) {
      setAccountDeleteError(toErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
      setDeletingAccount(false);
      setConfirmingDeleteAccount(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-gray-100">設定</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-400">所属グループ</h2>
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <div
              key={g.group.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                g.group.id === group?.group.id ? "border-blue-500 bg-blue-950" : "border-gray-700"
              }`}
            >
              <span className="text-sm font-semibold text-gray-100">{g.group.name}</span>
              {g.group.id === group?.group.id ? (
                <span className="text-xs font-semibold text-blue-400">選択中</span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectGroup(g.group.id)}
                  className="min-h-8 rounded-lg border border-gray-600 px-3 text-xs font-semibold text-gray-300"
                >
                  切り替える
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <Link href="/groups/new" className="font-semibold text-blue-400">
            + 新しいグループを作成
          </Link>
          <Link href="/groups/join" className="font-semibold text-blue-400">
            招待コードで参加する
          </Link>
        </div>
      </section>

      {groups.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-400">ログイン後に表示する家族</h2>
          <select
            value={defaultGroupId ?? ""}
            onChange={(e) => handleChangeDefaultGroup(e.target.value)}
            disabled={savingDefaultGroup}
            className="w-full appearance-none rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-base text-gray-100 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">指定しない（最後に見ていた家族を表示）</option>
            {groups.map((g) => (
              <option key={g.group.id} value={g.group.id}>
                {g.group.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">次回ログイン時に、まずこの家族の画面が表示されます。</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-400">招待コード（{group?.group.name}）</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-gray-700 px-3 py-2 font-mono text-sm text-gray-300">
            {group?.group.invite_code}
          </span>
          <button
            onClick={handleCopyInviteCode}
            className="min-h-10 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300"
          >
            コピー
          </button>
          {isOwner && (
            <button
              onClick={handleRegenerateInviteCode}
              disabled={regenerating}
              className="min-h-10 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300 disabled:opacity-50"
            >
              {regenerating ? "再発行中..." : "再発行"}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">この招待コードを家族に共有すると参加できます。</p>
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-400">危険な操作</h2>
          <div className="rounded-lg border border-red-300 p-4">
            {confirmingDeleteGroup ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-red-300">
                  「{group?.group.name}」を削除しますか？このグループの予定・実施作業・メンバー情報がすべて削除され、取り消せません。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteGroup(false)}
                    disabled={deletingGroup}
                    className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={deletingGroup}
                    className="min-h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {deletingGroup ? "削除中..." : "削除する"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteGroup(true)}
                  className="min-h-12 w-full text-base font-semibold text-red-400"
                >
                  {`「${group?.group.name}」を削除する`}
                </button>
                <p className="mt-1 text-xs text-gray-500">
                  このグループの予定・実施作業・メンバー情報がすべて削除されます。取り消せません。
                </p>
              </>
            )}
          </div>
          {members.length > 1 && (
            <p className="mt-2 text-xs text-gray-500">
              グループを残したまま脱退したい場合は、下のメンバー一覧から別のメンバーを管理者にしてください。
            </p>
          )}
        </section>
      )}

      {!isOwner && group && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-400">危険な操作</h2>
          <div className="rounded-lg border border-red-300 p-4">
            {confirmingLeaveGroup ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-red-300">
                  「{group.group.name}」から脱退しますか？このグループの予定・実施作業は閲覧できなくなります。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingLeaveGroup(false)}
                    disabled={leavingGroup}
                    className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveGroup}
                    disabled={leavingGroup}
                    className="min-h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {leavingGroup ? "脱退中..." : "脱退する"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingLeaveGroup(true)}
                className="min-h-12 w-full text-base font-semibold text-red-400"
              >
                {`「${group.group.name}」から脱退する`}
              </button>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-400">メンバー</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-lg border border-gray-700 px-4 py-3">
              {confirmingTransferId === member.profile_id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-blue-300">
                    {member.profile.display_name}さんを管理者にしますか？あなたは一般メンバーになります。
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingTransferId(null)}
                      disabled={transferringId === member.profile_id}
                      className="min-h-9 flex-1 rounded-lg border border-gray-600 text-xs font-semibold text-gray-300 disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransferOwnership(member.profile_id, member.profile.display_name)}
                      disabled={transferringId === member.profile_id}
                      className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {transferringId === member.profile_id ? "変更中..." : "管理者にする"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-100">
                    {member.profile.display_name}
                    {member.profile_id === user?.id && <span className="ml-1 text-xs text-gray-500">(自分)</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{member.role === "owner" ? "管理者" : "メンバー"}</span>
                    {isOwner && member.profile_id !== user?.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmingTransferId(member.profile_id)}
                          className="min-h-8 rounded-lg border border-blue-300 px-3 text-xs font-semibold text-blue-400"
                        >
                          管理者にする
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.profile_id, member.profile.display_name)}
                          disabled={removingId === member.profile_id}
                          className="min-h-8 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-400 disabled:opacity-50"
                        >
                          {removingId === member.profile_id ? "削除中..." : "削除"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-400">アカウント</h2>
        <div className="rounded-lg border border-red-300 p-4">
          {accountDeleteError && (
            <p className="mb-3 text-sm font-semibold text-red-300">{accountDeleteError}</p>
          )}
          {confirmingDeleteAccount ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-red-300">
                アカウントを削除しますか？所属している全ての家族グループから抜け、この操作は取り消せません。
              </p>
              {soleMemberGroupNames.length > 0 && (
                <p className="text-sm font-semibold text-red-300">
                  あなたが唯一のメンバーである次の家族グループも、アカウントと同時に削除されます：
                  {soleMemberGroupNames.join("、")}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteAccount(false)}
                  disabled={deletingAccount}
                  className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="min-h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deletingAccount ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDeleteAccount(true)}
              className="min-h-12 w-full text-base font-semibold text-red-400"
            >
              アカウントを削除する（退会）
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth requireGroup showNav>
      <SettingsContent />
    </RequireAuth>
  );
}
