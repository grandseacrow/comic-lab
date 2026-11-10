import paper from 'paper';
import type { Balloon, Point } from './model';
const scope = new paper.PaperScope();
scope.setup(new scope.Size(1,1));
export function boundary(kind: Balloon['kind'], point: Point, roundness=24): Point {
 const dx=point.x-.5,dy=point.y-.5;
 if(!dx&&!dy) return {x:.5,y:1};
 if(kind==='ellipse') { const m=Math.hypot(dx,dy)*2; return {x:.5+dx/m,y:.5+dy/m}; }
 // Project to the same normalized rounded rectangle used by the SVG path.
 const radius=roundness/200, edge=.5-radius;
 let lo=0,hi=2/Math.max(Math.abs(dx),Math.abs(dy));
 const inside=(t:number)=>{const qx=Math.abs(dx*t)-edge,qy=Math.abs(dy*t)-edge;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)<=radius;};
 for(let i=0;i<32;i++){const m=(lo+hi)/2;if(inside(m))lo=m;else hi=m;}
 return{x:.5+dx*lo,y:.5+dy*lo};
}
export function bodyContainsPoint(b:Balloon,point:Point):boolean {
 if(b.kind==='text')return true;
 const x=Math.abs(point.x/b.width-.5),y=Math.abs(point.y/b.height-.5);
 if(b.kind==='ellipse')return Math.hypot(x,y)<=.5+1e-7;
 const radius=b.roundness/200,edge=.5-radius;
 return Math.hypot(Math.max(x-edge,0),Math.max(y-edge,0))+Math.min(Math.max(x-edge,y-edge),0)<=radius+1e-7;
}
const cache=new Map<string,string>();
export function balloonPath(b: Balloon): string {
 if(b.kind==='text')return '';
 const key=JSON.stringify([b.kind,b.width,b.height,b.roundness,b.tail]); const cached=cache.get(key); if(cached) return cached;
 const body=b.kind==='ellipse'?new scope.Path.Ellipse({rectangle:new scope.Rectangle(0,0,b.width,b.height),insert:false}):new scope.Path.Rectangle({rectangle:new scope.Rectangle(0,0,b.width,b.height),radius:new scope.Size(b.width*b.roundness/200,b.height*b.roundness/200),insert:false});
 let result: paper.PathItem=body;
 if(b.tail.enabled){
 const a=boundary(b.kind,b.tail.a,b.roundness),bb=boundary(b.kind,b.tail.b,b.roundness);
 // Move the base inside by a fraction of a pixel to avoid coincident-edge artifacts.
 const inset=(v:Point)=>new scope.Point((.5+(v.x-.5)*.997)*b.width,(.5+(v.y-.5)*.997)*b.height);
 const tail=new scope.Path({segments:[inset(a),new scope.Point(b.tail.p.x*b.width,b.tail.p.y*b.height),inset(bb)],closed:true,insert:false});
 result=body.unite(tail,{insert:false});tail.remove();
 }
 const data=result.pathData;result.remove();body.remove();
 if(cache.size>1000)cache.clear();cache.set(key,data);return data;
}
