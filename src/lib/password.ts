export const MIN_PASSWORD_LENGTH = 6;

/** ログインに連続で失敗した回数がこの値に達したら「パスワードを忘れた場合」の案内を強調する */
export const FORGOT_PASSWORD_HINT_THRESHOLD = 3;

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
