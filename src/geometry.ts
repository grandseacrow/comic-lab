import paper from 'paper';
import {defaultZigzag} from './model';
import type {ZigzagSettings, Balloon, Point } from './model';
const scope = new paper.PaperScope();
scope.setup(new scope.Size(1,1));
const polygonCache=new Map<string,Point[]>();
export function zigzagVertices(settings:ZigzagSettings):Point[]{
 const key=JSON.stringify(settings),existing=polygonCache.get(key);if(existing)return existing;
 const count=Math.max(6,Math.min(48,Math.round(settings.count))),depth=Math.max(.05,Math.min(.45,settings.depth)),sharp=Math.max(0,Math.min(1,settings.sharpness));
 const shoulder=.22-.17*sharp,rShoulder=1-depth*(.25+.5*sharp),points:Point[]=[];
 for(let i=0;i<count;i++)for(const[offset,radius]of[[0,1],[shoulder,rShoulder],[.5,1-depth],[1-shoulder,rShoulder]]){const angle=-Math.PI/2+(i+offset)*Math.PI*2/count;points.push({x:.5+.5*radius*Math.cos(angle),y:.5+.5*radius*Math.sin(angle)});}
 if(polygonCache.size>300)polygonCache.clear();polygonCache.set(key,points);return points;
}
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
function polygonBoundary(point:Point,settings:ZigzagSettings):Point{
 const vertices=zigzagVertices(settings),direction={x:point.x-.5,y:point.y-.5};let nearest=Infinity;
 for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],edge={x:b.x-a.x,y:b.y-a.y},relative={x:a.x-.5,y:a.y-.5},den=cross(direction,edge);if(Math.abs(den)<1e-12)continue;const t=cross(relative,edge)/den,u=cross(relative,direction)/den;if(t>=0&&u>=-1e-9&&u<=1+1e-9)nearest=Math.min(nearest,t);}
 return Number.isFinite(nearest)?{x:.5+direction.x*nearest,y:.5+direction.y*nearest}:{x:.5,y:0};
}
export function boundaryPoint(b:Balloon,point:Point):Point{return boundary(b.kind,point,b.roundness,b.zigzag);}
export function boundary(kind: Balloon['kind'], point: Point, roundness=24,zigzag=defaultZigzag()): Point {
 const dx=point.x-.5,dy=point.y-.5;
 if(!dx&&!dy) return {x:.5,y:1};
 if(kind==='zigzag')return polygonBoundary(point,zigzag);
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
 if(b.kind==='zigzag'){const normalized={x:point.x/b.width,y:point.y/b.height},edge=polygonBoundary(normalized,b.zigzag);return Math.hypot(normalized.x-.5,normalized.y-.5)<=Math.hypot(edge.x-.5,edge.y-.5)+1e-8;}
 const x=Math.abs(point.x/b.width-.5),y=Math.abs(point.y/b.height-.5);
 if(b.kind==='ellipse')return Math.hypot(x,y)<=.5+1e-7;
 const radius=b.roundness/200,edge=.5-radius;
 return Math.hypot(Math.max(x-edge,0),Math.max(y-edge,0))+Math.min(Math.max(x-edge,y-edge),0)<=radius+1e-7;
}
const cache=new Map<string,string>();
export function balloonPath(b: Balloon): string {
 if(b.kind==='text')return '';
 const key=JSON.stringify([b.kind,b.width,b.height,b.roundness,b.tail,b.zigzag]); const cached=cache.get(key); if(cached) return cached;
 const body=b.kind==='zigzag'?new scope.Path({segments:zigzagVertices(b.zigzag).map(p=>new scope.Point(p.x*b.width,p.y*b.height)),closed:true,insert:false}):b.kind==='ellipse'?new scope.Path.Ellipse({rectangle:new scope.Rectangle(0,0,b.width,b.height),insert:false}):new scope.Path.Rectangle({rectangle:new scope.Rectangle(0,0,b.width,b.height),radius:new scope.Size(b.width*b.roundness/200,b.height*b.roundness/200),insert:false});
 let result: paper.PathItem=body;
 if(b.tail.enabled){
 const a=boundaryPoint(b,b.tail.a),bb=boundaryPoint(b,b.tail.b);
 // Move the base inside by a fraction of a pixel to avoid coincident-edge artifacts.
 const inset=(v:Point)=>new scope.Point((.5+(v.x-.5)*.997)*b.width,(.5+(v.y-.5)*.997)*b.height);
 const tail=new scope.Path({segments:[inset(a),new scope.Point(b.tail.p.x*b.width,b.tail.p.y*b.height),inset(bb)],closed:true,insert:false});
 result=body.unite(tail,{insert:false});tail.remove();
 // A tail bridging two deep valleys can enclose a tiny hole. Fill only such
 // internal contours; retain the outside silhouette and all source controls.
 if(b.kind==='zigzag'&&result instanceof scope.CompoundPath){const children=[...result.children]as paper.Path[];const outer=children.reduce((a,c)=>Math.abs(c.area)>Math.abs(a.area)?c:a);for(const child of children)if(child.clockwise!==outer.clockwise)child.remove();}
 }
 const data=result.pathData;result.remove();body.remove();
 if(cache.size>1000)cache.clear();cache.set(key,data);return data;
}
