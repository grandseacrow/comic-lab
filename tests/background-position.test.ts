import{it,expect,vi,afterEach}from'vitest';
import{newPageDocument}from'../src/page-project';import{attachPanelImage,newImageAsset,scaleImage,moveImage,panelImagesSVG}from'../src/panel-images';import{changePanelKind}from'../src/panel-operations';import{moveVertex}from'../src/panel-geometry';import{panelPath}from'../src/panels';import{artworkSVG,projectZip,readProject}from'../src/io';import{recordHistory,undoProject,redoProject}from'../src/history';
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const doc=newPageDocument(1200,1800,{template:'four-grid'}),asset=newImageAsset('source.png',{mime:'image/png',width:300,height:600});doc.project=attachPanelImage(doc.project,doc.project.panels![0].id,asset);doc.assets={[asset.id]:{bytes:new Uint8Array([137,80,78,71,1]),url:'data:image/png;base64,source',pixels:180000}};return doc;}
const placement=(svg:string)=>svg.match(/<image[^>]* x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/)!.slice(1).map(Number);
it.each(['position adjusted','enlarged','slanted']as const)('preserves background image placement and the visible selected-panel footprint: %s',mode=>{
 const doc=fixture();let panel=moveImage(doc.project.panels![0],35,80);if(mode==='enlarged')panel={...panel,image:scaleImage(panel.image!,panel.image!.scale*1.8)};if(mode==='slanted')panel=moveVertex(panel,0,70,90,doc.project);doc.project.panels![0]=panel;
 const before=structuredClone(panel),originalPlacement=placement(panelImagesSVG(doc.project,doc.assets)),history={past:[],future:[]}as{past:typeof doc.project[];future:typeof doc.project[]};recordHistory(history,doc.project);
 const background=changePanelKind(panel,'background');doc.project.panels![0]=background;const svg=panelImagesSVG(doc.project,doc.assets),mask=svg.match(/<mask[^>]*>[\s\S]*?<\/mask>/)![0];
 expect(background.points).toEqual(before.points);expect(background.image).toEqual(before.image);expect(background.borderVisible).toBe(false);expect(background.clipImage).toBe(false);expect(placement(svg)).toEqual(originalPlacement);
 // Regression: old code omitted this path, painting the correctly positioned image white.
 expect(mask).toContain(`<path d="${panelPath(background)}" fill="black"/>`);
 const restoredNormal=changePanelKind(background,'normal');expect(restoredNormal.points).toEqual(before.points);expect(restoredNormal.image).toEqual(before.image);doc.project.panels![0]=restoredNormal;expect(placement(panelImagesSVG(doc.project,doc.assets))).toEqual(originalPlacement);
 doc.project.panels![0]=background;const undo=undoProject(history,doc.project)!;expect(undo.panels![0]).toEqual(before);expect(redoProject(history,undo)!.panels![0]).toEqual(background);
});
it('changes only the clipping region and border, never the raster origin, at every clip/border combination',()=>{
 const doc=fixture();let p=moveVertex(doc.project.panels![0],1,-80,90,doc.project);p=changePanelKind(moveImage(p,-25,55),'background');doc.project.panels![0]=p;const expected=placement(panelImagesSVG(doc.project,doc.assets));
 for(const clipImage of [false,true])for(const borderVisible of [false,true]){doc.project.panels![0]={...p,clipImage,borderVisible};const svg=panelImagesSVG(doc.project,doc.assets);expect(placement(svg)).toEqual(expected);expect(svg.includes('id="panel-image-')).toBe(clipImage);expect(svg.match(/<mask[^>]*>[\s\S]*?<\/mask>/)![0]).toContain(panelPath(p));}
});
it('restores the adjusted background image, clip and polygon through an actual ZIP file with identical artwork',async()=>{
 const doc=fixture();let p=moveImage(doc.project.panels![0],-55,75);p={...p,image:scaleImage(p.image!,p.image!.scale*1.4)};p=moveVertex(p,0,50,65,doc.project);doc.project.panels![0]={...changePanelKind(p,'background'),clipImage:true};const svg=artworkSVG(doc.project,null,doc.assets);
 class Reader{result='data:image/png;base64,source';onload=()=>{};readAsDataURL(){this.onload();}}class Image{naturalWidth=300;naturalHeight=600;onload=()=>{};set src(_:string){this.onload();}}vi.stubGlobal('FileReader',Reader);vi.stubGlobal('Image',Image);
 const data=projectZip(doc),loaded=await readProject(new File([data as BlobPart],'background.zip'));expect(loaded).toEqual(doc);expect(artworkSVG(loaded.project,null,loaded.assets)).toBe(svg);expect(placement(artworkSVG(loaded.project,null,loaded.assets))).toEqual(placement(svg));
});
