import Link from "next/link";
import { formatDateTimeJst, isOverdue } from "@/lib/dateUtils";
import { ITEM_TYPE_LABEL, type Item } from "@/types/database";
import { OverdueBadge, StatusBadge } from "./StatusBadge";

export function ItemCard({ item, assigneeName }: { item: Item; assigneeName?: string }) {
  const overdue = isOverdue(item.due_at, item.status);

  return (
    <Link
      href={`/items/${item.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {ITEM_TYPE_LABEL[item.type]}
        </span>
        <StatusBadge status={item.status} />
        {overdue && <OverdueBadge />}
      </div>
      <p className="mb-1 text-base font-semibold text-gray-900">{item.title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {item.due_at && <span>期限: {formatDateTimeJst(item.due_at)}</span>}
        {assigneeName && <span>担当: {assigneeName}</span>}
      </div>
    </Link>
  );
}
