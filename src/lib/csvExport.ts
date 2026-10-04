import type { Item, ItemStatus } from "@/types/database";
import { ITEM_TYPE_LABEL } from "@/types/database";
import { toDatetimeLocalValue } from "./dateUtils";

/** 一度にCSV出力できる件数の上限（メール送信APIへの過大なリクエストを防ぐため） */
export const CSV_EXPORT_MAX_ITEMS = 500;

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

/** Jiraの取り込み画面で日付形式に「yyyy-MM-dd HH:mm」を指定できるよう、Asia/Tokyo基準でこの形式に揃える */
function formatJiraDate(iso: string | null): string {
  return iso ? toDatetimeLocalValue(iso).replace("T", " ") : "";
}

/**
 * 選択したチケットをJiraのCSV取り込み向けの形式に変換する（純関数・テスト対象）。
 * 予定には期限が無いため、終了時刻があればそれをDue dateとして出力する。
 */
export function buildItemsCsv(items: Item[], memberNameOf: (id: string | null) => string | undefined): string {
  const rows = items.map((item) => [
    item.title,
    "Task",
    JIRA_STATUS[item.status],
    item.description ?? "",
    memberNameOf(item.assignee_id) ?? "",
    formatJiraDate(item.start_at),
    formatJiraDate(item.due_at ?? item.end_at),
    ITEM_TYPE_LABEL[item.type],
  ]);
  // 先頭のBOMが無いと、ExcelがUTF-8をShift-JISとして読み込み日本語が文字化けする（Jiraの取り込みはBOM付きでも問題ない）
  const body = [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
  return `﻿${body}`;
}

/** 例: yaruru-tickets-20261004-1830.csv（Asia/Tokyo基準） */
export function csvFileName(now: Date = new Date()): string {
  const stamp = toDatetimeLocalValue(now.toISOString()).replace(/[-:]/g, "").replace("T", "-");
  return `yaruru-tickets-${stamp}.csv`;
}
