-- 사용자 승인: 다른 .md에 정원 저장 정의가 없으면 새 테이블 추가.
-- PRD의 profiles/missions/activities/plans/events는 변경하지 않는다.
begin;
do $$
begin
  if to_regclass('public.garden_saves') is not null or exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_garden_progress'
  ) then
    raise exception 'Garden save objects already exist; inspect the owning migration before applying.';
  end if;
end $$;

create table public.garden_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state)='object' and coalesce(state->>'version','')='1'),
  revision integer not null default 1 check (revision > 0),
  request_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.garden_saves enable row level security;
create policy garden_saves_select_own on public.garden_saves
  for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.garden_saves from public, anon, authenticated;
grant select on public.garden_saves to authenticated;

create function public.save_garden_progress(
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

  if p_expected_revision=0 then
    return query insert into public.garden_saves as saved (user_id,state,revision,request_id)
      values(auth.uid(),p_state,1,p_request_id) on conflict(user_id) do nothing returning saved.*;
  else
    return query update public.garden_saves as saved
      set state=p_state,revision=saved.revision+1,request_id=p_request_id,updated_at=now()
      where saved.user_id=auth.uid() and saved.revision=p_expected_revision returning saved.*;
  end if;
  if found then return; end if;
  -- 같은 요청의 동시 재시도는 한 번만 반영하고 같은 결과를 반환한다.
  return query select * from public.garden_saves where user_id=auth.uid() and request_id=p_request_id;
  -- 다른 기기의 버전 갱신은 빈 결과로 알린다. 클라이언트가 재조회 후 선택한다.
end $$;
revoke all on function public.save_garden_progress(uuid,jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function public.save_garden_progress(uuid,jsonb,integer,uuid) to authenticated;
commit;
