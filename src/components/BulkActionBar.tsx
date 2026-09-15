"use client";

import type { MemberWithProfile } from "@/lib/families";

/** 一括変更の「担当者なしにする」を表す特別値（空文字は「変更しない」と区別するため） */
export const BULK_UNASSIGN_VALUE = "__unassign__";

export function BulkActionBar({
  selectedCount,
  members,
  assigneeId,
  status,
  submitting,
  onAssigneeChange,
  onStatusChange,
  onApply,
  onCancel,
}: {
  selectedCount: number;
  members: MemberWithProfile[];
  assigneeId: string;
  status: string;
  submitting: boolean;
  onAssigneeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-blue-200 bg-blue-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold text-blue-900">{selectedCount}件選択中</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1">
          <select
            value={assigneeId}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
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
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
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
            className="min-h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-600 sm:flex-none"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={submitting || (!assigneeId && !status)}
            className="min-h-10 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none"
          >
            {submitting ? "変更中..." : "まとめて変更"}
          </button>
        </div>
      </div>
    </div>
  );
}
