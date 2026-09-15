export type ItemType = "event" | "todo";
export type ItemStatus = "not_started" | "in_progress" | "done";

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  event: "予定",
  todo: "実施作業",
};

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type FamilyGroup = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type FamilyMember = {
  id: string;
  group_id: string;
  profile_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type Item = {
  id: string;
  group_id: string;
  type: ItemType;
  title: string;
  description: string | null;
  start_at: string | null;
  due_at: string | null;
  assignee_id: string | null;
  status: ItemStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ItemWithAssignee = Item & {
  assignee: Pick<Profile, "id" | "display_name"> | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      family_groups: {
        Row: FamilyGroup;
        Insert: Partial<FamilyGroup> & { name: string; invite_code: string; created_by: string };
        Update: Partial<FamilyGroup>;
        Relationships: [];
      };
      family_members: {
        Row: FamilyMember;
        Insert: Partial<FamilyMember> & { group_id: string; profile_id: string };
        Update: Partial<FamilyMember>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: Partial<Item> & { group_id: string; type: ItemType; title: string; created_by: string };
        Update: Partial<Item>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_member_of_group: { Args: { p_group_id: string }; Returns: boolean };
      create_family_group: { Args: { p_name: string }; Returns: FamilyGroup };
      join_family_group: { Args: { p_invite_code: string }; Returns: FamilyGroup };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
