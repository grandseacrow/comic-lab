import{it,expect}from'vitest';
import{newPageDocument}from'../src/page-project';
import{newImageAsset,attachPanelImage,fitImage,scaleImage,moveImage,centerImage,pruneImageAssets,checkResourceBudget}from'../src/panel-images';
import{movePanel,resizePanel}from'../src/panels';
import{validateProject}from'../src/model';
import{recordHistory,undoProject,redoProject}from'../src/history';
it('fits cover/contain without stretching, and keeps the image center fixed during scale changes',()=>{
 let p=newPageDocument(1200,1800,{template:'four-grid'}).project;const asset=newImageAsset('wide.png',{width:1000,height:500,mime:'image/png'});p=attachPanelImage(p,p.panels![0].id,asset);const panel=p.panels![0],image=panel.image!;
 expect(image.scale).toBe(1.7);expect(image.offsetX).toBe(-575);expect(image.offsetY).toBe(0);
 const contained=fitImage(panel,image,'contain');expect(contained.scale).toBe(.55);expect(contained.offsetX).toBe(0);expect(contained.offsetY).toBe(287.5);
 const enlarged=scaleImage(contained,2);expect(enlarged.offsetX+enlarged.width*enlarged.scale/2).toBe(contained.offsetX+contained.width*contained.scale/2);expect(centerImage(panel,{...enlarged,offsetY:50}).offsetY).toBe(-75);
});
it('keeps relative image placement on frame movement/resize and moves only the image in image mode',()=>{
 let p=newPageDocument(1200,1800,{template:'four-grid'}).project;p=attachPanelImage(p,p.panels![0].id,newImageAsset('tall.jpg',{width:300,height:900,mime:'image/jpeg'}));const panel=p.panels![0],original=structuredClone(panel);
 expect(movePanel(panel,100,80,p).image).toEqual(panel.image);const resized=resizePanel(panel,'nw',20,50,p);expect(resized.image!.scale).toBe(panel.image!.scale);expect(resized.points[0][0]+resized.image!.offsetX).toBe(panel.points[0][0]+panel.image!.offsetX);expect(resized.points[0][1]+resized.image!.offsetY).toBe(panel.points[0][1]+panel.image!.offsetY);
 const changed=moveImage(panel,123,-45);expect(changed.points).toEqual(panel.points);expect(changed.image!.offsetX).toBe(panel.image!.offsetX+123);expect(changed.image!.offsetY).toBe(panel.image!.offsetY-45);expect(panel).toEqual(original);
});
it('restores import, replacement and removal through history and prunes only unused metadata',()=>{
 let p=newPageDocument(1200,1800,{template:'four-grid'}).project;const first=structuredClone(p),history={past:[],future:[]}as{past:typeof p[];future:typeof p[]},id=p.panels![0].id;
 recordHistory(history,p);p=attachPanelImage(p,id,newImageAsset('one.png',{width:500,height:500,mime:'image/png'}));const one=structuredClone(p);recordHistory(history,p);p=attachPanelImage(p,id,newImageAsset('two.webp',{width:600,height:300,mime:'image/webp'}));expect(p.assets).toHaveLength(1);
 recordHistory(history,p);p=pruneImageAssets({...p,panels:p.panels!.map(panel=>({...panel,image:null}))});expect(p.assets).toHaveLength(0);p=undoProject(history,p)!;expect(p.assets![0].name).toBe('two.webp');p=undoProject(history,p)!;expect(p).toEqual(one);p=undoProject(history,p)!;expect(p).toEqual(first);expect(redoProject(history,p)).toEqual(one);
});
it('rejects missing references, invalid scales, non-image paths, and resource budgets',()=>{
 let p=newPageDocument(1200,1800,{template:'four-grid'}).project;p=attachPanelImage(p,p.panels![0].id,newImageAsset('x.png',{width:100,height:100,mime:'image/png'}));
 for(const mutate of [(q:any)=>q.assets=[],(q:any)=>q.assets[0].path='../x.png',(q:any)=>q.panels[0].image.scale=0,(q:any)=>q.panels[0].image.offsetX=Infinity,(q:any)=>q.panels[0].image.width=999]){const q=structuredClone(p);mutate(q);expect(()=>validateProject(q)).toThrow();}
 expect(()=>checkResourceBudget({project:p,image:null,bytes:null},41*1024*1024,100)).toThrow('上限');expect(()=>checkResourceBudget({project:p,image:null,bytes:null},10,90_000_000)).toThrow('上限');
});
