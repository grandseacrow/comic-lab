import type{Panel,PageSettings,TemplateId}from'./page-data';
import{PANEL_TEMPLATES,MIN_PANEL_SIZE,MAX_PANELS,panelBounds}from'./page-data';
import type{Point,Project}from'./model';
import{uid,isPageProject,validateProject}from'./model';
export function rectanglePanel(x:number,y:number,width:number,height:number,order:number):Panel{return{id:uid(),kind:'normal',shape:'polygon',points:[[x,y],[x+width,y],[x+width,y+height],[x,y+height]],order,borderVisible:true,borderColor:'#222222',borderWidth:3,assetId:null,editing:{locked:false}};}
export function templatePanels(width:number,height:number,settings:PageSettings,template:TemplateId):Panel[]{
 const def=PANEL_TEMPLATES.find(t=>t.id===template);if(!def)throw new Error('対応していないコマ割りテンプレートです。');if(def.rows===0)return[];
 const {margin:m,gutter:g}=settings,w=(width-m*2-g*(def.cols-1))/def.cols,h=(height-m*2-g*(def.rows-1))/def.rows;
 if(w<MIN_PANEL_SIZE||h<MIN_PANEL_SIZE)throw new Error('余白・間隔が大きすぎてコマを作成できません。');
 return Array.from({length:def.rows*def.cols},(_,i)=>rectanglePanel(m+(i%def.cols)*(w+g),m+Math.floor(i/def.cols)*(h+g),w,h,i));
}
export function applyTemplate(project:Project,template:TemplateId):Project{if(!isPageProject(project))throw new Error('コマ割りは新規漫画ページで使用できます。');const page={...project.page,template};return validateProject({...project,page,panels:templatePanels(project.width,project.height,page,template)});}
export function updatePageSettings(project:Project,patch:Partial<PageSettings>):Project{if(!isPageProject(project))throw new Error('ページ設定がありません。');return validateProject({...project,page:{...project.page,...patch}});}
export function resizePage(project:Project,width:number,height:number):Project{
 if(!isPageProject(project))throw new Error('ページ設定がありません。');
 const sx=width/project.width,sy=height/project.height;
 const panels=project.panels.map(panel=>{const b=panelBounds(panel),w=Math.min(width,Math.max(MIN_PANEL_SIZE,b.width*sx)),h=Math.min(height,Math.max(MIN_PANEL_SIZE,b.height*sy)),x=Math.max(0,Math.min(width-w,b.x*sx)),y=Math.max(0,Math.min(height-h,b.y*sy));return{...panel,points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]as Panel['points']};});
 return validateProject({...project,width,height,panels});
}
export function orderedPanels(project:Project):Panel[]{return isPageProject(project)?[...project.panels].sort((a,b)=>a.order-b.order):[];}
export type PanelCorner='nw'|'ne'|'sw'|'se';
export function movePanel(panel:Panel,dx:number,dy:number,page:{width:number;height:number}):Panel{
 if(panel.editing.locked)return structuredClone(panel);const b=panelBounds(panel),x=Math.max(0,Math.min(page.width-b.width,b.x+dx)),y=Math.max(0,Math.min(page.height-b.height,b.y+dy));
 return{...panel,points:[[x,y],[x+b.width,y],[x+b.width,y+b.height],[x,y+b.height]]};
}
export function resizePanel(panel:Panel,corner:PanelCorner,dx:number,dy:number,page:{width:number;height:number}):Panel{
 if(panel.editing.locked)return structuredClone(panel);const b=panelBounds(panel);let x=b.x,y=b.y,right=b.x+b.width,bottom=b.y+b.height;
 if(corner.includes('w'))x=Math.max(0,Math.min(right-MIN_PANEL_SIZE,x+dx));else right=Math.min(page.width,Math.max(x+MIN_PANEL_SIZE,right+dx));
 if(corner.includes('n'))y=Math.max(0,Math.min(bottom-MIN_PANEL_SIZE,y+dy));else bottom=Math.min(page.height,Math.max(y+MIN_PANEL_SIZE,bottom+dy));
 return{...panel,points:[[x,y],[right,y],[right,bottom],[x,bottom]]};
}
export function addPanel(project:Project,center:Point):Project{
 if(!isPageProject(project))throw new Error('コマは新規漫画ページで追加できます。');if(project.panels.length>=MAX_PANELS)throw new Error('コマは100個まで追加できます。');
 const width=Math.min(400,project.width-2*project.page.margin),height=Math.min(300,project.height-2*project.page.margin),x=Math.max(0,Math.min(project.width-width,center.x-width/2)),y=Math.max(0,Math.min(project.height-height,center.y-height/2));
 const panels=orderedPanels(project).map((p,i)=>({...p,order:i}));panels.push(rectanglePanel(x,y,width,height,panels.length));return validateProject({...project,panels});
}
export function deletePanel(project:Project,id:string):Project{if(!isPageProject(project))return project;return validateProject({...project,panels:orderedPanels(project).filter(p=>p.id!==id).map((p,i)=>({...p,order:i}))});}
export function setPanelBounds(project:Project,panel:Panel,patch:Partial<ReturnType<typeof panelBounds>>):Panel{
 const old=panelBounds(panel),width=Math.max(MIN_PANEL_SIZE,Math.min(project.width,patch.width??old.width)),height=Math.max(MIN_PANEL_SIZE,Math.min(project.height,patch.height??old.height)),x=Math.max(0,Math.min(project.width-width,patch.x??old.x)),y=Math.max(0,Math.min(project.height-height,patch.y??old.y));
 return{...panel,points:[[x,y],[x+width,y],[x+width,y+height],[x,y+height]]};
}

export function panelPath(panel:Panel){return panel.points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')+'Z';}
export function panelArtworkSVG(project:Project){return orderedPanels(project).filter(p=>p.borderVisible).map(p=>`<path d="${panelPath(p)}" fill="none" stroke="${p.borderColor}" stroke-width="${p.borderWidth}"/>`).join('');}
