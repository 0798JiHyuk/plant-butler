import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const root='supabase/migrations/';
const manifest=JSON.parse(readFileSync('supabase/migration-baseline.json','utf8'));
// Ignore line endings / empty lines only. SQL tokens and nonempty lines remain immutable.
const hash=s=>createHash('sha256').update(s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n').filter(line=>line.trim()).join('\n')).digest('hex');
const files=readdirSync(root).filter(f=>f.endsWith('.sql')).sort();
const versions=new Set();
for(const file of files) {
  if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)||versions.has(file.slice(0,14)))throw new Error(`Invalid migration name: ${file}`);
  versions.add(file.slice(0,14));
  const sql=readFileSync(root+file,'utf8');
  if(!/^begin;\s*$/im.test(sql)||!/^commit;\s*$/im.test(sql))throw new Error(`Migration must be transactional: ${file}`);
}
for(const [file,expected] of Object.entries(manifest)) {
  if(!files.includes(file)||hash(readFileSync(root+file,'utf8'))!==expected)throw new Error(`Historical migration changed: ${file}. Add a new migration instead.`);
}
const base=process.env.MIGRATION_BASE_SHA;
if(base && !/^0+$/.test(base)) {
  if(!/^[a-f0-9]{40}$/i.test(base))throw new Error('Invalid migration base SHA');
  const git=args=>{
    const result=spawnSync('git',args,{encoding:'utf8',windowsHide:true});
    if(result.status!==0)throw new Error('Cannot read migration base; fetch full history.');
    return result.stdout;
  };
  const previous=git(['ls-tree','-r','--name-only',base,'--',root]).trim().split('\n').filter(f=>f.endsWith('.sql'));
  for(const path of previous) {
    if(!files.includes(path.slice(root.length)) || hash(readFileSync(path,'utf8'))!==hash(git(['show',`${base}:${path}`])))throw new Error(`Released migration changed: ${path}`);
  }
  const last=previous.map(p=>p.slice(root.length,root.length+14)).sort().at(-1);
  for(const file of files)if(!previous.includes(root+file) && last && file.slice(0,14)<=last)throw new Error(`New migration must follow released versions: ${file}`);
}
console.log(`PASS ${files.length} ordered migrations; ${Object.keys(manifest).length} historical checksums`);
