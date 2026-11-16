import{it,expect,vi,afterEach}from'vitest';
import{newPageDocument}from'../src/page-project';import{attachPanelImage,newImageAsset,panelImagesSVG,pruneImageAssets}from'../src/panel-images';import{projectZip,readProject,unzipBounded,artworkSVG}from'../src/io';import{zipSync,strToU8}from'fflate';import{dialoguesJSON,parseDialoguesJSON,applyDialogues}from'../src/dialogues';
afterEach(()=>vi.unstubAllGlobals());
function decoder(){class Reader{result='data:image/png;base64,source';onload=()=>{};readAsDataURL(){this.onload();}}class Image{naturalWidth=100;naturalHeight=50;onload=()=>{};set src(_:string){this.onload();}}vi.stubGlobal('FileReader',Reader);vi.stubGlobal('Image',Image);}
const bytes=new Uint8Array([137,80,78,71,1,2,3]);
function fixture(){const doc=newPageDocument(1200,1800,{template:'four-grid'}),asset=newImageAsset('same.png',{width:100,height:50,mime:'image/png'});doc.project=attachPanelImage(doc.project,doc.project.panels![0].id,asset);doc.project=attachPanelImage(doc.project,doc.project.panels![1].id,asset);doc.assets={[asset.id]:{bytes,url:'data:image/png;base64,source',pixels:5000}};return{doc,asset};}
it('stores shared source bytes once, restores exact relative transforms, and leaves dialogue JSON dialogue-only',async()=>{
 decoder();const{doc,asset}=fixture();doc.project.panels![1].image!.offsetX=-30;doc.project.panels![1].image!.scale=2.2;
 const data=projectZip(doc),files=await unzipBounded(data);expect(Object.keys(files)).toEqual(['project.json',asset.path]);expect(files[asset.path]).toEqual(bytes);
 const restored=await readProject(new File([data as BlobPart],'images.zip'));expect(restored).toEqual(doc);expect(artworkSVG(restored.project,null,restored.assets)).toBe(artworkSVG(doc.project,null,doc.assets));
 const json=dialoguesJSON(doc.project);expect(JSON.parse(json)).not.toHaveProperty('assets');expect(JSON.parse(json)).not.toHaveProperty('panels');expect(applyDialogues(doc.project,parseDialoguesJSON(json),'keep')).toEqual(doc.project);
 // Deleted sources stay in the runtime cache for Undo, but are not written to ZIP.
 doc.project=pruneImageAssets({...doc.project,panels:doc.project.panels!.map(p=>({...p,image:null}))});const empty=await unzipBounded(projectZip(doc));expect(Object.keys(empty)).toEqual(['project.json']);expect(doc.assets![asset.id].bytes).toEqual(bytes);
});
it('rejects missing, corrupt, and dimension-mismatched image resources atomically',async()=>{
 decoder();const{doc,asset}=fixture(),json=strToU8(JSON.stringify(doc.project));
 for(const resource of [undefined,new Uint8Array([0,1,2])]){const files:Record<string,Uint8Array>={'project.json':json};if(resource)files[asset.path]=resource;await expect(readProject(new File([zipSync(files)as BlobPart],'broken.zip'))).rejects.toThrow();}
 const p=structuredClone(doc.project);p.assets![0].width=101;for(const panel of p.panels!)if(panel.image)panel.image.width=101;await expect(readProject(new File([zipSync({'project.json':strToU8(JSON.stringify(p)),[asset.path]:bytes})as BlobPart],'mismatch.zip'))).rejects.toThrow('一致');expect(doc.assets![asset.id].bytes).toEqual(bytes);
});
it('uses polygon-derived clipping for images, then draws every frame above every image',()=>{
 const{doc}=fixture(),svg=artworkSVG(doc.project,null,doc.assets);expect(panelImagesSVG(doc.project,doc.assets)).toContain('<clipPath');expect(svg).toContain('clip-path="url(#panel-image-');expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('stroke="#222222"'));expect(svg).not.toContain('panel-selection');expect(svg).not.toContain('pointer-events');
});
it('passes embedded panel images and clipping to the actual PNG export pipeline at original page resolution',async()=>{
 const{doc}=fixture();let captured:Blob|undefined;const drawImage=vi.fn(),result=new Blob(['png'],{type:'image/png'}),canvas={width:0,height:0,getContext:()=>({drawImage}),toBlob:(done:(b:Blob)=>void)=>done(result)};
 class Image{onload=()=>{};set src(_:string){this.onload();}}
 vi.stubGlobal('Image',Image);vi.stubGlobal('document',{createElement:()=>canvas});vi.stubGlobal('URL',{createObjectURL:(b:Blob)=>{captured=b;return'blob:export';},revokeObjectURL:vi.fn()});
 const{exportPNG}=await import('../src/io');expect(await exportPNG(doc)).toBe(result);expect(await captured!.text()).toBe(artworkSVG(doc.project,null,doc.assets));expect(canvas.width).toBe(1200);expect(canvas.height).toBe(1800);expect(drawImage).toHaveBeenCalledOnce();
});
