"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const NAV_ITEMS = [
  { href: "/home", label: "ホーム" },
  { href: "/items", label: "チケット一覧" },
  { href: "/history", label: "履歴" },
  { href: "/settings", label: "設定" },
];

const ADMIN_NAV_ITEM = { href: "/admin", label: "管理" };

export function NavBar() {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();
  const items = isSuperAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white">
      <ul className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center text-xs font-medium ${
                  isActive ? "text-blue-600" : "text-gray-500"
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
