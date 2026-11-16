import type {Panel,PanelPoint} from './page-data';
import type {Project} from './model';
import {isPageProject,uid,validateProject} from './model';
import {panelBounds,MAX_PANELS} from './page-data';
import {changeShape,isRectangle} from './panel-geometry';
const lerp=(a:PanelPoint,b:PanelPoint,t:number):PanelPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function normal(project:Project,id:string){if(!isPageProject(project))throw Error('新規漫画ページで使用できます。');const panel=project.panels.find(p=>p.id===id);if(!panel||panel.kind!=='normal')throw Error('通常コマを選択してください。');if(panel.editing.locked)throw Error('ロックされたコマは編集できません。');return panel;}
const reindex=(panels:Panel[])=>panels.map((p,order)=>({...p,order}));
export function splitPanel(project:Project,id:string,direction:'vertical'|'horizontal',percentage:number):Project{
 const panel=normal(project,id);if(project.panels!.length>=MAX_PANELS)throw Error('コマは100個までです。');if(!Number.isFinite(percentage)||percentage<10||percentage>90)throw Error('分割位置は10〜90%で指定してください。');
 const [a,b,c,d]=panel.points,t=percentage/100,g=project.page!.gutter,vertical=direction==='vertical',length=(u:PanelPoint,v:PanelPoint)=>Math.hypot(v[0]-u[0],v[1]-u[1]);
 const edge=vertical?Math.min(length(a,b),length(d,c)):Math.min(length(a,d),length(b,c)),pad=g/(2*edge),lo=t-pad,hi=t+pad;
 if(lo<=0||hi>=1)throw Error('分割後のコマが小さすぎます。分割位置かガターを調整してください。');
 const q1:Panel['points']=vertical?[a,lerp(a,b,lo),lerp(d,c,lo),d]:[a,b,lerp(b,c,lo),lerp(a,d,lo)];
 const q2:Panel['points']=vertical?[lerp(a,b,hi),b,c,lerp(d,c,hi)]:[lerp(a,d,hi),lerp(b,c,hi),c,d];
 const children=[q1,q2].map(points=>{const p=changeShape(structuredClone(panel),points);p.id=uid();p.clipImage=true;delete p.resetPoints;return p;});
 const panels=[...project.panels!].sort((a,b)=>a.order-b.order).flatMap(p=>p.id===id?children:[p]);
 try{return validateProject({...project,panels:reindex(panels)});}catch{throw Error('分割後のコマが小さすぎるか細すぎます。分割位置かガターを調整してください。');}
}
export function mergeReason(project:Project,aId:string,bId:string):string|null{
 if(aId===bId)return'別の2コマを選択してください。';let a:Panel,b:Panel;try{a=normal(project,aId);b=normal(project,bId);}catch(e){return(e as Error).message;}
 const eps=1e-5,g=project.page!.gutter,near=(x:number,y:number)=>Math.abs(x-y)<eps;
 // Complementary trapezoids may also form a rectangle. Compare their outer
 // edges and the parallel inner edges, rather than just their bounding boxes.
 const [l,r]=panelBounds(a).x<=panelBounds(b).x?[a,b]:[b,a];
 const vertical=near(l.points[0][0],l.points[3][0])&&near(r.points[1][0],r.points[2][0])&&near(l.points[0][1],l.points[1][1])&&near(r.points[0][1],r.points[1][1])&&near(l.points[2][1],l.points[3][1])&&near(r.points[2][1],r.points[3][1])&&near(l.points[0][1],r.points[0][1])&&near(l.points[2][1],r.points[2][1]);
 if(vertical){const dx=r.points[0][0]-l.points[1][0],dx2=r.points[3][0]-l.points[2][0],edge=Math.hypot(l.points[2][0]-l.points[1][0],l.points[2][1]-l.points[1][1]),gap=dx*(l.points[2][1]-l.points[1][1])/edge;if(near(dx,dx2)&&dx>=-eps&&gap<=g+eps)return null;}
 const [t,d]=panelBounds(a).y<=panelBounds(b).y?[a,b]:[b,a];
 const horizontal=near(t.points[0][1],t.points[1][1])&&near(d.points[2][1],d.points[3][1])&&near(t.points[0][0],t.points[3][0])&&near(t.points[1][0],t.points[2][0])&&near(d.points[0][0],d.points[3][0])&&near(d.points[1][0],d.points[2][0])&&near(t.points[0][0],d.points[0][0])&&near(t.points[1][0],d.points[1][0]);
 if(horizontal){const dy=d.points[0][1]-t.points[3][1],dy2=d.points[1][1]-t.points[2][1],edge=Math.hypot(t.points[2][0]-t.points[3][0],t.points[2][1]-t.points[3][1]),gap=dy*(t.points[2][0]-t.points[3][0])/edge;if(near(dy,dy2)&&dy>=-eps&&gap<=g+eps)return null;}
 if(!isRectangle(a)||!isRectangle(b))return'統合すると外形が長方形になりません。L字・不規則な組み合わせは統合できません。';
 return'隣接していないか、2コマの位置・大きさが揃っていません。ガター以内で隣接する長方形2コマを選択してください。';
}
export function mergePanels(project:Project,aId:string,bId:string,imageSourceId?:string):Project{
 const reason=mergeReason(project,aId,bId);if(reason)throw Error(reason);const a=normal(project,aId),b=normal(project,bId),ab=panelBounds(a),bb=panelBounds(b),x=Math.min(ab.x,bb.x),y=Math.min(ab.y,bb.y),right=Math.max(ab.x+ab.width,bb.x+bb.width),bottom=Math.max(ab.y+ab.height,bb.y+bb.height);
 if(a.image&&b.image&&imageSourceId!==aId&&imageSourceId!==bId)throw Error('統合後に使用する画像を選択してください。');
 const source=imageSourceId===bId?b:a.image?a:b;
 const merged:Panel={...structuredClone(a),id:uid(),points:[[x,y],[right,y],[right,bottom],[x,bottom]],image:source.image?{...source.image,offsetX:panelBounds(source).x+source.image.offsetX-x,offsetY:panelBounds(source).y+source.image.offsetY-y}:null};delete merged.resetPoints;
 const all=[...project.panels!].sort((p,q)=>p.order-q.order),index=Math.min(all.indexOf(a),all.indexOf(b)),panels=all.filter(p=>p.id!==aId&&p.id!==bId);panels.splice(index,0,merged);return validateProject({...project,panels:reindex(panels)});
}
export function changePanelKind(panel:Panel,kind:Panel['kind']):Panel{return{...panel,kind,borderVisible:kind==='normal',clipImage:kind==='normal'};}
