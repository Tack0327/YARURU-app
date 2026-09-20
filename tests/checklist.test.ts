import { describe, expect, it } from "vitest";
import { applyEnterContinuation, applyListPrefix, parseChecklistLine, toggleTaskLine } from "@/lib/checklist";

describe("checklist", () => {
  describe("parseChecklistLine", () => {
    it("parses an unchecked task line", () => {
      expect(parseChecklistLine("- [ ] 買い物")).toEqual({ kind: "task", checked: false, text: "買い物" });
    });

    it("parses a checked task line", () => {
      expect(parseChecklistLine("- [x] 買い物")).toEqual({ kind: "task", checked: true, text: "買い物" });
    });

    it("parses a bullet line", () => {
      expect(parseChecklistLine("- 牛乳")).toEqual({ kind: "bullet", text: "牛乳" });
    });

    it("parses a numbered line", () => {
      expect(parseChecklistLine("2. パン")).toEqual({ kind: "numbered", number: 2, text: "パン" });
    });

    it("treats plain text as plain", () => {
      expect(parseChecklistLine("メモ")).toEqual({ kind: "plain", text: "メモ" });
    });
  });

  describe("toggleTaskLine", () => {
    it("checks an unchecked task line", () => {
      expect(toggleTaskLine("- [ ] 買い物\n- [ ] 洗濯", 0)).toBe("- [x] 買い物\n- [ ] 洗濯");
    });

    it("unchecks a checked task line", () => {
      expect(toggleTaskLine("- [x] 買い物", 0)).toBe("- [ ] 買い物");
    });

    it("does nothing when the line is not a task", () => {
      expect(toggleTaskLine("- 牛乳", 0)).toBe("- 牛乳");
    });
  });

  describe("applyListPrefix", () => {
    it("adds a bullet prefix to the current line", () => {
      const result = applyListPrefix("牛乳", 2, "bullet");
      expect(result.text).toBe("- 牛乳");
    });

    it("removes the bullet prefix when applied again (toggle off)", () => {
      const result = applyListPrefix("- 牛乳", 2, "bullet");
      expect(result.text).toBe("牛乳");
    });

    it("adds a task prefix to the current line", () => {
      const result = applyListPrefix("買い物", 2, "task");
      expect(result.text).toBe("- [ ] 買い物");
    });

    it("converts a bullet line to a task line", () => {
      const result = applyListPrefix("- 買い物", 2, "task");
      expect(result.text).toBe("- [ ] 買い物");
    });

    it("numbers the first line as 1", () => {
      const result = applyListPrefix("パン", 2, "numbered");
      expect(result.text).toBe("1. パン");
    });

    it("continues numbering from the preceding numbered line", () => {
      const description = "1. 牛乳\nパン";
      const cursorPos = description.length;
      const result = applyListPrefix(description, cursorPos, "numbered");
      expect(result.text).toBe("1. 牛乳\n2. パン");
    });

    it("only affects the line containing the cursor", () => {
      const description = "1行目\n2行目\n3行目";
      const cursorPos = description.indexOf("2行目") + 1;
      const result = applyListPrefix(description, cursorPos, "bullet");
      expect(result.text).toBe("1行目\n- 2行目\n3行目");
    });
  });

  describe("applyEnterContinuation", () => {
    it("returns null for a plain line (default newline behavior)", () => {
      expect(applyEnterContinuation("メモ", 2)).toBeNull();
    });

    it("continues a bullet line onto the next line", () => {
      const description = "- 牛乳";
      const result = applyEnterContinuation(description, description.length);
      expect(result?.text).toBe("- 牛乳\n- ");
    });

    it("continues a numbered line with the next number", () => {
      const description = "3. パン";
      const result = applyEnterContinuation(description, description.length);
      expect(result?.text).toBe("3. パン\n4. ");
    });

    it("continues a task line as an unchecked task, even if the current one is checked", () => {
      const description = "- [x] 買い物";
      const result = applyEnterContinuation(description, description.length);
      expect(result?.text).toBe("- [x] 買い物\n- [ ] ");
    });

    it("splits line content at the cursor position", () => {
      const description = "- 牛乳とパン";
      const cursorPos = description.indexOf("と");
      const result = applyEnterContinuation(description, cursorPos);
      expect(result?.text).toBe("- 牛乳\n- とパン");
    });

    it("exits the list when Enter is pressed on an empty list item", () => {
      const description = "- 牛乳\n- ";
      const result = applyEnterContinuation(description, description.length);
      expect(result?.text).toBe("- 牛乳\n");
      expect(result?.cursorPos).toBe("- 牛乳\n".length);
    });
  });
});
