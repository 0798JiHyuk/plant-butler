\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('90000000-0000-4000-8000-000000000008');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000008',true);
do $$
declare result integer;
begin
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1}',0,'10000000-0000-4000-8000-000000000081');
  assert result=1;
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1,"missions":{"packets":1}}',1,'10000000-0000-4000-8000-000000000082');
  assert result=2;
  begin
    perform public.save_garden_progress(auth.uid(),'{"version":1}',2,'10000000-0000-4000-8000-000000000083');
    raise exception 'Old client removed mission progress';
  exception when invalid_parameter_value then null; end;
  assert (select state ? 'missions' from public.garden_saves where user_id=auth.uid());
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1,"missions":{"packets":0}}',2,'10000000-0000-4000-8000-000000000084');
  assert result=3;
end $$;
rollback;
