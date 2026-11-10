import type { Balloon, Project } from './model';
import { validateProject } from './model';
export type DialoguesData={format:'comic-lab-dialogues';version:1;width:number;height:number;balloons:Balloon[]};
export type ImportSizing='keep'|'scale';
export const MAX_DIALOGUES_BYTES=5*1024*1024;
function validateLayers(width:number,height:number,balloons:unknown):Project{
 return validateProject({id:'dialogues',version:1,title:'',width,height,background:null,balloons});
}
export function dialoguesJSON(project:Project):string{
 const {width,height,balloons}=validateLayers(project.width,project.height,project.balloons);
 const text=JSON.stringify({format:'comic-lab-dialogues',version:1,width,height,balloons} satisfies DialoguesData,null,2);
 if(new TextEncoder().encode(text).length>MAX_DIALOGUES_BYTES)throw new Error('セリフ設定が5MBを超えるためJSON保存できません。内容を減らすか、プロジェクトZIPを保存してください。');
 return text;
}
export function parseDialoguesJSON(text:string):DialoguesData{
 if(new TextEncoder().encode(text).length>MAX_DIALOGUES_BYTES)throw new Error('セリフ設定JSONは5MB以下にしてください。');
 let raw:unknown;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('JSONの構文が正しくありません。JSONファイルを選択してください。');}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('セリフ設定JSONのルートはオブジェクトである必要があります。');
 const data=raw as Record<string,unknown>;
 if(data.format!=='comic-lab-dialogues')throw new Error('セリフ設定JSONの形式識別子が一致しません。ZIPプロジェクトは「プロジェクトを開く」で読み込んでください。');
 if(data.version!==1)throw new Error('対応していないセリフ設定JSONのバージョンです（対応：1）。');
 if(typeof data.width!=='number'||typeof data.height!=='number'||!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<1||data.height<1||data.width>20000||data.height>20000||data.width*data.height>20_000_000)throw new Error('元画像の幅・高さが不足しているか、対応範囲外です。');
 if(!Array.isArray(data.balloons))throw new Error('必須のオブジェクト一覧（balloons）がありません。');
 if(data.balloons.length>200)throw new Error('オブジェクトは200個まで読み込めます。');
 const ids=new Set<string>();
 data.balloons.forEach((item,i)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`オブジェクト${i+1}のデータが不正です。`);
  if(!['ellipse','rounded','text'].includes(item.kind))throw new Error(`オブジェクト${i+1}の種類に対応していません。`);
  for(const field of ['id','x','y','width','height','text','style','tail','fill','stroke','strokeWidth'])if(!Object.hasOwn(item,field))throw new Error(`オブジェクト${i+1}に必須項目「${field}」がありません。`);
  if(typeof item.id==='string'){if(ids.has(item.id))throw new Error('オブジェクトIDが重複しています。');ids.add(item.id);}
 });
 let project:Project;try{project=validateLayers(data.width,data.height,data.balloons);}catch{throw new Error('オブジェクトの座標・サイズ・書式・装飾・しっぽなどに不正な値があります。');}
 return{format:'comic-lab-dialogues',version:1,width:project.width,height:project.height,balloons:project.balloons};
}
export function applyDialogues(project:Project,data:DialoguesData,sizing:ImportSizing):Project{
 // Reuse the project validator and migrations; never change the background or viewport.
 const imported=validateLayers(data.width,data.height,data.balloons);
 const balloons=structuredClone(imported.balloons);
 if(sizing==='scale'&&(data.width!==project.width||data.height!==project.height)){
  const sx=project.width/data.width,sy=project.height/data.height,s=Math.sqrt(sx*sy);
  for(const b of balloons){
   b.x*=sx;b.y*=sy;b.width*=sx;b.height*=sy;
   b.textFrame.x*=sx;b.textFrame.y*=sy;b.textFrame.width*=sx;b.textFrame.height*=sy;
   b.strokeWidth*=s;b.style.size*=s;b.style.spacing*=s;b.style.padding*=s;
   b.style.decoration.outline.width*=s;
   b.style.decoration.shadow.x*=sx;b.style.decoration.shadow.y*=sy;b.style.decoration.shadow.blur*=s;
   // A/B/P are normalized to the balloon; their world positions scale with it.
  }
 }
 try{return validateProject({...project,balloons});}catch{throw new Error('比例変換後の座標・サイズ・装飾が対応範囲を超えます。「座標そのまま」を選ぶか、元画像と同じ寸法で読み込んでください。');}
}
