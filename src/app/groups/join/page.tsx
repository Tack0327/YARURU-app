"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { joinFamilyGroup } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function JoinGroupForm() {
  const router = useRouter();
  const { refreshGroup } = useAuth();
  const [supabase] = useState(() => createClient());
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await joinFamilyGroup(supabase, inviteCode.trim().toUpperCase());
      await refreshGroup();
      router.replace("/home");
    } catch {
      setError("招待コードが正しくありません。ご確認のうえ再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">家族グループに参加</h1>
        <p className="mb-8 text-center text-sm text-gray-600">家族から共有された招待コードを入力してください。</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-gray-700">
              招待コード
            </label>
            <input
              id="inviteCode"
              type="text"
              required
              placeholder="例：A1B2C3D4"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base uppercase focus:border-blue-500"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 rounded-lg bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "参加中..." : "参加する"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          まだグループがない方は{" "}
          <Link href="/groups/new" className="font-semibold text-blue-600">
            作成する
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function JoinGroupPage() {
  return (
    <RequireAuth>
      <JoinGroupForm />
    </RequireAuth>
  );
}
