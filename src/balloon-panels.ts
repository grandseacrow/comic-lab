import type{Balloon,Point,Project}from'./model';import{uid}from'./model';import type{Panel}from'./page-data';import{panelBounds}from'./page-data';import{moveBalloon}from'./editing';import{bodyCenter,textCenter}from'./transforms';import{splitPanel}from'./panel-operations';
export const balloonCenter=(b:Balloon)=>b.kind==='text'?textCenter(b):bodyCenter(b);
export function pointInPanel(p:Point,panel:Panel){return panel.points.every(([x,y],i)=>{const q=panel.points[(i+1)%4];return(q[0]-x)*(p.y-y)-(q[1]-y)*(p.x-x)>=-1e-6;});}
export function ownerPanel(b:Balloon,project?:Project){return project?.version===2?project.panels?.find(p=>p.id===b.panelId):undefined;}
export function trimToPanel(b:Balloon,project?:Project){const p=ownerPanel(b,project);return p&&(b.panelTrim??p.kind==='normal')?p:undefined;}
export const panelClipId=(b:Balloon)=>'balloon-panel-'+Array.from(b.id,c=>c.codePointAt(0)!.toString(16)).join('-');
export function translateWholeBalloon(b:Balloon,dx:number,dy:number):Balloon{const next=moveBalloon(b,dx,dy,'group');return{...next,clip:{...next.clip,x:next.clip.x+next.x-b.x,y:next.clip.y+next.y-b.y}};}
export function editLinkedPanel(project:Project,id:string,next:Panel,mode:'move'|'resize'|'shape'|'image'):Project{
 const previous=project.panels?.find(p=>p.id===id);if(!previous)return project;const old=panelBounds(previous),now=panelBounds(next);
 return{...project,panels:project.panels!.map(p=>p.id===id?next:p),balloons:project.balloons.map(b=>{if(b.panelId!==id||mode==='shape'||mode==='image')return b;const c=balloonCenter(b),dx=mode==='move'?now.x-old.x:now.x+(c.x-old.x)*now.width/old.width-c.x,dy=mode==='move'?now.y-old.y:now.y+(c.y-old.y)*now.height/old.height-c.y;return translateWholeBalloon(b,dx,dy);})};
}
export function followPageResize(before:Project,after:Project):Project{let p:Project={...before,width:after.width,height:after.height,page:after.page};for(const panel of after.panels??[])p=editLinkedPanel(p,panel.id,panel,'resize');return p;}
export function removeLinkedPanel(project:Project,id:string,removeDialogues:boolean):Project{return{...project,panels:project.panels!.filter(p=>p.id!==id).map((p,order)=>({...p,order})),balloons:removeDialogues?project.balloons.filter(b=>b.panelId!==id):project.balloons.map(b=>b.panelId===id?{...b,panelId:null}:b)};}
export function prepareLinkedSplit(project:Project,id:string,direction:'vertical'|'horizontal',ratio:number){
 const split=splitPanel(project,id,direction,ratio),old=new Set(project.panels!.map(p=>p.id)),children=split.panels!.filter(p=>!old.has(p.id)),unresolved:string[]=[];
 const next={...split,balloons:project.balloons.map(b=>{if(b.panelId!==id)return b;const inside=children.filter(p=>pointInPanel(balloonCenter(b),p));if(inside.length===1)return{...b,panelId:inside[0].id};unresolved.push(b.id);return b;})};return{next,children,unresolved};
}
function footprint(b:Balloon){const points:Point[]=[];if(b.kind!=='text'){points.push({x:b.x,y:b.y},{x:b.x+b.width,y:b.y+b.height});if(b.tail.enabled)for(const p of[b.tail.a,b.tail.b,b.tail.p])points.push({x:b.x+p.x*b.width,y:b.y+p.y*b.height});}const f=b.textFrame;points.push({x:b.x+f.x,y:b.y+f.y},{x:b.x+f.x+f.width,y:b.y+f.y+f.height});const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};}
export function placeInPanel(original:Balloon,panel:Panel,existing:Balloon[]):Balloon{
 const bounds=panelBounds(panel),center={x:panel.points.reduce((s,p)=>s+p[0],0)/4,y:panel.points.reduce((s,p)=>s+p[1],0)/4},foot=footprint(original),positions=[center,...[.3,.5,.7].flatMap(x=>[.25,.5,.75].map(y=>({x:bounds.x+bounds.width*x,y:bounds.y+bounds.height*y})))];
 let best:Balloon|undefined,bestCost=Infinity;for(const p of positions){const b=translateWholeBalloon(original,p.x-foot.x-foot.width/2,p.y-foot.y-foot.height/2),f=footprint(b);if(![{x:f.x,y:f.y},{x:f.x+f.width,y:f.y},{x:f.x+f.width,y:f.y+f.height},{x:f.x,y:f.y+f.height}].every(p=>pointInPanel(p,panel)))continue;let cost=0;for(const old of existing.filter(b=>b.panelId===panel.id)){const o=footprint(old);cost+=Math.max(0,Math.min(o.x+o.width,f.x+f.width)-Math.max(o.x,f.x))*Math.max(0,Math.min(o.y+o.height,f.y+f.height)-Math.max(o.y,f.y));}if(cost<bestCost){best=b;bestCost=cost;}}
 const b=best??translateWholeBalloon(original,center.x-balloonCenter(original).x,center.y-balloonCenter(original).y);return{...b,panelId:panel.id,panelTrim:panel.kind==='normal'};
}
export type BalloonCopy={balloon:Balloon;bounds:{x:number;y:number;width:number;height:number}};
export function copyBalloon(b:Balloon,project:Project,formatOnly=false):BalloonCopy{const p=ownerPanel(b,project),item=structuredClone(b);if(formatOnly)item.text='';if(p)item.panelTrim=b.panelTrim??p.kind==='normal';return{balloon:item,bounds:p?panelBounds(p):{x:0,y:0,width:project.width,height:project.height}};}
export function pasteBalloon(copy:BalloonCopy,project:Project,panel?:Panel):Balloon{
 const original=copy.balloon,source=copy.bounds,target=panel?panelBounds(panel):{x:0,y:0,width:project.width,height:project.height},c=balloonCenter(original),nextCenter={x:target.x+(c.x-source.x)*target.width/source.width,y:target.y+(c.y-source.y)*target.height/source.height},b=translateWholeBalloon(original,nextCenter.x-c.x,nextCenter.y-c.y);b.id=uid();b.panelId=panel?.id??null;if(b.panelTrim===undefined&&panel)b.panelTrim=panel.kind==='normal';return b;
}
