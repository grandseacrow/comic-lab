import type{Document}from'./model';
import{uid,validateProject}from'./model';
import{templatePanels}from'./panels';
import type{PageSettings}from'./page-data';
export function newPageDocument(width:number,height:number,settings:Partial<PageSettings>={}):Document{
 const page:PageSettings={mode:'new-page',backgroundColor:'#ffffff',margin:40,gutter:20,template:'blank',...settings};
 return{project:validateProject({id:uid(),version:2,title:'新規漫画ページ',width,height,background:null,balloons:[],page,panels:templatePanels(width,height,page,page.template)}),image:null,bytes:null};
}
