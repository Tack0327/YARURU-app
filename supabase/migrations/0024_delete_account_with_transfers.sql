-- YARURU: アカウント削除時の管理者委譲を1回のトランザクションにまとめる
-- これまではクライアント側でtransfer_group_ownershipを複数回呼んだ後にdelete_user_accountを呼んでいたため、
-- 途中の委譲が失敗すると、それ以前の委譲だけが確定した中途半端な状態が残ってしまっていた。
-- 1つのSECURITY DEFINER関数の中で行うことで、途中で例外が起きた場合はすべて自動的に取り消される。

create or replace function public.delete_account_with_transfers(p_user_id uuid, p_transfers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer jsonb;
begin
  for v_transfer in select * from jsonb_array_elements(p_transfers)
  loop
    perform public.transfer_group_ownership(
      (v_transfer ->> 'group_id')::uuid,
      (v_transfer ->> 'new_owner_id')::uuid
    );
  end loop;

  perform public.delete_user_account(p_user_id);
end;
$$;

grant execute on function public.delete_account_with_transfers(uuid, jsonb) to authenticated;
