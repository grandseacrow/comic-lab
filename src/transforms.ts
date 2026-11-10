import type {Balloon,Point} from './model';
import type {EditTarget} from './editing';
export const normalizeAngle=(angle:number)=>((angle+180)%360+360)%360-180;
export function rotateVector(p:Point,angle:number):Point{const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};}
export function rotatePoint(p:Point,center:Point,angle:number):Point{const q=rotateVector({x:p.x-center.x,y:p.y-center.y},angle);return{x:q.x+center.x,y:q.y+center.y};}
export const bodyCenter=(b:Balloon):Point=>({x:b.x+b.width/2,y:b.y+b.height/2});
export const textCenter=(b:Balloon):Point=>({x:b.x+b.textFrame.x+b.textFrame.width/2,y:b.y+b.textFrame.y+b.textFrame.height/2});
export const activeTarget=(b:Balloon,target:EditTarget):EditTarget=>b.kind==='text'?'text':target;
export const activeAngle=(b:Balloon,target:EditTarget)=>activeTarget(b,target)==='text'?b.textRotation:b.bodyRotation;
export const rotationCenter=(b:Balloon,target:EditTarget)=>activeTarget(b,target)==='text'?textCenter(b):bodyCenter(b);
export function worldToBody(b:Balloon,p:Point):Point{const q=rotatePoint(p,bodyCenter(b),-b.bodyRotation);return{x:q.x-b.x,y:q.y-b.y};}
export function textPointToBody(b:Balloon,p:Point):Point{const q=rotatePoint({x:p.x+b.x,y:p.y+b.y},textCenter(b),b.textRotation);return worldToBody(b,q);}
export const bodyTransform=(b:Balloon)=>`translate(${b.x} ${b.y}) rotate(${b.bodyRotation} ${b.width/2} ${b.height/2})`;
export const textTransform=(b:Balloon)=>`translate(${b.x} ${b.y}) rotate(${b.textRotation} ${b.textFrame.x+b.textFrame.width/2} ${b.textFrame.y+b.textFrame.height/2})`;
export function rotateObject(original:Balloon,delta:number,target:EditTarget):Balloon{
 const b=structuredClone(original);target=activeTarget(b,target);
 if(target!=='text')b.bodyRotation=normalizeAngle(b.bodyRotation+delta);
 if(target!=='body')b.textRotation=normalizeAngle(b.textRotation+delta);
 if(target==='group'){
  const f=b.textFrame,c=rotatePoint({x:f.x+f.width/2,y:f.y+f.height/2},{x:b.width/2,y:b.height/2},delta);
  f.x=c.x-f.width/2;f.y=c.y-f.height/2;
 }
 return b;
}
export function resizeBody(original:Balloon,dx:number,dy:number,target:EditTarget):Balloon{
 const b=structuredClone(original);let factor=1;
 if(target==='group'){
  factor=Math.max(Math.max(40/b.width,40/b.height,1/b.textFrame.width,1/b.textFrame.height),Math.min(Math.min(20000/b.width,20000/b.height,20000/b.textFrame.width,20000/b.textFrame.height),1+(dx*b.width+dy*b.height)/(b.width*b.width+b.height*b.height)));
  b.width*=factor;b.height*=factor;
 }else{b.width=Math.max(40,Math.min(20000,b.width+dx));b.height=Math.max(40,Math.min(20000,b.height+dy));}
 const anchor=rotatePoint({x:original.x,y:original.y},bodyCenter(original),original.bodyRotation);
 const half=rotateVector({x:b.width/2,y:b.height/2},b.bodyRotation);
 b.x=anchor.x+half.x-b.width/2;b.y=anchor.y+half.y-b.height/2;
 const f=b.textFrame;
 if(target==='group'){
  const old=textCenter(original),center={x:anchor.x+(old.x-anchor.x)*factor,y:anchor.y+(old.y-anchor.y)*factor};
  f.width*=factor;f.height*=factor;f.x=center.x-b.x-f.width/2;f.y=center.y-b.y-f.height/2;
 }else{f.x-=b.x-original.x;f.y-=b.y-original.y;}
 return b;
}
