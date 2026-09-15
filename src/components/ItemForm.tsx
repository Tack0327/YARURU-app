"use client";

import { useState } from "react";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/dateUtils";
import type { MemberWithProfile } from "@/lib/families";
import type { Item, ItemStatus, ItemType } from "@/types/database";

export type ItemFormValues = {
  type: ItemType;
  title: string;
  description: string;
  startAt: string | null;
  dueAt: string | null;
  assigneeId: string | null;
  status: ItemStatus;
};

export function ItemForm({
  members,
  initialItem,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  members: MemberWithProfile[];
  initialItem?: Item;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<ItemType>(initialItem?.type ?? "todo");
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [startAtLocal, setStartAtLocal] = useState(toDatetimeLocalValue(initialItem?.start_at ?? null));
  const [dueAtLocal, setDueAtLocal] = useState(toDatetimeLocalValue(initialItem?.due_at ?? null));
  const [assigneeId, setAssigneeId] = useState(initialItem?.assignee_id ?? "");
  const [status, setStatus] = useState<ItemStatus>(initialItem?.status ?? "not_started");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }

    const startAt = fromDatetimeLocalValue(startAtLocal);
    const dueAt = fromDatetimeLocalValue(dueAtLocal);

    if (startAt && dueAt && new Date(dueAt).getTime() < new Date(startAt).getTime()) {
      setError("期限日時は開始日時より後に設定してください。");
      return;
    }

    await onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      startAt,
      dueAt,
      assigneeId: assigneeId || null,
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">種別</legend>
        {(["todo", "event"] as ItemType[]).map((value) => (
          <label
            key={value}
            className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold ${
              type === value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600"
            }`}
          >
            <input
              type="radio"
              name="type"
              value={value}
              checked={type === value}
              onChange={() => setType(value)}
              className="sr-only"
            />
            {value === "todo" ? "ToDo" : "予定"}
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          タイトル
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
          詳細
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startAt" className="mb-1 block text-sm font-medium text-gray-700">
            開始日時
          </label>
          <input
            id="startAt"
            type="datetime-local"
            value={startAtLocal}
            onChange={(e) => setStartAtLocal(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="dueAt" className="mb-1 block text-sm font-medium text-gray-700">
            期限日時
          </label>
          <input
            id="dueAt"
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="assignee" className="mb-1 block text-sm font-medium text-gray-700">
          担当者
        </label>
        <select
          id="assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        >
          <option value="">未割り当て</option>
          {members.map((member) => (
            <option key={member.profile_id} value={member.profile_id}>
              {member.profile.display_name}
            </option>
          ))}
        </select>
      </div>

      {initialItem && (
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">
            ステータス
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ItemStatus)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
          >
            <option value="not_started">未対応</option>
            <option value="in_progress">対応中</option>
            <option value="done">完了</option>
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 flex-1 rounded-lg border border-gray-300 text-base font-semibold text-gray-700"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 flex-1 rounded-lg bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "保存中..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
