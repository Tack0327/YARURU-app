"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { FORGOT_PASSWORD_HINT_THRESHOLD } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [theme, setTheme] = useState<Theme>("dark");
  // 入力済みのメールアドレスを再設定画面に引き継ぎ、もう一度入力する手間を省く
  const forgotPasswordHref = email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password";
  const showForgotPasswordHint = failedAttempts >= FORGOT_PASSWORD_HINT_THRESHOLD;

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function handleToggleTheme(checked: boolean) {
    const value: Theme = checked ? "dark" : "light";
    setTheme(value);
    setStoredTheme(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setSubmitting(false);
      setFailedAttempts((count) => count + 1);
      setError("メールアドレスまたはパスワードが正しくありません。");
      return;
    }
    // 成功時はここでsetSubmitting(false)をするとページ遷移が反映されるまでの間
    // 「ログイン中...」表示が一瞬「ログイン」に戻ってしまうため、遷移するまでtrueのままにする
    // "/"経由だとAuthProviderの状態が揃うのを待って再度リダイレクトする分、一段余計にレンダリングが挟まるため、
    // ログイン直後は直接/homeへ遷移する（所属グループが無い場合はRequireAuthが/groups/newへ誘導する）
    router.replace("/home");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 flex items-center justify-center gap-2 text-center text-2xl font-bold text-gray-100">
          YARURU
          <span className="text-xs font-normal text-gray-500">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        </h1>
        <label className="mb-8 flex items-center justify-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={theme === "dark"}
            onChange={(e) => handleToggleTheme(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600"
          />
          薄暗い背景
        </label>
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
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
              パスワード
            </label>
            <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
            <div className="mt-2 text-right">
              <Link href={forgotPasswordHref} className="text-sm text-blue-400">
                パスワードを忘れた場合
              </Link>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {showForgotPasswordHint && (
            <div className="rounded-lg border border-amber-600 bg-amber-950 px-4 py-3 text-sm text-amber-200">
              <p>{failedAttempts}回連続でログインに失敗しました。</p>
              <Link href={forgotPasswordHref} className="mt-1 inline-block font-semibold text-amber-100 underline">
                パスワードを忘れた場合はこちら
              </Link>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 rounded-lg bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-300">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="font-semibold text-blue-400">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
