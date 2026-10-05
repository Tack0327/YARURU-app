"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import {
  isRecoveryWindowOpen,
  MIN_PASSWORD_LENGTH,
  RECOVERY_SESSION_MAX_AGE_SECONDS,
  validateNewPassword,
} from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

/** notRecovery: ログインはしているが、再設定メールのリンクから開いていない（または開いてから時間が経ちすぎた） */
type LinkStatus = "checking" | "ready" | "invalid" | "notRecovery";

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
  const [otherSessionsSignedOut, setOtherSessionsSignedOut] = useState(false);
  // リンクのトークンは1回しか使えないため、開発時のStrictModeで効果が2回走っても検証は1回だけにする
  const verifiedRef = useRef(false);
  // 再設定リンクが本物だと確認できた時刻。普段のログインのまま直接この画面を開いた場合はnullのまま
  // （元のパスワードを知らない人でも変更できてしまうため、その場合は受け付けない）
  const recoveryVerifiedAtRef = useRef<number | null>(null);

  // Supabaseクライアントは、再設定リンクのコードを本物のログインに交換できたときだけPASSWORD_RECOVERYを通知する。
  // URLに偽のコードを付けて開いても、交換に必要な情報がこのブラウザに無いため通知されない。
  // 交換は通信を伴うため、下の確認処理より先に購読しておけば通知を取りこぼさない。
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recoveryVerifiedAtRef.current = Date.now();
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

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
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (verifyError || !data.session) {
          setLinkStatus("invalid");
          return;
        }
        recoveryVerifiedAtRef.current = Date.now();
        setLinkStatus("ready");
        return;
      }

      // 再設定リンクから開いたか（?code=...付き）を、交換処理でURLが書き換わる前に控えておく
      const openedFromLink = readUrlParam("code") !== null;

      // 標準のリンク（?code=...）はSupabaseクライアントが初期化時に自動でセッションへ交換するので、その完了を待つ
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLinkStatus("invalid");
        return;
      }
      // PASSWORD_RECOVERYの通知は初期化の完了直後に非同期で届くため、少しだけ待ってから判定する
      for (let i = 0; i < 10 && recoveryVerifiedAtRef.current === null; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      if (isRecoveryWindowOpen(recoveryVerifiedAtRef.current)) {
        setLinkStatus("ready");
        return;
      }
      // リンクから開いたのに確認できなかった＝期限切れ・使用済みのリンク。ログイン中だとセッション自体は残るため、
      // 「リンクから開いてください」ではなく「リンクが無効です」と案内する
      setLinkStatus(openedFromLink ? "invalid" : "notRecovery");
    }

    verifyLink();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateNewPassword(password, confirmPassword);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    // 画面を開いたまま時間が経って有効時間を過ぎた場合に備え、更新の直前にも確認する
    if (!isRecoveryWindowOpen(recoveryVerifiedAtRef.current)) {
      setSubmitting(false);
      setLinkStatus("notRecovery");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    // 以前と同じパスワードはSupabaseが「same_password」として拒否するが、
    // 結果として入力したパスワードでログインできる状態に変わりはないため、更新成功として扱う
    if (updateError && updateError.code !== "same_password") {
      setSubmitting(false);
      setError(
        updateError.code === "weak_password"
          ? "パスワードが簡単すぎます。別のパスワードを入力してください。"
          : "パスワードの更新に失敗しました。時間をおいて再度お試しください。"
      );
      return;
    }

    // パスワードが漏れた可能性がある人の再設定を想定し、この端末以外のログインをすべて無効にする。
    // パスワードの更新自体は済んでいるため、ここで失敗しても完了画面は表示し、結果だけ伝える
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    setOtherSessionsSignedOut(!signOutError);
    setSubmitting(false);
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

  if (linkStatus === "notRecovery") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">再設定メールのリンクから開いてください</h1>
        <p className="mb-8 max-w-sm text-sm text-gray-300">
          安全のため、パスワードの変更は、再設定メールのリンクを開いてから{RECOVERY_SESSION_MAX_AGE_SECONDS / 60}
          分以内に限っています。ログイン中にパスワードを変えたい場合も、再設定メールを送信してリンクから開いてください。
        </p>
        <Link href="/forgot-password" className="mb-4 font-semibold text-blue-400">
          再設定メールを送信する
        </Link>
        <Link href="/home" className="text-sm text-gray-400">
          ホームへ戻る
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-800 px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-100">パスワードを更新しました</h1>
        <p className="mb-2 max-w-sm text-sm text-gray-300">次回から新しいパスワードでログインしてください。</p>
        <p className="mb-8 max-w-sm text-sm text-gray-300">
          {otherSessionsSignedOut
            ? "安全のため、この端末以外でのログインはすべて解除しました。"
            : "他の端末でのログインを解除できませんでした。心当たりのない端末がある場合は、その端末でログアウトしてください。"}
        </p>
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
