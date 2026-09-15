"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { NavBar } from "./NavBar";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
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
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      <NavBar />
    </div>
  );
}
