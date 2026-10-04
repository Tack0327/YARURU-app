import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/lib/password";

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
