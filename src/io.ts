import { zipSync, strToU8, strFromU8, Unzip, UnzipInflate } from 'fflate';
import type { Document, Project } from './model';
import { validateProject } from './model';
import { ensureFont, layoutText } from './typography';
import { balloonPath } from './geometry';
import { textArtworkSVG } from './text-artwork';
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export function projectZip(doc:Document):Uint8Array{
 const files:Record<string,Uint8Array>={'project.json':strToU8(JSON.stringify(doc.project,null,2))};
 if(doc.project.background&&doc.bytes)files[doc.project.background.path]=doc.bytes;
 return zipSync(files,{level:0});
}
export function unzipBounded(data:Uint8Array):Promise<Record<string,Uint8Array>>{
 return new Promise((resolve,reject)=>{
 let count=0,total=0,active=0,finished=false,failed=false;
 const files:Record<string,Uint8Array>=Object.create(null);
 const fail=(error:Error)=>{failed=true;reject(error);};
 const done=()=>{if(finished&&active===0&&!failed)resolve(files);};
 const unzip=new Unzip(file=>{
  if(failed)return;
  if(++count>10 || file.name.includes('..') || file.name.startsWith('/') || !/^(project\.json|assets\/background\.(png|jpg|webp))$/.test(file.name) || Object.hasOwn(files,file.name) || (file.originalSize??0)>100*1024*1024){fail(new Error('ZIPの内容が対応形式ではないか、上限を超えています。'));return;}
  files[file.name]=new Uint8Array();active++;const chunks:Uint8Array[]=[];let size=0;
  file.ondata=(error,chunk,final)=>{
   if(failed)return;
   if(error){fail(error);return;}
   size+=chunk.length;total+=chunk.length;
   if(total>100*1024*1024 || (file.name==='project.json'&&size>5*1024*1024)){file.terminate();fail(new Error('ZIP展開後のデータが上限を超えています。'));return;}
   chunks.push(chunk);
   if(final){const output=new Uint8Array(size);let at=0;for(const part of chunks){output.set(part,at);at+=part.length;}files[file.name]=output;active--;done();}
  };file.start();
 });
 unzip.register(UnzipInflate);
 try{for(let i=0;i<data.length&&!failed;i+=65536)unzip.push(data.subarray(i,i+65536),i+65536>=data.length);finished=true;done();}catch(error){fail(error as Error);}
 });
}
export function blobDataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('ファイルを読み込めませんでした。'));reader.readAsDataURL(blob);});}
export function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('画像を読み込めませんでした。PNG・JPEG・WebPを選んでください。'));img.src=src;});}
export function detectMime(bytes:Uint8Array):string{
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(strFromU8(bytes.subarray(0,4))==='RIFF'&&strFromU8(bytes.subarray(8,12))==='WEBP')return'image/webp';
 throw new Error('PNG・JPEG・WebP形式の画像を選んでください。');
}
export async function decodeImage(bytes:Uint8Array){
 const mime=detectMime(bytes),url=await blobDataURL(new Blob([bytes as BlobPart],{type:mime}));const img=await loadImage(url);
 if(img.naturalWidth*img.naturalHeight>20_000_000 || img.naturalWidth>20000 || img.naturalHeight>20000)throw new Error('画像は2,000万画素・一辺20,000px以下にしてください。');
 return{mime,url,width:img.naturalWidth,height:img.naturalHeight};
}
export async function readProject(file:File):Promise<Document>{
 if(file.size>50*1024*1024)throw new Error('プロジェクトファイルは50MB以下にしてください。');
 const files=await unzipBounded(new Uint8Array(await file.arrayBuffer()));
 if(!files['project.json'])throw new Error('project.jsonが見つかりません。');
 let raw:unknown;try{raw=JSON.parse(strFromU8(files['project.json']));}catch{throw new Error('project.jsonが正しいJSONではありません。');}
 const project=validateProject(raw);let bytes:Uint8Array|null=null,image:string|null=null;
 if(project.background){bytes=files[project.background.path];if(!bytes)throw new Error('元の背景画像がZIPに含まれていません。');const decoded=await decodeImage(bytes);if(decoded.width!==project.width||decoded.height!==project.height||decoded.mime!==project.background.mime)throw new Error('背景画像と原稿情報が一致しません。');image=decoded.url;}
 await Promise.all([...new Set(project.balloons.map(b=>b.style.family))].map(ensureFont));
 return{project,bytes,image};
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function artworkSVG(project:Project,image:string|null){
 const background=image?`<image href="${escape(image)}" width="${project.width}" height="${project.height}"/>`:'<rect width="100%" height="100%" fill="white"/>';
 const layers=project.balloons.map(b=>{return`<g transform="translate(${b.x} ${b.y})">${b.kind==='text'?'':`<path d="${balloonPath(b)}" fill="${b.fill}" stroke="${b.stroke}" stroke-width="${b.strokeWidth}" stroke-linejoin="round"/>`}${textArtworkSVG(b)}</g>`;}).join('');
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${project.width}" height="${project.height}" viewBox="0 0 ${project.width} ${project.height}">${background}${layers}</svg>`;
}
export async function exportPNG(doc:Document):Promise<Blob>{
 await Promise.all([...new Set(doc.project.balloons.map(b=>b.style.family))].map(ensureFont));
 if(doc.project.balloons.some(b=>layoutText(b).missing))throw new Error('フォントに含まれない文字があります。絵文字などを修正してから書き出してください。');
 const url=URL.createObjectURL(new Blob([artworkSVG(doc.project,doc.image)],{type:'image/svg+xml'}));
 try{const img=await loadImage(url);const canvas=document.createElement('canvas');canvas.width=doc.project.width;canvas.height=doc.project.height;const context=canvas.getContext('2d');if(!context)throw new Error('画像出力用Canvasを作成できませんでした。');context.drawImage(img,0,0);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNGの生成に失敗しました。')),'image/png'));}finally{URL.revokeObjectURL(url);}
}
