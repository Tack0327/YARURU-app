"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { applyEnterContinuation, applyListPrefix, parseChecklistLine, toggleTaskLine, type ListPrefixKind } from "@/lib/checklist";
import {
  addMonthsToDateKey,
  combineDateAndTimeJst,
  dateKeyJst,
  fromDatetimeLocalValue,
  RECURRENCE_DEFAULT_UNTIL_MONTHS,
  RECURRENCE_MAX_HORIZON_MONTHS,
  timeOfDayJst,
  toDatetimeLocalValue,
} from "@/lib/dateUtils";
import type { MemberWithProfile } from "@/lib/families";
import {
  ITEM_TYPE_LABEL,
  RECURRENCE_FREQ_LABEL,
  type Item,
  type ItemStatus,
  type ItemType,
  type RecurrenceFreq,
} from "@/types/database";

// ホームや一覧の左端の色（予定=緑、実施作業=黄）と揃える
const ITEM_TYPE_SELECTED_CLASS: Record<ItemType, string> = {
  event: "border-green-600 bg-green-950 text-green-300",
  todo: "border-amber-600 bg-amber-950 text-amber-300",
};

// 新規登録で日付だけが決まっているとき、実施作業の開始・期限の時刻に入れておく初期値
const DEFAULT_TODO_START_TIME = "09:00";
const DEFAULT_TODO_DUE_TIME = "18:00";

const INPUT_CLASS =
  "w-full rounded-lg border bg-gray-800 px-4 py-3 text-base text-gray-100 focus:border-blue-500 aria-[invalid=true]:border-red-400";

export type ItemFormValues = {
  type: ItemType;
  title: string;
  description: string;
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  dueAt: string | null;
  assigneeId: string | null;
  status: ItemStatus;
  recurrence: { freq: RecurrenceFreq; startDateKey: string; startTime: string; endTime: string; untilDateKey: string } | null;
};

/** 入力チェックのエラーと、それが出た入力欄のid */
type FieldError = { field: string; message: string };

const RECURRENCE_OPTIONS: RecurrenceFreq[] = ["daily", "weekly", "biweekly", "monthly"];

// 日付/時刻入力はカレンダーアイコン部分をクリックしないと選択UIが開かないため、
// 欄のどこをクリックしてもネイティブの選択UIが開くようにする（未対応ブラウザではshowPickerが存在せず何もしない）
function openPicker(e: MouseEvent<HTMLInputElement>) {
  e.currentTarget.showPicker?.();
}

function RequiredMark() {
  // 必須であることはinputのrequiredで読み上げに伝わるため、記号自体は読み上げない
  return (
    <span aria-hidden="true" className="text-red-400">
      *
    </span>
  );
}

