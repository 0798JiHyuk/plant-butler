-- Preserve new runtime when old browser versions save a snapshot.
-- No tables, columns, grants or game rewards change.
begin;
create or replace function public.save_garden_progress(
  p_user_id uuid, p_state jsonb, p_expected_revision integer, p_request_id uuid
) returns setof public.garden_saves
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_request_id is null
    or p_state is null or jsonb_typeof(p_state) <> 'object'
    or coalesce(p_state->>'version','') <> '1' or pg_catalog.octet_length(p_state::text) > 5242880 then
    raise exception 'Invalid progress request' using errcode='22023';
  end if;
  return query select * from public.garden_saves where user_id=auth.uid() and request_id=p_request_id;
  if found then return; end if;

  -- Older web clients must not strip mission runtime from a newer snapshot.
  if exists (select 1 from public.garden_saves where user_id=auth.uid() and state ? 'missions')
    and not (p_state ? 'missions') then
    raise exception 'Client update required' using errcode='22023';
  end if;

  if p_expected_revision=0 then
    return query insert into public.garden_saves as saved (user_id,state,revision,request_id)
      values(auth.uid(),p_state,1,p_request_id) on conflict(user_id) do nothing returning saved.*;
  else
    return query update public.garden_saves as saved
      set state=p_state,revision=saved.revision+1,request_id=p_request_id,updated_at=now()
      where saved.user_id=auth.uid() and saved.revision=p_expected_revision
        and (not (saved.state ? 'missions') or p_state ? 'missions') returning saved.*;
  end if;
  if found then return; end if;
  -- 같은 요청의 동시 재시도는 한 번만 반영하고 같은 결과를 반환한다.
  return query select * from public.garden_saves where user_id=auth.uid() and request_id=p_request_id;
  -- 다른 기기의 버전 갱신은 빈 결과로 알린다. 클라이언트가 재조회 후 선택한다.
end $$;
revoke all on function public.save_garden_progress(uuid,jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function public.save_garden_progress(uuid,jsonb,integer,uuid) to authenticated;
commit;
