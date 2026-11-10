import type {Balloon} from './model';
import {balloonPath} from './geometry';
import {textArtworkSVG} from './text-artwork';
function rotated(angle:number,cx:number,cy:number,content:string){return angle?`<g transform="rotate(${angle} ${cx} ${cy})">${content}</g>`:content;}
export function objectArtworkSVG(b:Balloon):string{
 const body=b.kind==='text'?'':`<path d="${balloonPath(b)}" fill="${b.fill}" stroke="${b.stroke}" stroke-width="${b.strokeWidth}" stroke-linejoin="round"/>`;
 const f=b.textFrame,shape=rotated(b.bodyRotation,b.width/2,b.height/2,body),text=rotated(b.textRotation,f.x+f.width/2,f.y+f.height/2,textArtworkSVG(b));
 const placed=(content:string)=>`<g transform="translate(${b.x} ${b.y})">${content}</g>`;
 if(!b.clip.enabled||b.kind==='text')return placed(shape+text);
 const c=b.clip,id='object-clip-'+Array.from(b.id,p=>p.codePointAt(0)!.toString(16)).join('-');
 const defs=`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"/></clipPath></defs>`;
 // Clip in manuscript space, outside any rotation/translation of the artwork.
 return defs+`<g clip-path="url(#${id})">${placed(shape+(c.includeText?text:''))}</g>`+(c.includeText?'':placed(text));
}
