import type { Balloon } from './model';
import { layoutText } from './typography';
// Identical SVG markup is used in the editor and in the PNG artwork.
export function textArtworkSVG(b:Balloon):string{
 const layout=layoutText(b),{outline,shadow}=b.style.decoration;
 const fill=layout.paths.map(g=>`<path d="${g.d}" transform="${g.transform}"/>`).join('');
 const foreground=`<g fill="${b.style.color}">${fill}</g>`;
 if(!layout.paths.length || (!outline.enabled&&!shadow.enabled))return foreground;
 const width=outline.enabled?outline.width:0;
 const silhouette=(color:string)=>layout.paths.map(g=>`<path d="${g.d}" transform="${g.transform}" fill="${color}"${width?` stroke="${color}" stroke-width="${2*width/g.scale}" stroke-linejoin="round"`:''}/>`).join('');
 const rim=width?`<g fill="none" stroke="${outline.color}" stroke-linejoin="round">${layout.paths.map(g=>`<path d="${g.d}" transform="${g.transform}" stroke-width="${2*width/g.scale}"/>`).join('')}</g>`:'';
 let shade='';
 if(shadow.enabled&&layout.bounds){
  const bounds=layout.bounds,margin=width+4*shadow.blur+2;
  const id='text-shadow-'+Array.from(b.id,c=>c.codePointAt(0)!.toString(16)).join('-');
  const filter=shadow.blur>0?`<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${bounds.left-margin}" y="${bounds.top-margin}" width="${Math.max(1,bounds.right-bounds.left+margin*2)}" height="${Math.max(1,bounds.bottom-bounds.top+margin*2)}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${shadow.blur}"/></filter></defs>`:'';
  shade=`${filter}<g transform="translate(${shadow.x} ${shadow.y})"><g${shadow.blur>0?` filter="url(#${id})"`:''}>${silhouette(shadow.color)}</g></g>`;
 }
 // Every outline is behind every fill, so inner halves never cover the letters.
 return shade+rim+foreground;
}
