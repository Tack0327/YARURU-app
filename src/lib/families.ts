import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FamilyGroup, FamilyMember, Profile } from "@/types/database";

type Client = SupabaseClient<Database>;

export type MyGroupInfo = {
  group: FamilyGroup;
  role: FamilyMember["role"];
};

export async function fetchMyGroup(supabase: Client): Promise<MyGroupInfo | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) return null;

  const { data: membership, error: memberError } = await supabase
    .from("family_members")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership) return null;

  const { data: group, error: groupError } = await supabase
    .from("family_groups")
    .select("*")
    .eq("id", membership.group_id)
    .single();
  if (groupError) throw groupError;

  return { group, role: membership.role };
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
