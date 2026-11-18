-- Test project only. Fixture accounts and all events are rolled back.
begin;
insert into auth.users(id,aud,role,created_at,updated_at) values
 ('b1000000-0000-4000-8000-000000000001','authenticated','authenticated',now(),now()),
 ('b1000000-0000-4000-8000-000000000002','authenticated','authenticated',now(),now()),
 ('b1000000-0000-4000-8000-000000000003','authenticated','authenticated',now(),now());
insert into public.garden_saves(user_id,state,request_id) values('b1000000-0000-4000-8000-000000000001','{"version":1,"garden":{"layoutVersion":2,"name":"test","items":[{"kind":"bench","col":20,"row":80,"flipped":true}],"plants":[]}}','b2000000-0000-4000-8000-000000000001');
insert into public.garden_sharing values('b1000000-0000-4000-8000-000000000001',true);
insert into public.analytics_team values('b1000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
do $$ begin
  if not public.record_app_event('app_opened','{}','open-one','kakao','share','test') then raise exception 'First event rejected';end if;
  if public.record_app_event('app_opened','{}','open-one','kakao','share','test') then raise exception 'Duplicate recorded';end if;
  perform public.record_app_event('app_opened','{}','open-two','instagram','social','later');
  perform public.record_app_event('activity_completed','{"activity_id":"log-1","mission_id":"D01","level":"small","stage":1}','completed-log-1');
  begin perform public.record_app_event('app_opened','{"memo":"private"}','private-payload');raise exception 'Private fields accepted';exception when invalid_parameter_value then null;end;
  begin perform public.record_app_event('app_opened','{}','invalid-source','https://private.example');raise exception 'Raw URL accepted';exception when invalid_parameter_value then null;end;
  begin perform public.team_analytics();raise exception 'Non-team could read';exception when insufficient_privilege then null;end;
  begin perform * from public.events;raise exception 'Raw events readable';exception when insufficient_privilege then null;end;
  begin insert into public.analytics_team values(auth.uid());raise exception 'Self promotion allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.events(user_id,name,props,local_date) values
 ('b1000000-0000-4000-8000-000000000001','app_opened','{}',(now() at time zone 'Asia/Seoul')::date-7),
 ('b1000000-0000-4000-8000-000000000002','app_opened','{}',(now() at time zone 'Asia/Seoul')::date-1),
 ('b1000000-0000-4000-8000-000000000002','app_opened','{}',(now() at time zone 'Asia/Seoul')::date),
 ('b1000000-0000-4000-8000-000000000003','app_opened','{}',(now() at time zone 'Asia/Seoul')::date);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","is_anonymous":false,"app_metadata":{"provider":"google"}}',true);
do $$ declare r jsonb; d1 jsonb; d7 jsonb; begin
  if public.get_shared_garden('b1000000-0000-4000-8000-000000000001')#>>'{items,0,flipped}'<>'true' then raise exception 'Direction missing from shared projection';end if;
  r:=public.team_analytics(28);
  if (r->>'visitors')::int<>2 or (r->>'newUsers')::int<>2 or (r->>'activeToday')::int<>2 or (r->>'completionUsers')::int<>1 then raise exception 'Incorrect metrics %',r;end if;
  select value into d1 from jsonb_array_elements(r->'retention') where value->>'day'='1';
  select value into d7 from jsonb_array_elements(r->'retention') where value->>'day'='7';
  if (d1->>'eligible')::int<>2 or (d1->>'returned')::int<>1 then raise exception 'D1 maturity incorrect %',d1;end if;
  if (d7->>'eligible')::int<>1 or (d7->>'returned')::int<>1 then raise exception 'D7 maturity incorrect %',d7;end if;
  if r::text like '%b1000000%' or r::text like '%private%' or r::text like '%instagram%' then raise exception 'Identity leak/first-touch overwritten';end if;
  if not exists(select 1 from jsonb_array_elements(r->'sources') where value->>'source'='kakao') then raise exception 'Missing source';end if;
  begin perform public.team_analytics(999);raise exception 'Invalid range accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
rollback;
