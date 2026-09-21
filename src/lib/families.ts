import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FamilyGroup, FamilyMember, Profile } from "@/types/database";

type Client = SupabaseClient<Database>;

export type MyGroupInfo = {
  group: FamilyGroup;
  role: FamilyMember["role"];
};

/**
 * 自分のプロフィール（ログイン後に表示する家族グループの設定を含む）を取得する。
 * userIdは呼び出し元が既に持っている値を渡す（supabase.auth.getUser()は毎回サーバーへの往復が発生するため、
 * ログイン直後の読み込みで何度も呼ぶと体感速度が悪化する）。
 */
export async function fetchMyProfile(supabase: Client, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * ログイン後に最初に表示する家族グループを設定する（未設定に戻す場合はnullを渡す）。
 * RPC経由にすることで、所属していないグループIDが設定されないようDB側でも検証する。
 */
export async function updateDefaultGroup(supabase: Client, groupId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_default_group", { p_group_id: groupId });
  if (error) throw error;
}

/**
 * 自分が所属している全ての家族グループを取得する（1人が複数グループに所属できる）。
 * userIdは呼び出し元が既に持っている値を渡す（理由はfetchMyProfileのコメント参照）。
 */
export async function fetchMyGroups(supabase: Client, userId: string): Promise<MyGroupInfo[]> {
  // family_groupsを外部キー経由で埋め込み取得し、1回の通信で済ませる
  // （以前はfamily_members取得→取得したgroup_idでfamily_groups取得の2往復になっていた。
  //   Database型のRelationshipsは空定義のままのため、.returns()で実際の戻り値の形を明示する）
  const { data, error } = await supabase
    .from("family_members")
    .select("role, family_groups(*)")
    .eq("profile_id", userId)
    .order("joined_at", { ascending: true })
    .returns<{ role: FamilyMember["role"]; family_groups: FamilyGroup | null }[]>();
  if (error) throw error;

  return (data ?? [])
    .filter((m) => m.family_groups)
    .map((m) => ({ group: m.family_groups as FamilyGroup, role: m.role }));
}

/** 招待コードを再発行する（グループのownerのみ実行可能） */
export async function regenerateInviteCode(supabase: Client, groupId: string): Promise<FamilyGroup> {
  const { data, error } = await supabase.rpc("regenerate_invite_code", { p_group_id: groupId });
  if (error) throw error;
  return data;
}

/** グループからメンバーを削除する（グループのownerのみ実行可能） */
export async function removeFamilyMember(supabase: Client, groupId: string, profileId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_family_member", { p_group_id: groupId, p_profile_id: profileId });
  if (error) throw error;
}

/** 自分自身がグループから脱退する（ownerは脱退できない） */
export async function leaveFamilyGroup(supabase: Client, groupId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_family_group", { p_group_id: groupId });
  if (error) throw error;
}

export async function createFamilyGroup(supabase: Client, name: string): Promise<FamilyGroup> {
  const { data, error } = await supabase.rpc("create_family_group", { p_name: name });
  if (error) throw error;
  return data;
}

export async function joinFamilyGroup(supabase: Client, inviteCode: string): Promise<FamilyGroup> {
  const { data, error } = await supabase.rpc("join_family_group", { p_invite_code: inviteCode });
  if (error) throw error;
  return data;
}

export type MemberWithProfile = FamilyMember & { profile: Profile };

type MemberWithEmbeddedProfile = FamilyMember & { profiles: Profile | null };

function toMemberWithProfile(members: MemberWithEmbeddedProfile[]): MemberWithProfile[] {
  return members
    .filter((m) => m.profiles)
    .map(({ profiles, ...member }) => ({ ...member, profile: profiles as Profile }));
}

export async function fetchGroupMembers(supabase: Client, groupId: string): Promise<MemberWithProfile[]> {
  // profilesを外部キー経由で埋め込み取得し、1回の通信で済ませる（以前はfamily_members取得→profiles取得の2往復だった）
  const { data, error } = await supabase
    .from("family_members")
    .select("*, profiles(*)")
    .eq("group_id", groupId)
    .returns<MemberWithEmbeddedProfile[]>();
  if (error) throw error;
  return toMemberWithProfile(data ?? []);
}

/**
 * 複数グループのメンバーを1回のクエリでまとめて取得する。
 * グループ数だけfetchGroupMembersを呼ぶと、グループ数が多い場合（スーパー管理者が全グループを見る場合など）に
 * N+1クエリとなり遅くなるため、一覧画面での複数グループ表示時はこちらを使う。
 */
export async function fetchGroupMembersForGroups(supabase: Client, groupIds: string[]): Promise<MemberWithProfile[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("family_members")
    .select("*, profiles(*)")
    .in("group_id", groupIds)
    .returns<MemberWithEmbeddedProfile[]>();
  if (error) throw error;
  return toMemberWithProfile(data ?? []);
}

/**
 * 渡したグループのうち、自分ひとりだけが所属しているグループのIDを返す。
 * アカウント削除（退会）時に「このグループも同時に削除される」という警告を出すために使う。
 */
export async function fetchSoleMemberGroupIds(supabase: Client, groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase.from("family_members").select("group_id").in("group_id", groupIds);
  if (error) throw error;

  const counts = new Map<string, number>();
  (data ?? []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));
  return groupIds.filter((id) => (counts.get(id) ?? 0) <= 1);
}

/** 管理者(owner)を、同じグループの他のメンバーへ委譲する（現在の管理者本人、またはスーパー管理者のみ実行可能） */
export async function transferGroupOwnership(supabase: Client, groupId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase.rpc("transfer_group_ownership", { p_group_id: groupId, p_new_owner_id: newOwnerId });
  if (error) throw error;
}

/** 家族グループを削除する（グループのowner、またはスーパー管理者のみ実行可能）。関連するチケット・メンバーも連鎖削除される */
export async function deleteFamilyGroup(supabase: Client, groupId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_family_group", { p_group_id: groupId });
  if (error) throw error;
}
