export const MIN_PASSWORD_LENGTH = 6;

/** ログインに連続で失敗した回数がこの値に達したら「パスワードを忘れた場合」の案内を強調する */
export const FORGOT_PASSWORD_HINT_THRESHOLD = 3;

/** 再設定メールのリンクを開いてから、パスワードを変更できる時間（秒） */
export const RECOVERY_SESSION_MAX_AGE_SECONDS = 60 * 60;

/**
 * 再設定メールのリンクを開いてから、まだパスワードを変更してよい時間内かを判定する（純関数・テスト対象）。
 * recoveryVerifiedAtMsは、この画面で再設定リンクが本物だと確認できた時刻（確認できていなければnull）。
 * ログインしたままの端末を他人に触られた場合に、元のパスワードを知らなくても変更できてしまうのを防ぐため、
 * 「リンクから開いたことを確認でき、かつ一定時間内」の場合だけ変更を許可する。
 */
export function isRecoveryWindowOpen(
  recoveryVerifiedAtMs: number | null,
  now: Date = new Date(),
  maxAgeSeconds: number = RECOVERY_SESSION_MAX_AGE_SECONDS
): boolean {
  if (recoveryVerifiedAtMs === null) return false;
  const elapsedMs = now.getTime() - recoveryVerifiedAtMs;
  return elapsedMs >= 0 && elapsedMs <= maxAgeSeconds * 1000;
}

/** 新しいパスワードと確認用パスワードを検証し、問題があればエラーメッセージを返す（問題なければnull） */
export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`;
  }
  if (password !== confirmPassword) {
    return "新しいパスワードと確認用パスワードが一致しません。";
  }
  return null;
}
