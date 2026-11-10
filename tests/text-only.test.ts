import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {strFromU8} from 'fflate';
import {emptyDocument,newBalloon,uid,validateProject} from '../src/model';
import {balloonPath} from '../src/geometry';
import {layoutText,registerFont} from '../src/typography';
import {artworkSVG,projectZip,unzipBounded} from '../src/io';
import {moveBalloon,resizeTextFrame} from '../src/editing';
import {recordHistory,undoProject,redoProject} from '../src/history';
import type {HistoryState} from '../src/history';
beforeAll(()=>{registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf'));registerFont('serif',readFileSync('public/fonts/NotoSerifJP.ttf'));});
describe('standalone text layers',()=>{
 it('creates a distinct text kind with no body, tail, padding or automatic shrinking',()=>{
  const b=newBalloon('text',1000,1400,0);
  expect(b.kind).toBe('text');expect(b.tail.enabled).toBe(false);expect(b.textFrame).toEqual({x:0,y:0,width:b.width,height:b.height});expect(b.style.padding).toBe(0);expect(b.style.overflowMode).toBe('visible');expect(balloonPath(b)).toBe('');
 });
 for(const direction of ['horizontal','vertical'] as const)it(`renders ${direction} Japanese with both fonts and keeps requested size beyond its region`,()=>{
  const b=newBalloon('text',1000,1400,0);b.text='「ことば。」\nそのまま描画';b.style.direction=direction;b.style.size=150;b.textFrame.width=60;b.textFrame.height=60;
  for(const family of ['sans','serif'] as const){b.style.family=family;const text=layoutText(b);expect(text.missing).toBe(false);expect(text.effectiveSize).toBe(150);expect(text.overflow).toBe(true);expect(text.warning).toBe(false);expect(text.paths.length).toBe(Array.from(b.text.replaceAll('\n','')).length);}
 });
 it('exports glyphs alone, ignoring all dormant body appearance values',()=>{
  const doc=emptyDocument(),b=newBalloon('text',1000,1400,0);b.text='文字だけ';b.fill='#ff0000';b.stroke='#00ff00';b.strokeWidth=30;b.tail.enabled=true;doc.project.balloons=[b];
  const svg=artworkSVG(doc.project,'data:image/png;base64,background'),text=layoutText(b);
  expect(svg).not.toMatch(/stroke=|stroke-width|stroke-dasharray|selection|handle|guide|<rect|clipPath/);expect(svg).not.toContain('#ff0000');expect(svg).not.toContain('#00ff00');expect(svg.match(/<path /g)).toHaveLength(text.paths.length);for(const glyph of text.paths)expect(svg).toContain(glyph.d);
 });
 it('keeps an empty text object completely transparent in output',()=>{const doc=emptyDocument();const b=newBalloon('text',1000,1400,0);b.text='';doc.project.balloons=[b];const svg=artworkSVG(doc.project,'data:image/png;base64,background');expect(svg).not.toMatch(/<path|<rect|stroke=/);});
 it('moves, resizes, duplicates, removes, undoes and redoes text using the existing editing pipeline',()=>{
  const b=newBalloon('text',1000,1400,0),original=structuredClone(b);let p=emptyDocument().project;p.balloons=[b];const history:HistoryState={past:[],future:[]};recordHistory(history,p);
  p=structuredClone(p);p.balloons[0]=resizeTextFrame(moveBalloon(b,100,-50,'text'),70,-10);const edited=p.balloons[0];expect(edited.textFrame.x).toBe(100);expect(edited.textFrame.y).toBe(-50);expect(edited.textFrame.width).toBe(b.textFrame.width+70);expect(edited.style.size).toBe(b.style.size);expect(balloonPath(edited)).toBe('');
  const copy={...structuredClone(edited),id:uid()};p.balloons.push(copy);p.balloons.shift();expect(p.balloons[0].id).toBe(copy.id);const changed=structuredClone(p);p=undoProject(history,p)!;expect(p.balloons).toEqual([original]);p=redoProject(history,p)!;expect(p).toEqual(changed);
 });
 it('round-trips mixed layers without changing original balloons, bytes, drawing order or output',async()=>{
  const doc=emptyDocument();doc.project.background={path:'assets/background.png',mime:'image/png',name:'old.png'};doc.bytes=new Uint8Array([137,80,78,71,2,4,6]);doc.project.balloons=[newBalloon('ellipse',1000,1400,0),newBalloon('text',1000,1400,1),newBalloon('rounded',1000,1400,2)];doc.project.balloons[1].style.family='serif';doc.project.balloons[1].text='文字のみ';doc.project.balloons[1]=moveBalloon(doc.project.balloons[1],25,-10,'text');
  const original=structuredClone(doc.project),svg=artworkSVG(doc.project,null),files=await unzipBounded(projectZip(doc)),restored=validateProject(JSON.parse(strFromU8(files['project.json'])));
  expect(restored.version).toBe(1);expect(restored).toEqual(original);expect(restored.balloons.map(b=>b.kind)).toEqual(['ellipse','text','rounded']);expect(files['assets/background.png']).toEqual(doc.bytes);expect(artworkSVG(restored,null)).toBe(svg);
  const reversed={...restored,balloons:[...restored.balloons].reverse()};const reverseSVG=artworkSVG(reversed,null);const first=restored.balloons[2],last=restored.balloons[0];expect(reverseSVG.indexOf(`translate(${first.x} ${first.y})`)).toBeLessThan(reverseSVG.indexOf(`translate(${last.x} ${last.y})`));
 });
 it('loads existing v0.1.1 shapes unchanged and rejects unknown object kinds',()=>{const doc=emptyDocument();doc.project.balloons=[newBalloon('ellipse',1000,1400,0),newBalloon('rounded',1000,1400,1)];const original=structuredClone(doc.project);expect(validateProject(original)).toEqual(original);const invalid=structuredClone(original);(invalid.balloons[0] as any).kind='unknown';expect(()=>validateProject(invalid)).toThrow();});
});
