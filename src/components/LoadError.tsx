"use client";

import { useState } from "react";

/** 画面の読み込みに失敗したときのメッセージと再読み込みボタン */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => unknown }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-red-400">
        {message}
      </p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="min-h-10 rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300 disabled:opacity-50"
      >
        {retrying ? "再読み込み中..." : "再読み込み"}
      </button>
    </div>
  );
}
