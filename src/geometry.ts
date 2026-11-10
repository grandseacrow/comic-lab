import paper from 'paper';
import type { Balloon, Point } from './model';
const scope = new paper.PaperScope();
scope.setup(new scope.Size(1,1));
export function boundary(kind: Balloon['kind'], point: Point): Point {
 const dx=point.x-.5,dy=point.y-.5;
 if(!dx&&!dy) return {x:.5,y:1};
 if(kind==='ellipse') { const m=Math.hypot(dx,dy)*2; return {x:.5+dx/m,y:.5+dy/m}; }
 // Project to a rounded rectangle with a fixed proportional corner radius.
 let lo=0,hi=2/Math.max(Math.abs(dx),Math.abs(dy));
 const inside=(t:number)=>{const qx=Math.abs(dx*t)-.38,qy=Math.abs(dy*t)-.38;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)<=.12;};
 for(let i=0;i<32;i++){const m=(lo+hi)/2;if(inside(m))lo=m;else hi=m;}
 return{x:.5+dx*lo,y:.5+dy*lo};
}
const cache=new Map<string,string>();
export function balloonPath(b: Balloon): string {
 const key=JSON.stringify([b.kind,b.width,b.height,b.tail]); const cached=cache.get(key); if(cached) return cached;
 const body=b.kind==='ellipse'?new scope.Path.Ellipse({rectangle:new scope.Rectangle(0,0,b.width,b.height),insert:false}):new scope.Path.Rectangle({rectangle:new scope.Rectangle(0,0,b.width,b.height),radius:new scope.Size(b.width*.12,b.height*.12),insert:false});
 let result: paper.PathItem=body;
 if(b.tail.enabled){
 const a=boundary(b.kind,b.tail.a),bb=boundary(b.kind,b.tail.b);
 // Move the base inside by a fraction of a pixel to avoid coincident-edge artifacts.
 const inset=(v:Point)=>new scope.Point((.5+(v.x-.5)*.997)*b.width,(.5+(v.y-.5)*.997)*b.height);
 const tail=new scope.Path({segments:[inset(a),new scope.Point(b.tail.p.x*b.width,b.tail.p.y*b.height),inset(bb)],closed:true,insert:false});
 result=body.unite(tail,{insert:false});tail.remove();
 }
 const data=result.pathData;result.remove();body.remove();
 if(cache.size>1000)cache.clear();cache.set(key,data);return data;
}
