"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { NavBar } from "./NavBar";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
}

function TopBar() {
  const { user, group, groups, selectGroup, isAdminViewing, exitAdminView, signOut } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "";

  async function handleSignOut() {
    setLoggingOut(true);
    await signOut();
    router.replace("/login");
  }

  function handleSelectGroup(groupId: string) {
    selectGroup(groupId);
    router.replace("/home");
  }

  return (
    <>
      {isAdminViewing && (
        <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-800">
          <span>🛡️ 管理者として「{group?.group.name}」を閲覧中</span>
          <button
            type="button"
            onClick={() => {
              exitAdminView();
              router.replace("/home");
            }}
            className="underline"
          >
            終了する
          </button>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2">
        {!isAdminViewing && groups.length > 1 && group ? (
          <select
            value={group.group.id}
            onChange={(e) => handleSelectGroup(e.target.value)}
            aria-label="家族グループを切り替える"
            className="min-h-9 max-w-[45%] truncate rounded-lg border border-gray-300 px-2 text-sm font-semibold text-gray-700"
          >
            {groups.map((g) => (
              <option key={g.group.id} value={g.group.id}>
                {g.group.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="truncate text-sm font-semibold text-gray-700">{group?.group.name}</span>
        )}
        <div className="flex items-center gap-3">
          <span className="truncate text-sm font-medium text-gray-700">{displayName}</span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-600 disabled:opacity-50"
          >
            {loggingOut ? "..." : "ログアウト"}
          </button>
        </div>
      </header>
    </>
  );
}

/** ログイン済みであることを要求する。requireGroupを指定すると家族グループへの参加も必須にする。 */
export function RequireAuth({
  children,
  requireGroup = false,
  showNav = false,
}: {
  children: React.ReactNode;
  requireGroup?: boolean;
  showNav?: boolean;
}) {
  const { user, group, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireGroup && !group) {
      router.replace("/groups/new");
    }
  }, [loading, user, group, requireGroup, router]);

  if (loading || !user || (requireGroup && !group)) {
    return <LoadingScreen />;
  }

  if (!showNav) {
    return (
      <div className="min-h-screen">
        <TopBar />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      <NavBar />
    </div>
  );
}
