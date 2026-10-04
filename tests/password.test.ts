import { describe, expect, it } from "vitest";
import { isRecoveryWindowOpen, validateNewPassword } from "@/lib/password";

describe("validateNewPassword", () => {
  it("6文字以上で確認用と一致すればnullを返す", () => {
    expect(validateNewPassword("abcdef", "abcdef")).toBeNull();
  });

  it("6文字未満ならエラーを返す", () => {
    expect(validateNewPassword("abcde", "abcde")).toBe("パスワードは6文字以上で入力してください。");
  });

  it("確認用と一致しなければエラーを返す", () => {
    expect(validateNewPassword("abcdef", "abcdeg")).toBe("新しいパスワードと確認用パスワードが一致しません。");
  });

  it("文字数不足と不一致が同時なら文字数のエラーを優先する", () => {
    expect(validateNewPassword("abc", "xyz")).toBe("パスワードは6文字以上で入力してください。");
  });
});

describe("isRecoveryWindowOpen", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("再設定リンクを確認してから1時間以内なら許可する", () => {
    expect(isRecoveryWindowOpen(now.getTime() - 10 * 60 * 1000, now)).toBe(true);
    expect(isRecoveryWindowOpen(now.getTime() - 60 * 60 * 1000, now)).toBe(true);
  });

  it("1時間を過ぎていたら拒否する", () => {
    expect(isRecoveryWindowOpen(now.getTime() - 60 * 60 * 1000 - 1, now)).toBe(false);
  });

  it("リンクから開いたことを確認できていない（普段のログインのまま開いた）場合は拒否する", () => {
    expect(isRecoveryWindowOpen(null, now)).toBe(false);
  });

  it("確認時刻が未来になっている場合は拒否する", () => {
    expect(isRecoveryWindowOpen(now.getTime() + 1000, now)).toBe(false);
  });
});
