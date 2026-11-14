import {it,expect,beforeAll,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {newPageDocument} from '../src/page-project';
import {emptyDocument,newBalloon,validateProject} from '../src/model';
import {artworkSVG,projectZip,readProject,exportPNG} from '../src/io';
import {registerFont} from '../src/typography';
import {dialoguesJSON,parseDialoguesJSON,applyDialogues} from '../src/dialogues';
import {panelPath} from '../src/panels';
beforeAll(()=>registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf')));
afterEach(()=>vi.unstubAllGlobals());
it('round-trips actual version2 ZIP files with panels and every dialogue kind and preserves the final artwork',async()=>{
 const doc=newPageDocument(1800,1200,{template:'four-grid',backgroundColor:'#edf4ff',margin:60,gutter:30});
 doc.project.balloons=(['ellipse','rounded','text','zigzag']as const).map((kind,i)=>{const b=newBalloon(kind,1800,1200,i);b.panelId=null;b.bodyRotation=23;b.textRotation=-15;b.style.decoration.outline.enabled=true;b.style.decoration.shadow.enabled=true;b.clip.enabled=i===3;return b;});
 doc.project.panels![0].borderWidth=9;doc.project.panels![1].borderVisible=false;
 const svg=artworkSVG(doc.project,null),zip=projectZip(doc),restored=await readProject(new File([zip as BlobPart],'page.zip'));
 expect(restored).toEqual(doc);expect(artworkSVG(restored.project,null)).toBe(svg);
 expect(svg.indexOf('fill="#edf4ff"')).toBeLessThan(svg.indexOf(panelPath(doc.project.panels![0])));
 expect(svg.indexOf(panelPath(doc.project.panels![0]))).toBeLessThan(svg.indexOf('clipPath'));
 expect(svg).not.toContain(panelPath(doc.project.panels![1]));expect(svg).not.toMatch(/panel-selection|stroke-dasharray|サイズ変更|pointer-events/);
 expect(svg).toContain('width="1800" height="1200"');
 const dialogue=JSON.parse(dialoguesJSON(doc.project));expect(dialogue).not.toHaveProperty('page');expect(dialogue).not.toHaveProperty('panels');
 expect(applyDialogues(doc.project,parseDialoguesJSON(JSON.stringify(dialogue)),'keep')).toEqual(doc.project);
});
it('exports the same artwork through the browser Canvas pipeline at page pixel resolution',async()=>{
 const doc=newPageDocument(1200,1800,{template:'two-horizontal'}),result=new Blob(['png-result'],{type:'image/png'});let svgBlob:Blob|undefined;
 const drawImage=vi.fn(),canvas={width:0,height:0,getContext:()=>({drawImage}),toBlob:(callback:(b:Blob)=>void,mime:string)=>{expect(mime).toBe('image/png');callback(result);}};
 class MockImage{onload=()=>{};set src(_:string){this.onload();}}
 vi.stubGlobal('Image',MockImage);vi.stubGlobal('document',{createElement:(tag:string)=>{expect(tag).toBe('canvas');return canvas;}});
 vi.stubGlobal('URL',{createObjectURL:(b:Blob)=>{svgBlob=b;return'blob:page-artwork';},revokeObjectURL:vi.fn()});
 expect(await exportPNG(doc)).toBe(result);expect(canvas.width).toBe(1200);expect(canvas.height).toBe(1800);expect(drawImage).toHaveBeenCalledTimes(1);expect(await svgBlob!.text()).toBe(artworkSVG(doc.project,null));
});
it('rejects unsupported or malformed page panels before replacing a document',()=>{
 const p=newPageDocument(1200,1800,{template:'four-grid'}).project;
 for(const patch of [{kind:'future'},{points:[[0,0],[100,10],[100,100],[0,100]]},{borderColor:'<script>'},{borderWidth:-1},{order:1}]){const invalid=structuredClone(p);Object.assign(invalid.panels![0],patch);expect(()=>validateProject(invalid)).toThrow();}
 expect(p.panels![0].kind).toBe('normal');
});

it('loads a legacy image ZIP through the existing decoder without adding new page fields or altering image bytes',async()=>{
 const doc=emptyDocument();doc.project.background={path:'assets/background.png',mime:'image/png',name:'legacy.png'};doc.bytes=new Uint8Array([137,80,78,71,0,10,20,30]);doc.image='data:image/png;base64,legacy';doc.project.balloons=[newBalloon('rounded',1000,1400,0)];
 class Reader{result=doc.image;onload=()=>{};readAsDataURL(){this.onload();}}
 class MockImage{naturalWidth=1000;naturalHeight=1400;onload=()=>{};set src(_:string){this.onload();}}
 vi.stubGlobal('FileReader',Reader);vi.stubGlobal('Image',MockImage);
 const restored=await readProject(new File([projectZip(doc) as BlobPart],'v155.zip'));
 expect(restored).toEqual(doc);expect(restored.project.version).toBe(1);expect(restored.project).not.toHaveProperty('page');expect(restored.project).not.toHaveProperty('panels');expect(restored.project.balloons[0]).not.toHaveProperty('panelId');
});
