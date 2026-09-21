"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";

/**
 * ページ遷移のたびに、保存されているテーマ設定をhtmlタグへ再適用する。
 * ログイン画面でテーマを切り替えた直後は正しく反映されるのに、ログイン後の画面遷移で
 * 元の配色に戻ってしまう不具合の対策（画面遷移で何らかの理由でクラスが失われても、
 * ここで毎回再適用することで確実に反映され続けるようにする）。
 */
export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, [pathname]);

  return null;
}
