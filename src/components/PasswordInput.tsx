"use client";

import { useState } from "react";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 pr-16 text-base text-gray-100 focus:border-blue-500"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-gray-400"
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示する"}
      >
        {visible ? "隠す" : "表示"}
      </button>
    </div>
  );
}
