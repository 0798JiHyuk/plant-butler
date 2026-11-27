import { spawnSync } from 'node:child_process';
import { localSql } from './db-local.mjs';

const container='supabase_db_plant-butler';
const scratch='plant_butler_restore_check';
const uid='d1000000-0000-4000-8000-000000000001';
const requestId='d2000000-0000-4000-8000-000000000001';
function docker(args,input) {
  const result=spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
  if(result.error||result.status!==0)throw new Error('Local restore rehearsal command failed; private output withheld.');
  return result.stdout;
}
if(localSql('select count(*) from public.garden_saves;').trim()!=='0')throw new Error('Rehearsal requires an empty local garden_saves table. Existing data left untouched.');
if(localSql(`select count(*) from pg_database where datname='${scratch}';`).trim()!=='0')throw new Error('Scratch database already exists; refusing to replace it.');
if(localSql(`select count(*) from auth.users where id='${uid}';`).trim()!=='0')throw new Error('Fixture UID exists; refusing to replace it.');
let created=false,fixture=false;
try {
  localSql(`insert into auth.users(id) values ('${uid}');`);fixture=true;
  localSql(`insert into public.garden_saves(user_id,state,revision,request_id) values ('${uid}','{"version":1,"saveSchemaVersion":1,"fruit":41,"garden":{"items":[],"plants":[]}}',7,'${requestId}');`);
  // A single synthetic save only; not an export of a person's account or whole Auth database.
  const dump=docker(['pg_dump','-U','postgres','-d','postgres','--section=pre-data','--section=data','--no-owner','--no-privileges','--table=public.garden_saves']);
  docker(['createdb','-U','postgres','-T','template0',scratch]);created=true;
  docker(['psql','-X','-U','postgres','-d',scratch,'-v','ON_ERROR_STOP=1'],dump);
  const result=docker(['psql','-X','-U','postgres','-d',scratch,'-At','-c',`select count(*) from public.garden_saves where user_id='${uid}' and revision=7 and request_id='${requestId}' and state->>'fruit'='41' and state->>'saveSchemaVersion'='1';`]);
  if(result.trim()!=='1')throw new Error('Restored snapshot mismatch');
  console.log('PASS local pg_dump/restore: synthetic snapshot, revision, request ID and schema version preserved');
} finally {
  if(fixture)localSql(`delete from auth.users where id='${uid}';`);
  if(created)docker(['dropdb','-U','postgres',scratch]);
}
