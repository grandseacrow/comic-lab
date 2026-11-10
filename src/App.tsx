import { useEffect, useRef, useState, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, Download, FileArchive, FolderOpen, Hand, ImagePlus, Layers, LoaderCircle, Maximize, Minus, MousePointer2, Plus, Redo2, Sparkles, Trash2, Type, Undo2, X, CircleHelp, Circle, Square, AlertCircle, BookOpen } from 'lucide-react';
import type { Balloon, Document as ComicDocument, Point, Project, TextStyle, TextDecoration } from './model';
import { validateProject, defaultTextFrame, emptyDocument, newBalloon, uid } from './model';
import { recordHistory, undoProject, redoProject } from './history';
import { moveBalloon, resizeTextFrame } from './editing';
import type { EditTarget } from './editing';
import { boundaryPoint } from './geometry';
import { dialoguesJSON, parseDialoguesJSON, applyDialogues, MAX_DIALOGUES_BYTES,dialogueSummary } from './dialogues';
import type { DialoguesData, ImportSizing } from './dialogues';
import {objectArtworkSVG} from './object-artwork';
import {rotationCenter,rotateObject,rotateVector,worldToBody,resizeBody,textTransform,normalizeAngle} from './transforms';
import {SelectionOverlay} from './SelectionOverlay';
import type {DragAction} from './SelectionOverlay';
import { ensureFont, layoutText } from './typography';
import { blobDataURL, decodeImage, download, exportPNG, loadImage, projectZip, readProject } from './io';
import{moveClip,resizeClip}from'./clipping';
import type{ClipCorner}from'./clipping';
import {PropertiesPanel} from './PropertiesPanel';
import{APP_VERSION}from'./version';
import './style.css';
const initial = emptyDocument();
const signature=(p:Project)=>JSON.stringify(p);
function IconButton({children,label,onClick,disabled,active}:{children:ReactNode;label:string;onClick:()=>void;disabled?:boolean;active?:boolean}){return <button className={`icon-button ${active?'active':''}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;}
export default function App(){
 const [doc,setDoc]=useState<ComicDocument>(initial),ref=useRef(doc);ref.current=doc;
 const [selected,setSelected]=useState<string|null>(null),[zoom,setZoom]=useState(.5),[mode,setMode]=useState<'select'|'pan'>('select');
 const [editTarget,setEditTarget]=useState<EditTarget>('body'),[textFocused,setTextFocused]=useState(false);
 const [clipEditing,setClipEditing]=useState(false);
 useEffect(()=>setClipEditing(false),[selected]);
 const [panel,setPanel]=useState<'tools'|'properties'|null>(null),[help,setHelp]=useState(false);
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[fontRevision,setFontRevision]=useState(0),[fontLoading,setFontLoading]=useState(true);
 const [pendingDialogues,setPendingDialogues]=useState<{data:DialoguesData;projectId:string}|null>(null),[importSizing,setImportSizing]=useState<ImportSizing>('scale'),[dialogueError,setDialogueError]=useState('');
 const jsonInput=useRef<HTMLInputElement>(null),dialogueModal=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(pendingDialogues)dialogueModal.current?.focus();},[pendingDialogues]);
 const [saved,setSaved]=useState(signature(initial.project));
 const history=useRef<{past:Project[];future:Project[]}>({past:[],future:[]});const [,refresh]=useState(0);
 const viewport=useRef<HTMLDivElement>(null),svgRef=useRef<SVGSVGElement>(null),imageInput=useRef<HTMLInputElement>(null),projectInput=useRef<HTMLInputElement>(null);
 const space=useRef(false),textSnapshot=useRef<Project|null>(null);
 const drag=useRef<{type:DragAction|'pan'; target?:EditTarget; id?:string; start:Point; original?:Balloon; scroll?:Point; changed:boolean}|null>(null);
 const dirty=signature(doc.project)!==saved;
 const b=doc.project.balloons.find(item=>item.id===selected);
 const textEditing=!!b&&(b.kind==='text'||editTarget==='text'||textFocused);
 const pushHistory=(p:Project)=>{recordHistory(history.current,p);refresh(v=>v+1);};
 const apply=(project:Project,record=true)=>{if(signature(project)===signature(ref.current.project))return;try{for(const item of project.balloons)if(ref.current.project.balloons.find(b=>b.id===item.id)!==item)validateProject({...project,balloons:[item]});}catch{setError('操作後の座標・サイズが対応範囲を超えるため、変更を適用しませんでした。');return;}if(record)pushHistory(ref.current.project);const next={...ref.current,project};ref.current=next;setDoc(next);};
 const update=(patch:Partial<Balloon>,record=true)=>{const current=ref.current.project;apply({...current,balloons:current.balloons.map(item=>item.id===selected?{...item,...patch}:item)},record);};
 const style=(patch:Partial<TextStyle>)=>{if(b)update({style:{...b.style,...patch}});};
 const outline=(patch:Partial<TextDecoration['outline']>)=>{if(b)style({decoration:{...b.style.decoration,outline:{...b.style.decoration.outline,...patch}}});};
 const shadow=(patch:Partial<TextDecoration['shadow']>)=>{if(b)style({decoration:{...b.style.decoration,shadow:{...b.style.decoration.shadow,...patch}}});};
 const undo=()=>{const p=undoProject(history.current,ref.current.project);if(!p)return;const next={...ref.current,project:p};ref.current=next;setDoc(next);setSelected(null);refresh(v=>v+1);};
 const redo=()=>{const p=redoProject(history.current,ref.current.project);if(!p)return;const next={...ref.current,project:p};ref.current=next;setDoc(next);setSelected(null);refresh(v=>v+1);};
 const remove=()=>{if(!selected)return;apply({...ref.current.project,balloons:ref.current.project.balloons.filter(item=>item.id!==selected)});setSelected(null);};
 const duplicate=()=>{if(!b)return;if(doc.project.balloons.length>=200){setError('オブジェクトは200個まで配置できます。');return;}const item=structuredClone(b);item.id=uid();item.x=Math.min(40000,item.x+24);item.y=Math.min(40000,item.y+24);item.clip.x+=item.x-b.x;item.clip.y+=item.y-b.y;apply({...doc.project,balloons:[...doc.project.balloons,item]});setSelected(item.id);};
 const reorder=(direction:number)=>{const items=[...doc.project.balloons],index=items.findIndex(item=>item.id===selected),next=index+direction;if(index<0||next<0||next>=items.length)return;[items[index],items[next]]=[items[next],items[index]];apply({...doc.project,balloons:items});};
 const fit=useCallback(()=>{const el=viewport.current;if(!el)return;const p=ref.current.project;setZoom(Math.min(2,Math.max(.05,Math.min((el.clientWidth-100)/p.width,(el.clientHeight-100)/p.height))));el.scrollTo(0,0);},[]);
 useEffect(()=>{const id=setTimeout(fit,50);return()=>clearTimeout(id);},[fit,doc.project.id]);
 useEffect(()=>{let cancelled=false;ensureFont('sans').then(()=>{if(!cancelled){setFontRevision(v=>v+1);setFontLoading(false);}}).catch(e=>{if(!cancelled){setFontLoading(false);setError(e.message);}});return()=>{cancelled=true;};},[]);
 useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(id);},[notice]);
 const add=(kind:Balloon['kind'])=>{if(!doc.image){setNotice('最初に漫画画像を読み込むか、サンプルを開いてください。');return;}if(doc.project.balloons.length>=200){setError('オブジェクトは200個まで配置できます。');return;}const item=newBalloon(kind,doc.project.width,doc.project.height,doc.project.balloons.length);apply({...doc.project,balloons:[...doc.project.balloons,item]});setSelected(item.id);setMode('select');if(innerWidth<1100)setPanel('properties');};
 const guard=()=>!dirty||window.confirm('未保存の変更があります。保存せずに別の原稿を開きますか？');
 const run=async(label:string,task:()=>Promise<void>)=>{setBusy(label);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:'処理に失敗しました。現在の編集内容は保持されています。');}finally{setBusy('');}};
 const replace=(next:ComicDocument,isSaved:boolean)=>{ref.current=next;setDoc(next);history.current={past:[],future:[]};setSelected(null);setSaved(isSaved?signature(next.project):'');refresh(v=>v+1);setPanel(null);};
 const importImage=async(file:File)=>{if(!guard())return;await run('画像を読み込み中',async()=>{if(file.size>50*1024*1024)throw new Error('画像は50MB以下にしてください。');const bytes=new Uint8Array(await file.arrayBuffer()),image=await decodeImage(bytes);const ext=image.mime==='image/jpeg'?'jpg':image.mime==='image/webp'?'webp':'png';const p:Project={id:uid(),version:1,title:file.name.replace(/\.[^.]+$/,'').slice(0,200),width:image.width,height:image.height,background:{path:`assets/background.${ext}`,mime:image.mime,name:file.name},balloons:[]};replace({project:p,image:image.url,bytes},false);setNotice('画像を読み込みました。吹き出しを追加しましょう。');});};
 const importProject=async(file:File)=>{if(!guard())return;await run('プロジェクトを復元中',async()=>{const next=await readProject(file);replace(next,true);setFontRevision(v=>v+1);setNotice('プロジェクトを復元しました。');});};
 const save=()=>run('プロジェクトを保存中',async()=>{const current=ref.current;download(new Blob([projectZip(current) as BlobPart],{type:'application/zip'}),`${current.project.title||'comic-lab'}-project.zip`);setSaved(signature(current.project));setNotice('画像と編集データをZIPに保存しました。');});
 const exportImage=()=>run('PNGを書き出し中',async()=>{const current=ref.current;const result=await exportPNG(current);download(result,`${current.project.title||'comic-lab'}.png`);setNotice(`${current.project.width} × ${current.project.height}pxでPNGを書き出しました。`);});
 const saveDialogues=()=>run('セリフ設定JSONを作成中',async()=>{const json=dialoguesJSON(ref.current.project),summary=dialogueSummary(parseDialoguesJSON(json));download(new Blob([json],{type:'application/json'}),`comic-lab-dialogues-v${APP_VERSION}.json`);setNotice(`JSON保存：${summary.objects}個（ギザギザ${summary.zigzag}個・トリミング${summary.clipped}個）。復元検証済み。`);});
 const readDialogues=async(file:File)=>{
  if(!ref.current.image){setError('先に背景画像を読み込んでから、セリフ設定JSONを開いてください。');return;}
  const projectId=ref.current.project.id;
  await run('セリフ設定JSONを確認中',async()=>{
   if(file.size>MAX_DIALOGUES_BYTES)throw new Error('セリフ設定JSONは5MB以下にしてください。');
   const data=parseDialoguesJSON(await file.text());
   await Promise.all([...new Set(data.balloons.map(item=>item.style.family))].map(ensureFont));
   if(ref.current.project.id!==projectId)throw new Error('原稿が変更されたため、JSON読込を中止しました。もう一度選択してください。');
   setFontRevision(v=>v+1);setImportSizing('scale');setDialogueError('');setPendingDialogues({data,projectId});
  });
 };
 const confirmDialogues=()=>{
  if(!pendingDialogues)return;
  try{
   if(ref.current.project.id!==pendingDialogues.projectId)throw new Error('原稿が変更されています。キャンセルしてJSONを選び直してください。');
   const next=applyDialogues(ref.current.project,pendingDialogues.data,importSizing);
   apply(next);setSelected(null);setPendingDialogues(null);setPanel(null);setNotice('セリフ設定を置き換えました。取り消しで元に戻せます。');
  }catch(e){setDialogueError(e instanceof Error?e.message:'セリフ設定を読み込めませんでした。');}
 };
 const loadFamily=(family:'sans'|'serif')=>run('フォントを読み込み中',async()=>{await ensureFont(family);const current=ref.current.project;apply({...current,balloons:current.balloons.map(item=>item.id===selected?{...item,style:{...item.style,family}}:item)});setFontRevision(v=>v+1);});
 useEffect(()=>{
 const key=(event:KeyboardEvent)=>{if(pendingDialogues){if(event.key==='Escape')setPendingDialogues(null);if((event.ctrlKey||event.metaKey)&&['s','z','y','d'].includes(event.key.toLowerCase()))event.preventDefault();return;}const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(event.code==='Space'){event.preventDefault();space.current=true;}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(ref.current.image)void save();}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){event.preventDefault();duplicate();}
 if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove();}
 if(event.key==='Escape'){setSelected(null);setPanel(null);setHelp(false);}
 };
 const up=(event:KeyboardEvent)=>{if(event.code==='Space')space.current=false;};
 const blur=()=>{space.current=false;};
 window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
 return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
 });
 const point=(event:ReactPointerEvent):Point=>{const rect=svgRef.current!.getBoundingClientRect();return{x:(event.clientX-rect.left)/zoom,y:(event.clientY-rect.top)/zoom};};
 const start=(event:ReactPointerEvent,type:DragAction,item:Balloon)=>{if(mode==='pan'||space.current)return;event.preventDefault();event.stopPropagation();const target=item.kind==='text'?'text':editTarget;setSelected(item.id);if(item.kind==='text'&&type==='move')type='text-move';if(type==='move'&&target==='text')return;if(item.kind!=='text')setEditTarget(type==='text-move'||type==='text-resize'?'text':target);event.currentTarget.setPointerCapture(event.pointerId);drag.current={type,target,id:item.id,start:point(event),original:structuredClone(item),changed:false};};
 const move=(event:ReactPointerEvent)=>{const d=drag.current;if(!d)return;
 if(d.type==='pan'){viewport.current!.scrollLeft=d.scroll!.x-(event.clientX-d.start.x);viewport.current!.scrollTop=d.scroll!.y-(event.clientY-d.start.y);return;}
 const pt=point(event),dx=pt.x-d.start.x,dy=pt.y-d.start.y,original=d.original!;let changed=structuredClone(original);
 if(d.type==='clip-move')changed=moveClip(original,dx,dy);
 if(d.type.startsWith('clip-')&&d.type!=='clip-move')changed=resizeClip(original,d.type.slice(5)as ClipCorner,dx,dy);
 if(d.type==='move')changed=moveBalloon(original,dx,dy,d.target||'group');
 if(d.type==='text-move')changed=moveBalloon(original,dx,dy,'text');
 if(d.type==='text-resize'){const local=rotateVector({x:dx,y:dy},-original.textRotation);changed=resizeTextFrame(original,local.x,local.y);}
 if(d.type==='resize'){const local=rotateVector({x:dx,y:dy},-original.bodyRotation);changed=resizeBody(original,local.x,local.y,d.target||'body');}
 if(d.type==='rotate'){const c=rotationCenter(original,d.target||'body'),a=Math.atan2(d.start.y-c.y,d.start.x-c.x),now=Math.atan2(pt.y-c.y,pt.x-c.x);changed=rotateObject(original,normalizeAngle((now-a)*180/Math.PI),d.target||'body');}
 if(d.type==='a'||d.type==='b'||d.type==='p'){const unrotated=worldToBody(original,pt),local={x:unrotated.x/original.width,y:unrotated.y/original.height};const bounded={x:Math.max(-20,Math.min(20,local.x)),y:Math.max(-20,Math.min(20,local.y))};changed.tail[d.type]=d.type==='p'?bounded:boundaryPoint(changed,bounded);}
 try{validateProject({...ref.current.project,balloons:[changed]});}catch{setError('座標・サイズが対応範囲を超えるため、変更を適用しませんでした。');return;}
 if(!d.changed){if(Math.abs(dx)+Math.abs(dy)<.5)return;pushHistory(ref.current.project);d.changed=true;}
 const project=ref.current.project;apply({...project,balloons:project.balloons.map(item=>item.id===d.id?changed:item)},false);
 };
 const end=()=>{drag.current=null;};
 const startPan=(event:ReactPointerEvent)=>{if(mode!=='pan'&&!space.current&&event.button!==1){if(event.target===event.currentTarget)setSelected(null);return;}event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={type:'pan',start:{x:event.clientX,y:event.clientY},scroll:{x:viewport.current!.scrollLeft,y:viewport.current!.scrollTop},changed:false};};
 const zoomBy=(factor:number)=>setZoom(z=>Math.min(4,Math.max(.05,z*factor)));
 const sample=()=>{if(!guard())return;void run('サンプルを準備中',async()=>{
 const response=await fetch(`${import.meta.env.BASE_URL}sample.svg`);if(!response.ok)throw new Error('サンプルを読み込めませんでした。');const svg=await response.text();const source=await blobDataURL(new Blob([svg],{type:'image/svg+xml'}));const img=await loadImage(source);const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1400;canvas.getContext('2d')!.drawImage(img,0,0);const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('サンプル画像の生成に失敗しました。')),'image/png'));const bytes=new Uint8Array(await png.arrayBuffer());await ensureFont('sans');const next=emptyDocument();next.project.title='放課後の約束';next.project.background={path:'assets/background.png',mime:'image/png',name:'sample.png'};next.image=await blobDataURL(png);next.bytes=bytes;
 const first=newBalloon('ellipse',1000,1400,0);first.x=660;first.y=90;first.width=230;first.height=320;first.textFrame=defaultTextFrame(first);first.text='この街で、\nまた会おう。';first.tail.p={x:-.2,y:1.12};first.tail.a={x:.17,y:.87};first.tail.b={x:.37,y:.98};
 const second=newBalloon('rounded',1000,1400,1);second.x=80;second.y=760;second.width=370;second.height=150;second.textFrame=defaultTextFrame(second);second.text='あの日の約束を、\nまだ覚えている。';second.style.direction='horizontal';second.style.size=26;second.style.padding=18;
 next.project.balloons=[first,second];replace(next,false);setSelected(first.id);setFontRevision(v=>v+1);setNotice('サンプルを開きました。セリフやしっぽを自由に編集できます。');});};
 const textInfo=b?layoutText(b):null;
 const overflowCount=doc.project.balloons.filter(item=>layoutText(item).warning).length;

 return <div className="app" data-font-revision={fontRevision}>
 <input ref={imageInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="漫画画像ファイル" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importImage(file);}}/>
 <input ref={projectInput} className="hidden" type="file" accept=".zip,application/zip" aria-label="プロジェクトZIPファイル" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importProject(file);}}/>
 <input ref={jsonInput} className="hidden" type="file" accept=".json,application/json" aria-label="セリフ設定JSONファイル" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void readDialogues(file);}}/>
 <header className="header"><a className="brand" href="./" aria-label="comic.lab ホーム" onClick={e=>e.preventDefault()}><span className="brand-mark"><span/><span/></span>comic<span className="brand-dot">.</span>lab</a><span className="header-divider"/><span className="product-name">Balloon Editor <span className="version">v{APP_VERSION}</span></span><div className="document-title"><span className={`status-dot ${dirty?'unsaved':''}`}/><span>{doc.project.title}</span><span className="save-state">{dirty?'未保存':'保存済み'}</span></div><div className="header-actions"><IconButton label="使い方" onClick={()=>setHelp(true)}><CircleHelp size={19}/></IconButton><button className="button secondary save-button" disabled={!doc.image||!!busy} onClick={()=>void save()}><FileArchive size={16}/><span>プロジェクト保存</span></button><button className="button primary" disabled={!doc.image||!!busy||fontLoading} onClick={()=>void exportImage()}><Download size={16}/><span>PNG書き出し</span><ChevronDown size={13}/></button></div></header>
 <div className="mobile-bar"><button onClick={()=>setPanel(panel==='tools'?null:'tools')}><Layers size={16}/> ツール・レイヤー</button><span>Balloon Editor</span><button onClick={()=>setPanel(panel==='properties'?null:'properties')}><Type size={16}/> プロパティ</button></div>
 <main className="layout">
 {panel&&<button className="panel-backdrop" aria-label="パネルを閉じる" onClick={()=>setPanel(null)}/>}
 <aside className={`left-panel ${panel==='tools'?'mobile-open':''}`}><div className="panel-mobile-title">ツール<IconButton label="ツールを閉じる" onClick={()=>setPanel(null)}><X size={18}/></IconButton></div>
 <div className="left-top"><p className="eyebrow">WORKSPACE</p><div className="workspace-title">ことばを、重ねる。</div><p className="muted small">絵はそのまま。セリフは自由に。</p></div>
 <section className="panel-section file-section"><h2>原稿</h2><button className="button import-button" onClick={()=>imageInput.current?.click()} disabled={!!busy}><ImagePlus size={18}/>画像を読み込む<Plus size={15}/></button><button className="text-button" onClick={()=>projectInput.current?.click()} disabled={!!busy}><FolderOpen size={16}/>プロジェクトを開く<ChevronRight size={14}/></button><p className="hint">PNG / JPEG / WebP · 最大50MB</p><div className="dialogue-actions"><button className="text-button" disabled={!doc.image||!!busy} onClick={()=>void saveDialogues()}><Download size={15}/>セリフ設定をJSON保存</button><button className="text-button" disabled={!doc.image||!!busy} onClick={()=>jsonInput.current?.click()}><FolderOpen size={15}/>セリフ設定をJSON読込</button><p className="hint">画像を含まない編集データ · 最大5MB</p></div></section>
 <section className="panel-section"><div className="section-heading"><h2>編集ツール</h2><MousePointer2 size={12} color="#a9b09e"/></div><div className="mode-switch"><button className={mode==='select'?'selected':''} onClick={()=>setMode('select')}><MousePointer2 size={16}/>選択</button><button className={mode==='pan'?'selected':''} onClick={()=>setMode('pan')}><Hand size={16}/>移動</button></div><h2 className="subheading">吹き出しを追加</h2><div className="shape-buttons"><button onClick={()=>add('ellipse')} disabled={!!busy}><svg viewBox="0 0 80 60" aria-hidden="true"><path d="M40 7C59 7 72 16 72 29S60 49 43 49L30 57 31 48C16 46 8 39 8 29S21 7 40 7Z"/></svg><span>楕円</span><span className="shape-plus">＋</span></button><button onClick={()=>add('rounded')} disabled={!!busy}><svg viewBox="0 0 80 60" aria-hidden="true"><rect x="9" y="9" width="62" height="41" rx="9"/></svg><span>角丸四角</span><span className="shape-plus">＋</span></button><button onClick={()=>add('text')} disabled={!!busy}><Type size={38} aria-hidden="true"/><span>文字のみ</span><span className="shape-plus">＋</span></button><button onClick={()=>add('zigzag')} disabled={!!busy}><svg viewBox="0 0 80 60" aria-hidden="true"><path d="m40 4 7 10 15-5-1 13 15 8-14 7 3 14-17-4-8 11-9-11-16 5 3-15L4 30l14-7-2-14 16 5Z"/></svg><span>ギザギザ</span><span className="shape-plus">＋</span></button></div></section>
 <section className="panel-section layers-section"><div className="section-heading"><h2><Layers size={15}/>レイヤー</h2><span className="count">{doc.project.balloons.length}</span></div><p className="hint layer-hint">上のレイヤーほど手前に表示</p><div className="layer-list">{[...doc.project.balloons].reverse().map((item)=><button className={`layer-row ${selected===item.id?'selected':''}`} key={item.id} onClick={()=>{setSelected(item.id);setMode('select');}}><span className="layer-icon">{item.kind==='text'?<Type size={18}/>:item.kind==='ellipse'?<Circle size={18}/>:<Square size={18}/>}</span><span><strong>{item.text.replace(/\n/g,' ')||(item.kind==='text'?'文字のみ':'空の吹き出し')}</strong><small>{item.style.direction==='vertical'?'縦書き':'横書き'} · {Math.round(item.kind==='text'?item.textFrame.width:item.width)} × {Math.round(item.kind==='text'?item.textFrame.height:item.height)}</small></span><span className="layer-dot"/></button>)}{doc.image&&<div className="background-layer"><ImagePlus size={16}/><span>背景画像</span><span className="locked-label">固定</span></div>}{!doc.image&&<div className="no-layers"><Layers size={23}/><span>画像を読み込むと、<br/>レイヤーがここに表示されます。</span></div>}</div>{b&&<div className="layer-actions"><IconButton label="前面へ" onClick={()=>reorder(1)}><ArrowUp size={16}/></IconButton><IconButton label="背面へ" onClick={()=>reorder(-1)}><ArrowDown size={16}/></IconButton><span/><IconButton label="複製" onClick={duplicate}><Copy size={16}/></IconButton><IconButton label="削除" onClick={remove}><Trash2 size={16}/></IconButton></div>}</section>
 <div className="privacy-note"><span className="local-dot"/><span>画像・セリフは端末内で処理<br/><small>作品データは送信されません</small></span></div>
 </aside>
 <section className="canvas-column"><div className="canvas-topbar"><div className="breadcrumb">原稿 <ChevronRight size={13}/><span>{doc.image?doc.project.title:'新しい原稿'}</span></div><div className="history-buttons">{overflowCount>0&&<span className="overflow-count" title="吹き出しを選び、文字サイズ・余白・寸法を調整してください。"><AlertCircle size={13}/>{overflowCount}件の文字はみ出し</span>}<IconButton label="取り消し (Ctrl / ⌘ Z)" disabled={!history.current.past.length} onClick={undo}><Undo2 size={17}/></IconButton><IconButton label="やり直し (Ctrl / ⌘ Shift Z)" disabled={!history.current.future.length} onClick={redo}><Redo2 size={17}/></IconButton></div></div>
 <div ref={viewport} className={`canvas-viewport ${mode==='pan'?'pan-mode':''}`} onPointerDown={startPan} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomBy(e.deltaY<0?1.08:1/1.08);}}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file&&!busy)void (file.name.endsWith('.zip')?importProject(file):importImage(file));}}>
 {doc.image?<div className="canvas-workspace" style={{minWidth:doc.project.width*zoom+100,minHeight:doc.project.height*zoom+100}} onPointerDown={e=>{if(e.target===e.currentTarget&&mode==='select'&&!space.current)setSelected(null);}}><div className="page-label">PAGE 01 <span>{doc.project.width} × {doc.project.height} PX</span></div><svg className="artboard" ref={svgRef} width={doc.project.width*zoom} height={doc.project.height*zoom} viewBox={`0 0 ${doc.project.width} ${doc.project.height}`} aria-label="漫画編集キャンバス" onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
 <image href={doc.image} width={doc.project.width} height={doc.project.height} onPointerDown={()=>{if(mode==='select'&&!space.current)setSelected(null);}}/>
 {doc.project.balloons.map(item=><g key={item.id} className={mode==='select'?'balloon':''} onPointerDown={e=>start(e,'move',item)}><g dangerouslySetInnerHTML={{__html:objectArtworkSVG(item)}}/>{item.kind==='text'&&<rect transform={textTransform(item)} x={item.textFrame.x} y={item.textFrame.y} width={item.textFrame.width} height={item.textFrame.height} fill="none" pointerEvents="all"/>}</g>)}
 {b&&mode==='select'&&<SelectionOverlay b={b} zoom={zoom} target={editTarget} textEditing={textEditing} clipEditing={clipEditing} onStart={(e,type)=>start(e,type,b)}/>}

 </svg></div>:<div className="empty-canvas"><div className="empty-page"><div className="paper-corner"/><span className="empty-edition">COMIC.LAB / YOUR NEXT STORY</span><div className="empty-illustration"><svg viewBox="0 0 220 160" aria-hidden="true"><path d="M46 32C46 13 174 13 174 58S144 113 115 108L82 133 87 102C64 96 46 80 46 58Z" fill="#eef1e6" stroke="#496650" strokeWidth="2"/><path d="M28 88C15 92 15 128 49 130L64 145 63 125" fill="#f7f4ec" stroke="#a4aa99" strokeWidth="1.5"/><path d="M92 50h40M101 64h40M88 78h31" stroke="#718366" strokeWidth="3" strokeLinecap="round"/><path d="m180 15 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="#b1be83"/></svg></div><h1>物語に、<br/>ことばを。</h1><p>漫画画像に吹き出しを重ねて、<br/>あなただけの1ページを。</p><button className="button primary empty-import" onClick={()=>imageInput.current?.click()} disabled={!!busy}><ImagePlus size={17}/>漫画画像を読み込む</button><span className="drop-hint">または、ここに画像をドロップ</span><div className="empty-separator"><span/>はじめての方へ<span/></div><button className="sample-button" onClick={sample} disabled={!!busy}><BookOpen size={15}/>サンプルで試す<ChevronRight size={14}/></button></div><span className="empty-caption">絵を変えずに、伝わり方を変える。</span></div>}
 </div>
 <div className="canvas-bottom"><span className="canvas-instruction">{doc.image?<><MousePointer2 size={13}/>ドラッグで移動<span>·</span>右下の□でサイズ変更</>:<><Sparkles size={13}/>あなたの漫画に、ぴったりのことばを。</>}</span><div className="zoom-controls"><IconButton label="縮小" onClick={()=>zoomBy(1/1.2)} disabled={!doc.image}><Minus size={16}/></IconButton><button className="zoom-value" onClick={fit} disabled={!doc.image}>{Math.round(zoom*100)}<span>%</span></button><IconButton label="拡大" onClick={()=>zoomBy(1.2)} disabled={!doc.image}><Plus size={16}/></IconButton><span className="zoom-divider"/><IconButton label="全体を表示" onClick={fit} disabled={!doc.image}><Maximize size={15}/></IconButton></div></div>
 </section>
 <aside className={`right-panel ${panel==='properties'?'mobile-open':''}`}><div className="properties-heading"><div><p className="eyebrow">PROPERTIES</p><h2>プロパティ</h2></div><span className="properties-mark"><Type size={18}/></span><button className="mobile-close" aria-label="プロパティを閉じる" onClick={()=>setPanel(null)}><X size={18}/></button></div>
 <PropertiesPanel clipEditing={clipEditing} setClipEditing={setClipEditing} b={b} textInfo={textInfo} textEditing={textEditing} editTarget={b?.kind==='text'?'text':editTarget} setEditTarget={setEditTarget} setTextFocused={setTextFocused} onTextFocus={()=>{setTextFocused(true);textSnapshot.current=structuredClone(ref.current.project);}} onTextBlur={()=>{setTextFocused(false);if(textSnapshot.current&&signature(textSnapshot.current)!==signature(ref.current.project))pushHistory(textSnapshot.current);textSnapshot.current=null;}} update={update} style={style} outline={outline} shadow={shadow} loadFamily={loadFamily} duplicate={duplicate} remove={remove}/>

 <div className="properties-footer"><span>非破壊編集</span><span>元の画像を保護</span></div></aside>
 </main>
 <footer className="statusbar"><span><span className="local-dot"/>LOCAL WORKSPACE · v{APP_VERSION}</span><span>{doc.image?`${doc.project.width} × ${doc.project.height} px`:'画像未読込'}<span className="footer-divider">/</span>{doc.project.balloons.filter(item=>item.kind!=='text').length} 吹き出し{doc.project.balloons.some(item=>item.kind==='text')&&` / ${doc.project.balloons.filter(item=>item.kind==='text').length} 文字のみ`}</span><button onClick={()=>setHelp(true)}>ショートカット <span>?</span></button></footer>
 {notice&&<div className="toast" role="status"><Check size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="通知を閉じる"><X size={15}/></button></div>}
 {error&&<div className="toast error-toast" role="alert"><AlertCircle size={19}/><span>{error}</span><button onClick={()=>setError('')} aria-label="エラーを閉じる"><X size={16}/></button></div>}
 {(busy||fontLoading)&&<div className="busy-indicator" role="status"><LoaderCircle size={16} className="spin"/>{busy||'日本語フォントを準備中…'}</div>}
 {pendingDialogues&&<div className="modal-backdrop"><div ref={dialogueModal} tabIndex={-1} className="help-modal dialogue-modal" role="dialog" aria-modal="true" aria-labelledby="dialogue-import-title" onKeyDown={e=>{if(e.key==='Tab'){const targets=dialogueModal.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])');if(targets?.length){const first=targets[0],last=targets[targets.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialogueModal.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialogueModal.current)){e.preventDefault();first.focus();}}}}}><div className="section-heading"><h2 id="dialogue-import-title">セリフ設定を読み込みますか？</h2><IconButton label="JSON読込をキャンセル" onClick={()=>setPendingDialogues(null)}><X size={20}/></IconButton></div><p>現在のセリフ・吹き出し {doc.project.balloons.length}個を、JSON内の {pendingDialogues.data.balloons.length}個に置き換えます。背景画像は維持します。{dirty&&'未保存の変更があります。必要ならキャンセルして先に保存してください。'}</p><div className="help-note">JSON形式 v{pendingDialogues.data.version} ／ 作成アプリ {pendingDialogues.data.appVersion?`v${pendingDialogues.data.appVersion}`:'不明（旧形式）'}<br/>ギザギザ {dialogueSummary(pendingDialogues.data).zigzag}個 ／ トリミング有効 {dialogueSummary(pendingDialogues.data).clipped}個</div>{pendingDialogues.data.compatibilityWarnings?.map((warning,i)=><div key={i} className="inline-warning" role="alert"><AlertCircle size={15}/>{warning}</div>)}<div className="help-note">JSONの元画像：{pendingDialogues.data.width} × {pendingDialogues.data.height}px<br/>現在の画像：{doc.project.width} × {doc.project.height}px</div>{(pendingDialogues.data.width!==doc.project.width||pendingDialogues.data.height!==doc.project.height)?<fieldset className="import-sizing"><legend><AlertCircle size={14}/>画像の寸法が異なります</legend><label><input type="radio" name="dialogue-sizing" checked={importSizing==='scale'} onChange={()=>setImportSizing('scale')}/><span>座標を比例変換<small>文字・線・装飾も画像サイズに合わせて調整します。</small></span></label><label><input type="radio" name="dialogue-sizing" checked={importSizing==='keep'} onChange={()=>setImportSizing('keep')}/><span>座標そのまま<small>位置・サイズ・装飾の数値をすべて維持します。</small></span></label></fieldset>:<p>画像寸法が同じため、座標・文字サイズをそのまま復元します。</p>}{dialogueError&&<div className="inline-warning" role="alert"><AlertCircle size={15}/>{dialogueError}</div>}<div className="dialogue-modal-buttons"><button className="button secondary" onClick={()=>setPendingDialogues(null)}>キャンセル</button><button className="button primary" onClick={confirmDialogues}>置き換えて読み込む</button></div></div></div>}
 {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><div className="help-modal" role="dialog" aria-modal="true" aria-label="使い方" onClick={e=>e.stopPropagation()}><div className="section-heading"><h2>comic.lab の使い方</h2><IconButton label="使い方を閉じる" onClick={()=>setHelp(false)}><X size={20}/></IconButton></div><p>画像を開き、吹き出しを追加してセリフを入力。ZIPで編集内容を保存し、PNGで完成原稿を書き出せます。</p><dl><dt>吹き出しを移動</dt><dd>本体をドラッグ</dd><dt>サイズ変更</dt><dd>選択枠の右下の□をドラッグ</dd><dt>文字を独立編集</dt><dd>操作対象ボタンで「文字のみ」に変更</dd><dt>文字枠の点線</dt><dd>文字編集中だけ表示。PNGには含まれません</dd><dt>しっぽを調整</dt><dd>A・Bは付け根、Pは先端</dd><dt>パン</dt><dd>移動ツール／Space＋ドラッグ</dd><dt>拡大・縮小</dt><dd>下部の＋／− または Ctrl / ⌘＋ホイール</dd><dt>取り消し／やり直し</dt><dd>Ctrl / ⌘ Z ／ Ctrl / ⌘ Shift Z</dd><dt>複製／削除</dt><dd>Ctrl / ⌘ D ／ Delete</dd><dt>プロジェクト保存</dt><dd>Ctrl / ⌘ S</dd></dl><div className="help-note">自動保存はありません。作業途中はプロジェクトZIPを保存してください。画像・セリフはブラウザ内で処理されます。</div><button className="button primary" onClick={()=>setHelp(false)}>編集をはじめる<ChevronRight size={16}/></button></div></div>}
 </div>;
}
