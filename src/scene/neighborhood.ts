import { buildingBlocked as districtBlocked } from '../core/worldTerrain';
import { NEIGHBORHOOD_PATH, LANDMARKS, BUILDING_AREAS, CAFE_BENCH, roadDistance } from '../core/worldGeometry';
import type { AppState } from '../core/types';
import type Phaser from 'phaser';
import { events } from '../core/events';
import { copy } from '../core/copy';
import { SHOP_RANGE } from '../core/interaction';

/** Measured adapter coordinates; the delivery's 1000x700 diagram is never used for collision. */
export const DISTRICT_PATH = NEIGHBORHOOD_PATH;
export { buildingBlocked as districtBlocked } from '../core/worldTerrain';
export function districtReserved(x:number,y:number):boolean {return roadDistance(x,y)<80||districtBlocked(x,y)||Math.hypot(x-CAFE_BENCH.x,y-CAFE_BENCH.y)<90;}
export function drawNeighborhood(scene:Phaser.Scene,canInteract:(point:{x:number;y:number},range?:number)=>boolean,readState:()=>AppState):()=>void {
  const interact=(name:'shop'|'cafe'|'school'|'work')=>{
    const p=LANDMARKS[name];
    const r=BUILDING_AREAS[name];const zone=scene.add.zone((r.left+r.right)/2,(r.top+p.y)/2,r.right-r.left,p.y-r.top).setDepth(p.y).setInteractive({useHandCursor:true});
    zone.on('pointerdown',()=>{if(canInteract(p,SHOP_RANGE)){if(name==='shop')events.emit('hud-action',{id:'shop'});else events.emit('world-interact',{id:name});}});
  };
  (['shop','cafe','school','work'] as const).forEach(interact);
  const sign=(x:number,y:number,text:string,left=false)=>{
    scene.add.image(x,y,'wood_wayfinder').setOrigin(.5,1).setDisplaySize(112,82).setFlipX(left).setDepth(y);
    scene.add.text(x+(left?5:-5),y-46,text,{fontFamily:'sans-serif',fontSize:'12px',fontStyle:'bold',color:'#594327'}).setOrigin(.5).setDepth(y+1);
  };
  sign(2650,1740,copy.map.cafe);sign(2430,1360,copy.map.school);sign(2150,1850,copy.map.garden,true);
  const bench=scene.add.image(CAFE_BENCH.x,CAFE_BENCH.y,'decor_bench').setOrigin(.5,1).setDepth(CAFE_BENCH.y).setInteractive({useHandCursor:true});
  bench.on('pointerdown',()=>{if(canInteract(CAFE_BENCH))events.emit('seat-change',{id:'cafe-bench'});});
  // Board artwork is baked into the background; only story markings are overlaid.
  const slot=scene.add.graphics().setPosition(LANDMARKS.board.x-347,LANDMARKS.board.y-535).setDepth(LANDMARKS.board.y+51);
  const boardLabel=scene.add.text(LANDMARKS.board.x,LANDMARKS.board.y-45,'',{fontFamily:'sans-serif',fontSize:'12px',color:'#3e5233',stroke:'#fff4d5',strokeThickness:3}).setOrigin(.5).setDepth(LANDMARKS.board.y+51);
  scene.add.zone(LANDMARKS.board.x,LANDMARKS.board.y,90,80).setDepth(LANDMARKS.board.y+55).setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(canInteract(LANDMARKS.board))events.emit('world-interact',{id:'board'});});
  return ()=>{
    const state=readState(),p=state.garden.narrative;slot.clear();boardLabel.setText('');
    slot.lineStyle(2,0x7b9160,.8);slot.beginPath();slot.moveTo(320,532);slot.lineTo(333,519);slot.lineTo(345,530);slot.lineTo(365,515);slot.strokePath();
    if(p?.facts.includes('slotSeen')){slot.lineStyle(3,0x694f36);slot.lineBetween(318,545,375,545);}
    if(p?.decision==='together'){slot.fillStyle(0x7b9a64);slot.fillRect(322,518,12,18);slot.fillStyle(0xb58b55);slot.fillRect(340,518,12,18);slot.fillStyle(0x6b98a1);slot.fillRect(358,518,12,18);boardLabel.setText(copy.map.togetherMaps);}
    if(p?.decision==='own'){boardLabel.setText((p.mapName===undefined?state.garden.name:p.mapName)||copy.map.ownMap);p.marks?.slice(0,3).forEach((_,index)=>{slot.fillStyle(0x64834e);slot.fillCircle(328+index*17,528,4);});}
  };

}
