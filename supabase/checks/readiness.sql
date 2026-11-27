-- Read-only diagnostics for SQL Editor. No payload text, UID or email is returned.
select to_regclass('supabase_migrations.schema_migrations') is not null as cli_history_exists;

with expected(name) as (values ('garden_saves'),('garden_sharing'),('cafe_sessions'),('cafe_members'),
 ('events'),('analytics_team'),('analytics_event_keys'),('analytics_acquisition'))
select e.name, c.oid is not null as exists, coalesce(c.relrowsecurity,false) as rls_enabled
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name) order by e.name;

with expected(signature) as (values
 ('public.save_garden_progress(uuid,jsonb,integer,uuid)'),('public.has_google_session()'),
 ('public.cafe_step(uuid,real,real,text,boolean)'),('public.cafe_leave(uuid)'),
 ('public.get_shared_garden(uuid)'),('public.team_analytics(integer)'),
 ('public.record_app_event(text,jsonb,text,text,text,text)'))
select signature,to_regprocedure(signature) is not null as exists,
 case when to_regprocedure(signature) is not null then md5(pg_get_functiondef(to_regprocedure(signature))) end as definition_hash
from expected order by signature;

with expected(name,data_type) as (values ('user_id','uuid'),('state','jsonb'),('revision','integer'),
 ('request_id','uuid'),('updated_at','timestamp with time zone'))
select e.name,e.data_type as expected_type,c.data_type as actual_type,c.is_nullable
from expected e left join information_schema.columns c
 on c.table_schema='public' and c.table_name='garden_saves' and c.column_name=e.name order by e.name;

select p.proname,p.prosecdef as security_definer,p.proconfig as function_settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('save_garden_progress','cafe_step','cafe_leave','get_shared_garden','record_app_event','team_analytics')
order by p.proname;

select grantee,table_name,privilege_type from information_schema.table_privileges
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
order by table_name,grantee,privilege_type;

select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by 1,2;

select coalesce(state->>'saveSchemaVersion','legacy') as save_schema_version,count(*) as saves
from public.garden_saves group by 1 order by 1;

select count(*) as orphaned_saves from public.garden_saves g
left join auth.users u on u.id=g.user_id where u.id is null;

-- Run separately ONLY if cli_history_exists=true:
-- select version,name from supabase_migrations.schema_migrations order by version;
-- Hashes help compare definitions, but existence/history alone never proves schema equality.
