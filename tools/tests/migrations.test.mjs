import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const checker=fileURLToPath(new URL('../check-migrations.mjs',import.meta.url));
const dbTool=fileURLToPath(new URL('../db-local.mjs',import.meta.url));
test('historical SQL changes/deletion are rejected; new migrations and line endings are accepted',()=>{
  const dir=mkdtempSync(join(tmpdir(),'plant-migration-'));
  try {
    mkdirSync(join(dir,'supabase/migrations'),{recursive:true});
    const name='20261105010000_initial.sql',sql='begin;\nselect 1;\ncommit;';
    writeFileSync(join(dir,'supabase/migrations',name),sql);
    writeFileSync(join(dir,'supabase/migration-baseline.json'),JSON.stringify({[name]:createHash('sha256').update(sql).digest('hex')}));
    // Synthetic fixtures are not a Git checkout; don't inherit the real PR base SHA.
    const run=()=>spawnSync(process.execPath,[checker],{cwd:dir,env:{...process.env,MIGRATION_BASE_SHA:''},encoding:'utf8',windowsHide:true}).status;
    assert.equal(run(),0);
    writeFileSync(join(dir,'supabase/migrations',name),sql.replaceAll('\n','\r\n\r\n'));
    writeFileSync(join(dir,'supabase/migrations/20261127010000_next.sql'),'begin;\nselect 2;\ncommit;');
    assert.equal(run(),0);
    writeFileSync(join(dir,'supabase/migrations',name),sql.replace('select 1','select 9'));
    assert.notEqual(run(),0);
    rmSync(join(dir,'supabase/migrations',name));assert.notEqual(run(),0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('failed/invalid type generation leaves the previous file unchanged',()=>{
  const dir=mkdtempSync(join(tmpdir(),'plant-types-'));
  try {
    mkdirSync(join(dir,'src/lib'),{recursive:true});
    const file=join(dir,'src/lib/database.types.ts');writeFileSync(file,'existing types');
    const fake=join(dir,'cli.js');writeFileSync(fake,"console.log('not database types');");
    const run=spawnSync(process.execPath,[dbTool,'types'],{cwd:dir,env:{...process.env,SUPABASE_CLI:fake},encoding:'utf8',windowsHide:true});
    assert.notEqual(run.status,0);assert.equal(readFileSync(file,'utf8'),'existing types');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
