import{beforeAll,afterEach,it,expect,vi}from'vitest';import{create,act}from'react-test-renderer';import type{ReactTestInstance,ReactTestRenderer}from'react-test-renderer';import{readFileSync}from'node:fs';import App from'../src/App';import{registerFont}from'../src/typography';import{download}from'../src/io';
vi.mock('../src/io',async load=>({...await load<typeof import('../src/io')>(),download:vi.fn(),decodeImage:vi.fn(async()=>({mime:'image/png',url:'data:image/png;base64,background',width:1000,height:1400}))}));
beforeAll(()=>registerFont('sans',readFileSync('public/fonts/NotoSansJP.ttf')));let renderer:ReactTestRenderer;
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());vi.useRealTimers();vi.unstubAllGlobals();vi.mocked(download).mockClear();});
const text=(n:ReactTestInstance|string):string=>typeof n==='string'?n:n.children.map(text).join('');
it('creates every kind at the current screen center after zoom and paper-origin changes via the App tool buttons',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),confirm:()=>true});vi.stubGlobal('innerWidth',1400);
 const origin={left:0,top:0};
 const node={clientWidth:800,clientHeight:600,clientLeft:0,clientTop:0,scrollTo:vi.fn(),focus:vi.fn(),click:vi.fn(),getBoundingClientRect:()=>({left:240,top:120})};
 await act(async()=>{renderer=create(<App/>,{createNodeMock:element=>element.type==='svg'&&element.props['aria-label']==='漫画編集キャンバス'?{getBoundingClientRect:()=>({...origin})}:node});});
 await act(async()=>renderer.root.findByProps({'aria-label':'漫画画像ファイル'}).props.onChange({target:{files:[new File([new Uint8Array([137,80,78,71])],'page.png',{type:'image/png'})],value:''}}));
 await act(async()=>{vi.advanceTimersByTime(60);});
 // Raise zoom so that both viewport-center coordinates lie inside the paper.
 await act(async()=>{for(let i=0;i<8;i++)renderer.root.findByProps({'aria-label':'拡大'}).props.onClick();});
 const cases=[['楕円＋','ellipse',-100,-300],['角丸四角＋','rounded',-300,-700],['文字のみ＋','text',-500,-900],['ギザギザ＋','zigzag',-600,-1100]]as const;
 const expected:{x:number;y:number;kind:string}[]=[];
 for(const[label,kind,left,top]of cases){origin.left=left;origin.top=top;const zoom=renderer.root.findByProps({'aria-label':'漫画編集キャンバス'}).props.width/1000;expected.push({kind,x:(640-left)/zoom,y:(420-top)/zoom});await act(async()=>{renderer.root.findAllByType('button').find(n=>text(n)===label)!.props.onClick();});}
 await act(async()=>{await renderer.root.findAllByType('button').find(n=>text(n)==='セリフ設定をJSON保存')!.props.onClick();});
 const data=JSON.parse(await vi.mocked(download).mock.calls[0][0].text());expect(data.balloons).toHaveLength(4);
 data.balloons.forEach((b:any,i:number)=>{expect(b.kind).toBe(expected[i].kind);expect(b.x+b.width/2).toBeCloseTo(expected[i].x);expect(b.y+b.height/2).toBeCloseTo(expected[i].y);expect(b.clip.x).toBeCloseTo(b.x);expect(b.clip.y).toBeCloseTo(b.y);});
});
