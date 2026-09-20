"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fetchAllGroups } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";
import type { FamilyGroup } from "@/types/database";

/** 選択・絞り込みの対象にできる家族グループ一覧。スーパー管理者は全グループ、それ以外は自分の所属グループを返す */
export function useSelectableGroups(): FamilyGroup[] {
  const { groups, isSuperAdmin } = useAuth();
  const [supabase] = useState(() => createClient());
  const [allGroupsForAdmin, setAllGroupsForAdmin] = useState<FamilyGroup[] | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchAllGroups(supabase)
      .then(setAllGroupsForAdmin)
      .catch(() => setAllGroupsForAdmin(null));
  }, [isSuperAdmin, supabase]);

  return useMemo(
    () => (isSuperAdmin && allGroupsForAdmin ? allGroupsForAdmin : groups.map((g) => g.group)),
    [isSuperAdmin, allGroupsForAdmin, groups]
  );
}
