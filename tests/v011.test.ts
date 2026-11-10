import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {strFromU8} from 'fflate';
import {defaultTextFrame,emptyDocument,newBalloon,validateProject} from '../src/model';
import {layoutText,registerFont} from '../src/typography';
import {balloonPath,boundary} from '../src/geometry';
import {artworkSVG,projectZip,unzipBounded} from '../src/io';
import {moveBalloon,resizeTextFrame} from '../src/editing';
import {recordHistory,undoProject,redoProject} from '../src/history';
import type {HistoryState} from '../src/history';
beforeAll(()=>registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf')));
const overflowBalloon=(direction:'horizontal'|'vertical')=>{const b=newBalloon('rounded',1000,1400,0);b.text='はみ出す文字。\n改行はそのまま。';b.style.direction=direction;b.style.size=180;b.style.padding=0;b.textFrame={x:20,y:10,width:120,height:95};return b;};
describe('v0.1.1 typography and independent frames',()=>{
 for(const direction of ['horizontal','vertical'] as const){
  it(`${direction}: keeps requested size and all paths in visible and warning modes`,()=>{
   const b=overflowBalloon(direction),original=structuredClone(b);let v=layoutText(b);
   expect(v.effectiveSize).toBe(180);expect(v.overflow).toBe(true);expect(v.warning).toBe(false);expect(v.paths.length).toBe(Array.from(b.text.replaceAll('\n','')).length);
   b.style.overflowMode='warn';const warning=layoutText(b);expect(warning.warning).toBe(true);expect(warning.paths).toEqual(v.paths);expect(b.style.size).toBe(original.style.size);expect(b.textFrame).toEqual(original.textFrame);
  });
  it(`${direction}: fits only when opted in without changing the source size, frame or wrapping`,()=>{
   const b=overflowBalloon(direction),visible=layoutText(b),original=structuredClone(b);b.style.overflowMode='fit';const fitted=layoutText(b);
   expect(fitted.effectiveSize).toBeLessThan(180);expect(fitted.effectiveSize).toBeGreaterThan(0);expect(fitted.overflow).toBe(false);expect(fitted.lineCount).toBe(visible.lineCount);expect(fitted.paths.length).toBe(visible.paths.length);
   expect(b.style.size).toBe(180);expect(b.textFrame).toEqual(original.textFrame);expect(b.text).toBe(original.text);
   b.style.overflowMode='visible';expect(layoutText(b).paths).toEqual(visible.paths);
  });
 }
 it('preserves manual newlines when font size changes, with optional legacy auto wrapping',()=>{const b=overflowBalloon('horizontal');expect(b.style.wrapMode).toBe('manual');expect(layoutText(b).lineCount).toBe(2);b.style.size=44;expect(layoutText(b).lineCount).toBe(2);b.style.wrapMode='auto';expect(layoutText(b).lineCount).toBeGreaterThan(2);});
 it('moves and resizes text independently of body and tail',()=>{const b=newBalloon('ellipse',1000,1400,0),original=structuredClone(b);const moved=moveBalloon(b,123,-47,'text'),resized=resizeTextFrame(moved,88,-20);expect(resized.x).toBe(b.x);expect(resized.y).toBe(b.y);expect(resized.width).toBe(b.width);expect(resized.tail).toEqual(b.tail);expect(resized.textFrame.x).toBe(b.textFrame.x+123);expect(resized.textFrame.height).toBe(b.textFrame.height-20);expect(b).toEqual(original);});
 it('moves body alone while keeping absolute text position and legacy group movement',()=>{const b=newBalloon('ellipse',1000,1400,0);const alone=moveBalloon(b,67,42,'body');expect(alone.x+alone.textFrame.x).toBeCloseTo(b.x+b.textFrame.x);expect(alone.y+alone.textFrame.y).toBeCloseTo(b.y+b.textFrame.y);const group=moveBalloon(b,67,42,'group');expect(group.textFrame).toEqual(b.textFrame);expect(group.x+group.textFrame.x).toBeCloseTo(b.x+b.textFrame.x+67);});
 it('body resizing never repositions, resizes or reflows the text frame',()=>{const b=newBalloon('rounded',1000,1400,0);const original=layoutText(b);b.width*=2;b.height/=2;b.kind='ellipse';expect(layoutText(b).paths).toEqual(original.paths);});
 it('renders text outside body without a frame, background, clip or export guide',()=>{const doc=emptyDocument(),b=overflowBalloon('horizontal');b.textFrame.x=b.width+80;doc.project.balloons=[b];const svg=artworkSVG(doc.project,null);expect(svg).not.toMatch(/clipPath|clip-path|mask|text-edit-guide|selection|stroke-dasharray|foreignObject/);const text=layoutText(b);for(const glyph of text.paths)expect(svg).toContain(glyph.transform);expect(text.bounds!.right).toBeGreaterThan(b.width);});
});
describe('v0.1.1 corners and tail',()=>{
 it('creates both shapes with tails enabled',()=>{for(const kind of ['ellipse','rounded'] as const)expect(newBalloon(kind,1000,1400,0).tail.enabled).toBe(true);});
 it('supports square, legacy and maximally rounded corners with joined tails',()=>{
  const b=newBalloon('rounded',1000,1400,0);const paths=[];
  for(const roundness of [0,24,100]){b.roundness=roundness;const path=balloonPath(b);paths.push(path);expect(path.match(/m/gi)).toHaveLength(1);expect(path).not.toMatch(/NaN|Infinity/);const corner=boundary('rounded',{x:1,y:1},roundness);expect(corner.x).toBeGreaterThan(.5);if(roundness===0)expect(corner.x).toBeCloseTo(1);if(roundness===100)expect(Math.hypot(corner.x-.5,corner.y-.5)).toBeCloseTo(.5);}
  expect(new Set(paths).size).toBe(3);b.tail.enabled=false;b.roundness=0;expect(balloonPath(b)).not.toMatch(/c/i);b.width*=1.5;expect(b.roundness).toBe(0);
 });
 it('restores the same geometry after hiding and reshowing either tail',()=>{for(const kind of ['ellipse','rounded'] as const){const b=newBalloon(kind,1000,1400,0);b.tail.p={x:-.7,y:1.8};const tail=structuredClone(b.tail),withTail=balloonPath(b);b.tail.enabled=false;expect(balloonPath(b)).not.toBe(withTail);b.tail.enabled=true;expect(b.tail).toEqual(tail);expect(balloonPath(b)).toBe(withTail);}});
});
describe('v0.1.1 compatibility, persistence and history',()=>{
 it('migrates v0.1 without modifying original coordinates, text, background or existing tail flags',()=>{
  const doc=emptyDocument();doc.project.background={path:'assets/background.png',mime:'image/png',name:'old.png'};doc.project.balloons=[newBalloon('rounded',1000,1400,0),newBalloon('ellipse',1000,1400,1)];doc.project.balloons[0].tail.enabled=false;
  const raw:any=structuredClone(doc.project);for(const b of raw.balloons){delete b.textFrame;delete b.roundness;delete b.style.overflowMode;delete b.style.wrapMode;}
  const untouched=structuredClone(raw),migrated=validateProject(raw);
  expect(raw).toEqual(untouched);expect(migrated.background).toEqual(raw.background);
  migrated.balloons.forEach((b,i)=>{expect(b.x).toBe(raw.balloons[i].x);expect(b.y).toBe(raw.balloons[i].y);expect(b.text).toBe(raw.balloons[i].text);expect(b.tail).toEqual(raw.balloons[i].tail);expect(b.roundness).toBe(24);expect(b.textFrame).toEqual(defaultTextFrame(b));expect(b.style.overflowMode).toBe('visible');expect(b.style.wrapMode).toBe('auto');});
 });
 it('preserves legacy centered text placement mathematically',()=>{const b=newBalloon('rounded',1000,1400,0);b.text='あ\nい';b.style.direction='horizontal';const factor=.94,innerH=Math.max(1,b.height*factor-b.style.padding*2),top=(b.height-innerH)/2;const extent=b.style.size*b.style.lineHeight+b.style.size;const first=layoutText(b).paths[0].transform;const fontAscent=1160;expect(first).toContain('scale(');const values=first.match(/translate\(([^)]+)\)/)![1].split(' ').map(Number);expect(values[1]).toBeCloseTo(top+(innerH-extent)/2+fontAscent*b.style.size/1000);});
 it('defaults a missing tail flag to enabled and rejects invalid new fields',()=>{const doc=emptyDocument();doc.project.balloons=[newBalloon('rounded',1000,1400,0)];const raw:any=structuredClone(doc.project);delete raw.balloons[0].tail.enabled;expect(validateProject(raw).balloons[0].tail.enabled).toBe(true);for(const patch of [{roundness:101},{textFrame:{x:0,y:0,width:0,height:100}},{style:{...doc.project.balloons[0].style,overflowMode:'unknown'}}]){const bad=structuredClone(doc.project);Object.assign(bad.balloons[0],patch);expect(()=>validateProject(bad)).toThrow();}});
 it('ZIP round-trips new fields, disabled tail data, original bytes and identical output',async()=>{
  const doc=emptyDocument();doc.project.background={path:'assets/background.png',mime:'image/png',name:'original.png'};doc.bytes=new Uint8Array([137,80,78,71,1,2,3]);const b=overflowBalloon('vertical');b.roundness=83;b.tail.enabled=false;b.textFrame.x+=43;b.style.overflowMode='fit';doc.project.balloons=[b];
  const originalSVG=artworkSVG(doc.project,null),files=await unzipBounded(projectZip(doc)),restored=validateProject(JSON.parse(strFromU8(files['project.json'])));
  expect(files['assets/background.png']).toEqual(doc.bytes);expect(restored).toEqual(doc.project);expect(artworkSVG(restored,null)).toBe(originalSVG);
 });
 it('undoes and redoes independent movement, roundness, tail and fit settings together',()=>{
  let p=emptyDocument().project;p.balloons=[newBalloon('rounded',1000,1400,0)];const original=structuredClone(p),history:HistoryState={past:[],future:[]};recordHistory(history,p);p=structuredClone(p);p.balloons[0]=moveBalloon(p.balloons[0],60,30,'text');p.balloons[0].roundness=92;p.balloons[0].tail.enabled=false;p.balloons[0].style.overflowMode='fit';const changed=structuredClone(p);p=undoProject(history,p)!;expect(p).toEqual(original);p=redoProject(history,p)!;expect(p).toEqual(changed);expect(original.balloons[0].tail.enabled).toBe(true);
 });
});
