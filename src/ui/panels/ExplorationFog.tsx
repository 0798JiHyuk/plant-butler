import { useId } from 'react';
import { LINKS,ZONES,type ZoneId } from '../../core/exploration';
import { GARDEN_ORIGIN,LANDMARKS,WORLD_SIZE,worldEdge,type WorldPoint } from '../../core/worldGeometry';
const pathD=(points:readonly WorldPoint[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
function frontierPath(a:ZoneId,b:ZoneId,known:readonly ZoneId[]):WorldPoint[] {
  const points=known.includes(a)?worldEdge(a,b):worldEdge(b,a);
  if(!points.length)return [];
  const out=[points[0]];let length=0;
  for(let i=1;i<points.length;i++){
    const previous=points[i-1],next=points[i],distance=Math.hypot(next.x-previous.x,next.y-previous.y);
    if(length+distance>145){const k=(145-length)/distance;out.push({x:previous.x+(next.x-previous.x)*k,y:previous.y+(next.y-previous.y)*k});break;}
    out.push(next);length+=distance;
  }
  return out;
}
export function ExplorationFog({known,here}:{known:readonly ZoneId[];here:WorldPoint}) {
  const maskId=`fog-${useId().replace(/:/g,'')}`;
  const paths=LINKS.filter(([a,b])=>ZONES[a].enabled&&ZONES[b].enabled&&(known.includes(a)||known.includes(b))).map(([a,b])=>({a,b,points:known.includes(a)&&known.includes(b)||a==='garden'&&b==='home'?worldEdge(a,b):frontierPath(a,b,known)}));
  return <g className="map-fog" data-known={known.join(',')} pointerEvents="none" aria-hidden="true">
    <defs>
      <filter id={`${maskId}-soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="65"/></filter>
      <linearGradient id={`${maskId}-mist`} x2=".35" y2="1"><stop stopColor="#edf1e5"/><stop offset="1" stopColor="#ccd8c2"/></linearGradient>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={WORLD_SIZE.width} height={WORLD_SIZE.height}>
        <rect width={WORLD_SIZE.width} height={WORLD_SIZE.height} fill="white"/>
        <g fill="black" filter={`url(#${maskId}-soft)`}>
          <ellipse cx={GARDEN_ORIGIN.x+GARDEN_ORIGIN.width/2} cy={GARDEN_ORIGIN.y+GARDEN_ORIGIN.height/2} rx={GARDEN_ORIGIN.width*.61} ry={GARDEN_ORIGIN.height*.59}/>
          <ellipse cx={LANDMARKS.home.x} cy={LANDMARKS.home.y-220} rx="410" ry="490"/>
          {known.filter(id=>id!=='garden'&&id!=='home'&&ZONES[id].enabled).map(id=><ellipse key={id} cx={ZONES[id].worldX} cy={ZONES[id].worldY-240} rx="530" ry="610"/>)}
          {paths.map(({a,b,points})=><path key={`${a}/${b}`} d={pathD(points)} stroke="black" strokeWidth="280" fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
          <circle cx={here.x} cy={here.y} r="180"/>
        </g>
      </mask>
    </defs>
    <g mask={`url(#${maskId})`}>
      <rect width={WORLD_SIZE.width} height={WORLD_SIZE.height} fill={`url(#${maskId}-mist)`}/>
      <image href={`${import.meta.env.BASE_URL}assets/garden/resident-pio-painted.webp`} width={WORLD_SIZE.width} height={WORLD_SIZE.height} preserveAspectRatio="none"/>
    </g>
  </g>;
}
