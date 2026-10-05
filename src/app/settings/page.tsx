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
  DISPLAY_NAME_MAX_LENGTH,
  fetchGroupMembers,
  fetchSoleMemberGroupIds,
  GROUP_NAME_MAX_LENGTH,
  leaveFamilyGroup,
  regenerateInviteCode,
  removeFamilyMember,
  renameFamilyGroup,
  transferGroupOwnership,
  updateMyDisplayName,
  validateDisplayName,
  validateGroupName,
  type MemberWithProfile,
} from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function SettingsContent() {
  const router = useRouter();
  const {
    user,
    group,
    groups,
    selectGroup,
    defaultGroupId,
    setDefaultGroup,
    refreshGroup,
    signOut,
    isAdminViewing,
    viewGroupAsAdmin,
  } = useAuth();
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

  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  // nullは「グループ名を表示中」、文字列は「編集中（入力中の名前）」
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [savingGroupName, setSavingGroupName] = useState(false);
  // nullは「表示名を表示中」、文字列は「編集中（入力中の名前）」
  const [editingDisplayName, setEditingDisplayName] = useState<string | null>(null);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const myDisplayName =
    members.find((m) => m.profile_id === user?.id)?.profile.display_name ??
    ((user?.user_metadata?.display_name as string | undefined) || "");

  const isOwner = group?.role === "owner";
  // 管理者ビュー中は役割をowner扱いにしているが、招待コードの再発行とメンバーの削除は
  // そのグループの本当の管理者しかDB側で許可されておらず必ず失敗するため、ボタン自体を出さない
  const canManageMembers = isOwner && !isAdminViewing;

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

  async function handleRenameDisplayName() {
    if (!user || editingDisplayName === null) return;
    const validationError = validateDisplayName(editingDisplayName);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    setSavingDisplayName(true);
    try {
      await updateMyDisplayName(supabase, user.id, editingDisplayName);
      // メンバー一覧（この画面の自分の名前・担当者名の元データ）を読み直して、新しい名前を表示に反映する
      loadMembers();
      setEditingDisplayName(null);
      showToast("表示名を変更しました");
    } catch {
      showToast("表示名を変更できませんでした。時間をおいて再度お試しください。", "error");
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleRenameGroup() {
    if (!group || editingGroupName === null) return;
    const validationError = validateGroupName(editingGroupName);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    setSavingGroupName(true);
    try {
      const renamed = await renameFamilyGroup(supabase, group.group.id, editingGroupName);
      // 管理者ビュー中は閲覧中のグループの情報を手元に持っているため、それを差し替えて表示に反映する
      if (isAdminViewing) viewGroupAsAdmin(renamed);
      else await refreshGroup();
      setEditingGroupName(null);
      showToast("グループ名を変更しました");
    } catch (err) {
      // DB関数が返した利用者向けのメッセージ（P0001。「権限がありません」など）だけを表示し、
      // 関数が見つからないなどの技術的な英語のメッセージは画面に出さない
      const dbError = err as { code?: string; message?: string };
      showToast(
        dbError?.code === "P0001" && dbError.message
          ? dbError.message
          : "グループ名を変更できませんでした。時間をおいて再度お試しください。",
        "error"
      );
    } finally {
      setSavingGroupName(false);
    }
  }

  async function handleSendPasswordReset() {
    if (!user?.email) return;
    setSendingPasswordReset(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingPasswordReset(false);
    if (resetError) {
      showToast(
        resetError.code === "over_email_send_rate_limit" || resetError.status === 429
          ? "短時間に送信が集中しています。しばらく時間をおいてから再度お試しください。"
          : "メールの送信に失敗しました。時間をおいて再度お試しください。",
        "error"
      );
      return;
    }
    showToast(`${user.email} に再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください`);
  }

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
      // 削除した人が同じ招待コードで再参加できないよう、DB側で招待コードも作り直しているため最新を読み込む
      await refreshGroup();
      showToast("メンバーを削除しました（招待コードも新しくなりました）");
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
      showToast("ログイン後に表示するグループを設定しました");
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
        <h2 className="mb-2 text-sm font-bold text-gray-400">アカウント</h2>
        <div className="mb-3 rounded-lg border border-gray-700 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-300">表示名</p>
          {editingDisplayName !== null ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editingDisplayName}
                onChange={(e) => setEditingDisplayName(e.target.value)}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                aria-label="新しい表示名"
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-base text-gray-100 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">変更すると、完了したものも含め、担当しているチケットの担当者名も新しい名前で表示されます。</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDisplayName(null)}
                  disabled={savingDisplayName}
                  className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleRenameDisplayName}
                  disabled={savingDisplayName}
                  className="min-h-10 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingDisplayName ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-100">{myDisplayName}</span>
              <button
                type="button"
                onClick={() => setEditingDisplayName(myDisplayName)}
                className="min-h-8 shrink-0 rounded-lg border border-gray-600 px-3 text-xs font-semibold text-gray-300"
              >
                表示名を変更
              </button>
            </div>
          )}
        </div>
        <div className="mb-3 rounded-lg border border-gray-700 p-4">
          <p className="mb-3 text-sm text-gray-300">
            安全のため、パスワードの変更は登録メールアドレス（{user?.email}）に届く再設定メールのリンクから行います。
          </p>
          <button
            type="button"
            onClick={handleSendPasswordReset}
            disabled={sendingPasswordReset || !user?.email}
            className="min-h-10 w-full rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
          >
            {sendingPasswordReset ? "送信中..." : "パスワードを変更する（再設定メールを送信）"}
          </button>
        </div>
        <div className="rounded-lg border border-red-300 p-4">
          {accountDeleteError && (
            <p className="mb-3 text-sm font-semibold text-red-300">{accountDeleteError}</p>
          )}
          {confirmingDeleteAccount ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-red-300">
                アカウントを削除しますか？所属している全てのグループから抜け、この操作は取り消せません。
              </p>
              {soleMemberGroupNames.length > 0 && (
                <p className="text-sm font-semibold text-red-300">
                  あなたが唯一のメンバーである次のグループも、アカウントと同時に削除されます：
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
          <h2 className="mb-2 text-sm font-bold text-gray-400">ログイン後に表示するグループ</h2>
          <select
            value={defaultGroupId ?? ""}
            onChange={(e) => handleChangeDefaultGroup(e.target.value)}
            disabled={savingDefaultGroup}
            className="w-full appearance-none rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-base text-gray-100 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">指定しない（最後に見ていたグループを表示）</option>
            {groups.map((g) => (
              <option key={g.group.id} value={g.group.id}>
                {g.group.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">次回ログイン時に、まずこのグループの画面が表示されます。</p>
        </section>
      )}

      {group && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-400">グループ名</h2>
          {editingGroupName !== null ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                maxLength={GROUP_NAME_MAX_LENGTH}
                aria-label="新しいグループ名"
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-base text-gray-100 focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGroupName(null)}
                  disabled={savingGroupName}
                  className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleRenameGroup}
                  disabled={savingGroupName}
                  className="min-h-10 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingGroupName ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 px-4 py-3">
              <span className="truncate text-sm font-semibold text-gray-100">{group.group.name}</span>
              {/* グループ名の変更は、そのグループの管理者（またはスーパー管理者）だけがDB側で許可されている */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditingGroupName(group.group.name)}
                  className="min-h-8 shrink-0 rounded-lg border border-gray-600 px-3 text-xs font-semibold text-gray-300"
                >
                  名前を変更
                </button>
              )}
            </div>
          )}
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
          {canManageMembers && (
            <button
              onClick={handleRegenerateInviteCode}
              disabled={regenerating}
              className="min-h-10 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300 disabled:opacity-50"
            >
              {regenerating ? "再発行中..." : "再発行"}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">この招待コードをメンバーに共有すると参加できます。</p>
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
                        {canManageMembers && (
                          <button
                            onClick={() => handleRemoveMember(member.profile_id, member.profile.display_name)}
                            disabled={removingId === member.profile_id}
                            className="min-h-8 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-400 disabled:opacity-50"
                          >
                            {removingId === member.profile_id ? "削除中..." : "削除"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
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
