import { localSql, localCli } from './db-local.mjs';

// This is deliberately local only, with no configurable connection URL.
const uid='e1000000-0000-4000-8000-000000000001';
if(localSql('select count(*) from auth.users;').trim()!=='0')throw new Error('Upgrade rehearsal requires an empty disposable local Auth database.');
for(const table of ['garden_saves','garden_sharing','cafe_sessions','cafe_members','events','analytics_team','analytics_event_keys','analytics_acquisition']) {
  if(localSql(`select count(*) from public.${table};`).trim()!=='0')throw new Error('Upgrade rehearsal requires empty local application tables.');
}
localCli(['db','reset','--version','20261118020000']);
let inserted=false;
try {
  localSql(`insert into auth.users(id) values ('${uid}');`);inserted=true;
  localSql(`insert into public.garden_saves(user_id,state,revision,request_id) values ('${uid}',
    '{"version":1,"fruit":41,"missions":{"packets":2},"garden":{"name":"fixture","items":[]}}',7,'e2000000-0000-4000-8000-000000000001');`);
  localCli(['migration','up']);
  const preserved=localSql(`select count(*) from public.garden_saves where user_id='${uid}' and revision=7
    and state='{"version":1,"fruit":41,"missions":{"packets":2},"garden":{"name":"fixture","items":[]}}'::jsonb;`).trim();
  if(preserved!=='1')throw new Error('Existing row changed during upgrade');
  console.log('PASS previous release -> latest migration: existing JSON and revision unchanged');
} finally {
  if(inserted)localSql(`delete from auth.users where id='${uid}';`);
}
