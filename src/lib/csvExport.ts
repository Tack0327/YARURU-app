import type { Item, ItemStatus } from "@/types/database";
import { ITEM_TYPE_LABEL } from "@/types/database";
import { toDatetimeLocalValue } from "./dateUtils";

/** 一度にCSV出力できる件数の上限（メール送信APIへの過大なリクエストを防ぐため） */
export const CSV_EXPORT_MAX_ITEMS = 500;

// メール送信の回数制限。実際の判定はDB関数claim_csv_email_slot（0025のマイグレーション）が行うため、値を変える場合は両方を揃える
export const CSV_EMAIL_MIN_INTERVAL_SECONDS = 60;
export const CSV_EMAIL_DAILY_LIMIT = 20;

/** jira: Jiraへの取り込み用（内容をそのまま出力） / excel: Excelでの閲覧用（数式として実行されないよう加工） */
export type CsvPurpose = "jira" | "excel";

export const CSV_PURPOSE_LABEL: Record<CsvPurpose, string> = {
  jira: "Jira取り込み用",
  excel: "Excel閲覧用",
};

// Jiraの標準ワークフローのステータス名に合わせておくと、取り込み時の対応付けが自動で行われやすい
const JIRA_STATUS: Record<ItemStatus, string> = {
  not_started: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const CSV_HEADERS = ["Summary", "Issue Type", "Status", "Description", "Assignee", "Start date", "Due date", "Labels"];

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Excelは「= + - @」やタブ・改行で始まるセルを数式として扱い、悪意ある内容だと外部コマンドを実行され得る（CSVインジェクション）。
 * 先頭に'を付けると文字列として表示される。Jiraに取り込むと'がそのまま残るため、Excel用のときだけ行う。
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Jiraの取り込み画面で日付形式に「yyyy-MM-dd HH:mm」を指定できるよう、Asia/Tokyo基準でこの形式に揃える */
function formatJiraDate(iso: string | null): string {
  return iso ? toDatetimeLocalValue(iso).replace("T", " ") : "";
}

/**
 * 選択したチケットをCSVに変換する（純関数・テスト対象）。列はJiraのCSV取り込みに合わせている。
 * 予定には期限が無いため、終了時刻があればそれをDue dateとして出力する。
 */
export function buildItemsCsv(
  items: Item[],
  memberNameOf: (id: string | null) => string | undefined,
  purpose: CsvPurpose = "jira"
): string {
  const rows = items.map((item) => {
    const cells = [
      item.title,
      "Task",
      JIRA_STATUS[item.status],
      item.description ?? "",
      memberNameOf(item.assignee_id) ?? "",
      formatJiraDate(item.start_at),
      formatJiraDate(item.due_at ?? item.end_at),
      ITEM_TYPE_LABEL[item.type],
    ];
    return purpose === "excel" ? cells.map(neutralizeFormula) : cells;
  });
  // 先頭のBOMが無いと、ExcelがUTF-8をShift-JISとして読み込み日本語が文字化けする（Jiraの取り込みはBOM付きでも問題ない）
  const body = [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
  return `﻿${body}`;
}

/** 例: yaruru-tickets-jira-20261004-1830.csv（Asia/Tokyo基準） */
export function csvFileName(purpose: CsvPurpose, now: Date = new Date()): string {
  const stamp = toDatetimeLocalValue(now.toISOString()).replace(/[-:]/g, "").replace("T", "-");
  return `yaruru-tickets-${purpose}-${stamp}.csv`;
}

/** メール送信APIのリクエスト本文を検証する（純関数・テスト対象）。問題があればerrorに利用者向けのメッセージを入れて返す */
export function parseCsvEmailRequest(
  body: unknown
): { ok: true; itemIds: string[]; purpose: CsvPurpose } | { ok: false; error: string } {
  const { itemIds, purpose } = (body && typeof body === "object" ? body : {}) as { itemIds?: unknown; purpose?: unknown };
  if (
    !Array.isArray(itemIds) ||
    itemIds.length === 0 ||
    itemIds.length > CSV_EXPORT_MAX_ITEMS ||
    !itemIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return { ok: false, error: `チケットを1〜${CSV_EXPORT_MAX_ITEMS}件選択してください。` };
  }
  if (purpose !== "jira" && purpose !== "excel") {
    return { ok: false, error: "CSVの用途（Jira取り込み用／Excel閲覧用）を選択してください。" };
  }
  return { ok: true, itemIds: [...new Set(itemIds as string[])], purpose };
}
