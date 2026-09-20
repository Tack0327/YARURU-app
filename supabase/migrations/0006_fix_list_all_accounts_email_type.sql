-- YARURU: list_all_accounts()の型不一致を修正
-- auth.users.email は character varying 型のため、戻り値定義（text）に合わせて明示的にキャストする。

create or replace function public.list_all_accounts()
returns table (id uuid, email text, display_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  return query
    select p.id, u.email::text, p.display_name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at asc;
end;
$$;
