import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A fixed local container target: never accept a production URL or arbitrary Docker container.
const container = 'supabase_db_plant-butler';
const target = resolve('src/lib/database.types.ts');
function run(command,args,input) {
  const result=spawnSync(command,args,{input,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
  if(result.error || result.status!==0)throw new Error(`${command} failed. Check local Docker/Supabase setup; private output is withheld.`);
  return result.stdout;
}
export function localSql(sql) {
  return run('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],sql);
}
export function generateTypes(check=false) {
  // SUPABASE_CLI may point to a locally installed executable. No database target flags allowed.
  const args=['gen','types','typescript','--local','--schema','public'];
  const result=localCli(args).replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').trim()+'\n';
  if(!result.includes('export type Database ='))throw new Error('No generated database types; existing file kept.');
  const normalized=s=>s.replace(/\r\n/g,'\n').trim();
  if(check) {
    if(normalized(result)!==normalized(readFileSync(target,'utf8')))throw new Error('Database types differ. Run db:types after local migration reset.');
  } else {
    const temp=target+'.tmp';writeFileSync(temp,result,'utf8');
    try{renameSync(temp,target);}finally{rmSync(temp,{force:true});}
  }
}
export function localCli(args) {
  let cli=process.env.SUPABASE_CLI || 'supabase';
  if(process.platform==='win32' && cli==='supabase') {
    const found=run('where.exe',['supabase']).split(/\r?\n/).find(p=>p.endsWith('.cmd'));
    if(found) {
      // npm exec puts a .cmd shim on PATH. Resolve its adjacent JS entry without a shell.
      const candidate=resolve(found,'..','..','supabase','dist','supabase.js');
      try{readFileSync(candidate);cli=candidate;}catch{throw new Error('Set SUPABASE_CLI to the Supabase executable or JS entry.');}
    }
  }
  return cli.endsWith('.js') ? run(process.execPath,[cli,...args]) : run(cli,args);
}
const command=process.argv[2];
if(command==='test') {
  for(const file of readdirSync('supabase/tests').filter(f=>f.endsWith('.sql')).sort()) {
    const sql=readFileSync(resolve('supabase/tests',file),'utf8').replace(/^\uFEFF/,'');
    if(!/^rollback;\s*$/im.test(sql))throw new Error(`Test must roll back: ${file}`);
    localSql(sql);console.log('PASS',file);
  }
} else if(command==='types' || command==='types-check') {
  generateTypes(command==='types-check');console.log('PASS database types',command);
} else if(fileURLToPath(import.meta.url)===resolve(process.argv[1]||'')) {
  throw new Error('Use test, types or types-check');
}
