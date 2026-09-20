"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { NavBar } from "./NavBar";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
}

function GroupsErrorScreen({ message }: { message: string }) {
  const { refreshGroup } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    await refreshGroup();
    setRetrying(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-red-600">{message}</p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-600 disabled:opacity-50"
      >
        {retrying ? "再読み込み中..." : "再読み込み"}
      </button>
    </div>
  );
}

function TopBar() {
  const { user, group, isAdminViewing, exitAdminView, signOut } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "";

  async function handleSignOut() {
    setLoggingOut(true);
    await signOut();
    router.replace("/login");
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
      <header className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <span className="truncate text-sm font-medium text-gray-700">{displayName}</span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-600 disabled:opacity-50"
        >
          {loggingOut ? "..." : "ログアウト"}
        </button>
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
  const { user, group, groupsError, loading } = useAuth();
  const router = useRouter();

  // 家族グループが無いことが確定している場合のみ新規作成へ誘導する。
  // 一時的な取得エラーの場合は、所属グループが無いと誤解させないようエラー表示に留める（groupsErrorの説明を参照）
  const shouldRedirectToNewGroup = requireGroup && !group && !groupsError;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (shouldRedirectToNewGroup) {
      router.replace("/groups/new");
    }
  }, [loading, user, shouldRedirectToNewGroup, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  if (requireGroup && !group) {
    return groupsError ? <GroupsErrorScreen message={groupsError} /> : <LoadingScreen />;
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
