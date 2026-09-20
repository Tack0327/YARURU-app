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
