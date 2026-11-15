import type {Document,Project} from './model';
import {uid,isPageProject,validateProject} from './model';
import type {Panel,PanelImage,ImageAsset} from './page-data';
import {panelBounds} from './page-data';
import {orderedPanels,panelPath,panelArtworkSVG} from './panels';
export type ImageResource={bytes:Uint8Array;url:string;pixels?:number};
export type ImageResources=Record<string,ImageResource>;
export const MAX_IMAGE_BYTES=40*1024*1024;
export const MAX_IMAGE_PIXELS=80_000_000;
export const MIN_IMAGE_SCALE=.001,MAX_IMAGE_SCALE=20000;
export function fitScale(panel:Panel,width:number,height:number,mode:'cover'|'contain'){
 const b=panelBounds(panel);return (mode==='cover'?Math.max:Math.min)(b.width/width,b.height/height);
}
export function centerImage(panel:Panel,image:PanelImage):PanelImage{const b=panelBounds(panel);return{...image,offsetX:(b.width-image.width*image.scale)/2,offsetY:(b.height-image.height*image.scale)/2};}
export function fitImage(panel:Panel,image:PanelImage,fitMode=image.fitMode):PanelImage{return centerImage(panel,{...image,fitMode,scale:fitScale(panel,image.width,image.height,fitMode)});}
export function scaleImage(image:PanelImage,scale:number):PanelImage{scale=Math.max(MIN_IMAGE_SCALE,Math.min(MAX_IMAGE_SCALE,scale));return{...image,scale,offsetX:image.offsetX+image.width*(image.scale-scale)/2,offsetY:image.offsetY+image.height*(image.scale-scale)/2};}
export function moveImage(panel:Panel,dx:number,dy:number):Panel{if(!panel.image||panel.editing.locked)return panel;return{...panel,image:{...panel.image,offsetX:Math.max(-40_000_000,Math.min(40_000_000,panel.image.offsetX+dx)),offsetY:Math.max(-40_000_000,Math.min(40_000_000,panel.image.offsetY+dy))}};}
export function usedImageAssets(project:Project):ImageAsset[]{const used=new Set(project.panels?.map(p=>p.image?.assetId));return(project.assets??[]).filter(a=>used.has(a.id));}
export function pruneImageAssets(project:Project):Project{return project.assets?{...project,assets:usedImageAssets(project)}:project;}
export function attachPanelImage(project:Project,panelId:string,asset:ImageAsset):Project{
 if(!isPageProject(project)||!project.panels.some(p=>p.id===panelId))throw Error('画像を配置するコマが見つかりません。');
 return validateProject(pruneImageAssets({...project,assets:[...(project.assets??[]).filter(a=>a.id!==asset.id),asset],panels:project.panels.map(p=>p.id===panelId?{...p,image:fitImage(p,{assetId:asset.id,width:asset.width,height:asset.height,offsetX:0,offsetY:0,scale:1,fitMode:'cover'})}:p)}));
}
export function newImageAsset(name:string,decoded:{width:number;height:number;mime:string}):ImageAsset{const id=uid(),ext=decoded.mime==='image/jpeg'?'jpg':decoded.mime==='image/webp'?'webp':'png';return{id,path:`assets/images/${id}.${ext}`,name:name.slice(0,255),mime:decoded.mime,width:decoded.width,height:decoded.height};}
export function findReusableAsset(project:Project,resources:ImageResources,bytes:Uint8Array):ImageAsset|undefined{return(project.assets??[]).find(a=>{const old=resources[a.id]?.bytes;return old?.length===bytes.length&&old.every((v,i)=>v===bytes[i]);});}
export function checkResourceBudget(doc:Document,bytes:number,pixels:number){
 const resources=Object.values(doc.assets??{}),total=resources.reduce((sum,r)=>sum+r.bytes.length,0);let decodedPixels=0;
 // Runtime resources include undo-only images; keep their dimensions outside project history.
 for(const r of resources)decodedPixels+=r.pixels??0;
 if(resources.length>=100||total+bytes>MAX_IMAGE_BYTES||decodedPixels+pixels>MAX_IMAGE_PIXELS)throw Error('画像素材の上限（100枚・合計40MB・展開後8,000万画素）を超えます。ZIP保存して開き直すと未使用の履歴素材を解放できます。');
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function panelImagesSVG(project:Project,resources:ImageResources={}):string{
 const panels=orderedPanels(project),backgrounds=panels.filter(p=>p.kind==='background'),normal=panels.filter(p=>p.kind==='normal');
 const render=(panel:Panel)=>{const image=panel.image;if(!image)return'';const resource=resources[image.assetId];if(!Object.hasOwn(resources,image.assetId)||!resource)throw Error('コマの画像素材が見つかりません。ZIPを開き直してください。');
  const b=panelBounds(panel),id='panel-image-'+Array.from(panel.id,c=>c.codePointAt(0)!.toString(16)).join('-'),raster=`<image href="${escape(resource.url)}" x="${b.x+image.offsetX}" y="${b.y+image.offsetY}" width="${image.width*image.scale}" height="${image.height*image.scale}" preserveAspectRatio="none"/>`;
  return(panel.clipImage??panel.kind==='normal')?`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${panelPath(panel)}"/></clipPath></defs><g clip-path="url(#${id})">${raster}</g>`:raster;
 };
 const mask=backgrounds.length&&normal.length&&!project.page?.showGutterBackground?`<defs><mask id="panel-gutter-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${project.width}" height="${project.height}"><rect width="100%" height="100%" fill="white"/>${normal.map(p=>`<path d="${panelPath(p)}" fill="black"/>`).join('')}</mask></defs><rect width="100%" height="100%" fill="${project.page!.backgroundColor}" mask="url(#panel-gutter-mask)"/>`:'';
 const content=backgrounds.map(render).join('')+panelArtworkSVG(project,'background')+mask+normal.map(render).join('');
 return panels.some(p=>p.image&&!(p.clipImage??p.kind==='normal'))?`<defs><clipPath id="panel-page-clip"><rect width="${project.width}" height="${project.height}"/></clipPath></defs><g clip-path="url(#panel-page-clip)">${content}</g>`:content;
}
