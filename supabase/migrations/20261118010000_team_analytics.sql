-- PRD event schema; no reflection, custom plan, email, garden name or image payload.
begin;
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  name text not null check(name in ('app_opened','mission_viewed','mission_swapped','level_lowered','activity_completed','rested','returned','stage_changed','plan_created','reflection_added','emergency_opened','emergency_called')),
  props jsonb not null default '{}', occurred_at timestamptz not null default now(), local_date date not null
);
alter table public.events enable row level security;
revoke all on public.events from public,anon,authenticated;
create index if not exists analytics_events_day on public.events(name,local_date,user_id);
create index if not exists analytics_events_user on public.events(user_id,name,local_date);
create index if not exists analytics_events_rate on public.events(user_id,occurred_at);
create table public.analytics_team(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.analytics_team enable row level security;
create policy analytics_team_self on public.analytics_team for select to authenticated using(user_id=(select auth.uid()) and (select public.has_google_session()));
revoke all on public.analytics_team from public,anon,authenticated;
grant select on public.analytics_team to authenticated;
create table public.analytics_event_keys(user_id uuid not null references auth.users(id) on delete cascade,event_key text not null,event_id bigint not null references public.events(id),primary key(user_id,event_key));
alter table public.analytics_event_keys enable row level security;
revoke all on public.analytics_event_keys from public,anon,authenticated;
create table public.analytics_acquisition(user_id uuid primary key references auth.users(id) on delete cascade,source text not null,medium text not null,campaign text not null);
alter table public.analytics_acquisition enable row level security;
revoke all on public.analytics_acquisition from public,anon,authenticated;

create function public.record_app_event(p_name text,p_props jsonb,p_event_key text,p_source text default '',p_medium text default '',p_campaign text default '')
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); eid bigint; allowed text[];
begin
  if uid is null or not public.has_google_session() then raise exception 'Not authorized' using errcode='42501';end if;
  allowed:=case p_name when 'app_opened' then array[]::text[] when 'mission_viewed' then array['mission_id'] when 'activity_completed' then array['activity_id','mission_id','level','stage'] when 'rested' then array['activity_id','stage'] else null end;
  if allowed is null or p_props is null or jsonb_typeof(p_props)<>'object' or p_event_key is null or p_event_key !~ '^[A-Za-z0-9:_-]{1,128}$'
    or octet_length(p_props::text)>1024 then raise exception 'Invalid event' using errcode='22023';end if;
  if exists(select 1 from jsonb_object_keys(p_props) k where not k=any(allowed)) or (select count(*) from jsonb_object_keys(p_props))<>cardinality(allowed) then raise exception 'Invalid event fields' using errcode='22023';end if;
  if p_name='mission_viewed' and jsonb_typeof(p_props->'mission_id')<>'string' then raise exception 'Invalid mission type' using errcode='22023';end if;
  if p_name='activity_completed' and jsonb_typeof(p_props->'mission_id') not in ('string','null') then raise exception 'Invalid mission type' using errcode='22023';end if;
  if p_name in ('activity_completed','rested') and jsonb_typeof(p_props->'activity_id')<>'string' then raise exception 'Invalid activity type' using errcode='22023';end if;
  if p_name in ('mission_viewed','activity_completed') and coalesce(p_props->>'mission_id','')!~ '^[A-Za-z0-9_-]{1,80}$' and not(p_name='activity_completed' and p_props->'mission_id'='null'::jsonb) then raise exception 'Invalid mission id' using errcode='22023';end if;
  if p_name in ('activity_completed','rested') and (coalesce(p_props->>'activity_id','')!~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_props->'stage')<>'number' or p_props->>'stage'!~ '^[1-6]$') then raise exception 'Invalid action' using errcode='22023';end if;
  if p_name='activity_completed' and coalesce(p_props->>'level','') not in ('large','medium','small') then raise exception 'Invalid level' using errcode='22023';end if;
  if coalesce(p_source,'')!~ '^[A-Za-z0-9_-]{0,48}$' or coalesce(p_medium,'')!~ '^[A-Za-z0-9_-]{0,48}$' or coalesce(p_campaign,'')!~ '^[A-Za-z0-9_-]{0,48}$' then raise exception 'Invalid source' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||p_event_key,0));
  if exists(select 1 from public.analytics_event_keys where user_id=uid and event_key=p_event_key) then return false;end if;
  if (select count(*) from public.events where user_id=uid and occurred_at>now()-interval '1 minute')>=120 then raise exception 'Event limit' using errcode='54000';end if;
  insert into public.events(user_id,name,props,local_date) values(uid,p_name,p_props,(now() at time zone 'Asia/Seoul')::date) returning id into eid;
  insert into public.analytics_event_keys values(uid,p_event_key,eid);
  if p_name='app_opened' then insert into public.analytics_acquisition values(uid,coalesce(nullif(p_source,''),'direct'),coalesce(p_medium,''),coalesce(p_campaign,'')) on conflict(user_id) do nothing;end if;
  return true;
end $$;

create function public.team_analytics(p_days integer default 28) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Seoul')::date; since date; result jsonb;
begin
  if auth.uid() is null or not public.has_google_session() or not exists(select 1 from public.analytics_team where user_id=auth.uid()) then raise exception 'Team access required' using errcode='42501';end if;
  if p_days is null or p_days not in (7,28,90) then raise exception 'Invalid range' using errcode='22023';end if;
  since:=today-(p_days-1);
  with visible as (select e.* from public.events e where not exists(select 1 from public.analytics_team t where t.user_id=e.user_id)),
  opens as(select distinct user_id,local_date from visible where name='app_opened'),
  firsts as(select user_id,min(local_date) as first_day from opens group by user_id),
  days as(select generate_series(since,today,interval '1 day')::date as day),
  retention as(select offset_day,count(f.user_id) as eligible,count(f.user_id) filter(where exists(select 1 from opens o where o.user_id=f.user_id and o.local_date=f.first_day+offset_day)) as returned from (values(1),(7),(14)) as d(offset_day) left join firsts f on f.first_day>=since and f.first_day<=today-offset_day group by offset_day)
  select jsonb_build_object(
    'asOf',today,'days',p_days,
    'visitors',(select count(distinct user_id) from opens where local_date between since and today),
    'newUsers',(select count(*) from firsts where first_day between since and today),
    'activeToday',(select count(*) from opens where local_date=today),
    'completionUsers',(select count(distinct user_id) from visible where name='activity_completed' and local_date between since and today),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',day,'active',(select count(*) from opens where local_date=day),'newUsers',(select count(*) from firsts where first_day=day),'completed',(select count(distinct user_id) from visible where name='activity_completed' and local_date=day)) order by day),'[]'::jsonb) from days),
    'retention',(select jsonb_agg(jsonb_build_object('day',offset_day,'eligible',eligible,'returned',returned) order by offset_day) from retention),
    'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (select coalesce(a.source,'unknown') as source,coalesce(a.medium,'') as medium,coalesce(a.campaign,'') as campaign,count(*) as users from firsts f left join public.analytics_acquisition a on a.user_id=f.user_id where first_day between since and today group by a.source,a.medium,a.campaign order by count(*) desc limit 50) s)
  ) into result;
  return result;
end $$;
revoke all on function public.record_app_event(text,jsonb,text,text,text,text),public.team_analytics(integer) from public,anon,authenticated;
grant execute on function public.record_app_event(text,jsonb,text,text,text,text),public.team_analytics(integer) to authenticated;
commit;
