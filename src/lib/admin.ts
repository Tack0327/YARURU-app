import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccount, Database, FamilyGroup } from "@/types/database";

type Client = SupabaseClient<Database>;

/** 呼び出し元がスーパー管理者かどうかをサーバー側で判定する */
export async function checkIsSuperAdmin(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) throw error;
  return data ?? false;
}

/** スーパー管理者向け: 全ての家族グループを取得する（RLSにより非スーパー管理者は自分の所属分しか返らない） */
export async function fetchAllGroups(supabase: Client): Promise<FamilyGroup[]> {
  const { data, error } = await supabase.from("family_groups").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** スーパー管理者向け: 全アカウント一覧を取得する */
export async function fetchAllAccounts(supabase: Client): Promise<AdminAccount[]> {
  const { data, error } = await supabase.rpc("list_all_accounts");
  if (error) throw error;
  return data ?? [];
}

/** アカウントを削除する（本人自身、またはスーパー管理者のみ実行可能） */
export async function deleteAccount(supabase: Client, userId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_user_account", { p_user_id: userId });
  if (error) throw error;
}

/**
 * 管理者になっているグループの委譲とアカウント削除を、1つのトランザクションでまとめて実行する。
 * 途中の委譲が失敗した場合は、それ以前の委譲も含めてすべて取り消される（中途半端な状態が残らない）。
 */
export async function deleteAccountWithTransfers(
  supabase: Client,
  userId: string,
  transfers: { groupId: string; newOwnerId: string }[]
): Promise<void> {
  const { error } = await supabase.rpc("delete_account_with_transfers", {
    p_user_id: userId,
    p_transfers: transfers.map((t) => ({ group_id: t.groupId, new_owner_id: t.newOwnerId })),
  });
  if (error) throw error;
}

/** スーパー管理者向け: グループ削除前の警告表示用に、メンバー数・チケット数を取得する */
export async function fetchGroupStats(supabase: Client, groupId: string): Promise<{ memberCount: number; itemCount: number }> {
  const [membersResult, itemsResult] = await Promise.all([
    supabase.from("family_members").select("id", { count: "exact", head: true }).eq("group_id", groupId),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("group_id", groupId),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return { memberCount: membersResult.count ?? 0, itemCount: itemsResult.count ?? 0 };
}

/** スーパー管理者向け: 指定したグループそれぞれの管理者(owner)のprofile_idを取得する（group_id → profile_id） */
export async function fetchGroupOwners(supabase: Client, groupIds: string[]): Promise<Map<string, string>> {
  if (groupIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("family_members")
    .select("group_id, profile_id")
    .eq("role", "owner")
    .in("group_id", groupIds);
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.group_id, m.profile_id]));
}
