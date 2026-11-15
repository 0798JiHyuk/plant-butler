/** World coordinates shared by collision, painted paths, navigation and the map. */
export interface WorldPoint { x: number; y: number }
export const WORLD_SIZE = {width:4096,height:3072,gardenHeight:712,interiorWidth:1266} as const;
export const GARDEN_ORIGIN={x:256,y:1536,width:1266,height:1474} as const;
/** Painted lawn inside the lower-left garden walls; unrelated to legacy save translation. */
export const GARDEN_DECOR_BOUNDS={x:96,y:2224,width:1440,height:784} as const;
export const GARDEN_LAWN:readonly (readonly [number,number])[]=[
  [210,2320],[470,2320],[710,2360],[880,2290],[1150,2320],[1350,2500],
  [1420,2760],[1290,2900],[920,2970],[420,2900],[210,2750],[120,2500],
];
export const ATLAS_LANDMARKS={garden:{x:640,y:640},home:{x:914,y:240},nuri:{x:250,y:330},moru:{x:850,y:258},pio:{x:985,y:355}} as const;
export const ATLAS_HOME_PATH=[[640,640],[700,620],[800,580],[900,540],[980,500],[1020,450],[1010,400],[950,340],[850,290],[914,280],[914,240]] as const;
export const LANDMARKS = {
  garden:{x:896,y:2224},home:{x:1112,y:1624},shop:{x:1780,y:1856},junction:{x:2448,y:1520},cafe:{x:3112,y:1904},school:{x:2416,y:800},work:{x:3496,y:800},
  board:{x:350,y:2150},nuri:{x:506,y:1866},moru:{x:1106,y:1794},pio:{x:1241,y:1891},
} as const;
export const BUILDING_AREAS={
  home:{left:875,right:1350,top:1190,bottom:1565},shop:{left:1520,right:2190,top:1320,bottom:1765},cafe:{left:2920,right:3630,top:1360,bottom:1820},
  school:{left:1980,right:2870,top:60,bottom:700},work:{left:3200,right:4020,top:230,bottom:700},
} as const;
export const AREA_YARDS=[
  {left:900,right:1400,top:1580,bottom:1900},{left:1450,right:2300,top:1770,bottom:2130},{left:2780,right:3770,top:1840,bottom:2270},
  {left:2000,right:2910,top:730,bottom:1050},{left:3150,right:4020,top:730,bottom:1050},
] as const;
export const CAFE_BENCH={x:3480,y:2060} as const;
export const WORLD_EDGES:Record<string,readonly (readonly [number,number])[]>={
  'garden/home':[[896,2224],[960,2076],[1090,1930],[1170,1800],[1112,1624]],
  'garden/shop':[[896,2224],[960,2076],[1192,1924],[1460,1896],[1780,1856]],
  'junction/shop':[[2448,1520],[2330,1690],[2260,1900],[2030,1910],[1780,1856]],
  'cafe/junction':[[3112,1904],[2840,1880],[2640,1600],[2448,1520]],
  'junction/school':[[2448,1520],[2430,1290],[2420,1030],[2416,800]],
  'school/work':[[2416,800],[2770,800],[3130,800],[3496,800]],
};
export const NEIGHBORHOOD_PATH=Object.values(WORLD_EDGES).flat();
export function roadDistance(x:number,y:number):number {
  let best=Infinity;
  for(const points of Object.values(WORLD_EDGES))for(let i=1;i<points.length;i++){
    const [ax,ay]=points[i-1],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    best=Math.min(best,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return best;
}
export function worldEdge(from:string,to:string): WorldPoint[] {
  const points=WORLD_EDGES[[from,to].sort().join('/')];
  if(!points)return [];
  const anchor=LANDMARKS[from as keyof typeof LANDMARKS];
  const result=points.map(([x,y])=>({x,y}));
  return anchor&&Math.hypot(result[0].x-anchor.x,result[0].y-anchor.y)>1?result.reverse():result;
}
export function worldRoute(nodes:readonly string[]):WorldPoint[] {
  return nodes.slice(1).flatMap((node,i)=>worldEdge(nodes[i],node));
}
/** Guide to the next bend on the actual road, not through a building to a node. */
export function nextRoadPoint(here:WorldPoint,points:readonly WorldPoint[]):WorldPoint|undefined {
  if(!points.length)return undefined;
  let best=Infinity,index=0,along=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    if(!length)continue;
    const t=Math.max(0,Math.min(1,((here.x-a.x)*dx+(here.y-a.y)*dy)/length));
    const distance=Math.hypot(here.x-a.x-t*dx,here.y-a.y-t*dy);
    if(distance<best){best=distance;index=i;along=t;}
  }
  const end=points[index+1]??points[index];
  if(along>.9&&index+2<points.length)return points[index+2];
  return end;
}
export function compassDirection(here:WorldPoint,target:WorldPoint): 'north'|'south'|'east'|'west'|'northEast'|'northWest'|'southEast'|'southWest' {
  const dx=target.x-here.x,dy=target.y-here.y;
  if(Math.abs(dx)<Math.abs(dy)*.45)return dy<0?'north':'south';
  if(Math.abs(dy)<Math.abs(dx)*.45)return dx<0?'west':'east';
  return dy<0?(dx<0?'northWest':'northEast'):(dx<0?'southWest':'southEast');
}
