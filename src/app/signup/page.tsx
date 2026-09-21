"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "このメールアドレスは既に登録されています。"
          : "登録に失敗しました。入力内容をご確認ください。"
      );
      return;
    }

    if (data.session) {
      router.replace("/");
    } else {
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">確認メールを送信しました</h1>
        <p className="mb-8 max-w-sm text-sm text-gray-300">
          {email} 宛に届いたメール内のリンクから認証を完了してください。
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
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-100">新規登録</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-gray-300">
              表示名
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-base text-gray-100 focus:border-blue-500"
            />
          </div>
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
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
              パスワード（6文字以上）
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={setPassword}
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
            {submitting ? "登録中..." : "登録する"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-300">
          既にアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-semibold text-blue-400">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
