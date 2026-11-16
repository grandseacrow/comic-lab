import type {Panel,PanelPoint} from './page-data';
export type Quad=Panel['points'];
export function bounds(points:Quad){const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));return{x,y,width:Math.max(...points.map(p=>p[0]))-x,height:Math.max(...points.map(p=>p[1]))-y};}
export function isValidQuad(points:Quad):boolean{
 const b=bounds(points);let area=0,perimeter=0;
 if(b.width<40-1e-7||b.height<40-1e-7)return false;
 for(let i=0;i<4;i++){const a=points[i],c=points[(i+1)%4],d=points[(i+2)%4],cross=(c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]),edge=Math.hypot(c[0]-a[0],c[1]-a[1]);if(cross<=1e-6||edge<20-1e-7)return false;perimeter+=edge;area+=a[0]*c[1]-c[0]*a[1];}
 return area/2>=1600-1e-6&&area/perimeter>=20-1e-7;
}
export function mapQuad(points:Quad,fn:(p:PanelPoint)=>PanelPoint):Quad{return points.map(fn)as Quad;}
export function rectPoints(x:number,y:number,width:number,height:number):Quad{return[[x,y],[x+width,y],[x+width,y+height],[x,y+height]];}
export function isRectangle(panel:Panel){const b=bounds(panel.points),expected=rectPoints(b.x,b.y,b.width,b.height);return panel.points.every((p,i)=>p.every((v,j)=>Math.abs(v-expected[i][j])<1e-6));}
// Image offsets are relative to the polygon's bounding-box origin. Shape changes
// compensate that origin while keeping the raster itself fixed in page space.
export function changeShape(panel:Panel,points:Quad):Panel{const old=bounds(panel.points),next=bounds(points);return{...panel,points,...(panel.image?{image:{...panel.image,offsetX:panel.image.offsetX+old.x-next.x,offsetY:panel.image.offsetY+old.y-next.y}}:{})};}
export function transformPanel(panel:Panel,x:number,y:number,width:number,height:number,keepImagePosition:boolean):Panel{
 const b=bounds(panel.points),fn=([px,py]:PanelPoint):PanelPoint=>[x+(px-b.x)*width/b.width,y+(py-b.y)*height/b.height],points=mapQuad(panel.points,fn);
 return{...(keepImagePosition?changeShape(panel,points):{...panel,points}),...(panel.resetPoints?{resetPoints:mapQuad(panel.resetPoints,fn)}:{})};
}
export function moveVertex(panel:Panel,index:number,dx:number,dy:number,page:{width:number;height:number}):Panel{
 if(!Number.isInteger(index)||index<0||index>3)throw Error('頂点を選択してください。');if(panel.kind!=='normal')throw Error('頂点編集は通常コマで使用できます。');if(panel.editing.locked)return panel;
 const points=structuredClone(panel.points);points[index]=[Math.max(0,Math.min(page.width,points[index][0]+dx)),Math.max(0,Math.min(page.height,points[index][1]+dy))];
 if(points[index][0]===panel.points[index][0]&&points[index][1]===panel.points[index][1])return panel;
 if(!isValidQuad(points))throw Error('辺が交差・反転する位置や、細すぎるコマには変形できません。');
 return{...changeShape(panel,points),resetPoints:structuredClone(panel.resetPoints??panel.points)};
}
export function restoreVertices(panel:Panel,page?:{width:number;height:number}):Panel{
 let points=structuredClone(panel.resetPoints??panel.points);
 if(page){const b=bounds(points),w=Math.min(page.width,b.width),h=Math.min(page.height,b.height),x=Math.max(0,Math.min(page.width-w,b.x)),y=Math.max(0,Math.min(page.height-h,b.y));points=mapQuad(points,([px,py])=>[x+(px-b.x)*w/b.width,y+(py-b.y)*h/b.height]);}
 return changeShape(panel,points);
}
export function rectangularize(panel:Panel):Panel{const b=bounds(panel.points);return changeShape(panel,rectPoints(b.x,b.y,b.width,b.height));}
