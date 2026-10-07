"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const NAV_ITEMS = [
  { href: "/home", label: "ホーム" },
  { href: "/items", label: "一覧" },
  { href: "/history", label: "完了履歴" },
  { href: "/settings", label: "設定" },
];

const ADMIN_NAV_ITEM = { href: "/admin", label: "管理" };

export function NavBar() {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();
  const items = isSuperAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    // iPhoneのホームバーにタブが重ならないよう、その高さ分だけ下に余白を取る
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-800 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          // 予定・作業の詳細・追加（/items/...）はホームからも開くため、一覧を経由したように見えないよう一覧のときだけ光らせる
          const isActive =
            item.href === "/items" ? pathname === "/items" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center text-xs font-medium ${
                  isActive ? "text-blue-400" : "text-gray-400"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
