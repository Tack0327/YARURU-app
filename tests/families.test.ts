import { describe, expect, it } from "vitest";
import { joinFamilyGroupErrorMessage } from "@/lib/families";

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
