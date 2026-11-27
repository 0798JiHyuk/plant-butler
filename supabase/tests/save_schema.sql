-- Test DB only. Legacy clients work until a current client saves the explicit marker.
begin;
insert into auth.users(id) values ('c1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
do $$ declare saved public.garden_saves; begin
  select * into saved from public.save_garden_progress(auth.uid(),'{"version":1,"fruit":17}',0,'c2000000-0000-4000-8000-000000000001');
  assert saved.revision=1;
  select * into saved from public.save_garden_progress(auth.uid(),'{"version":1,"saveSchemaVersion":1,"fruit":17}',1,'c2000000-0000-4000-8000-000000000002');
  assert saved.revision=2 and saved.state->>'fruit'='17';
  begin
    perform public.save_garden_progress(auth.uid(),'{"version":1,"fruit":0}',2,'c2000000-0000-4000-8000-000000000003');
    raise exception 'Old client removed schema marker';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_garden_progress(auth.uid(),'{"version":1,"saveSchemaVersion":2}',2,'c2000000-0000-4000-8000-000000000004');
    raise exception 'Unsupported schema accepted';
  exception when invalid_parameter_value then null; end;
  assert (select revision=2 and state->>'fruit'='17' from public.garden_saves where user_id=auth.uid());
  assert not exists(select 1 from public.save_garden_progress(auth.uid(),'{"version":1,"saveSchemaVersion":1}',1,'c2000000-0000-4000-8000-000000000005'));
end $$;
rollback;
