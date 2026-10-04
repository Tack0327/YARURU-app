"use client";

import { useState } from "react";
import { CSV_PURPOSE_LABEL, type CsvPurpose } from "@/lib/csvExport";
import type { MemberWithProfile } from "@/lib/families";

/** 一括変更の「担当者なしにする」を表す特別値（空文字は「変更しない」と区別するため） */
export const BULK_UNASSIGN_VALUE = "__unassign__";

function BulkDateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 pl-2">
      <span className="shrink-0 text-xs text-gray-400">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // カレンダーアイコン以外の場所をクリックしても日付選択UIが開くようにする
        onClick={(e) => e.currentTarget.showPicker?.()}
        aria-label={`${label}をまとめて変更`}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-gray-100"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`${label}を変更しない`}
          className="shrink-0 px-2 text-sm text-gray-400"
        >
          ✕
        </button>
      ) : (
        <span className="shrink-0 pr-2 text-xs text-gray-500">変更しない</span>
      )}
    </div>
  );
}

export function BulkActionBar({
  selectedCount,
  members,
  assigneeId,
  status,
  startDateKey,
  dueDateKey,
  submitting,
  deleting,
  exporting,
  allowAssigneeChange = true,
  onAssigneeChange,
  onStatusChange,
  onStartDateChange,
  onDueDateChange,
  onApply,
  onDelete,
  onExportDownload,
  onExportEmail,
  onCancel,
}: {
  selectedCount: number;
  members: MemberWithProfile[];
  assigneeId: string;
  status: string;
  /** 空文字は「変更しない」 */
  startDateKey: string;
  /** 空文字は「変更しない」 */
  dueDateKey: string;
  submitting: boolean;
  deleting: boolean;
  exporting: boolean;
  /** falseの場合、担当者の一括変更を無効にする（複数の家族グループを横断表示している場合など） */
  allowAssigneeChange?: boolean;
  onAssigneeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onApply: () => void;
  onDelete: () => void | Promise<void>;
  onExportDownload: (purpose: CsvPurpose) => void;
  /** 送信に成功したらtrueを返す */
  onExportEmail: (purpose: CsvPurpose) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [choosingExport, setChoosingExport] = useState(false);
  const [csvPurpose, setCsvPurpose] = useState<CsvPurpose>("jira");
  const [editorOpen, setEditorOpen] = useState(false);

  async function handleConfirmDelete() {
    await onDelete();
    setConfirmingDelete(false);
  }

  function handleExportDownload() {
    onExportDownload(csvPurpose);
    setChoosingExport(false);
  }

  async function handleExportEmail() {
    if (await onExportEmail(csvPurpose)) setChoosingExport(false);
  }

  if (choosingExport) {
    return (
      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-blue-800 bg-blue-950">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3">
          <p className="text-sm font-semibold text-blue-200">選択した{selectedCount}件をCSVで出力します</p>
          <div role="radiogroup" aria-label="CSVの用途" className="grid grid-cols-2 gap-2">
            {(["jira", "excel"] as CsvPurpose[]).map((purpose) => (
              <button
                key={purpose}
                type="button"
                role="radio"
                aria-checked={csvPurpose === purpose}
                onClick={() => setCsvPurpose(purpose)}
                disabled={exporting}
                className={`min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${
                  csvPurpose === purpose ? "border-blue-400 bg-blue-900 text-blue-100" : "border-gray-600 text-gray-300"
                }`}
              >
                {CSV_PURPOSE_LABEL[purpose]}
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-300">
            {csvPurpose === "jira"
              ? "内容をそのまま出力します。Excelで開く場合は「Excel閲覧用」を選んでください。"
              : "「= + - @」で始まる値は、数式として実行されないよう先頭に「'」を付けます。"}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => setChoosingExport(false)}
              disabled={exporting}
              className="min-h-10 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleExportDownload}
              disabled={exporting}
              className="min-h-10 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              ダウンロード
            </button>
            <button
              type="button"
              onClick={handleExportEmail}
              disabled={exporting}
              className="min-h-10 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {exporting ? "送信中..." : "メールで送る"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmingDelete) {
    return (
      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-red-800 bg-red-950">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm font-semibold text-red-200">
            選択した{selectedCount}件を削除しますか？この操作は取り消せません。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="min-h-10 flex-1 rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300 disabled:opacity-50 sm:flex-none"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="min-h-10 flex-1 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none"
            >
              {deleting ? "削除中..." : "削除する"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const csvButtonClassName =
    "min-h-10 whitespace-nowrap rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300 disabled:opacity-50";

  // スマホでは変更欄（担当者・状況・日付）が画面の大半を覆ってしまうため、「まとめて変更」を押すまで折りたたむ。
  // 横幅に余裕のあるsm以上の画面では、これまでどおり常に表示する。
  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-blue-800 bg-blue-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-center justify-between sm:shrink-0">
          <p className="whitespace-nowrap text-sm font-semibold text-blue-200">{selectedCount}件選択中</p>
          {editorOpen && (
            <button type="button" onClick={() => setEditorOpen(false)} className="text-xs font-semibold text-blue-300 sm:hidden">
              変更欄を閉じる
            </button>
          )}
        </div>
        <div className={`${editorOpen ? "grid" : "hidden"} grid-cols-2 gap-2 sm:flex sm:flex-1`}>
          <button
            type="button"
            onClick={() => setChoosingExport(true)}
            disabled={submitting || deleting}
            className={`hidden sm:block ${csvButtonClassName}`}
          >
            CSV出力
          </button>
          {/* 複数の家族を横断表示している間は担当者を一括変更できないため、選択欄自体を出さない */}
          {allowAssigneeChange && (
            <select
              value={assigneeId}
              onChange={(e) => onAssigneeChange(e.target.value)}
              className="appearance-none rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-gray-100"
              aria-label="担当者をまとめて変更"
            >
              <option value="">担当者: 変更しない</option>
              <option value={BULK_UNASSIGN_VALUE}>担当者なしにする</option>
              {members.map((member) => (
                <option key={member.profile_id} value={member.profile_id}>
                  {member.profile.display_name}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="appearance-none rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-gray-100"
            aria-label="ステータスをまとめて変更"
          >
            <option value="">状況: 変更しない</option>
            <option value="not_started">未対応</option>
            <option value="in_progress">対応中</option>
            <option value="done">完了</option>
          </select>
          <BulkDateInput label="開始日" value={startDateKey} onChange={onStartDateChange} />
          <BulkDateInput label="期限日" value={dueDateKey} onChange={onDueDateChange} />
          {dueDateKey && <p className="col-span-2 text-xs text-blue-300">期限日は実施作業にのみ反映されます</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setChoosingExport(true)}
            disabled={submitting || deleting}
            className={`sm:hidden ${csvButtonClassName}`}
          >
            CSV出力
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={submitting || deleting}
            className="min-h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-400 disabled:opacity-50"
          >
            まとめて削除
          </button>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className={`${editorOpen ? "hidden" : "block"} min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white sm:hidden`}
          >
            まとめて変更
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={submitting || deleting || (!assigneeId && !status && !startDateKey && !dueDateKey)}
            className={`${editorOpen ? "block" : "hidden"} min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:block`}
          >
            {submitting ? "変更中..." : "まとめて変更"}
          </button>
        </div>
      </div>
    </div>
  );
}
