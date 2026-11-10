import type{Balloon}from'./model';
import{rotatePoint,bodyCenter}from'./transforms';
export type ClipCorner='nw'|'ne'|'sw'|'se';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function moveClip(original:Balloon,dx:number,dy:number):Balloon{const b=structuredClone(original);b.clip.x=clamp(b.clip.x+dx,-80000,80000);b.clip.y=clamp(b.clip.y+dy,-80000,80000);return b;}
export function resizeClip(original:Balloon,corner:ClipCorner,dx:number,dy:number):Balloon{
 const b=structuredClone(original),c=original.clip;let left=c.x,top=c.y,right=c.x+c.width,bottom=c.y+c.height;
 if(corner.includes('w'))left=clamp(c.x+dx,Math.max(-80000,right-40000),Math.min(80000,right-1));else right=clamp(right+dx,left+1,left+40000);
 if(corner.includes('n'))top=clamp(c.y+dy,Math.max(-80000,bottom-40000),Math.min(80000,bottom-1));else bottom=clamp(bottom+dy,top+1,top+40000);
 b.clip={...b.clip,x:left,y:top,width:right-left,height:bottom-top};return b;
}
export function clipToBody(b:Balloon):Balloon['clip']{const center=bodyCenter(b),points=[[0,0],[b.width,0],[0,b.height],[b.width,b.height]].map(([x,y])=>rotatePoint({x:b.x+x,y:b.y+y},center,b.bodyRotation));const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return{...b.clip,x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};}
