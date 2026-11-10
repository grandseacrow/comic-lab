import * as fontkit from 'fontkit';
import type { Balloon } from './model';
import { bodyContainsPoint } from './geometry';
type Font = fontkit.Font;
const fonts=new Map<string,Font>();
const layoutCache=new Map<string,TextLayout>();
const pending=new Map<string,Promise<void>>();
export async function ensureFont(family:'sans'|'serif'):Promise<void>{
 if(fonts.has(family))return;
 if(pending.has(family))return pending.get(family)!;
 const task=(async()=>{const response=await fetch(`${import.meta.env.BASE_URL}fonts/${family==='sans'?'NotoSansJP':'NotoSerifJP'}.ttf`);if(!response.ok)throw new Error('フォントを読み込めませんでした。接続を確認して再試行してください。');registerFont(family,new Uint8Array(await response.arrayBuffer()));})();
 pending.set(family,task);try{await task;}finally{pending.delete(family);}
}
export function registerFont(family:string,data:Uint8Array){layoutCache.clear();const font=fontkit.create(data as never) as Font;fonts.set(family,font.getVariation({wght:400}));fonts.set(family+'-bold',font.getVariation({wght:700}));}
export type GlyphPath={ d:string; transform:string; scale:number };
export type TextLayout={ paths:GlyphPath[]; overflow:boolean; requestedOverflow:boolean; outsideBody:boolean; warning:boolean; missing:boolean; effectiveSize:number; lineCount:number; bounds:{left:number;top:number;right:number;bottom:number}|null };
const shapeCache=new Map<string,ReturnType<Font['layout']>>();
const fontIds=new WeakMap<Font,number>();let nextFontId=0;
function shape(font:Font,text:string,vertical:boolean){
 if(!fontIds.has(font))fontIds.set(font,++nextFontId);
 const key=`${fontIds.get(font)}:${text}:${vertical}`;
 const existing=shapeCache.get(key);if(existing)return existing;
 const result=font.layout(text,vertical?['vert','vrt2']:[]);
 if(shapeCache.size>3000)shapeCache.clear();shapeCache.set(key,result);return result;
}
const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
const chars=(text:string)=>Array.from(segmenter.segment(text),x=>x.segment);
const noStart=/^[、。，．！？!?）］｝〉》」』】ぁぃぅぇぉっゃゅょァィゥェォッャュョー]/;
const noEnd=/^[（［｛〈《「『【]/;
export function layoutText(b:Balloon):TextLayout{
 const key=JSON.stringify([b.text,b.style,b.textFrame,b.kind,b.width,b.height,b.roundness]);
 const cached=layoutCache.get(key);if(cached)return cached;
 const result=computeText(b);
 if(fonts.has(b.style.family)){if(layoutCache.size>=200)layoutCache.clear();layoutCache.set(key,result);}
 return result;
}
function computeText(b:Balloon):TextLayout{
 const s=b.style,font=fonts.get(s.family+(s.bold?'-bold':''));
 const empty={paths:[],overflow:false,requestedOverflow:false,outsideBody:false,warning:false,missing:false,effectiveSize:s.size,lineCount:0,bounds:null};
 if(!font||!b.text)return empty;
 const frame=b.textFrame;
 const innerW=Math.max(1,frame.width-s.padding*2),innerH=Math.max(1,frame.height-s.padding*2);
 const left=frame.x+(frame.width-innerW)/2,top=frame.y+(frame.height-innerH)/2;
 const vertical=s.direction==='vertical',limit=vertical?innerH:innerW;
 type Token={text:string;advance:number;latin:boolean};
 const tokens=(text:string):Token[]=>{
  const pieces:string[]=[];
  for(const char of chars(text)){if(vertical&&/^[A-Za-z0-9]+$/.test(char)&&pieces.length&&/^[A-Za-z0-9]+$/.test(pieces.at(-1)!))pieces[pieces.length-1]+=char;else pieces.push(char);}
  return pieces.map(text=>{const latin=vertical&&/^[A-Za-z0-9]+$/.test(text);const run=shape(font,text,vertical&&!latin);return{text,latin,advance:(vertical&&!latin?s.size:run.positions.reduce((a,p)=>a+p.xAdvance*s.size/font.unitsPerEm,0))+s.spacing};});
 };
 // Resolve wrapping ONCE at the requested size. Fit never reflows these lines.
 const lines:Token[][]=[];
 for(const paragraph of b.text.split('\n')){
  const all=tokens(paragraph);let line:Token[]=[],used=0;
  for(const token of all){
   if(s.wrapMode==='auto'&&line.length&&used+token.advance>limit&&!noStart.test(token.text)){
    let carry:Token|undefined;
    if(noEnd.test(line.at(-1)!.text)&&line.length>1)carry=line.pop();
    lines.push(line);line=carry?[carry]:[];used=carry?.advance||0;
   }
   line.push(token);used+=token.advance;
  }
  lines.push(line);
 }
 const calculate=(size:number,emit:boolean)=>{
  const scale=size/font.unitsPerEm,ratio=size/s.size,spacing=s.spacing*ratio;
  const cross=size*s.lineHeight,extent=(lines.length-1)*cross+size;
  let outsideBody=false;
  let overflow=extent>(vertical?innerW:innerH)+.1,missing=false;
  const paths:GlyphPath[]=[];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(x1:number,y1:number,x2:number,y2:number)=>{if(![{x:x1,y:y1},{x:x1,y:y2},{x:x2,y:y1},{x:x2,y:y2}].every(p=>bodyContainsPoint(b,p)))outsideBody=true;minX=Math.min(minX,x1);minY=Math.min(minY,y1);maxX=Math.max(maxX,x2);maxY=Math.max(maxY,y2);};
  lines.forEach((line,lineIndex)=>{
   const length=Math.max(0,line.reduce((a,t)=>a+t.advance*ratio,0)-spacing);
   if(length>limit+.1)overflow=true;
   let cursor=(s.align==='center'?(limit-length)/2:s.align==='end'?limit-length:0);
   const colX=left+(innerW+extent)/2-size/2-lineIndex*cross;
   const rowY=top+(innerH-extent)/2+lineIndex*cross+font.ascent*scale;
   for(const token of line){
    const run=shape(font,token.text,vertical&&!token.latin);let offset=0;
    run.glyphs.forEach((glyph,i)=>{
     if(glyph.id===0)missing=true;
     const pos=run.positions[i],box=glyph.bbox;let transform:string;
     if(vertical&&token.latin){
      const width=token.advance*ratio-spacing,cy=top+cursor+width/2;
      const tx=-width/2+offset+pos.xOffset*scale,ty=(font.ascent+font.descent)*scale/2-pos.yOffset*scale;
      transform=`translate(${colX} ${cy}) rotate(90) translate(${tx} ${ty}) scale(${scale} ${-scale})`;
      if(glyph.path.commands.length)include(colX-ty+box.minY*scale,cy+tx+box.minX*scale,colX-ty+box.maxY*scale,cy+tx+box.maxX*scale);
     }else{
      const x=vertical?colX-glyph.advanceWidth*scale/2:left+cursor+offset+pos.xOffset*scale;
      const y=vertical?top+cursor+font.ascent*scale:rowY-pos.yOffset*scale;
      transform=`translate(${x} ${y}) scale(${scale} ${-scale})`;
      if(glyph.path.commands.length)include(x+box.minX*scale,y-box.maxY*scale,x+box.maxX*scale,y-box.minY*scale);
     }
     if(emit)paths.push({d:glyph.path.toSVG(),transform,scale});offset+=pos.xAdvance*scale;
    });
    cursor+=token.advance*ratio;
   }
  });
  const bounds=Number.isFinite(minX)?{left:minX,top:minY,right:maxX,bottom:maxY}:null;
  if(bounds&&(minX<left-.1||minY<top-.1||maxX>left+innerW+.1||maxY>top+innerH+.1))overflow=true;
  return {paths,overflow,outsideBody,missing,bounds};
 };
 const requested=calculate(s.size,false);let effectiveSize=s.size;
 if(s.overflowMode==='fit'&&requested.overflow){
  let low=.01,high=s.size;
  for(let i=0;i<22;i++){const mid=(low+high)/2;if(calculate(mid,false).overflow)high=mid;else low=mid;}
  effectiveSize=Math.floor(low*1000)/1000;
 }
 const result=calculate(effectiveSize,true);
 return {...result,requestedOverflow:requested.overflow,warning:s.overflowMode==='warn'?(result.overflow||result.outsideBody):s.overflowMode==='fit'&&result.overflow,effectiveSize,lineCount:lines.length};
}
