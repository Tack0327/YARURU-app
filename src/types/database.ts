export type ItemType = "event" | "todo";
export type ItemStatus = "not_started" | "in_progress" | "done";
export type RecurrenceFreq = "daily" | "weekly" | "biweekly" | "monthly";

export const RECURRENCE_FREQ_LABEL: Record<RecurrenceFreq, string> = {
  daily: "毎日",
  weekly: "毎週（同じ曜日）",
  biweekly: "隔週",
  monthly: "月に一度",
};

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  event: "予定",
  todo: "実施作業",
};

// 予定は緑、実施作業は黄。カードの左枠とカレンダーの丸印で同じ色を使うため、ここに集約する。
export const ITEM_TYPE_ACCENT: Record<ItemType, { border: string; dot: string }> = {
  event: { border: "border-l-green-500", dot: "bg-green-500" },
  todo: { border: "border-l-amber-400", dot: "bg-amber-400" },
};

export type Profile = {
  id: string;
  display_name: string;
  default_group_id: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export type FamilyGroup = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};

export type AdminAccount = {
  id: string;
  email: string;
  display_name: string;
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
  end_at: string | null;
  is_all_day: boolean;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_group_id: string | null;
  assignee_id: string | null;
  status: ItemStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ItemWithAssignee = Item & {
  assignee: Pick<Profile, "id" | "display_name"> | null;
};

export type NoteVisibility = "shared" | "private";

export type Note = {
  id: string;
  /** 「自分だけ」メモはグループに紐づかないためnull（「家族に共有」メモは必ず値を持つ） */
  group_id: string | null;
  /** 最後に編集した人。そのアカウントが削除されるとnullになる（共有メモ自体は残る） */
  profile_id: string | null;
  note_date: string;
  title: string | null;
  content: string | null;
  visibility: NoteVisibility;
  created_at: string;
  updated_at: string;
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
      notes: {
        Row: Note;
        Insert: Partial<Note> & { profile_id: string; note_date: string };
        Update: Partial<Note>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_member_of_group: { Args: { p_group_id: string }; Returns: boolean };
      create_family_group: { Args: { p_name: string }; Returns: FamilyGroup };
      join_family_group: { Args: { p_invite_code: string }; Returns: FamilyGroup };
      regenerate_invite_code: { Args: { p_group_id: string }; Returns: FamilyGroup };
      remove_family_member: { Args: { p_group_id: string; p_profile_id: string }; Returns: undefined };
      leave_family_group: { Args: { p_group_id: string }; Returns: undefined };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      delete_user_account: { Args: { p_user_id: string }; Returns: undefined };
      list_all_accounts: { Args: Record<string, never>; Returns: AdminAccount[] };
      delete_family_group: { Args: { p_group_id: string }; Returns: undefined };
      set_default_group: { Args: { p_group_id: string | null }; Returns: undefined };
      transfer_group_ownership: { Args: { p_group_id: string; p_new_owner_id: string }; Returns: undefined };
      upsert_private_note: { Args: { p_note_date: string; p_title: string | null; p_content: string | null }; Returns: Note };
      upsert_shared_note: {
        Args: { p_group_id: string; p_note_date: string; p_title: string | null; p_content: string | null };
        Returns: Note;
      };
      delete_account_with_transfers: { Args: { p_user_id: string; p_transfers: { group_id: string; new_owner_id: string }[] }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
