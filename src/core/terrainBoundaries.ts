/** Measured over the painted world. Grass is open; walls and trunks are solid. */
export const OPEN_LAWN:readonly (readonly [number,number])[]=[
  [650,440],[1000,380],[1380,420],[1700,430],[1950,750],[2400,900],[2800,900],[3120,850],[3600,870],
  [3820,1000],[3860,1430],[3980,1670],[3840,1940],[3790,2080],[3570,2190],[3500,2400],[3640,2520],
  [3480,2700],[3140,2780],[2770,2880],[2260,2810],[1940,2920],[1660,2870],[1540,2690],[1500,2450],
  [1370,2310],[1250,2210],[1000,2200],[896,2224],[760,2250],[600,2300],[300,2270],[200,2200],[200,1990],
  [490,1810],[750,1700],[850,1670],[860,1430],[750,1200],[350,1220],[200,1140],[120,960],[180,760],[500,560],
];
/** Ground immediately in front of the entrance wall, omitted by the old lawn outline. */
export const GATE_APRON:readonly (readonly [number,number])[]=[
  [300,2235],[780,2235],[840,2220],[950,2220],[1200,2270],[1280,2400],[950,2450],[380,2420],
];
const scale=4096/1440;
const walls=[
  [[0,320],[37,237],[91,194],[201,143],[274,114]],
  [[16,678],[23,813],[45,912],[87,1000],[207,1046],[390,1058],[546,1000],[570,920],[556,810],[522,781],[490,770],[422,751],[347,750]],
  // Follow the foot of the stones and the gatepost, not their painted upper faces.
  [[162,780],[205,785],[247,785],[264,785]],
  [[1057,67],[1151,35],[1270,66],[1405,125],[1430,160]],
  [[1292,356],[1351,399],[1440,449]],
  [[1435,873],[1379,934],[1303,980],[1175,1027],[1056,1018]],
  [[178,594],[235,566],[294,555]],
] as const;
export const WALL_SEGMENTS=walls.flatMap(points=>points.slice(1).map((p,i)=>({ax:points[i][0]*scale,ay:points[i][1]*scale,bx:p[0]*scale,by:p[1]*scale})));
export const TREE_TRUNKS=[{x:370,y:1840,r:95},{x:940,y:490,r:85},{x:1940,y:330,r:80},{x:3860,y:2200,r:105},{x:1600,y:760,r:55}];
export function wallBlocked(x:number,y:number):boolean {
  return WALL_SEGMENTS.some(s=>{
    const dx=s.bx-s.ax,dy=s.by-s.ay,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(y-s.ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-s.ax-t*dx,y-s.ay-t*dy)<22;
  });
}
