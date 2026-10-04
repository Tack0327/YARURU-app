"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("メールアドレスを入力してください。");
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);

    if (resetError) {
      setError(
        resetError.code === "over_email_send_rate_limit" || resetError.status === 429
          ? "短時間に送信が集中しています。しばらく時間をおいてから再度お試しください。"
          : "メールの送信に失敗しました。メールアドレスをご確認のうえ再度お試しください。"
      );
      return;
    }
    // 登録の有無を第三者に推測されないよう、未登録のアドレスでも同じ完了画面を表示する
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">メールを送信しました</h1>
        <p className="mb-8 max-w-sm text-sm text-gray-300">
          {email} 宛にパスワード再設定用のリンクを送信しました。メール内のリンクを開き、新しいパスワードを設定してください。
        </p>
        <Link href="/login" className="font-semibold text-blue-400">
          ログイン画面へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-bold text-gray-100">パスワードの再設定</h1>
        <p className="mb-8 text-center text-sm text-gray-300">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-base text-gray-100 focus:border-blue-500"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 rounded-lg bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "送信中..." : "再設定メールを送信"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-300">
          <Link href="/login" className="font-semibold text-blue-400">
            ログイン画面へ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">読み込み中...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
