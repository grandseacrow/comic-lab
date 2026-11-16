export type ShortcutAction='save'|'undo'|'redo'|'copy'|'paste'|'duplicate'|'delete'|'cancel'|'select'|'pan'|'ellipse'|'rounded'|'text'|'zigzag'|'export';
export const candidateKeys={select:'Alt + V',pan:'Alt + H',ellipse:'Alt + Q',rounded:'Alt + R',text:'Alt + T',zigzag:'Alt + G',export:'Ctrl / ⌘ + Shift + E'};
export function inputTarget(target:EventTarget|null){return!!(target as HTMLElement|null)?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');}
export function shortcutAction(e:KeyboardEvent,options:{modal:boolean;composing:boolean;endedAt:number;now:number;experimental:boolean}):ShortcutAction|undefined{
 if(e.isComposing||e.keyCode===229||options.composing||options.now-options.endedAt<80||inputTarget(e.target))return;
 if(e.key==='Escape')return'cancel';if(options.modal)return;const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
 if(mod&&!e.altKey){if(key==='z')return e.shiftKey?'redo':'undo';if(!e.shiftKey){const map:Record<string,ShortcutAction>={s:'save',c:'copy',v:'paste',d:'duplicate',y:'redo'};return map[key];}if(options.experimental&&key==='e')return'export';}
 if(!mod&&!e.altKey&&!e.shiftKey&&(e.key==='Delete'||e.key==='Backspace'))return'delete';
 if(options.experimental&&e.altKey&&!mod&&!e.shiftKey){const map:Record<string,ShortcutAction>={v:'select',h:'pan',q:'ellipse',r:'rounded',t:'text',g:'zigzag'};return map[key];}
}
