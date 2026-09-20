export type ParsedLine =
  | { kind: "task"; checked: boolean; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; number: number; text: string }
  | { kind: "plain"; text: string };

const TASK_RE = /^- \[( |x)\] (.*)$/;
const BULLET_RE = /^- (.*)$/;
const NUMBERED_RE = /^(\d+)\. (.*)$/;

export function parseChecklistLine(line: string): ParsedLine {
  const taskMatch = line.match(TASK_RE);
  if (taskMatch) return { kind: "task", checked: taskMatch[1] === "x", text: taskMatch[2] };

  const numberedMatch = line.match(NUMBERED_RE);
  if (numberedMatch) return { kind: "numbered", number: Number(numberedMatch[1]), text: numberedMatch[2] };

  const bulletMatch = line.match(BULLET_RE);
  if (bulletMatch) return { kind: "bullet", text: bulletMatch[1] };

  return { kind: "plain", text: line };
}

/** 詳細欄のプレビューでタスク行のチェックボックスをクリックした際、対象行の完了状態を反転する */
export function toggleTaskLine(description: string, lineIndex: number): string {
  const lines = description.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return description;

  const parsed = parseChecklistLine(line);
  if (parsed.kind !== "task") return description;

  lines[lineIndex] = `- [${parsed.checked ? " " : "x"}] ${parsed.text}`;
  return lines.join("\n");
}

export type ListPrefixKind = "bullet" | "numbered" | "task";

/**
 * カーソルがある行に箇条書き・番号・タスクの接頭辞を付与する。既に同じ種類の行であれば接頭辞を外す（トグル）。
 * 番号リストは、直前に連続する番号付き行があればその続き番号を採番する。
 */
export function applyListPrefix(
  description: string,
  cursorPos: number,
  kind: ListPrefixKind
): { text: string; cursorPos: number } {
  const before = description.slice(0, cursorPos);
  const after = description.slice(cursorPos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEndRel = after.indexOf("\n");
  const lineEnd = lineEndRel === -1 ? description.length : cursorPos + lineEndRel;
  const line = description.slice(lineStart, lineEnd);
  const parsed = parseChecklistLine(line);

  let newLine: string;
  if (kind === "task") {
    newLine = parsed.kind === "task" ? parsed.text : `- [ ] ${parsed.text}`;
  } else if (kind === "bullet") {
    newLine = parsed.kind === "bullet" ? parsed.text : `- ${parsed.text}`;
  } else {
    let nextNumber = 1;
    const precedingLines = description.slice(0, lineStart).split("\n");
    for (let i = precedingLines.length - 1; i >= 0; i -= 1) {
      const precedingParsed = parseChecklistLine(precedingLines[i]);
      if (precedingParsed.kind === "numbered") {
        nextNumber = precedingParsed.number + 1;
        break;
      }
      if (precedingLines[i].trim() !== "") break;
    }
    newLine = parsed.kind === "numbered" ? parsed.text : `${nextNumber}. ${parsed.text}`;
  }

  const text = description.slice(0, lineStart) + newLine + description.slice(lineEnd);
  return { text, cursorPos: Math.max(lineStart, cursorPos + (newLine.length - line.length)) };
}

/**
 * 詳細欄でEnterキーが押されたときの挙動。箇条書き・番号・タスクの行では、次の行に同じ書式を引き継ぐ。
 * 行の内容が空のままEnterが押された場合は、書式を解除して通常の行に戻す（リストからの離脱）。
 * 通常の行（対象外）ではnullを返し、呼び出し側でデフォルトの改行に任せる。
 */
export function applyEnterContinuation(
  description: string,
  cursorPos: number
): { text: string; cursorPos: number } | null {
  const before = description.slice(0, cursorPos);
  const after = description.slice(cursorPos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEndRel = after.indexOf("\n");
  const lineEnd = lineEndRel === -1 ? description.length : cursorPos + lineEndRel;
  const line = description.slice(lineStart, lineEnd);
  const parsed = parseChecklistLine(line);

  if (parsed.kind === "plain") return null;

  if (parsed.text.trim() === "") {
    const text = description.slice(0, lineStart) + description.slice(lineEnd);
    return { text, cursorPos: lineStart };
  }

  const prefix = parsed.kind === "task" ? "- [ ] " : parsed.kind === "bullet" ? "- " : `${parsed.number + 1}. `;
  const text = description.slice(0, cursorPos) + "\n" + prefix + description.slice(cursorPos);
  return { text, cursorPos: cursorPos + 1 + prefix.length };
}
