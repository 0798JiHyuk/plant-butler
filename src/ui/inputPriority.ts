import { events } from '../core/events';

/** Bubble phase: React handlers keep working; Phaser's window listeners do not run.
 * Do not preventDefault: inputs, scrolling, button clicks and pointer capture need it.
 */
export function installUiInputPriority(root:HTMLElement):()=>void {
  // Phaser uses mouse/touch events. Pointer events remain available to React's
  // joystick capture and the document-level audio unlock handler.
  const types=['mousedown','mousemove','mouseup','touchstart','touchmove','touchend','touchcancel','wheel'] as const;
  const stop=(event:Event)=>{
    event.stopPropagation();
    if(event.type!=='wheel')events.emit('ui-pointer-cancel',{});
  };
  // Touch sequences keep their original canvas target even after the finger
  // moves onto HTML. Check the actual release/move location in that case.
  const crossing=(event:Event)=>{
    if(!(event.target instanceof HTMLCanvasElement)||!event.target.closest('#game'))return;
    const points=typeof TouchEvent!=='undefined'&&event instanceof TouchEvent?Array.from(event.changedTouches):event instanceof MouseEvent?[event]:[];
    if(points.some(p=>{const hit=document.elementFromPoint(p.clientX,p.clientY);return !!hit&&root.contains(hit);}))stop(event);
  };
  const crossingTypes=['mousemove','mouseup','touchmove','touchend','touchcancel'] as const;
  for(const type of types)root.addEventListener(type,stop);
  for(const type of crossingTypes)document.addEventListener(type,crossing,true);
  return ()=>{
    for(const type of types)root.removeEventListener(type,stop);
    for(const type of crossingTypes)document.removeEventListener(type,crossing,true);
  };
}
