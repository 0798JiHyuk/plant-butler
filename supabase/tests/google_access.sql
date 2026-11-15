-- Test database only. No existing users or rows are modified.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000009',true);
select set_config('request.jwt.claims','{"is_anonymous":true,"app_metadata":{"provider":"anonymous"}}',true);
do $$ begin
  assert not public.has_google_session(),'Anonymous session accepted';
  assert not exists(select 1 from public.garden_saves),'Anonymous read exposed';
  begin
    perform public.save_garden_progress(auth.uid(),'{"version":1}',0,'10000000-0000-4000-8000-000000000091');
    raise exception 'Anonymous write accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"is_anonymous":false,"app_metadata":{"provider":"email","providers":["email"]}}',true);
do $$ begin assert not public.has_google_session(),'Non-Google session accepted'; end $$;
select set_config('request.jwt.claims','{"is_anonymous":false,"app_metadata":{"provider":"google","providers":["google"]}}',true);
do $$ begin assert public.has_google_session(),'Google session rejected'; end $$;
select set_config('request.jwt.claims','{}',true);
do $$ begin assert not public.has_google_session(),'Missing claims accepted'; end $$;
rollback;
