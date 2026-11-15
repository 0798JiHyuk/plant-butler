import type { AppState } from './types';
import { GARDEN_ORIGIN } from './worldGeometry';

/** One-time translation. Field-slot IDs and indoor furniture are not world coordinates. */
export function upgradeGardenLayout(s:AppState):void {
  if(s.garden.layoutVersion===2)return;
  const dc=GARDEN_ORIGIN.x/32,dr=GARDEN_ORIGIN.y/32;
  for(const item of s.garden.items){item.col+=dc;item.row+=dr;}
  for(const plant of s.garden.plants){
    const field=plant.col>=100&&plant.col<104&&plant.row>=100&&plant.row<104;
    if(!field){plant.col+=dc;plant.row+=dr;}
  }
  if(s.garden.bed){s.garden.bed.x+=GARDEN_ORIGIN.x;s.garden.bed.y+=GARDEN_ORIGIN.y;}
  const goal=s.garden.exploration?.goal;
  if(goal?.zone==='garden'){goal.col+=dc;goal.row+=dr;}
  s.garden.layoutVersion=2;
}
