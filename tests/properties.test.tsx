import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PropertiesPanel} from '../src/PropertiesPanel';
import type {PropertiesProps} from '../src/PropertiesPanel';
import {newBalloon} from '../src/model';
const noop=()=>{};
const props=(kind:'ellipse'|'text'):PropertiesProps=>({b:newBalloon(kind,1000,1400,0),textInfo:null,textEditing:false,editTarget:'body',setEditTarget:noop,setTextFocused:noop,onTextFocus:noop,onTextBlur:noop,update:noop,style:noop,outline:noop,shadow:noop,loadFamily:noop,duplicate:noop,remove:noop});
it('keeps the dialogue visible and every details group initially collapsed',()=>{const html=renderToStaticMarkup(<PropertiesPanel {...props('ellipse')}/>);expect(html).toContain('<textarea');expect(html.match(/aria-expanded="false"/g)).toHaveLength(6);expect(html).not.toContain('aria-label="文字色"');expect(html).not.toContain('aria-label="しっぽを表示"');expect(html.indexOf('<textarea')).toBeLessThan(html.indexOf('文字設定'));});
it('hides balloon and tail settings for standalone text',()=>{const html=renderToStaticMarkup(<PropertiesPanel {...props('text')}/>);expect(html).not.toContain('吹き出し設定');expect(html).not.toContain('しっぽ設定');expect(html).toContain('文字設定');});

it('shows a single operation target button directly after the dialogue input',()=>{const html=renderToStaticMarkup(<PropertiesPanel {...props('ellipse')}/>);expect(html).toContain('操作対象：吹き出し');expect(html.indexOf('操作対象：')).toBeGreaterThan(html.indexOf('</textarea>'));expect(html).not.toContain('aria-label="操作対象"');});
