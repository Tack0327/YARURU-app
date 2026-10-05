import { describe, expect, it } from "vitest";
import { joinFamilyGroupErrorMessage, validateDisplayName, validateGroupName } from "@/lib/families";

describe("joinFamilyGroupErrorMessage", () => {
  it("DB関数が返した利用者向けのメッセージ（P0001）はそのまま表示する", () => {
    const message = "招待コードの入力に続けて失敗したため、しばらく参加できません。1時間ほど待ってから再度お試しください";
    expect(joinFamilyGroupErrorMessage({ code: "P0001", message })).toBe(message);
  });

  it("通信エラーなどの技術的なメッセージは、日本語の固定の文言に置き換える", () => {
    expect(joinFamilyGroupErrorMessage({ code: "", message: "TypeError: Failed to fetch" })).toBe(
      "参加できませんでした。通信状況をご確認のうえ再度お試しください。"
    );
    expect(joinFamilyGroupErrorMessage({ code: "23502", message: 'null value in column "profile_id"' })).toBe(
      "参加できませんでした。通信状況をご確認のうえ再度お試しください。"
    );
    expect(joinFamilyGroupErrorMessage(null)).toBe("参加できませんでした。通信状況をご確認のうえ再度お試しください。");
  });
});

describe("validateGroupName", () => {
  it("前後の空白を除いて1〜50文字なら問題なし", () => {
    expect(validateGroupName("高木家")).toBeNull();
    expect(validateGroupName("  テニスサークル  ")).toBeNull();
    expect(validateGroupName("あ".repeat(50))).toBeNull();
  });

  it("空・空白だけの名前は拒否する", () => {
    expect(validateGroupName("")).toBe("グループ名を入力してください。");
    expect(validateGroupName("   ")).toBe("グループ名を入力してください。");
  });

  it("51文字以上は拒否する", () => {
    expect(validateGroupName("あ".repeat(51))).toBe("グループ名は50文字以内で入力してください。");
  });
});

describe("validateDisplayName", () => {
  it("前後の空白を除いて1〜30文字なら問題なし", () => {
    expect(validateDisplayName("たかし")).toBeNull();
    expect(validateDisplayName("  Tack  ")).toBeNull();
    expect(validateDisplayName("あ".repeat(30))).toBeNull();
  });

  it("空・空白だけの名前は拒否する", () => {
    expect(validateDisplayName("")).toBe("表示名を入力してください。");
    expect(validateDisplayName("　 ")).toBe("表示名を入力してください。");
  });

  it("31文字以上は拒否する", () => {
    expect(validateDisplayName("あ".repeat(31))).toBe("表示名は30文字以内で入力してください。");
  });
});
