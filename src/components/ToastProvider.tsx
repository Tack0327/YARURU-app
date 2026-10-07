"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastVariant = "success" | "error";
type Toast = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    // エラーは原因と対処を読む時間が要るため、成功の通知より長く表示する
    setTimeout(
      () => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      },
      variant === "error" ? 8000 : 3000
    );
  }, []);

  const latestMessage = toasts.findLast((toast) => toast.variant === "success")?.message ?? "";
  const latestError = toasts.findLast((toast) => toast.variant === "error")?.message ?? "";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 読み上げソフトは、最初からある領域の中身が変わったときに確実に読み上げるため、読み上げ用の領域を常に置いておく。
          エラーは他の読み上げに割り込んで伝える */}
      <div role="status" aria-live="polite" className="sr-only">
        {latestMessage}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {latestError}
      </div>
      {/* 下部ナビ（高さ3.5rem）とiPhoneのホームバーに重ならない位置に出す。
          トーストはタップする必要がないので、下にあるナビやボタンの操作を妨げないようクリックを透過させる */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            aria-hidden="true"
            // 成功時は、白ベースでも反転して読める組み合わせ（gray-100の背景にgray-900の文字）にする。
            // text-whiteは反転されないため、反転されるgray-700の背景と組み合わせると白ベースで白地に白文字になる
            className={`w-full max-w-sm rounded-lg px-4 py-3 text-center text-sm font-medium shadow-lg ${
              toast.variant === "error" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-900"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
