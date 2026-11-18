-- Preserve direction in opt-in public garden projection.
begin;
create or replace function public.get_shared_garden(p_user_id uuid) returns jsonb
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
    'items',(select coalesce(jsonb_agg(jsonb_build_object('kind',r->'kind','flipped',coalesce(r->'flipped'='true'::jsonb,false),'col',r->'col','row',r->'row')),'[]'::jsonb)
      from (select value as r from jsonb_array_elements(case when jsonb_typeof(g->'items')='array' then g->'items' else '[]'::jsonb end) limit 300) a where jsonb_typeof(r->'col')='number' and jsonb_typeof(r->'row')='number' and r->>'col' ~ '^[0-9]{1,3}$' and r->>'row' ~ '^[0-9]{1,3}$' and r->>'kind' in ('flowerpot','table','shelf','bench','birdbath','hammock','flower','pot','lamp')),
    'plants',(select coalesce(jsonb_agg(jsonb_build_object('plantId',r->'plantId','col',r->'col','row',r->'row','harvested',coalesce(r->'harvested'='true'::jsonb,false),
      'stage',public.garden_plant_stage(r->>'date',coalesce(r->>'plantId','') in ('apple_tree','peach_tree')))),'[]'::jsonb)
      from (select value as r from jsonb_array_elements(case when jsonb_typeof(g->'plants')='array' then g->'plants' else '[]'::jsonb end) limit 300) a where jsonb_typeof(r->'col')='number' and jsonb_typeof(r->'row')='number' and r->>'col' ~ '^[0-9]{1,3}$' and r->>'row' ~ '^[0-9]{1,3}$' and r->>'plantId' in ('dandelion','violet','clover','sunflower','cosmos','lavender','hydrangea','tulip','daisy','hibiscus','lily-of-valley','narcissus','apple_tree','peach_tree'))
  );
end $$;
commit;
