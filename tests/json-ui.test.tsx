import {afterEach,beforeAll,it,expect,vi}from'vitest';
import{create,act}from'react-test-renderer';
import type{ReactTestRenderer,ReactTestInstance}from'react-test-renderer';
import{readFileSync}from'node:fs';
import App from'../src/App';
import{registerFont}from'../src/typography';
import{download}from'../src/io';
vi.mock('../src/io',async importOriginal=>({...await importOriginal<typeof import('../src/io')>(),download:vi.fn(),decodeImage:vi.fn(async()=>({mime:'image/png',url:'data:image/png;base64,background',width:1000,height:1400}))}));
beforeAll(()=>{registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf'));vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);});
let renderer:ReactTestRenderer;
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());vi.unstubAllGlobals();vi.mocked(download).mockClear();});
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(text).join('');
const button=(name:string)=>renderer.root.findAllByType('button').find(n=>text(n)===name)!;
async function click(name:string){const b=button(name);expect(b,`button ${name}`).toBeDefined();await act(async()=>{await b.props.onClick();});}
async function number(label:string,value:number){const n=renderer.root.findAllByType('label').find(n=>text(n.children[0]as ReactTestInstance)===label)!;expect(n,`number ${label}`).toBeDefined();await act(async()=>n.findByType('input').props.onChange({target:{value:String(value)}}));}
const artwork=()=>renderer.root.findAll(n=>!!n.props.dangerouslySetInnerHTML).map(n=>n.props.dangerouslySetInnerHTML.__html);
it('saves and reloads edited jagged and dragged clip values through the actual App buttons and JSON file handlers',async()=>{
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),confirm:()=>true});vi.stubGlobal('innerWidth',1400);
 await act(async()=>{renderer=create(<App/>,{createNodeMock:()=>({clientWidth:800,clientHeight:800,scrollTo:vi.fn(),focus:vi.fn(),getBoundingClientRect:()=>({left:0,top:0}),click:vi.fn()})});});
 const image=renderer.root.findByProps({'aria-label':'漫画画像ファイル'});await act(async()=>{await image.props.onChange({target:{files:[new File([new Uint8Array([137,80,78,71])],'background.png',{type:'image/png'})],value:''}});});
 await click('ギザギザ＋');await click('吹き出し設定');await number('ギザギザの数',31);await number('ギザギザの深さ（%）',39);await number('尖り具合（%）',92);
 await click('クリッピング設定');await act(async()=>renderer.root.findByProps({'aria-label':'クリッピングを有効化'}).props.onClick());
 await number('クリップ X',110);await number('クリップ Y',130);await number('クリップ幅',310);await number('クリップ高さ',220);
 await click('範囲をドラッグで編集');const zoom=renderer.root.findByProps({'aria-label':'漫画編集キャンバス'}).props.width/1000;
 await act(async()=>renderer.root.findByProps({'aria-label':'クリップ右下'}).props.onPointerDown({clientX:420*zoom,clientY:350*zoom,pointerId:1,preventDefault:vi.fn(),stopPropagation:vi.fn(),currentTarget:{setPointerCapture:vi.fn()}}));
 const viewport=()=>renderer.root.findAllByType('div').find(n=>typeof n.props.className==='string'&&n.props.className.startsWith('canvas-viewport'))!;
 await act(async()=>viewport().props.onPointerMove({clientX:465*zoom,clientY:382*zoom}));await act(async()=>viewport().props.onPointerUp());
 const before=artwork();await click('セリフ設定をJSON保存');expect(download).toHaveBeenCalledTimes(1);
 expect(vi.mocked(download).mock.calls[0][1]).toBe('comic-lab-dialogues-v1.51.json');
 const [blob]=vi.mocked(download).mock.calls[0];const json=await blob.text(),raw=JSON.parse(json),b=raw.balloons[0];
 expect(b.kind).toBe('zigzag');expect(b.zigzag).toEqual({count:31,depth:.39,sharpness:.92});expect(b.clip.enabled).toBe(true);expect(b.clip.x).toBe(110);expect(b.clip.y).toBe(130);expect(b.clip.width).toBeCloseTo(355);expect(b.clip.height).toBeCloseTo(252);
 await click('削除');expect(artwork()).toEqual([]);
 await act(async()=>{await renderer.root.findByProps({'aria-label':'セリフ設定JSONファイル'}).props.onChange({target:{files:[new File([json],'dialogues.json',{type:'application/json'})],value:''}});});
 expect(button('置き換えて読み込む')).toBeDefined();await click('置き換えて読み込む');expect(artwork()).toEqual(before);
 await click('セリフ設定をJSON保存');const again=JSON.parse(await vi.mocked(download).mock.calls[1][0].text());expect(again.balloons).toEqual(raw.balloons);
 for(const field of ['clip','zigzag']){const broken=structuredClone(again);delete broken.balloons[0][field];await act(async()=>{await renderer.root.findByProps({'aria-label':'セリフ設定JSONファイル'}).props.onChange({target:{files:[new File([JSON.stringify(broken)],'broken.json',{type:'application/json'})],value:''}});});expect(artwork()).toEqual(before);expect(renderer.root.findAllByProps({role:'dialog'})).toHaveLength(0);expect(text(renderer.root.findByProps({role:'alert'}))).toContain('欠落');}
 const legacy=structuredClone(again);legacy.version=1;delete legacy.balloons[0].clip;delete legacy.balloons[0].zigzag;await act(async()=>{await renderer.root.findByProps({'aria-label':'セリフ設定JSONファイル'}).props.onChange({target:{files:[new File([JSON.stringify(legacy)],'legacy.json',{type:'application/json'})],value:''}});});expect(renderer.root.findAllByProps({role:'alert'})).toHaveLength(2);expect(artwork()).toEqual(before);await click('キャンセル');expect(artwork()).toEqual(before);


});
