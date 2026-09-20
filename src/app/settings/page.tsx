"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { fetchGroupMembers, regenerateInviteCode, removeFamilyMember, type MemberWithProfile } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function SettingsContent() {
  const { user, group, groups, selectGroup, refreshGroup } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = group?.role === "owner";

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
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-gray-900">設定</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">所属グループ</h2>
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <div
              key={g.group.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                g.group.id === group?.group.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{g.group.name}</span>
              {g.group.id === group?.group.id ? (
                <span className="text-xs font-semibold text-blue-600">選択中</span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectGroup(g.group.id)}
                  className="min-h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600"
                >
                  切り替える
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <Link href="/groups/new" className="font-semibold text-blue-600">
            + 新しいグループを作成
          </Link>
          <Link href="/groups/join" className="font-semibold text-blue-600">
            招待コードで参加する
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">招待コード（{group?.group.name}）</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-700">
            {group?.group.invite_code}
          </span>
          <button
            onClick={handleCopyInviteCode}
            className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700"
          >
            コピー
          </button>
          {isOwner && (
            <button
              onClick={handleRegenerateInviteCode}
              disabled={regenerating}
              className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              {regenerating ? "再発行中..." : "再発行"}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">この招待コードを家族に共有すると参加できます。</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">メンバー</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-900">
                {member.profile.display_name}
                {member.profile_id === user?.id && <span className="ml-1 text-xs text-gray-400">(自分)</span>}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{member.role === "owner" ? "作成者" : "メンバー"}</span>
                {isOwner && member.profile_id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.profile_id, member.profile.display_name)}
                    disabled={removingId === member.profile_id}
                    className="min-h-8 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                  >
                    {removingId === member.profile_id ? "削除中..." : "削除"}
                  </button>
                )}
              </div>
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
