import { describe, expect, it } from 'vitest';
import source from '../core/data/mission-copy-2026-11-21.md?raw';
import { missions, missionById, setMissionCategory, startMission, reportMission } from '../core/missions';
import { createState, decodeState } from '../core/state';
import { FORBIDDEN_WORDS, copy } from '../core/copy';

describe('팀 전달 미션 문구 개정',()=>{
  it('90개 원본의 제목·NPC·상황·행동·설명·시작 버튼을 누락 없이 연결한다',()=>{
    const entries=[...source.matchAll(/^### ([DAW]\d{2}) (.+)\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)];
    expect(entries).toHaveLength(90);
    for(const [,id,name,body] of entries){
      const m=missionById(id)!;expect(m).toBeDefined();expect(m.name).toBe(name.trim());
      const lines=body.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const [npc,...dialogue]=lines[0].split(': ');expect(m.npc).toBe(npc);
      expect(m.dialogue).toBe(dialogue.join(': ').replace('쳐줄게','괜찮아'));
      expect(m.situation).toBe(lines[1].slice('상황: '.length));
      for(const [variant,label] of [['basic','조금 해볼 만할 때'],['small','이것도 버거울 때']] as const){
        const i=lines.indexOf(`**${label}**`);
        expect(m[variant]).toBe(lines[i+1]);expect(m[`${variant}Hint`]).toBe(lines[i+2]);
        expect(m.buttons?.[variant].start).toBe(lines[i+3].slice(1,-1));
      }
      for(const value of [m.name,m.dialogue,m.situation!,m.basic,m.small,m.basicHint!,m.smallHint!]){
        for(const word of FORBIDDEN_WORDS)expect(value).not.toContain(word);
        expect(value).not.toContain('쳐줄게');
      }
    }
    expect(copy.missions.otherChoices).toBe('다른 걸 해볼래요');expect(copy.missions.rest).toBe('지금은 쉴래요');
  });
  it('문구 외 ID·단계·조건·추천·보상 데이터가 개정 전과 같다',async()=>{
    const textKeys=new Set(['name','npc','dialogue','basic','small','situation','basicHint','smallHint','buttons','record','smallRecord','done']);
    const rules=missions.map(m=>Object.fromEntries(Object.entries(m).filter(([key])=>!textKeys.has(key))));
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rules)));
    expect([...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')).toBe('d32a58c7ec9bf960f9bbf17b482552e1e1ef8c7cfb33d0d8fbf1b798f8b61d12');
  });
  it('설명은 실행·완료 기준에 합치지 않고 이전 실행·기록은 복원한다',()=>{
    const s=createState();setMissionCategory(s,'daily');expect(startMission(s,'2026-11-21','D01','basic',true)).toBe(true);
    expect(s.missions!.execution!.text).toBe(missionById('D01')!.basic);
    expect(s.missions!.execution!.criterion).not.toContain(missionById('D01')!.basicHint);
    s.missions!.execution!.text='이전 버전에서 선택한 행동';
    const restored=decodeState(JSON.parse(JSON.stringify(s)));expect(restored.missions!.execution!.text).toBe('이전 버전에서 선택한 행동');
    reportMission(restored,'2026-11-21');const saved=decodeState(JSON.parse(JSON.stringify(restored)));
    expect(saved.logs[0].text).toBe(restored.logs[0].text);
    const clothes=createState();setMissionCategory(clothes,'daily');startMission(clothes,'2026-11-21','D04','small',true);reportMission(clothes,'2026-11-21');
    expect(clothes.logs[0].text).toBe('갈아입을 옷 한 개를 골랐다.');
  });
});
