export type Point = { x: number; y: number };
export type Tail = { enabled: boolean; a: Point; b: Point; p: Point };
export type TextStyle = { direction: 'vertical'|'horizontal'; family: 'sans'|'serif'; size: number; bold: boolean; color: string; lineHeight: number; spacing: number; padding: number; align: 'start'|'center'|'end' };
export type Balloon = { id: string; kind: 'ellipse'|'rounded'; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number; tail: Tail; text: string; style: TextStyle };
export type Project = { id: string; version: 1; title: string; width: number; height: number; background: { path: string; mime: string; name: string } | null; balloons: Balloon[] };
export type Document = { project: Project; image: string | null; bytes: Uint8Array | null };
export const uid = () => crypto.randomUUID();
export function emptyDocument(): Document { return { project: { id: uid(), version: 1, title: '無題の原稿', width: 1000, height: 1400, background: null, balloons: [] }, image: null, bytes: null }; }
export function newBalloon(kind: Balloon['kind'], width: number, height: number, index: number): Balloon {
 const w = Math.min(260, width * .28), h = Math.min(320, height * .28);
 return { id: uid(), kind, x: Math.max(0, width*.58 + index%3*16 - w/2), y: Math.max(0, height*.18 + index%4*22), width: w, height: h, fill: '#ffffff', stroke: '#222222', strokeWidth: Math.max(2, width/450), tail: { enabled: kind === 'ellipse', a: {x:.54,y:.998}, b:{x:.73,y:.944}, p:{x:.86,y:1.34} }, text: 'ここに\nセリフを入力', style: { direction:'vertical', family:'sans', size: Math.max(16, Math.round(width/38)), bold: false, color:'#222222', lineHeight:1.5, spacing:0, padding:28, align:'center' } };
}
export function validateProject(input: unknown): Project {
 const fail = () => { throw new Error('プロジェクトの形式が正しくありません。'); };
 if (!input || typeof input !== 'object') return fail();
 const p = input as Project;
 const n = (v: unknown, min: number, max: number) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
 const color = (v:unknown) => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
 const str = (v:unknown, max:number) => typeof v==='string' && v.length<=max;
 if(p.version!==1 || !str(p.id,100) || !str(p.title,200) || !n(p.width,1,20000) || !n(p.height,1,20000) || p.width*p.height>20_000_000 || !Array.isArray(p.balloons) || p.balloons.length>200) return fail();
 if(p.background && (!['image/png','image/jpeg','image/webp'].includes(p.background.mime) || !/^assets\/background\.(png|jpg|webp)$/.test(p.background.path) || !str(p.background.name,255))) return fail();
 const ids = new Set();
 for(const b of p.balloons) {
  if(!b || !str(b.id,100) || ids.has(b.id) || !['ellipse','rounded'].includes(b.kind) || !n(b.x,-40000,40000) || !n(b.y,-40000,40000) || !n(b.width,40,20000) || !n(b.height,40,20000) || !color(b.fill) || !color(b.stroke) || !n(b.strokeWidth,0,30) || !str(b.text,10000)) return fail();
  ids.add(b.id);
  if(!b.tail || typeof b.tail.enabled!=='boolean') return fail();
  for(const pt of [b.tail.a,b.tail.b,b.tail.p]) if(!pt || !n(pt.x,-20,20) || !n(pt.y,-20,20)) return fail();
  const s=b.style;
  if(!s || !['vertical','horizontal'].includes(s.direction) || !['sans','serif'].includes(s.family) || !['start','center','end'].includes(s.align) || !n(s.size,6,300) || typeof s.bold!=='boolean' || !color(s.color) || !n(s.lineHeight,.8,3) || !n(s.spacing,-2,30) || !n(s.padding,0,300)) return fail();
 }
 return structuredClone(p);
}
