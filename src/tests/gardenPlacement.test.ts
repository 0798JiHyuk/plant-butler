import { describe,expect,it } from 'vitest';
import { LANDMARKS } from '../core/worldGeometry';
import { createState,decodeState } from '../core/state';
import { DEFAULT_BED,inGardenRegion,isDecorTile,nextDecorSlot,TILE,bedFits } from '../scene/map';

describe('왼쪽 아래 정원 배치',()=>{
  it('집 앞·상점·학교·직장·카페에는 야외 소품을 놓지 않는다',()=>{
    for(const id of ['home','shop','school','work','cafe'] as const){
      const p=LANDMARKS[id];expect(inGardenRegion(p.x,p.y)).toBe(false);
      expect(isDecorTile(Math.floor(p.x/TILE),Math.floor(p.y/TILE))).toBe(false);
    }
    expect(isDecorTile(18,57)).toBe(false); // 이전 집 앞 마당
  });
  it('자동 소품 자리와 기본 텃밭은 담장 안 잔디에 있다',()=>{
    expect(bedFits(DEFAULT_BED.x,DEFAULT_BED.y,[])).toBe(true);
    expect(DEFAULT_BED.y).toBeGreaterThan(LANDMARKS.garden.y);
    for(const [dx,dy] of [[0,0],[DEFAULT_BED.w,0],[0,DEFAULT_BED.h],[DEFAULT_BED.w,DEFAULT_BED.h]]){
      expect(inGardenRegion(DEFAULT_BED.x+dx,DEFAULT_BED.y+dy)).toBe(true);
    }
    const used:{col:number;row:number}[]=[];
    for(let i=0;i<10;i++){
      const slot=nextDecorSlot(used);expect(slot).not.toBeNull();used.push(slot!);
      expect(inGardenRegion(slot!.col*TILE+16,slot!.row*TILE+16)).toBe(true);
    }
  });
  it('이미 저장한 텃밭 위치와 실내 가구는 기본 위치 변경으로 덮어쓰지 않는다',()=>{
    const s=createState();s.garden.bed={x:720,y:2700};
    s.garden.interior={items:[{id:'bench',kind:'bench',variant:0,col:12,row:12}]};
    expect(decodeState(s).garden).toEqual(s.garden);
  });
});
