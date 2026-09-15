"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function SettingsContent() {
  const { group, user, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    fetchGroupMembers(supabase, group.group.id)
      .then(setMembers)
      .catch(() => setError("メンバー情報の取得に失敗しました。"));
  }, [supabase, group]);

  async function handleCopyInviteCode() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.group.invite_code);
      showToast("招待コードをコピーしました");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-gray-900">設定</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">家族グループ</h2>
        <p className="mb-1 text-base font-semibold text-gray-900">{group?.group.name}</p>
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
              <span className="text-xs text-gray-400">{member.role === "owner" ? "作成者" : "メンバー"}</span>
            </li>
          ))}
        </ul>
      </section>

      <button
        onClick={handleSignOut}
        className="min-h-12 rounded-lg border border-gray-300 text-base font-semibold text-gray-700"
      >
        ログアウト
      </button>
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
