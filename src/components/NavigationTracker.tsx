"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordPageVisit } from "@/lib/navigation";

/** 画面（パス）が切り替わるたびに記録し、「開く前の画面に戻る」処理でアプリ内に戻る先があるかを判断できるようにする */
export function NavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordPageVisit(pathname);
  }, [pathname]);

  return null;
}
