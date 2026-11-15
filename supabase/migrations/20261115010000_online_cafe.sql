-- Online café MVP: short-lived positions and an opt-in, allowlisted garden view.
-- No changes to garden_saves policies, economy, mission records or CAS saving.
begin;
create table public.garden_sharing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.garden_sharing enable row level security;
create policy garden_sharing_own on public.garden_sharing for all to authenticated
  using (user_id=(select auth.uid()) and (select public.has_google_session()))
  with check (user_id=(select auth.uid()) and (select public.has_google_session()));
revoke all on public.garden_sharing from anon,authenticated;
grant select,insert,update on public.garden_sharing to authenticated;

create table public.cafe_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null
);
alter table public.cafe_sessions enable row level security;
revoke all on public.cafe_sessions from anon,authenticated;

create table public.cafe_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  garden_name text not null check (char_length(garden_name)<=24),
  x real not null check (x>144 and x<1904),
  y real not null check (y>480 and y<1380),
  seat_id text unique check (seat_id is null or seat_id ~ '^chair-([1-9]|10)$'),
  updated_at timestamptz not null default now()
);
alter table public.cafe_members enable row level security;
create policy cafe_members_read on public.cafe_members for select to authenticated
  using ((select public.has_google_session()) and updated_at>now()-interval '30 seconds');
revoke all on public.cafe_members from anon,authenticated;
-- Session tokens live in the unpublished cafe_sessions table with no client grants.
grant select on public.cafe_members to authenticated;

