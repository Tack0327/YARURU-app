"use client";

import type { ItemFilters, SortDirection, SortField } from "@/lib/items";
import type { MemberWithProfile } from "@/lib/families";
import type { FamilyGroup } from "@/types/database";

export function FilterBar({
  filters,
  members,
  groups,
  onChange,
}: {
  filters: ItemFilters;
  members: MemberWithProfile[];
  groups?: FamilyGroup[];
  onChange: (filters: ItemFilters) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <input
        type="search"
        placeholder="キーワードで検索"
        value={filters.keyword ?? ""}
        onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        aria-label="キーワードで検索"
      />
      {groups && groups.length > 1 && (
        <select
          value={filters.groupId ?? ""}
          onChange={(e) => onChange({ ...filters, groupId: e.target.value || undefined })}
          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          aria-label="家族で絞り込み"
        >
          <option value="">家族: すべて</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={filters.type ?? ""}
          onChange={(e) => onChange({ ...filters, type: (e.target.value || undefined) as ItemFilters["type"] })}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          aria-label="種別で絞り込み"
        >
          <option value="">種別: すべて</option>
          <option value="todo">実施作業</option>
          <option value="event">予定</option>
        </select>
        <select
          value={filters.status ?? ""}
          onChange={(e) => onChange({ ...filters, status: (e.target.value || undefined) as ItemFilters["status"] })}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          aria-label="ステータスで絞り込み"
        >
          <option value="">状況: すべて</option>
          <option value="not_started">未対応</option>
          <option value="in_progress">対応中</option>
          <option value="done">完了</option>
        </select>
        <select
          value={filters.assigneeId ?? ""}
          onChange={(e) => onChange({ ...filters, assigneeId: e.target.value || undefined })}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          aria-label="担当者で絞り込み"
        >
          <option value="">担当: すべて</option>
          {members.map((member) => (
            <option key={member.profile_id} value={member.profile_id}>
              {member.profile.display_name}
            </option>
          ))}
        </select>
        <select
          value={`${filters.sortBy ?? "due_at"}:${filters.sortDirection ?? "asc"}`}
          onChange={(e) => {
            const [sortBy, sortDirection] = e.target.value.split(":") as [SortField, SortDirection];
            onChange({ ...filters, sortBy, sortDirection });
          }}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          aria-label="並び替え"
        >
          <option value="due_at:asc">期限が近い順</option>
          <option value="due_at:desc">期限が遠い順</option>
          <option value="created_at:desc">作成日が新しい順</option>
          <option value="created_at:asc">作成日が古い順</option>
          <option value="updated_at:desc">更新日が新しい順</option>
        </select>
      </div>
    </div>
  );
}
