-- YARURU: スーパー管理者判定を、メールアドレスの直書きからprofiles.is_super_adminフラグ管理に変更する
-- （メールアドレス変更時にも判定が壊れないようにするため）

alter table public.profiles add column if not exists is_super_admin boolean not null default false;

-- 現在のスーパー管理者アカウントに、このマイグレーション実行時点でのみメールアドレスからフラグを付与する
-- （以降の判定は下記is_super_admin()の通りこのフラグを見るだけで、メールアドレスには依存しない）
update public.profiles p
set is_super_admin = true
from auth.users u
where u.id = p.id and lower(u.email) = lower('Hisataka.Takagi.ym@renesas.com');

-- is_super_adminは、アプリ（PostgREST経由のAPIリクエスト）からは変更できないようにする。
-- SQL Editor等での直接更新（管理者の追加・削除）のみ許可する。
-- request.jwt.claimsはPostgREST経由のリクエストでのみ設定されるため、これで区別できる。
create or replace function public.profiles_protect_super_admin_flag()
returns trigger
language plpgsql
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and current_setting('request.jwt.claims', true) is not null then
    new.is_super_admin := old.is_super_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_super_admin_flag_trigger on public.profiles;
create trigger profiles_protect_super_admin_flag_trigger
  before update on public.profiles
  for each row execute function public.profiles_protect_super_admin_flag();

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;
