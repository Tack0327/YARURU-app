"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { createFamilyGroup } from "@/lib/families";
import { createClient } from "@/lib/supabase/client";

function NewGroupForm() {
  const router = useRouter();
  const { refreshGroup } = useAuth();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createFamilyGroup(supabase, name);
      await refreshGroup();
      router.replace("/home");
    } catch {
      setError("家族グループの作成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">家族グループを作成</h1>
        <p className="mb-8 text-center text-sm text-gray-600">
          グループを作成すると、招待コードを家族に共有して参加してもらえます。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="groupName" className="mb-1 block text-sm font-medium text-gray-700">
              グループ名
            </label>
            <input
              id="groupName"
              type="text"
              required
              placeholder="例：田中家"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
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
            {submitting ? "作成中..." : "グループを作成する"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          招待コードをお持ちの方は{" "}
          <Link href="/groups/join" className="font-semibold text-blue-600">
            参加する
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function NewGroupPage() {
  return (
    <RequireAuth>
      <NewGroupForm />
    </RequireAuth>
  );
}
