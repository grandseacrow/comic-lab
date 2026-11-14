export type PanelPoint=[number,number];
export type Panel={id:string;kind:'normal';shape:'polygon';points:[PanelPoint,PanelPoint,PanelPoint,PanelPoint];order:number;borderVisible:boolean;borderColor:string;borderWidth:number;assetId:string|null;editing:{locked:boolean}};
export const PAGE_PRESETS=[{id:'portrait',label:'縦長',width:1200,height:1800},{id:'square',label:'正方形',width:1200,height:1200},{id:'landscape',label:'横長',width:1800,height:1200}]as const;
export const PANEL_TEMPLATES=[{id:'two-horizontal',label:'2コマ・横分割（上下）',rows:2,cols:1},{id:'two-vertical',label:'2コマ・縦分割（左右）',rows:1,cols:2},{id:'four-vertical',label:'4コマ・縦並び',rows:4,cols:1},{id:'four-grid',label:'4コマ・2×2',rows:2,cols:2},{id:'blank',label:'空白ページ',rows:0,cols:0}]as const;
export type TemplateId=typeof PANEL_TEMPLATES[number]['id'];
export type PageSettings={mode:'new-page';backgroundColor:string;margin:number;gutter:number;template:TemplateId};
export const MIN_PANEL_SIZE=40;
export const MAX_PANELS=100;
export function panelBounds(panel:Panel){const [[x,y],[right],[,bottom]]=panel.points;return{x,y,width:right-x,height:bottom-y};}
export function validatePageData(settings:unknown,panels:unknown,width:number,height:number):void{
 const fail=(message:string):never=>{throw new Error(message);};
 const n=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const p=settings as PageSettings;
 if(!p||p.mode!=='new-page'||!color(p.backgroundColor)||!n(p.margin,0,200)||!n(p.gutter,0,200)||!PANEL_TEMPLATES.some(t=>t.id===p.template)||width<320||height<320||p.margin*2>=Math.min(width,height))fail('ページ設定の形式が正しくありません。');
 if(!Array.isArray(panels)||panels.length>MAX_PANELS)fail('コマ配列の形式またはコマ数が対応範囲外です。');
 const ids=new Set<string>(),orders=new Set<number>();
 for(const raw of panels as Panel[]){
  const b=raw;if(!b||typeof b.id!=='string'||!b.id||b.id.length>100||ids.has(b.id)||b.kind!=='normal'||b.shape!=='polygon'||!Array.isArray(b.points)||b.points.length!==4||!Number.isInteger(b.order)||!n(b.order,0,MAX_PANELS-1)||orders.has(b.order)||typeof b.borderVisible!=='boolean'||!color(b.borderColor)||!n(b.borderWidth,0,30)||!(b.assetId===null||(typeof b.assetId==='string'&&b.assetId.length<=100))||!b.editing||typeof b.editing.locked!=='boolean')fail('コマの種類・ID・順序・枠線設定が不正です。');
  ids.add(b.id);orders.add(b.order);
  for(const point of b.points)if(!Array.isArray(point)||point.length!==2||!n(point[0],0,width)||!n(point[1],0,height))fail('コマの頂点が原稿の範囲外です。');
  const [[x,y],[right,y2],[right2,bottom],[x2,bottom2]]=b.points;
  if(x!==x2||right!==right2||y!==y2||bottom!==bottom2||right-x<MIN_PANEL_SIZE||bottom-y<MIN_PANEL_SIZE)fail('alpha.1では最小40pxの長方形コマを使用してください。');
 }
}
