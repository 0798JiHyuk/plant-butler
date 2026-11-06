-- 로컬/테스트 DB 전용. 끝에서 rollback하며 실제 계정은 사용하지 않는다.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$
declare result integer;
begin
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1,"fruit":10}',0,'10000000-0000-4000-8000-000000000001');
  assert result=1,'Initial save';
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1,"fruit":99}',0,'10000000-0000-4000-8000-000000000001');
  assert result=1,'Duplicate must not change revision';
  assert (select state->>'fruit' from public.garden_saves)='10','Duplicate must not change data';
  select revision into result from public.save_garden_progress(auth.uid(),'{"version":1,"fruit":8}',1,'10000000-0000-4000-8000-000000000002');
  assert result=2,'Update revision';
  assert not exists(select 1 from public.save_garden_progress(auth.uid(),'{"version":1,"fruit":100}',1,'10000000-0000-4000-8000-000000000003')),'Stale update rejected';
  begin
    perform public.save_garden_progress('90000000-0000-4000-8000-000000000002','{"version":1}',0,'10000000-0000-4000-8000-000000000004');
    raise exception 'Cross-user write accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.garden_saves set state='{"version":1}';
    raise exception 'Direct write accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_garden_progress(auth.uid(),'{"version":2}',2,'10000000-0000-4000-8000-000000000005');
    raise exception 'Invalid version accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$begin assert not exists(select 1 from public.garden_saves),'Cross-user read exposed'; end$$;
reset role;
set local role anon;
do $$begin
  begin perform * from public.garden_saves; raise exception 'Unauthenticated read exposed';
  exception when insufficient_privilege then null; end;
  begin perform public.save_garden_progress('90000000-0000-4000-8000-000000000001','{"version":1}',0,'10000000-0000-4000-8000-000000000006');
    raise exception 'Unauthenticated write accepted';
  exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
