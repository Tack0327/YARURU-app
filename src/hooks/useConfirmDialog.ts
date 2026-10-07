"use client";

import { useCallback, useEffect, useId, useRef, type KeyboardEvent } from "react";

/**
 * 画面内に出す確認欄（削除・脱退など）のキーボード操作を整える。
 * - 確認欄が開いたら「キャンセル」にフォーカスを移す（確認欄を開いたボタン自体が消えるため、そのままだとフォーカスが失われる。
 *   取り消せない操作が多いので、うっかりEnterで実行しないようキャンセル側にする）
 * - Escキーでキャンセルできるようにする
 * - 閉じたら、確認欄を開いたボタンにフォーカスを戻す
 *
 * triggerPropsは確認欄を開くボタンに、cancelPropsはキャンセルボタンに展開して渡す。
 * （確認欄の開閉でボタンが作り直されるため、refではなく目印の属性で探す）
 */
export function useConfirmDialog(open: boolean, onCancel: () => void, busy = false) {
  const key = useId();
  const messageId = `${key}-message`;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      document.querySelector<HTMLElement>(`[data-confirm-cancel="${key}"]`)?.focus();
    } else if (wasOpenRef.current) {
      // 画面幅によって表示を切り替えているボタン（display:noneの方）は除き、見えている方に戻す
      const triggers = document.querySelectorAll<HTMLElement>(`[data-confirm-trigger="${key}"]`);
      Array.from(triggers)
        .find((el) => el.offsetParent !== null)
        ?.focus();
    }
    wasOpenRef.current = open;
  }, [open, key]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      }
    },
    [busy, onCancel]
  );

  return {
    messageId,
    triggerProps: { "data-confirm-trigger": key },
    cancelProps: { "data-confirm-cancel": key },
    dialogProps: { role: "alertdialog" as const, "aria-labelledby": messageId, onKeyDown: handleKeyDown },
  };
}
