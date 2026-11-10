import type{Balloon,Point}from'./model';
export type ViewRect={left:number;top:number;width:number;height:number};
export function creationCenter(view:ViewRect,origin:Point,zoom:number,page:{width:number;height:number}):Point{
 const fallback={x:page.width/2,y:page.height/2};
 if(!Number.isFinite(zoom)||zoom<=0||view.width<=0||view.height<=0||![view.left,view.top,view.width,view.height,origin.x,origin.y].every(Number.isFinite))return fallback;
 const axis=(start:number,length:number,paperStart:number,pixels:number)=>{
  const middle=start+length/2,paperEnd=paperStart+pixels*zoom;
  if(middle>=paperStart&&middle<=paperEnd)return(middle-paperStart)/zoom;
  // At page margins or a fully zoomed-out page, stay in the visible manuscript.
  const first=Math.max(start,paperStart),last=Math.min(start+length,paperEnd);
  return last>first?((first+last)/2-paperStart)/zoom:pixels/2;
 };
 return{x:axis(view.left,view.width,origin.x,page.width),y:axis(view.top,view.height,origin.y,page.height)};
}
export function placeAtCenter(original:Balloon,center:Point):Balloon{
 const b=structuredClone(original),x=center.x-b.width/2,y=center.y-b.height/2;
 b.clip.x=x+(b.clip.x-b.x);b.clip.y=y+(b.clip.y-b.y);b.x=x;b.y=y;
 return b;
}
