-- YARURU: グループ名を作成後に変更できるようにする（あわせて、利用者向けの文言を「家族グループ」から「グループ」に揃える）
-- テーブル名・関数名（family_groupsなど）は既存のデータやコードとの互換のためそのまま使い、画面上の呼び方だけを変える。

-- 1. グループ名の変更（そのグループの管理者、またはスーパー管理者のみ。グループの削除と同じ条件）
create or replace function public.rename_family_group(p_group_id uuid, p_name text)
returns public.family_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_group public.family_groups;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  if char_length(v_name) = 0 then
    raise exception 'グループ名を入力してください';
  end if;
  if char_length(v_name) > 50 then
    raise exception 'グループ名は50文字以内で入力してください';
  end if;

  update public.family_groups
  set name = v_name
  where id = p_group_id
  returning * into v_group;

  if not found then
    raise exception 'グループが見つかりません';
  end if;

  return v_group;
end;
$$;

revoke execute on function public.rename_family_group(uuid, text) from public, anon;
grant execute on function public.rename_family_group(uuid, text) to authenticated, service_role;

-- 2. チケットの所属グループ・作成者の変更を禁止するトリガー（本文は0028と同じ。メッセージの「家族グループ」のみ変更）
create or replace function public.items_prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'チケットを別のグループへ移すことはできません';
  end if;
  if new.created_by is distinct from old.created_by
     and not (new.created_by is null and pg_trigger_depth() > 1) then
    raise exception 'チケットの作成者は変更できません';
  end if;
  return new;
end;
$$;
