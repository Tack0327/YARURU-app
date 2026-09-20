import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FamilyGroup, FamilyMember, Profile } from "@/types/database";

type Client = SupabaseClient<Database>;

export type MyGroupInfo = {
  group: FamilyGroup;
  role: FamilyMember["role"];
};

/** 自分が所属している全ての家族グループを取得する（1人が複数グループに所属できる） */
export async function fetchMyGroups(supabase: Client): Promise<MyGroupInfo[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) return [];

  const { data: memberships, error: memberError } = await supabase
    .from("family_members")
    .select("*")
    .eq("profile_id", user.id)
    .order("joined_at", { ascending: true });
  if (memberError) throw memberError;
  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);
  const { data: groups, error: groupError } = await supabase.from("family_groups").select("*").in("id", groupIds);
  if (groupError) throw groupError;

  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
  return memberships
    .filter((m) => groupMap.has(m.group_id))
    .map((m) => ({ group: groupMap.get(m.group_id)!, role: m.role }));
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

export async function fetchGroupMembers(supabase: Client, groupId: string): Promise<MemberWithProfile[]> {
  const { data: members, error } = await supabase.from("family_members").select("*").eq("group_id", groupId);
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const profileIds = members.map((m) => m.profile_id);
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").in("id", profileIds);
  if (profileError) throw profileError;

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return members
    .filter((m) => profileMap.has(m.profile_id))
    .map((m) => ({ ...m, profile: profileMap.get(m.profile_id)! }));
}
