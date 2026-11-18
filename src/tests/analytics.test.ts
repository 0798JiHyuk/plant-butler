import { expect,it } from 'vitest';
import { readAcquisition } from '../lib/events';
import { retentionRate,readAnalytics } from '../core/analytics';
import { toLocalDate } from '../lib/date';
it('유입에는 허용된 태그만 사용하고 URL·원문·과도한 값을 제외한다',()=>{
  expect(readAcquisition('?utm_source=kakao&utm_medium=share&utm_campaign=test')).toEqual({source:'kakao',medium:'share',campaign:'test'});
  expect(readAcquisition('?utm_source=https://private.example&memo=secret&utm_campaign='+ 'x'.repeat(49))).toEqual({source:'',medium:'',campaign:''});
});
it('한국 날짜와 성숙한 코호트의 분모를 사용하며 미도래는 0%로 표시하지 않는다',()=>{
  expect(toLocalDate(new Date('2026-11-17T16:00:00Z'))).toBe('2026-11-18');
  expect(retentionRate({eligible:0,returned:0})).toBeNull();expect(retentionRate({eligible:3,returned:1})).toBe(33.3);
  expect(()=>readAnalytics({asOf:'2026-11-18',days:28,visitors:1,newUsers:1,activeToday:1,completionUsers:0,daily:[],sources:[],retention:[{day:7,eligible:0,returned:1}]})).toThrow();
});
