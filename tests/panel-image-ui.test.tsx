import{afterEach,beforeAll,it,expect,vi}from'vitest';import{create,act}from'react-test-renderer';import type{ReactTestRenderer,ReactTestInstance}from'react-test-renderer';import{readFileSync}from'node:fs';import App from'../src/App';import{registerFont}from'../src/typography';import{download,decodeImage,unzipBounded}from'../src/io';import{zipSync,strToU8}from'fflate';
vi.mock('../src/io',async load=>({...await load<typeof import('../src/io')>(),download:vi.fn(),decodeImage:vi.fn()}));
beforeAll(()=>registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf')));let renderer:ReactTestRenderer;
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());vi.useRealTimers();vi.unstubAllGlobals();vi.mocked(download).mockClear();vi.mocked(decodeImage).mockReset();});
const text=(n:ReactTestInstance|string):string=>typeof n==='string'?n:n.children.map(text).join('');const button=(name:string)=>renderer.root.findAllByType('button').find(n=>text(n)===name)!;
async function click(name:string){expect(button(name),name).toBeDefined();await act(async()=>{await button(name).props.onClick();});}
async function change(label:string,value:string){await act(async()=>renderer.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));}
const origin={left:-200,top:-300};
async function setup(){vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('innerWidth',1400);vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),confirm:()=>true});vi.mocked(decodeImage).mockResolvedValue({width:100,height:50,mime:'image/png',url:'data:image/png;base64,source'});const node={clientWidth:800,clientHeight:600,clientLeft:0,clientTop:0,scrollTo:vi.fn(),focus:vi.fn(),click:vi.fn(),getBoundingClientRect:()=>({left:240,top:120})};await act(async()=>{renderer=create(<App/>,{createNodeMock:e=>e.type==='svg'&&e.props['aria-label']==='漫画編集キャンバス'?{getBoundingClientRect:()=>origin}:node});});await click('新規プロジェクト');await click('漫画ページを作成');await act(async()=>{vi.advanceTimersByTime(60);});await click('コマ選択');await select(1);}
async function select(n:number){await act(async()=>renderer.root.findByProps({'aria-label':`コマ ${n}`}).props.onPointerDown(pointer(100,100)));await act(async()=>viewport().props.onPointerUp());}
const viewport=()=>renderer.root.findAllByType('div').find(n=>typeof n.props.className==='string'&&n.props.className.startsWith('canvas-viewport'))!;
const pointer=(x:number,y:number)=>{const zoom=renderer.root.findByProps({'aria-label':'漫画編集キャンバス'}).props.width/1200;return{clientX:origin.left+x*zoom,clientY:origin.top+y*zoom,pointerId:1,preventDefault:vi.fn(),stopPropagation:vi.fn(),currentTarget:{setPointerCapture:vi.fn()}};};
const file=(last=3)=>new File([new Uint8Array([137,80,78,71,1,2,last])],'source.png',{type:'image/png'});
async function image(f=file()){await act(async()=>{await renderer.root.findByProps({'aria-label':'コマ内画像ファイル'}).props.onChange({target:{files:[f],value:''}});});}
async function saved(){await click('保存');const blob=vi.mocked(download).mock.calls.at(-1)![0];const files=await unzipBounded(new Uint8Array(await blob.arrayBuffer()));return{blob,p:JSON.parse(new TextDecoder().decode(files['project.json']))};}
async function undo(){await act(async()=>renderer.root.findByProps({'aria-label':'取り消し (Ctrl / ⌘ Z)'}).props.onClick());}
async function redo(){await act(async()=>renderer.root.findByProps({'aria-label':'やり直し (Ctrl / ⌘ Shift Z)'}).props.onClick());}
it('separates zoomed image dragging from frame editing, reuses sources, and restores image bytes through undo and ZIP',async()=>{
 await setup();expect(button('内部画像を編集').props.disabled).toBe(true);await image();let {p}=await saved();expect(p.assets).toHaveLength(1);const initial=structuredClone(p);
 await click('内部画像を編集');expect(renderer.root.findAllByProps({'aria-label':'コマのseサイズ変更'})).toHaveLength(0);
 await act(async()=>renderer.root.findByProps({'aria-label':'コマ 1'}).props.onPointerDown(pointer(100,100)));await act(async()=>viewport().props.onPointerMove(pointer(180,145)));await act(async()=>viewport().props.onPointerMove(pointer(220,170)));await act(async()=>viewport().props.onPointerUp());
 p=(await saved()).p;expect(p.panels[0].points).toEqual(initial.panels[0].points);expect(p.panels[0].image.offsetX).toBeCloseTo(initial.panels[0].image.offsetX+120);expect(p.panels[0].image.offsetY).toBeCloseTo(initial.panels[0].image.offsetY+70);
 await undo();expect((await saved()).p).toEqual(initial);await redo();expect((await saved()).p).toEqual(p);await select(1);await click('Contain');await change('画像の拡大率（%）','250');await click('表示位置をリセット');const arranged=(await saved()).p;
 await click('コマ枠を編集');await change('コマ幅','700');expect((await saved()).p.panels[0].image).toEqual(arranged.panels[0].image);
 await select(2);await image();p=(await saved()).p;expect(p.assets).toHaveLength(1);expect(p.panels[0].image.assetId).toBe(p.panels[1].image.assetId);
 await image(file(9));p=(await saved()).p;expect(p.assets).toHaveLength(2);expect(p.panels[0].image.assetId).not.toBe(p.panels[1].image.assetId);
 await click('画像を削除');expect((await saved()).p.panels).toHaveLength(2);expect((await saved()).p.assets).toHaveLength(1);await undo();const restored=await saved();expect(restored.p).toEqual(p);
 class Reader{result='data:image/png;base64,source';onload=()=>{};readAsDataURL(){this.onload();}}class Image{naturalWidth=100;naturalHeight=50;onload=()=>{};set src(_:string){this.onload();}}vi.stubGlobal('FileReader',Reader);vi.stubGlobal('Image',Image);
 await act(async()=>renderer.root.findByProps({'aria-label':'プロジェクトZIPファイル'}).props.onChange({target:{files:[new File([restored.blob],'page.zip')],value:''}}));expect((await saved()).p).toEqual(p);
});
it('cancels a stale asynchronous import and retains all artwork after image or ZIP loading errors',async()=>{
 await setup();await image();const before=(await saved()).p;let resolve!:(v:Awaited<ReturnType<typeof decodeImage>>)=>void;vi.mocked(decodeImage).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));let task!:Promise<void>;
 await act(async()=>{task=renderer.root.findByProps({'aria-label':'コマ内画像ファイル'}).props.onChange({target:{files:[file(4)],value:''}});await Promise.resolve();});await select(2);await act(async()=>{resolve({width:100,height:50,mime:'image/png',url:'data:image/png;base64,other'});await task;});expect((await saved()).p).toEqual(before);
 await select(1);vi.mocked(decodeImage).mockRejectedValueOnce(Error('画像が破損しています'));await image(file(8));expect((await saved()).p).toEqual(before);
 const broken=zipSync({'project.json':strToU8(JSON.stringify(before))});await act(async()=>renderer.root.findByProps({'aria-label':'プロジェクトZIPファイル'}).props.onChange({target:{files:[new File([broken as BlobPart],'missing.zip')],value:''}}));expect((await saved()).p).toEqual(before);
});
