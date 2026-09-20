-- YARURU: ログイン後に表示する家族グループの設定を、所属チェック付きのRPC経由に変更する
-- 直接のテーブル更新だと、所属していないグループIDを設定してもDB側では拒否されなかったため。

create or replace function public.set_default_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_group_id is not null and not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid()
  ) then
    raise exception '所属していないグループは設定できません';
  end if;

  update public.profiles set default_group_id = p_group_id where id = auth.uid();
end;
$$;

grant execute on function public.set_default_group(uuid) to authenticated;
