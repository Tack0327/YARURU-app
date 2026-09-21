"use client";

import { useState } from "react";
import type { MemberWithProfile } from "@/lib/families";

/** 一括変更の「担当者なしにする」を表す特別値（空文字は「変更しない」と区別するため） */
export const BULK_UNASSIGN_VALUE = "__unassign__";

export function BulkActionBar({
  selectedCount,
  members,
  assigneeId,
  status,
  submitting,
  deleting,
  allowAssigneeChange = true,
  onAssigneeChange,
  onStatusChange,
  onApply,
  onDelete,
  onCancel,
}: {
  selectedCount: number;
  members: MemberWithProfile[];
  assigneeId: string;
  status: string;
  submitting: boolean;
  deleting: boolean;
  /** falseの場合、担当者の一括変更を無効にする（複数の家族グループを横断表示している場合など） */
  allowAssigneeChange?: boolean;
  onAssigneeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onApply: () => void;
  onDelete: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleConfirmDelete() {
    await onDelete();
    setConfirmingDelete(false);
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

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-blue-800 bg-blue-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold text-blue-200">{selectedCount}件選択中</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1">
          <select
            value={assigneeId}
            onChange={(e) => onAssigneeChange(e.target.value)}
            disabled={!allowAssigneeChange}
            title={allowAssigneeChange ? undefined : "家族を1つに絞り込むと担当者を一括変更できます"}
            className="rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-gray-100 disabled:bg-gray-700 disabled:text-gray-500"
            aria-label="担当者をまとめて変更"
          >
            <option value="">{allowAssigneeChange ? "担当者: 変更しない" : "担当者: 家族を絞り込むと変更可能"}</option>
            {allowAssigneeChange && <option value={BULK_UNASSIGN_VALUE}>担当者なしにする</option>}
            {allowAssigneeChange &&
              members.map((member) => (
                <option key={member.profile_id} value={member.profile_id}>
                  {member.profile.display_name}
                </option>
              ))}
          </select>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-gray-100"
            aria-label="ステータスをまとめて変更"
          >
            <option value="">状況: 変更しない</option>
            <option value="not_started">未対応</option>
            <option value="in_progress">対応中</option>
            <option value="done">完了</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 flex-1 rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300 sm:flex-none"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={submitting || deleting}
            className="min-h-10 flex-1 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-400 disabled:opacity-50 sm:flex-none"
          >
            まとめて削除
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={submitting || deleting || (!assigneeId && !status)}
            className="min-h-10 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none"
          >
            {submitting ? "変更中..." : "まとめて変更"}
          </button>
        </div>
      </div>
    </div>
  );
}
