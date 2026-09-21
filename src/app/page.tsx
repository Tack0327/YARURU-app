"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function RootPage() {
  const { user, group, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!group) {
      router.replace("/groups/new");
    } else {
      router.replace("/home");
    }
  }, [loading, user, group, router]);

  return <div className="flex min-h-screen items-center justify-center text-gray-400">読み込み中...</div>;
}
