import type { Project } from './model';
export type HistoryState={past:Project[];future:Project[]};
export function recordHistory(history:HistoryState,project:Project){history.past.push(structuredClone(project));if(history.past.length>100)history.past.shift();history.future=[];}
export function undoProject(history:HistoryState,current:Project):Project|undefined{const previous=history.past.pop();if(!previous)return;history.future.push(structuredClone(current));return structuredClone(previous);}
export function redoProject(history:HistoryState,current:Project):Project|undefined{const next=history.future.pop();if(!next)return;history.past.push(structuredClone(current));return structuredClone(next);}
