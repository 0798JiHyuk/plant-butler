export interface AnalyticsReport {
  asOf:string;days:number;visitors:number;newUsers:number;activeToday:number;completionUsers:number;
  daily:{date:string;active:number;newUsers:number;completed:number}[];
  retention:{day:number;eligible:number;returned:number}[];
  sources:{source:string;medium:string;campaign:string;users:number}[];
}
const count=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
export function readAnalytics(value:unknown):AnalyticsReport {
  if(!obj(value)||!date(value.asOf)||![7,28,90].includes(Number(value.days))||!['visitors','newUsers','activeToday','completionUsers'].every(k=>count(value[k]))
    ||!Array.isArray(value.daily)||!value.daily.every(r=>obj(r)&&date(r.date)&&['active','newUsers','completed'].every(k=>count(r[k])))
    ||!Array.isArray(value.retention)||!value.retention.every(r=>obj(r)&&[1,7,14].includes(Number(r.day))&&count(r.eligible)&&count(r.returned)&&Number(r.returned)<=Number(r.eligible))
    ||!Array.isArray(value.sources)||!value.sources.every(r=>obj(r)&&['source','medium','campaign'].every(k=>typeof r[k]==='string')&&count(r.users)))throw new Error('Invalid analytics');
  return value as unknown as AnalyticsReport;
}
export const retentionRate=(r:{eligible:number;returned:number}):number|null=>r.eligible?Math.round(r.returned/r.eligible*1000)/10:null;
