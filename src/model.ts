export type Point = { x: number; y: number };
export type Tail = { enabled: boolean; a: Point; b: Point; p: Point };
export type TextFrame = { x: number; y: number; width: number; height: number };
export type OverflowMode = 'visible'|'warn'|'fit';
export type TextDecoration = { outline:{enabled:boolean;color:string;width:number};shadow:{enabled:boolean;color:string;x:number;y:number;blur:number} };
export const defaultDecoration=():TextDecoration=>({outline:{enabled:false,color:'#ffffff',width:3},shadow:{enabled:false,color:'#000000',x:4,y:4,blur:4}});
export type TextStyle = { decoration:TextDecoration; wrapMode:'manual'|'auto'; overflowMode: OverflowMode; direction: 'vertical'|'horizontal'; family: 'sans'|'serif'; size: number; bold: boolean; color: string; lineHeight: number; spacing: number; padding: number; align: 'start'|'center'|'end' };
export type Balloon = { textFrame: TextFrame; roundness: number; id: string; kind: 'ellipse'|'rounded'|'text'; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number; tail: Tail; text: string; style: TextStyle };
export type Project = { id: string; version: 1; title: string; width: number; height: number; background: { path: string; mime: string; name: string } | null; balloons: Balloon[] };
export type Document = { project: Project; image: string | null; bytes: Uint8Array | null };
export const uid = () => crypto.randomUUID();
export function emptyDocument(): Document { return { project: { id: uid(), version: 1, title: '無題の原稿', width: 1000, height: 1400, background: null, balloons: [] }, image: null, bytes: null }; }
export function defaultTextFrame(b: Pick<Balloon,'kind'|'width'|'height'>): TextFrame {
 const factor=b.kind==='text'?1:b.kind==='ellipse'?Math.SQRT1_2:.94;
 return {x:b.width*(1-factor)/2,y:b.height*(1-factor)/2,width:b.width*factor,height:b.height*factor};
}
export function newBalloon(kind: Balloon['kind'], width: number, height: number, index: number): Balloon {
 const w = Math.max(40, Math.min(260, width * .28)), h = Math.max(40, Math.min(320, height * .28));
 const balloon: Omit<Balloon,'textFrame'> = { roundness:kind==='text'?0:24, id: uid(), kind, x: Math.max(0, width*.58 + index%3*16 - w/2), y: Math.max(0, height*.18 + index%4*22), width: w, height: h, fill: '#ffffff', stroke: '#222222', strokeWidth: Math.min(30, Math.max(2, width/450)), tail: { enabled: kind!=='text', a: {x:.54,y:.998}, b:{x:.73,y:.944}, p:{x:.86,y:1.34} }, text: 'ここに\nセリフを入力', style: { decoration:defaultDecoration(), wrapMode:'manual', overflowMode:'visible', direction:'vertical', family:'sans', size: Math.min(300, Math.max(16, Math.round(width/38))), bold: false, color:'#222222', lineHeight:1.5, spacing:0, padding:kind==='text'?0:28, align:'center' } };
 return {...balloon,textFrame:defaultTextFrame(balloon)};
}
export function validateProject(input: unknown): Project {
 const fail = () => { throw new Error('プロジェクトの形式が正しくありません。'); };
 if (!input || typeof input !== 'object') return fail();
 const p = structuredClone(input) as Project;
 const n = (v: unknown, min: number, max: number) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
 const color = (v:unknown) => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
 const str = (v:unknown, max:number) => typeof v==='string' && v.length<=max;
 if(p.version!==1 || !str(p.id,100) || !str(p.title,200) || !n(p.width,1,20000) || !n(p.height,1,20000) || p.width*p.height>20_000_000 || !Array.isArray(p.balloons) || p.balloons.length>200) return fail();
 if(p.background && (!['image/png','image/jpeg','image/webp'].includes(p.background.mime) || !/^assets\/background\.(png|jpg|webp)$/.test(p.background.path) || !str(p.background.name,255))) return fail();
 const ids = new Set();
 for(const b of p.balloons) {
  if(!b || !str(b.id,100) || ids.has(b.id) || !['ellipse','rounded','text'].includes(b.kind) || !n(b.x,-40000,40000) || !n(b.y,-40000,40000) || !n(b.width,40,20000) || !n(b.height,40,20000) || !color(b.fill) || !color(b.stroke) || !n(b.strokeWidth,0,30) || !str(b.text,10000)) return fail();
  ids.add(b.id);
  if(b.roundness===undefined)b.roundness=24;
  if(b.textFrame===undefined)b.textFrame=defaultTextFrame(b);
  const frame=b.textFrame;
  if(!n(b.roundness,0,100) || !frame || !n(frame.x,-80000,80000) || !n(frame.y,-80000,80000) || !n(frame.width,1,20000) || !n(frame.height,1,20000)) return fail();
  if(b.tail && b.tail.enabled===undefined)b.tail.enabled=true;
  if(!b.tail || typeof b.tail.enabled!=='boolean') return fail();
  for(const pt of [b.tail.a,b.tail.b,b.tail.p]) if(!pt || !n(pt.x,-20,20) || !n(pt.y,-20,20)) return fail();
  const s=b.style;
  if(s && s.overflowMode===undefined)s.overflowMode='visible';
  if(s && s.wrapMode===undefined)s.wrapMode='auto';
  if(s && s.decoration===undefined)s.decoration=defaultDecoration();
  const decoration=s?.decoration,outline=decoration?.outline,shadow=decoration?.shadow;
  if(!outline || typeof outline.enabled!=='boolean' || !color(outline.color) || !n(outline.width,0,30) || !shadow || typeof shadow.enabled!=='boolean' || !color(shadow.color) || !n(shadow.x,-500,500) || !n(shadow.y,-500,500) || !n(shadow.blur,0,50))return fail();
  if(!s || !['manual','auto'].includes(s.wrapMode) || !['visible','warn','fit'].includes(s.overflowMode) || !['vertical','horizontal'].includes(s.direction) || !['sans','serif'].includes(s.family) || !['start','center','end'].includes(s.align) || !n(s.size,6,300) || typeof s.bold!=='boolean' || !color(s.color) || !n(s.lineHeight,.8,3) || !n(s.spacing,-2,30) || !n(s.padding,0,300)) return fail();
 }
 return structuredClone(p);
}
