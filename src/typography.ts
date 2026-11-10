import * as fontkit from 'fontkit';
import type { Balloon } from './model';
type Font = fontkit.Font;
const fonts=new Map<string,Font>();
const pending=new Map<string,Promise<void>>();
export async function ensureFont(family:'sans'|'serif'):Promise<void>{
 if(fonts.has(family))return;
 if(pending.has(family))return pending.get(family)!;
 const task=(async()=>{const response=await fetch(`${import.meta.env.BASE_URL}fonts/${family==='sans'?'NotoSansJP':'NotoSerifJP'}.ttf`);if(!response.ok)throw new Error('フォントを読み込めませんでした。接続を確認して再試行してください。');registerFont(family,new Uint8Array(await response.arrayBuffer()));})();
 pending.set(family,task);try{await task;}finally{pending.delete(family);}
}
export function registerFont(family:string,data:Uint8Array){const font=fontkit.create(data as never) as Font;fonts.set(family,font.getVariation({wght:400}));fonts.set(family+'-bold',font.getVariation({wght:700}));}
export type GlyphPath={ d:string; transform:string };
export type TextLayout={ paths:GlyphPath[]; overflow:boolean; missing:boolean };
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
 const s=b.style,font=fonts.get(s.family+(s.bold?'-bold':''));if(!font)return{paths:[],overflow:false,missing:false};
 const scale=s.size/font.unitsPerEm, factor=b.kind==='ellipse'?Math.SQRT1_2: .94;
 const innerW=Math.max(1,b.width*factor-s.padding*2),innerH=Math.max(1,b.height*factor-s.padding*2);
 const left=(b.width-innerW)/2,top=(b.height-innerH)/2;
 const vertical=s.direction==='vertical', limit=vertical?innerH:innerW;
 type Token={text:string;advance:number;latin:boolean};
 const tokens=(text:string):Token[]=>{
 const pieces:string[]=[];
 for(const char of chars(text)){if(vertical&&/^[A-Za-z0-9]+$/.test(char)&&pieces.length&&/^[A-Za-z0-9]+$/.test(pieces.at(-1)!))pieces[pieces.length-1]+=char;else pieces.push(char);}
 return pieces.map(text=>{const latin=vertical&&/^[A-Za-z0-9]+$/.test(text);const run=shape(font,text,vertical&&!latin);return{text,latin,advance:(vertical&&!latin?s.size:run.positions.reduce((a,p)=>a+p.xAdvance*scale,0))+s.spacing};});
 };
 const lines:Token[][]=[];
 for(const paragraph of b.text.split('\n')){
  const all=tokens(paragraph);let line:Token[]=[],used=0;
  for(const token of all){
   if(line.length&&used+token.advance>limit&&!noStart.test(token.text)){
    let carry:Token|undefined;
    if(noEnd.test(line.at(-1)!.text)&&line.length>1)carry=line.pop();
    lines.push(line);line=carry?[carry]:[];used=carry?.advance||0;
   }
   line.push(token);used+=token.advance;
  }
  lines.push(line);
 }
 const cross=s.size*s.lineHeight,extent=lines.length? (lines.length-1)*cross+s.size:0;
 let overflow=extent>(vertical?innerW:innerH)+.1,missing=false;
 const paths:GlyphPath[]=[];
 lines.forEach((line,lineIndex)=>{
  const length=Math.max(0,line.reduce((a,t)=>a+t.advance,0)-s.spacing);
  if(length>limit+.1)overflow=true;
  let cursor=(s.align==='center'?(limit-length)/2:s.align==='end'?limit-length:0);
  const colX=left+(innerW+extent)/2-s.size/2-lineIndex*cross;
  const rowY=top+(innerH-extent)/2+lineIndex*cross+font.ascent*scale;
  for(const token of line){
   const run=shape(font,token.text,vertical&&!token.latin);
   let offset=0;
   run.glyphs.forEach((glyph,i)=>{
    if(glyph.id===0)missing=true;
    const pos=run.positions[i];let transform:string;
    if(vertical){
     if(token.latin){
      const width=token.advance-s.spacing;
      const mid=(font.ascent+font.descent)*scale/2;
      transform=`translate(${colX} ${top+cursor+width/2}) rotate(90) translate(${-width/2+offset+pos.xOffset*scale} ${mid-pos.yOffset*scale}) scale(${scale} ${-scale})`;
     }else{
      transform=`translate(${colX-glyph.advanceWidth*scale/2} ${top+cursor+font.ascent*scale}) scale(${scale} ${-scale})`;
     }
    }else transform=`translate(${left+cursor+offset+pos.xOffset*scale} ${rowY-pos.yOffset*scale}) scale(${scale} ${-scale})`;
    paths.push({d:glyph.path.toSVG(),transform});offset+=pos.xAdvance*scale;
   });
   cursor+=token.advance;
  }
 });
 return{paths,overflow,missing};
}
