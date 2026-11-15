import { LANDMARKS } from './worldGeometry';
export type MapPlace='tree'|'home'|'entrance'|'stones'|'shelf';
export type MapSymbol='leaf'|'stone'|'arrow'|'sound'|'quiet';
export interface GardenMark {place:MapPlace;symbol:MapSymbol}
export const MAP_PLACES={tree:LANDMARKS.nuri,home:LANDMARKS.home,entrance:LANDMARKS.garden,stones:{x:350,y:1920},shelf:LANDMARKS.pio} as const;
export const MAP_SYMBOLS:MapSymbol[]=['leaf','stone','arrow','sound','quiet'];
export function validMapMarks(value:unknown):value is GardenMark[] {
  return Array.isArray(value)&&value.length<=5&&new Set(value.map(x=>x?.place)).size===value.length
    &&value.every(x=>!!x&&typeof x==='object'&&typeof x.place==='string'&&Object.prototype.hasOwnProperty.call(MAP_PLACES,x.place)&&MAP_SYMBOLS.includes(x.symbol));
}
export function markPlace(marks:GardenMark[],place:MapPlace,symbol?:MapSymbol):GardenMark[] {
  const rest=marks.filter(x=>x.place!==place);
  return symbol?[...rest,{place,symbol}]:rest;
}