export function ItemForm({
  members,
  initialItem,
  initialDateKey,
  defaultAssigneeId,
  submitting,
  submitLabel,
  submitError,
  onSubmit,
  onCancel,
}: {
  members: MemberWithProfile[];
  initialItem?: Item;
  /** 新規登録時に日付欄へ入れておく日付（「YYYY-MM-DD」。ホームで選んでいた日など） */
  initialDateKey?: string;
  /** 新規登録時の担当者の初期値（ログイン中のユーザーなど）。そのグループのメンバーにいる場合だけ使う */
  defaultAssigneeId?: string;
  submitting: boolean;
  submitLabel: string;
  /** 保存に失敗したときのメッセージ（保存ボタンのすぐ上に出す） */
  submitError?: string | null;
  onSubmit: (values: ItemFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const newDateKey = initialItem ? "" : (initialDateKey ?? "");

  const [type, setType] = useState<ItemType>(initialItem?.type ?? "todo");
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(initialItem?.assignee_id ?? "");
  // 利用者が担当者を自分で選んだ後は、初期値で上書きしない
  const assigneeTouchedRef = useRef(false);

  // メンバー一覧は画面を開いた後に読み込まれるため、読み込み後に初期値の担当者を設定する。
  // 本人がそのグループのメンバーでない場合（スーパー管理者が他のグループを閲覧中など）は、
  // 担当者にするとDBの所属チェックで登録に失敗するため設定しない
  useEffect(() => {
    if (initialItem || assigneeTouchedRef.current || assigneeId || !defaultAssigneeId) return;
    if (members.some((member) => member.profile_id === defaultAssigneeId)) setAssigneeId(defaultAssigneeId);
  }, [initialItem, members, defaultAssigneeId, assigneeId]);
  const [status, setStatus] = useState<ItemStatus>(initialItem?.status ?? "not_started");
  const [isAllDay, setIsAllDay] = useState(initialItem?.is_all_day ?? false);

  // 予定用（日付・開始時間・終了時間を分けて管理する）
  const [eventDate, setEventDate] = useState(initialItem ? dateKeyJst(initialItem.start_at) : newDateKey);
  const [startTime, setStartTime] = useState(timeOfDayJst(initialItem?.start_at ?? null));
  const [endTime, setEndTime] = useState(timeOfDayJst(initialItem?.end_at ?? null));
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq | "none">("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");

  // 実施作業用（終日でなければ従来通り日時で管理する）
  const [startAtLocal, setStartAtLocal] = useState(
    initialItem ? toDatetimeLocalValue(initialItem.start_at) : newDateKey && `${newDateKey}T${DEFAULT_TODO_START_TIME}`
  );
  const [dueAtLocal, setDueAtLocal] = useState(
    initialItem ? toDatetimeLocalValue(initialItem.due_at) : newDateKey && `${newDateKey}T${DEFAULT_TODO_DUE_TIME}`
  );
  const [startDateOnly, setStartDateOnly] = useState(initialItem ? dateKeyJst(initialItem.start_at) : newDateKey);
  const [dueDateOnly, setDueDateOnly] = useState(initialItem ? dateKeyJst(initialItem.due_at) : newDateKey);

  const [error, setError] = useState<FieldError | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  /** 入力チェックのエラーを該当する欄の下に出し、その欄へフォーカスを移す（長いフォームでも直す場所がすぐ分かるように） */
  function fail(field: string, message: string) {
    setError({ field, message });
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  }

  /** 入力欄に付ける、エラーの状態と説明文の関連付け */
  function fieldProps(field: string) {
    const invalid = error?.field === field;
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${field}-error` : undefined,
      className: `${INPUT_CLASS} ${invalid ? "border-red-400" : "border-gray-600"}`,
    };
  }

  function errorFor(field: string): ReactNode {
    if (error?.field !== field) return null;
    return (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm text-red-400">
        {error.message}
      </p>
    );
  }

  function handleApplyListPrefix(kind: ListPrefixKind) {
    const el = descriptionRef.current;
    const cursorPos = el ? el.selectionStart : description.length;
    const result = applyListPrefix(description, cursorPos, kind);
    setDescription(result.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.cursorPos, result.cursorPos);
    });
  }

  function handleDescriptionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const el = e.currentTarget;
    const result = applyEnterContinuation(description, el.selectionStart);
    if (!result) return;

    e.preventDefault();
    setDescription(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.cursorPos, result.cursorPos);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return fail("title", "タイトルを入力してください。");

    if (type === "event") {
      if (!eventDate) return fail("eventDate", "日付を入力してください。");
      if (!isAllDay && !startTime) return fail("startTime", "開始時間を入力してください。");
      if (!isAllDay && endTime && startTime && endTime < startTime) {
        return fail("endTime", "終了時間は開始時間より後にしてください。");
      }
      if (!initialItem && recurrenceFreq !== "none") {
        if (!recurrenceUntil) return fail("recurrenceUntil", "繰り返しの期限（ここまで）を入力してください。");
        if (recurrenceUntil < eventDate) return fail("recurrenceUntil", "繰り返しの期限は開始日より後にしてください。");
        if (recurrenceUntil > addMonthsToDateKey(eventDate, RECURRENCE_MAX_HORIZON_MONTHS)) {
          return fail(
            "recurrenceUntil",
            `繰り返しの期限は開始日から最大${RECURRENCE_MAX_HORIZON_MONTHS}か月後までにしてください。`
          );
        }
      }

      const startAt = combineDateAndTimeJst(eventDate, isAllDay ? "00:00" : startTime);
      const endAt = isAllDay ? null : endTime ? combineDateAndTimeJst(eventDate, endTime) : null;
      const recurrence =
        !initialItem && recurrenceFreq !== "none"
          ? {
              freq: recurrenceFreq,
              startDateKey: eventDate,
              startTime: isAllDay ? "00:00" : startTime,
              endTime: isAllDay ? "00:00" : endTime,
              untilDateKey: recurrenceUntil,
            }
          : null;

      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim(),
        isAllDay,
        startAt,
        endAt,
        dueAt: null,
        assigneeId: assigneeId || null,
        status,
        recurrence,
      });
      return;
    }

    // 実施作業
    const startAt = isAllDay ? combineDateAndTimeJst(startDateOnly, "00:00") : fromDatetimeLocalValue(startAtLocal);
    const dueAt = isAllDay ? combineDateAndTimeJst(dueDateOnly, "00:00") : fromDatetimeLocalValue(dueAtLocal);
    const unit = isAllDay ? "日" : "日時";

    if (!startAt) return fail("startAt", `開始${unit}を入力してください。`);
    if (!dueAt) return fail("dueAt", `期限${unit}を入力してください。`);
    if (new Date(dueAt).getTime() < new Date(startAt).getTime()) {
      return fail("dueAt", "期限は開始より後に設定してください。");
    }

    await onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      isAllDay,
      startAt,
      endAt: null,
      dueAt,
      assigneeId: assigneeId || null,
      status,
      recurrence: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-300">種別</legend>
        {(["todo", "event"] as ItemType[]).map((value) => (
          <label
            key={value}
            // ラジオボタン自体は見えないため、キーボードで選んでいるときはラベル側に枠線を出す
            className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
              type === value ? ITEM_TYPE_SELECTED_CLASS[value] : "border-gray-600 text-gray-300"
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
            {ITEM_TYPE_LABEL[value]}
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-300">
          タイトル <RequiredMark />
        </label>
        <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} {...fieldProps("title")} />
        {errorFor("title")}
      </div>

      <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-gray-300">
        <input
          type="checkbox"
          checked={isAllDay}
          onChange={(e) => setIsAllDay(e.target.checked)}
          className="size-5 rounded border-gray-600"
        />
        終日（時間を指定しない）
      </label>

      {type === "event" ? (
        <>
          <div>
            <label htmlFor="eventDate" className="mb-1 block text-sm font-medium text-gray-300">
              日付 <RequiredMark />
            </label>
            <input
              id="eventDate"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              onClick={openPicker}
              {...fieldProps("eventDate")}
            />
            {errorFor("eventDate")}
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="mb-1 block text-sm font-medium text-gray-300">
                  開始時間 <RequiredMark />
                </label>
                <input
                  id="startTime"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  onClick={openPicker}
                  {...fieldProps("startTime")}
                />
                {errorFor("startTime")}
              </div>
              <div>
                <label htmlFor="endTime" className="mb-1 block text-sm font-medium text-gray-300">
                  終了時間
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  onClick={openPicker}
                  {...fieldProps("endTime")}
                />
                {errorFor("endTime")}
              </div>
            </div>
          )}

          {!initialItem && (
            <div>
              <label htmlFor="recurrenceFreq" className="mb-1 block text-sm font-medium text-gray-300">
                繰り返し
              </label>
              <select
                id="recurrenceFreq"
                value={recurrenceFreq}
                onChange={(e) => {
                  const value = e.target.value as RecurrenceFreq | "none";
                  setRecurrenceFreq(value);
                  if (value !== "none" && !recurrenceUntil && eventDate) {
                    setRecurrenceUntil(addMonthsToDateKey(eventDate, RECURRENCE_DEFAULT_UNTIL_MONTHS));
                  }
                }}
                className={`${INPUT_CLASS} appearance-none border-gray-600`}
              >
                <option value="none">繰り返さない</option>
                {RECURRENCE_OPTIONS.map((freq) => (
                  <option key={freq} value={freq}>
                    {RECURRENCE_FREQ_LABEL[freq]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!initialItem && recurrenceFreq !== "none" && (
            <div>
              <label htmlFor="recurrenceUntil" className="mb-1 block text-sm font-medium text-gray-300">
                繰り返しの期限（ここまで） <RequiredMark />
              </label>
              <input
                id="recurrenceUntil"
                type="date"
                required
                min={eventDate || undefined}
                max={eventDate ? addMonthsToDateKey(eventDate, RECURRENCE_MAX_HORIZON_MONTHS) : undefined}
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
                onClick={openPicker}
                {...fieldProps("recurrenceUntil")}
              />
              {errorFor("recurrenceUntil")}
              <p className="mt-1 text-xs text-gray-400">
                この日までの分をまとめて作成します（開始日から最大{RECURRENCE_MAX_HORIZON_MONTHS}か月後まで）。
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startAt" className="mb-1 block text-sm font-medium text-gray-300">
              開始{isAllDay ? "日" : "日時"} <RequiredMark />
            </label>
            {isAllDay ? (
              <input
                id="startAt"
                type="date"
                required
                value={startDateOnly}
                onChange={(e) => setStartDateOnly(e.target.value)}
                onClick={openPicker}
                {...fieldProps("startAt")}
              />
            ) : (
              <input
                id="startAt"
                type="datetime-local"
                required
                value={startAtLocal}
                onChange={(e) => setStartAtLocal(e.target.value)}
                onClick={openPicker}
                {...fieldProps("startAt")}
              />
            )}
            {errorFor("startAt")}
          </div>
          <div>
            <label htmlFor="dueAt" className="mb-1 block text-sm font-medium text-gray-300">
              期限{isAllDay ? "日" : "日時"} <RequiredMark />
            </label>
            {isAllDay ? (
              <input
                id="dueAt"
                type="date"
                required
                value={dueDateOnly}
                onChange={(e) => setDueDateOnly(e.target.value)}
                onClick={openPicker}
                {...fieldProps("dueAt")}
              />
            ) : (
              <input
                id="dueAt"
                type="datetime-local"
                required
                value={dueAtLocal}
                onChange={(e) => setDueAtLocal(e.target.value)}
                onClick={openPicker}
                {...fieldProps("dueAt")}
              />
            )}
            {errorFor("dueAt")}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="assignee" className="mb-1 block text-sm font-medium text-gray-300">
          担当者
        </label>
        <select
          id="assignee"
          value={assigneeId}
          onChange={(e) => {
            assigneeTouchedRef.current = true;
            setAssigneeId(e.target.value);
          }}
          className={`${INPUT_CLASS} appearance-none border-gray-600`}
        >
          <option value="">担当なし</option>
          {members.map((member) => (
            <option key={member.profile_id} value={member.profile_id}>
              {member.profile.display_name}
            </option>
          ))}
        </select>
      </div>

      {initialItem && (
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-300">
            状況
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ItemStatus)}
            className={`${INPUT_CLASS} appearance-none border-gray-600`}
          >
            <option value="not_started">未対応</option>
            <option value="in_progress">対応中</option>
            <option value="done">完了</option>
          </select>
        </div>
      )}

      {/* 詳細は任意のため、必須の日時・担当者より後ろに置く（スマホで必須欄が画面の下に押しやられないように） */}
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-300">
          詳細
        </label>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => handleApplyListPrefix("bullet")}
            className="min-h-9 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300"
          >
            ・箇条書き
          </button>
          <button
            type="button"
            onClick={() => handleApplyListPrefix("numbered")}
            className="min-h-9 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300"
          >
            1. 番号
          </button>
          <button
            type="button"
            onClick={() => handleApplyListPrefix("task")}
            className="min-h-9 rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300"
          >
            ☑ タスク
          </button>
        </div>
        <textarea
          id="description"
          ref={descriptionRef}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleDescriptionKeyDown}
          className={`${INPUT_CLASS} border-gray-600`}
        />
        {description.trim() && (
          <div className="mt-2 flex flex-col gap-1 rounded-lg border border-gray-700 bg-gray-700 p-3">
            {description.split("\n").map((line, index) => {
              const parsed = parseChecklistLine(line);

              if (parsed.kind === "task") {
                return (
                  <label key={index} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={parsed.checked}
                      onChange={() => setDescription((prev) => toggleTaskLine(prev, index))}
                      className="mt-0.5 size-4 shrink-0 rounded border-gray-600"
                    />
                    <span className={parsed.checked ? "text-gray-400 line-through" : "text-gray-300"}>
                      {parsed.text}
                    </span>
                  </label>
                );
              }

              if (parsed.kind === "bullet") {
                return (
                  <p key={index} className="flex gap-2 text-sm text-gray-300">
                    <span aria-hidden>・</span>
                    <span>{parsed.text}</span>
                  </p>
                );
              }

              if (parsed.kind === "numbered") {
                return (
                  <p key={index} className="flex gap-2 text-sm text-gray-300">
                    <span aria-hidden>{parsed.number}.</span>
                    <span>{parsed.text}</span>
                  </p>
                );
              }

              return line.trim() ? (
                <p key={index} className="text-sm text-gray-300">
                  {line}
                </p>
              ) : (
                <div key={index} className="h-2" />
              );
            })}
          </div>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-red-400">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 flex-1 rounded-lg border border-gray-600 text-base font-semibold text-gray-300"
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
