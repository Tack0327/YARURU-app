"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

type LinkStatus = "checking" | "ready" | "invalid";

function readUrlParam(name: string): string | null {
  const query = new URLSearchParams(window.location.search).get(name);
  if (query) return query;
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get(name);
}

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // リンクのトークンは1回しか使えないため、開発時のStrictModeで効果が2回走っても検証は1回だけにする
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    async function verifyLink() {
      if (readUrlParam("error") || readUrlParam("error_code")) {
        setLinkStatus("invalid");
        return;
      }

      // メールテンプレートでtoken_hash形式のリンクにしている場合（別の端末でメールを開いても使える）
      const tokenHash = readUrlParam("token_hash");
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        setLinkStatus(verifyError ? "invalid" : "ready");
        return;
      }

      // 標準のリンク（?code=...）はSupabaseクライアントが初期化時に自動でセッションへ交換するので、その完了を待つ
      const { data } = await supabase.auth.getSession();
      setLinkStatus(data.session ? "ready" : "invalid");
    }

    verifyLink();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateNewPassword(password, confirmPassword);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    // 以前と同じパスワードはSupabaseが「same_password」として拒否するが、
    // 結果として入力したパスワードでログインできる状態に変わりはないため、更新成功として扱う
    if (updateError && updateError.code !== "same_password") {
      setError(
        updateError.code === "weak_password"
          ? "パスワードが簡単すぎます。別のパスワードを入力してください。"
          : "パスワードの更新に失敗しました。時間をおいて再度お試しください。"
      );
      return;
    }
    setDone(true);
  }

  if (linkStatus === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-gray-800 text-gray-400">確認中...</div>;
  }

  if (linkStatus === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">リンクが無効です</h1>
        <p className="mb-8 max-w-sm text-sm text-gray-300">
          再設定用のリンクの有効期限が切れているか、すでに使用済みです。また、再設定メールを送信したときと同じブラウザでリンクを開く必要があります。お手数ですが、もう一度再設定メールを送信してください。
        </p>
        <Link href="/forgot-password" className="mb-4 font-semibold text-blue-400">
          再設定メールを再送信する
        </Link>
        <Link href="/login" className="text-sm text-gray-400">
          ログイン画面へ戻る
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">パスワードを更新しました</h1>
        <p className="mb-8 max-w-sm text-sm text-gray-300">次回から新しいパスワードでログインしてください。</p>
        <Link
          href="/home"
          className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white"
        >
          ホームへ進む
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-100">新しいパスワードの設定</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
              新しいパスワード（{MIN_PASSWORD_LENGTH}文字以上）
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={setPassword}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-300">
              新しいパスワード（確認用）
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={setConfirmPassword}
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
            {submitting ? "更新中..." : "パスワードを更新する"}
          </button>
        </form>
      </div>
    </div>
  );
}
