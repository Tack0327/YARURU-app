-- YARURU: 家族グループからの脱退機能
-- ownerは脱退できない（グループを削除するか、設定から管理する）。member（一般メンバー）は自分自身を脱退させられる。

create or replace function public.leave_family_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.family_members
  where group_id = p_group_id and profile_id = auth.uid();

  if v_role is null then
    raise exception 'このグループに所属していません';
  end if;

  if v_role = 'owner' then
    raise exception 'グループの作成者は脱退できません。グループを削除するか、設定から管理してください';
  end if;

  delete from public.family_members
  where group_id = p_group_id and profile_id = auth.uid();
end;
$$;

grant execute on function public.leave_family_group(uuid) to authenticated;