create function public.cafe_step(p_session uuid,p_x real,p_y real,p_seat text,p_join boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_x real:=p_x; v_y real:=p_y; v_i integer; v_name text; v_row public.cafe_members; v_session uuid;
begin
  if v_uid is null or not public.has_google_session() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_session is null then raise exception 'Invalid session' using errcode='22023'; end if;
  -- Serialize join/leave/movement from multiple tabs of the same account.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
  delete from public.cafe_members where updated_at<=now()-interval '30 seconds';
  select * into v_row from public.cafe_members where user_id=v_uid for update;
  select session_id into v_session from public.cafe_sessions where user_id=v_uid;
  if not p_join and v_session is distinct from p_session then return jsonb_build_object('status','replaced'); end if;
  if not p_join and v_row.user_id is null then return jsonb_build_object('status','expired'); end if;
  if p_seat is not null then
    if p_seat !~ '^chair-([1-9]|10)$' then raise exception 'Invalid chair' using errcode='22023'; end if;
    v_i:=split_part(p_seat,'-',2)::integer-1;
    v_x:=case v_i/2 when 0 then 480 when 1 then 1024 when 2 then 1568 when 3 then 480 else 1568 end + case when v_i%2=0 then -140 else 140 end;
    v_y:=case when v_i<6 then 810 else 1170 end;
    if p_join or v_row.user_id is null or sqrt(power(v_row.x-v_x,2)+power(v_row.y-v_y,2))>240 then return jsonb_build_object('status','far'); end if;
    if exists(select 1 from public.cafe_members where seat_id=p_seat and user_id<>v_uid) then return jsonb_build_object('status','occupied'); end if;
  else
    if v_x is null or v_y is null or not(v_x>144 and v_x<1904 and v_y>480 and v_y<1380)
      or v_x::text in ('NaN','Infinity','-Infinity') or v_y::text in ('NaN','Infinity','-Infinity')
      or exists(select 1 from (values(480,700),(1024,700),(1568,700),(480,1060),(1568,1060)) as t(x,y) where abs(v_x-t.x)<100 and abs(v_y-t.y)<55)
      or exists(select 1 from (values(340,810),(620,810),(884,810),(1164,810),(1428,810),(1708,810),(340,1170),(620,1170),(1428,1170),(1708,1170)) as c(x,y) where abs(v_x-c.x)<42 and v_y>c.y-28 and v_y<c.y+6)
    then raise exception 'Invalid position' using errcode='22023'; end if;
  end if;
  select left(coalesce(nullif(case when jsonb_typeof(state->'garden'->'name')='string' then state->'garden'->>'name' end,''),'나의 작은 정원'),24) into v_name from public.garden_saves where user_id=v_uid;
  if p_join then
    insert into public.cafe_sessions(user_id,session_id) values(v_uid,p_session)
      on conflict(user_id) do update set session_id=excluded.session_id;
  end if;
  begin
    insert into public.cafe_members(user_id,garden_name,x,y,seat_id)
      values(v_uid,coalesce(v_name,'나의 작은 정원'),v_x,v_y,p_seat)
      on conflict(user_id) do update set garden_name=excluded.garden_name,x=excluded.x,y=excluded.y,seat_id=excluded.seat_id,updated_at=now();
  exception when unique_violation then return jsonb_build_object('status','occupied'); end;
  return jsonb_build_object('status','ok');
end $$;

create function public.cafe_leave(p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.has_google_session() then raise exception 'Not authorized' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  delete from public.cafe_members where user_id=auth.uid() and exists(select 1 from public.cafe_sessions where user_id=auth.uid() and session_id=p_session);
  delete from public.cafe_sessions where user_id=auth.uid() and session_id=p_session;
end $$;

-- Dates and private IDs never leave this projection. Bad legacy dates stay seeds.
create function public.garden_plant_stage(p_date text,p_tree boolean) returns text
language plpgsql stable security invoker set search_path='' as $$
declare age integer;
begin
  age:=(now() at time zone 'Asia/Seoul')::date-p_date::date;
  return case when age is null or age<1 then 'seed' when age<3 then 'sprout' when p_tree and age<6 then 'young' else 'bloom' end;
exception when others then return 'seed';
end $$;

create function public.get_shared_garden(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb; g jsonb;
begin
  if auth.uid() is null or not public.has_google_session() then raise exception 'Not authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.garden_sharing where user_id=p_user_id and enabled) then return null; end if;
  select state into s from public.garden_saves where user_id=p_user_id;
  if s is null or coalesce(s->'garden'->>'layoutVersion','')<>'2' then return null; end if;
  g:=s->'garden';
  return jsonb_build_object(
    'name',left(coalesce(nullif(case when jsonb_typeof(g->'name')='string' then g->>'name' end,''),'나의 작은 정원'),24),
    'bed',jsonb_build_object('x',case when jsonb_typeof(g->'bed'->'x')='number' and g->'bed'->>'x' ~ '^[0-9]{1,4}(\.[0-9]{1,8})?$' then least(4096,(g->'bed'->>'x')::numeric) else 560 end,
      'y',case when jsonb_typeof(g->'bed'->'y')='number' and g->'bed'->>'y' ~ '^[0-9]{1,4}(\.[0-9]{1,8})?$' then least(3072,(g->'bed'->>'y')::numeric) else 2512 end),
    'items',(select coalesce(jsonb_agg(jsonb_build_object('kind',r->'kind','col',r->'col','row',r->'row')),'[]'::jsonb)
      from (select value as r from jsonb_array_elements(case when jsonb_typeof(g->'items')='array' then g->'items' else '[]'::jsonb end) limit 300) a where jsonb_typeof(r->'col')='number' and jsonb_typeof(r->'row')='number' and r->>'col' ~ '^[0-9]{1,3}$' and r->>'row' ~ '^[0-9]{1,3}$' and r->>'kind' in ('flowerpot','table','shelf','bench','birdbath','hammock','flower','pot','lamp')),
    'plants',(select coalesce(jsonb_agg(jsonb_build_object('plantId',r->'plantId','col',r->'col','row',r->'row','harvested',coalesce(r->'harvested'='true'::jsonb,false),
      'stage',public.garden_plant_stage(r->>'date',coalesce(r->>'plantId','') in ('apple_tree','peach_tree')))),'[]'::jsonb)
      from (select value as r from jsonb_array_elements(case when jsonb_typeof(g->'plants')='array' then g->'plants' else '[]'::jsonb end) limit 300) a where jsonb_typeof(r->'col')='number' and jsonb_typeof(r->'row')='number' and r->>'col' ~ '^[0-9]{1,3}$' and r->>'row' ~ '^[0-9]{1,3}$' and r->>'plantId' in ('dandelion','violet','clover','sunflower','cosmos','lavender','hydrangea','tulip','daisy','hibiscus','lily-of-valley','narcissus','apple_tree','peach_tree'))
  );
end $$;
revoke all on function public.cafe_step(uuid,real,real,text,boolean),public.cafe_leave(uuid),public.get_shared_garden(uuid),public.garden_plant_stage(text,boolean) from public,anon,authenticated;
grant execute on function public.cafe_step(uuid,real,real,text,boolean),public.cafe_leave(uuid),public.get_shared_garden(uuid) to authenticated;
-- Only the safe position table is published. Never publish garden_saves.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafe_members') then
    alter publication supabase_realtime add table public.cafe_members;
  end if;
end $$;
commit;
