import type { Balloon } from './model';
export type EditTarget = 'group'|'body'|'text';
export function moveBalloon(original:Balloon,dx:number,dy:number,target:EditTarget):Balloon {
 const b=structuredClone(original);
 if(target==='text'){
  b.textFrame.x=Math.max(-80000,Math.min(80000,original.textFrame.x+dx));
  b.textFrame.y=Math.max(-80000,Math.min(80000,original.textFrame.y+dy));
 }else{
  if(target==='body'){dx=Math.max(original.textFrame.x-80000,Math.min(original.textFrame.x+80000,dx));dy=Math.max(original.textFrame.y-80000,Math.min(original.textFrame.y+80000,dy));}
  b.x=Math.max(-40000,Math.min(40000,original.x+dx));b.y=Math.max(-40000,Math.min(40000,original.y+dy));
  if(target==='body'){b.textFrame.x-=b.x-original.x;b.textFrame.y-=b.y-original.y;}
 }
 return b;
}
export function resizeTextFrame(original:Balloon,dx:number,dy:number):Balloon {
 const b=structuredClone(original);
 b.textFrame.width=Math.max(1,Math.min(20000,original.textFrame.width+dx));
 b.textFrame.height=Math.max(1,Math.min(20000,original.textFrame.height+dy));return b;
}
