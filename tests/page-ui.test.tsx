import {afterEach,beforeAll,it,expect,vi}from'vitest';
import{create,act}from'react-test-renderer';
import type{ReactTestRenderer,ReactTestInstance}from'react-test-renderer';
import{readFileSync}from'node:fs';
import App from'../src/App';
import{registerFont}from'../src/typography';
import{download,unzipBounded}from'../src/io';
import{panelBounds}from'../src/page-data';
vi.mock('../src/io',async load=>({...await load<typeof import('../src/io')>(),download:vi.fn()}));
beforeAll(()=>registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf')));
let renderer:ReactTestRenderer;
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());vi.useRealTimers();vi.unstubAllGlobals();vi.mocked(download).mockClear();});
const text=(n:ReactTestInstance|string):string=>typeof n==='string'?n:n.children.map(text).join('');
const button=(name:string)=>renderer.root.findAllByType('button').find(n=>text(n)===name)!;
async function click(name:string){expect(button(name),name).toBeDefined();await act(async()=>{await button(name).props.onClick();});}
async function change(label:string,value:string){await act(async()=>renderer.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));}
const viewport=()=>renderer.root.findAllByType('div').find(n=>typeof n.props.className==='string'&&n.props.className.startsWith('canvas-viewport'))!;
const artwork=()=>renderer.root.findAll(n=>!!n.props.dangerouslySetInnerHTML).map(n=>n.props.dangerouslySetInnerHTML.__html);
async function saved(){await click('プロジェクト保存');const blob=vi.mocked(download).mock.calls.at(-1)![0];const files=await unzipBounded(new Uint8Array(await blob.arrayBuffer()));return{blob,project:JSON.parse(new TextDecoder().decode(files['project.json']))};}
const origin={left:-200,top:-300};
async function setup(){vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('innerWidth',1400);vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),confirm:vi.fn(()=>true)});const node={clientWidth:800,clientHeight:600,clientLeft:0,clientTop:0,scrollTo:vi.fn(),focus:vi.fn(),click:vi.fn(),getBoundingClientRect:()=>({left:240,top:120})};await act(async()=>{renderer=create(<App/>,{createNodeMock:e=>e.type==='svg'&&e.props['aria-label']==='漫画編集キャンバス'?{getBoundingClientRect:()=>origin}:node});});await click('新規作成');await click('漫画ページを作成');await act(async()=>{vi.advanceTimersByTime(60);});}
const pointer=(x:number,y:number)=>{const zoom=renderer.root.findByProps({'aria-label':'漫画編集キャンバス'}).props.width/1200;return{clientX:origin.left+x*zoom,clientY:origin.top+y*zoom,pointerId:1,preventDefault:vi.fn(),stopPropagation:vi.fn(),currentTarget:{setPointerCapture:vi.fn()}};};
it('edits panels at zoomed paper coordinates without touching dialogue, then saves/restores a complete page ZIP',async()=>{
 await setup();expect(renderer.root.findAllByProps({'aria-label':'コマ 1'})).toHaveLength(1);
 await click('ギザギザ＋');const before=artwork();expect(before).toHaveLength(1);await click('コマ選択');expect(artwork()).toEqual(before);
 const initial=(await saved()).project;const panel=initial.panels[0],bounds=panelBounds(panel);
 await act(async()=>renderer.root.findByProps({'aria-label':'コマ 1'}).props.onPointerDown(pointer(bounds.x+10,bounds.y+10)));
 await act(async()=>viewport().props.onPointerMove(pointer(bounds.x+35,bounds.y+40)));await act(async()=>viewport().props.onPointerUp());
 expect(artwork()).toEqual(before);expect(renderer.root.findByProps({'aria-label':'コマ X'}).props.value).toBe(65);
 await act(async()=>renderer.root.findByProps({'aria-label':'コマのseサイズ変更'}).props.onPointerDown(pointer(bounds.x+bounds.width+25,bounds.y+bounds.height+30)));
 await act(async()=>viewport().props.onPointerMove(pointer(bounds.x+bounds.width-50,bounds.y+bounds.height-60)));await act(async()=>viewport().props.onPointerUp());
 await change('コマ枠線の太さ','7');await change('コマ枠線色','#aabbcc');const edited=await saved();
 expect(edited.project.balloons).toEqual(initial.balloons);expect(edited.project.panels[0].borderWidth).toBe(7);expect(edited.project.panels[0].borderColor).toBe('#aabbcc');
 await click('選択コマを削除');expect(renderer.root.findAllByProps({'aria-label':'コマ 1'})).toHaveLength(1);expect((await saved()).project.panels).toHaveLength(1);
 await act(async()=>renderer.root.findByProps({'aria-label':'取り消し (Ctrl / ⌘ Z)'}).props.onClick());expect((await saved()).project.panels).toEqual(edited.project.panels);
 await act(async()=>renderer.root.findByProps({'aria-label':'やり直し (Ctrl / ⌘ Shift Z)'}).props.onClick());expect((await saved()).project.panels).toHaveLength(1);
 await act(async()=>renderer.root.findByProps({'aria-label':'プロジェクトZIPファイル'}).props.onChange({target:{files:[new File([edited.blob],'page.zip')],value:''}}));
 expect((await saved()).project).toEqual(edited.project);expect(artwork()).toEqual(before);
 await act(async()=>renderer.root.findByProps({'aria-label':'プロジェクトZIPファイル'}).props.onChange({target:{files:[new File(['broken'],'invalid.zip')],value:''}}));expect((await saved()).project).toEqual(edited.project);
 // Dialogue JSON stays dialogue-only; applying it leaves the entire panel layer intact.
 await click('セリフ設定をJSON保存');const json=await vi.mocked(download).mock.calls.at(-1)![0].text(),data=JSON.parse(json);expect(data).not.toHaveProperty('page');expect(data).not.toHaveProperty('panels');
 await act(async()=>renderer.root.findByProps({'aria-label':'セリフ設定JSONファイル'}).props.onChange({target:{files:[new File([json],'dialogues.json')],value:''}}));await click('置き換えて読み込む');expect((await saved()).project).toEqual(edited.project);
});
it('creates blank/preset pages, adds panels, confirms template replacement, and preserves balloons and selection UI state',async()=>{
 await setup();await click('文字のみ＋');await click('文字設定');await click('コマ選択');const hit=renderer.root.findAllByType('rect').find(n=>n.props.pointerEvents==='none'&&n.props.transform);expect(hit).toBeDefined();await click('通常コマを追加');expect((await saved()).project.panels).toHaveLength(3);
 vi.mocked(window.confirm).mockReturnValueOnce(false);await change('コマ割りテンプレート','blank');await click('テンプレートを適用');expect((await saved()).project.panels).toHaveLength(3);
 await click('テンプレートを適用');let p=(await saved()).project;expect(p.panels).toHaveLength(0);expect(p.balloons).toHaveLength(1);
 await change('ページサイズ','landscape');await change('ページ背景色','#eeddcc');await change('ページ余白','60');await change('コマ間隔','30');await change('コマ割りテンプレート','four-grid');await click('テンプレートを適用');p=(await saved()).project;expect(p.width).toBe(1800);expect(p.height).toBe(1200);expect(p.page.backgroundColor).toBe('#eeddcc');expect(panelBounds(p.panels[0]).x).toBe(60);expect(p.panels).toHaveLength(4);
 const balloonLayer=renderer.root.findAllByType('button').find(n=>typeof n.props.className==='string'&&n.props.className.startsWith('layer-row')&&text(n).includes('セリフを入力'))!;await act(async()=>balloonLayer.props.onClick());
 // The original properties component stays mounted while editing panels.
 expect(button('文字設定').props['aria-expanded']).toBe(true);
});
