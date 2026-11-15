-- Run ONLY against a test project after the café migration. Everything rolls back.
begin;
insert into auth.users(id,aud,role,created_at,updated_at) values
 ('a1000000-0000-4000-8000-000000000001','authenticated','authenticated',now(),now()),
 ('a1000000-0000-4000-8000-000000000002','authenticated','authenticated',now(),now());
insert into public.garden_saves(user_id,state,revision,request_id) values
 ('a1000000-0000-4000-8000-000000000001','{"version":1,"garden":{"layoutVersion":2,"name":"테스트 A","items":[{"kind":"bench","col":20,"row":80,"id":"private-id"},{"kind":"bench","col":{"memo":"DO_NOT_EXPOSE"},"row":81}],"plants":[{"plantId":"apple_tree","date":"2026-01-01","col":21,"row":81}]},"logs":[{"memo":"DO_NOT_EXPOSE"}],"fruit":999}'::jsonb,1,'a2000000-0000-4000-8000-000000000001'),
 ('a1000000-0000-4000-8000-000000000002','{"version":1,"garden":{"layoutVersion":2,"items":[],"plants":[]}}'::jsonb,1,'a2000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
insert into public.garden_sharing(user_id,enabled) values(auth.uid(),true);
select public.cafe_step('a3000000-0000-4000-8000-000000000001',340,850,null,true);
do $$ begin
  if public.cafe_step('a3000000-0000-4000-8000-000000000001',340,810,'chair-1')->>'status'<>'ok' then raise exception 'A cannot sit'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
select public.cafe_step('a3000000-0000-4000-8000-000000000002',340,850,null,true);
do $$ declare g jsonb; n integer; begin
  if public.cafe_step('a3000000-0000-4000-8000-000000000002',340,810,'chair-1')->>'status'<>'occupied' then raise exception 'Chair was double booked'; end if;
  if exists(select 1 from public.garden_saves where user_id<>auth.uid()) then raise exception 'Private saves visible'; end if;
  update public.garden_sharing set enabled=false where user_id='a1000000-0000-4000-8000-000000000001';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Other sharing updated'; end if;
  g:=public.get_shared_garden('a1000000-0000-4000-8000-000000000001');
  if g is null or g->>'name'<>'테스트 A' or g::text like '%DO_NOT_EXPOSE%' or g::text like '%private-id%' or g ?| array['fruit','logs','days','settings'] then raise exception 'Projection leaked/incorrect'; end if;
  if public.get_shared_garden(auth.uid()) is not null then raise exception 'Sharing default not off'; end if;
  begin perform * from public.cafe_sessions; raise exception 'Session table readable'; exception when insufficient_privilege then null; end;
  begin delete from public.cafe_members; raise exception 'Direct presence delete allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
update public.garden_sharing set enabled=false where user_id=auth.uid();
do $$ begin
  if public.get_shared_garden(auth.uid()) is not null then raise exception 'Revoked sharing still readable'; end if;
end $$;
select public.cafe_step('a3000000-0000-4000-8000-000000000003',1024,1280,null,true);
select public.cafe_leave('a3000000-0000-4000-8000-000000000001');
do $$ begin
  if not exists(select 1 from public.cafe_members where user_id=auth.uid()) then raise exception 'Stale leave deleted new session'; end if;
  if public.cafe_step('a3000000-0000-4000-8000-000000000001',1024,1280,null)->>'status'<>'replaced' then raise exception 'Stale movement accepted'; end if;
  if public.cafe_step('a3000000-0000-4000-8000-000000000003',340,810,'chair-1')->>'status'<>'far' then raise exception 'Remote chair accepted'; end if;
  begin
    perform public.cafe_step('a3000000-0000-4000-8000-000000000003','NaN'::real,1280,null);
    raise exception 'NaN position accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cafe_step('a3000000-0000-4000-8000-000000000003',480,700,null);
    raise exception 'Table collision accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
update public.cafe_members set updated_at=now()-interval '31 seconds' where user_id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.cafe_members where user_id=auth.uid()) then raise exception 'Expired presence visible'; end if;
  if public.cafe_step('a3000000-0000-4000-8000-000000000003',1024,1280,null)->>'status'<>'expired' then raise exception 'Expired session not detected'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true,"app_metadata":{"provider":"anonymous"}}',true);
do $$ begin
  begin perform public.get_shared_garden('a1000000-0000-4000-8000-000000000002'); raise exception 'Guest accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
