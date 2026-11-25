"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, Focus, Leaf, Printer, Search, TreeDeciduous, ZoomIn, ZoomOut } from "lucide-react";
import { resolveHeritageRootId, type HeritagePerson } from "@/lib/heritage-tree-layout";
import { buildLivingCanopy, type LivingPerson } from "@/lib/living-canopy";
import { livingWoodCurve } from "@/lib/living-wood";
import type { BoughPoint } from "@/lib/heritage-boughs";

const round = (v: number) => Number(v.toFixed(2));
const palette = ["#90c627", "#b0d92e", "#71ad2c", "#c1df3e", "#81be31", "#a3cf36", "#65a44c"];
const natural = (n: number) => { const v = Math.sin(n * 14.45 + 6.38) * 72843.23; return v - Math.floor(v); };
const serial = (id: string) => Number(id.replace(/\D/g, "")) || 1;

function leafPath(width: number, height: number, variant = 0) {
  const w = width / 2, h = height / 2, s = variant * w * .11;
  return `M 0 ${round(-h)}
    C ${round(w*.26+s)} ${round(-h*.94)} ${round(w*.64+s)} ${round(-h*.74)} ${round(w*.70)} ${round(-h*.56)}
    Q ${round(w*.60)} ${round(-h*.45)} ${round(w*.85)} ${round(-h*.31)}
    C ${round(w*1.06)} ${round(-h*.07)} ${round(w*.91)} ${round(h*.40)} ${round(w*.62)} ${round(h*.61)}
    Q ${round(w*.39)} ${round(h*.83)} 0 ${round(h)}
    C ${round(-w*.35)} ${round(h*.88)} ${round(-w*.86)} ${round(h*.50)} ${round(-w*.90)} ${round(h*.17)}
    Q ${round(-w*1.00)} ${round(-h*.06)} ${round(-w*.76)} ${round(-h*.29)}
    C ${round(-w*.83-s)} ${round(-h*.62)} ${round(-w*.34)} ${round(-h*.91)} 0 ${round(-h)} Z`;
}
function taperedWood(from: BoughPoint, to: BoughPoint, start: number, end: number) {
  const {point,path} = livingWoodCurve(from,to);
  const left: string[] = [], right: string[] = [];
  const total = 20;
  for (let i=0;i<=total;i++) {
    const t = i/total;
    const p=point(t), a=point(Math.max(0,t-.003)), b=point(Math.min(1,t+.003));
    const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
    const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
    const taper=start*Math.pow(1-t, .76)+end*Math.pow(t,.76);
    const radius=taper/2*(.99+(natural((i+1)*81+serial(to.id))*-.04));
    left.push(`${round(p.x+nx*radius)} ${round(p.y+ny*radius)}`);
    right.push(`${round(p.x-nx*radius)} ${round(p.y-ny*radius)}`);
  }
  return { area:`M ${left.join(" L ")} L ${right.reverse().join(" L ")} Z`,line:path };
}
function branchWidth(descendants: number, total: number) {
  return 1.8 + 82 * Math.pow((Math.max(0,descendants)+1)/Math.max(1,total),.66);
}
function PersonLeaf({ node, active, faded, onPick }: {node:LivingPerson;active:boolean;faded:boolean;onPick:(id:string)=>void}) {
  const wood=node.childCount>0;
  const code=serial(node.id);
  const words=node.name.trim().split(/\s+/);
  const split=node.name.length>8 && words.length>1;
  const cut=Math.ceil(words.length/2);
  const pieces=split?[words.slice(0,cut).join(" "),words.slice(cut).join(" ")]:[node.name];
  const maxChars=Math.max(...pieces.map(piece=>piece.length));
  const font=Math.max(9,Math.min(wood?14:14.8,(node.artWidth-7)/(maxChars*.60)));
  const green=palette[code%palette.length];
  return <g className={`canopy-person ${active?"on":""} ${faded?"faded":""}`}
    transform={`translate(${round(node.x)} ${round(node.y)})`}
    role="button" tabIndex={0} aria-label={`${node.name}، الجيل ${node.generation}، ذريته المسجلة ${node.descendantCount}`}
    onClick={()=>onPick(node.id)}
    onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onPick(node.id);}}}>
    <title>{`${node.name} — الجيل ${node.generation} — ${node.descendantCount} من الذرية`}</title>
    {wood
      ? <g>
          <ellipse rx={node.artWidth/2} ry={node.artHeight/2}
            fill={node.descendantCount>45?"#d8ad43":node.descendantCount>8?"#f0d38b":"#fff0c9"}
            stroke={active?"#245139":"#8b6b3c"} strokeWidth={active?4:2.2}/>
          <ellipse rx={node.artWidth/2-4.7} ry={node.artHeight/2-4.4}
            stroke="#fff8dd" strokeWidth="1.15" fill="none" opacity=".83"/>
        </g>
      : <g transform={`rotate(${round((natural(code*17)-.5)*29)})`}>
          <path d={leafPath(node.artWidth,node.artHeight,(natural(code)-.5)*2)} fill={green}
            stroke={active?"#1e5740":"#55922e"} strokeWidth={active?3:1.3}/>
          <path d={`M 0 ${round(-node.artHeight*.42)} C ${round(-node.artWidth*.27)} ${round(-node.artHeight*.27)} ${round(-node.artWidth*.27)} ${round(node.artHeight*.18)} 0 ${round(node.artHeight*.43)} Q ${round(-node.artWidth*.08)} 0 0 ${round(-node.artHeight*.42)} Z`}
            fill="#f4f9a6" opacity=".17"/>
          <path d={`M 0 ${round(node.artHeight*.43)} Q ${round(node.artWidth*.15)} 0 0 ${round(-node.artHeight*.44)}`}
            fill="none" stroke="#e3f5a5" strokeWidth="1.3" opacity=".67"/>
          <path d="M -3 4 l -12 -13 M 1 -12 l 12 -12 M 0 18 l 13 -13 M 0 -23 l -9 -8 M 1 9 l 13 -8" fill="none" stroke="#e4f3ac" strokeWidth=".8" opacity=".49"/>
        </g>}
    <text textAnchor="middle" direction="rtl" fontFamily="'Noto Kufi Arabic',sans-serif"
      fontWeight="700" fontSize={font} fill={wood?"#392718":"#233c22"}
      stroke="#fff7d4" strokeWidth=".4" paintOrder="stroke">
      {pieces.map((part,i)=><tspan key={i} x="0" dy={i===0?(pieces.length===2?-font*.22:font*.35):font*1.24}>{part}</tspan>)}
    </text>
  </g>;
}

export function LivingTreeClient({people,sourceLabel}:{people:HeritagePerson[];sourceLabel:string}) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [branch,setBranch]=useState<string>("all");
  const [search,setSearch]=useState("");
  const [zoom,setZoom]=useState(1);
  const [center,setCenter]=useState({x:700,y:820});
  const svgRef=useRef<SVGSVGElement|null>(null);
  const art=useMemo(()=>buildLivingCanopy(people),[people]);
  const rootId=useMemo(()=>resolveHeritageRootId(people),[people]);
  const byId=useMemo(()=>new Map(art.nodes.map(n=>[n.id,n])),[art]);
  const selected=selectedId?byId.get(selectedId):undefined;
  const lineage=useMemo(()=>{
    const list:string[]=[];let id=selectedId;
    while(id && !list.includes(id)){list.push(id);id=byId.get(id)?.parentId||null;}
    return new Set(list);
  },[selectedId,byId]);
  const results=search.trim().length<2?[]:art.nodes.filter(n=>n.name.includes(search.trim())).slice(0,9);
  const boxWidth=1400/zoom,boxHeight=1600/zoom;
  const viewBox=`${round(center.x-boxWidth/2)} ${round(center.y-boxHeight/2)} ${round(boxWidth)} ${round(boxHeight)}`;
  const pick=(id:string)=>{setSelectedId(id);};
  const focus=(node:LivingPerson)=>{setSelectedId(node.id);setCenter({x:node.x,y:node.y});setZoom(2.25);};
  const reset=()=>{setZoom(1);setCenter({x:700,y:800});setSelectedId(null);setBranch("all");};
  function exportSvg(){
    const source=svgRef.current;
    if(!source)return;
    const clone=source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox","0 0 1400 1600");
    clone.setAttribute("width","2800");clone.setAttribute("height","3200");
    const content=new XMLSerializer().serializeToString(clone);
    const file=new Blob([content],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(file);
    const link=document.createElement("a");link.href=url;link.download="al-waili-living-tree-experiment.svg";link.click();
    URL.revokeObjectURL(url);
  }
  return <main className="canopy-lab">
    <section className="canopy-lab-hero" dir="rtl">
      <div className="canopy-lab-kicker"><TreeDeciduous size={18}/> مختبر المشجرة الفنية — تجربة مستقلة</div>
      <h1>نحو شجرة <em>طبيعية</em> تحفظ الأنساب</h1>
      <p>إعادة بناء لتوزيع الأسماء والأغصان داخل تاج نباتي كثيف. هذه معاينة فنية مستقلة تقرأ بيانات المشجرة ولا تعدّلها؛ المشجرة الحالية باقية كما هي.</p>
      <a href="/tree-art" className="canopy-lab-back"><ArrowLeft size={17}/> العودة إلى الرسم المعتمد سابقًا</a>
    </section>
    <div className="canopy-lab-controls" dir="rtl">
      <div className="canopy-lab-filter">
        <button className={branch==="all"?"active":""} onClick={()=>setBranch("all")}>الشجرة كاملة</button>
        {art.branches.map(item=><button key={item.id} className={branch===item.id?"active":""} onClick={()=>setBranch(item.id)}>ذرية {item.name}<small>{item.descendantCount}</small></button>)}
      </div>
      <div className="canopy-lab-search"><Search size={18}/><input value={search} onChange={event=>setSearch(event.target.value)}
        placeholder="ابحث عن اسم في المشجرة" aria-label="البحث في المشجرة"/>
        {results.length>0&&<div className="canopy-lab-results">{results.map(node=><button key={node.id} onClick={()=>{focus(node);setSearch("");}}>{node.name}<small>الجيل {node.generation}</small></button>)}</div>}
      </div>
    </div>
    <div className="canopy-lab-workspace" dir="rtl">
      <section className="canopy-lab-poster-wrap">
        <div className="canopy-lab-toolbar">
          <div><Leaf size={18}/><strong>الشجرة العضوية التجريبية</strong><span>{art.sourceCount} اسمًا · {art.terminalCount} ورقة باسم حقيقي</span></div>
          <div className="canopy-lab-actions">
            <button onClick={()=>setZoom(v=>Math.min(4,v*1.28))} title="تقريب" aria-label="تقريب"><ZoomIn size={17}/></button>
            <button onClick={()=>setZoom(v=>Math.max(1,v/1.28))} title="إبعاد" aria-label="إبعاد"><ZoomOut size={17}/></button>
            <button onClick={reset} title="إظهار الشجرة كاملة"><Eye size={17}/></button>
            <button onClick={exportSvg} title="تنزيل SVG"><Download size={17}/></button>
            <button onClick={()=>window.print()} title="طباعة"><Printer size={17}/></button>
          </div>
        </div>
        <div className="canopy-lab-poster">
          <svg ref={svgRef} viewBox={viewBox} className="canopy-lab-svg" role="img" aria-label="شجرة حمد بن محمد العضوية التفاعلية">
            <defs>
              <radialGradient id="labPaper"><stop offset="0" stopColor="#fffdf1"/><stop offset=".77" stopColor="#fcf9e9"/><stop offset="1" stopColor="#efe7d1"/></radialGradient>
              <radialGradient id="labCanopy"><stop offset="0" stopColor="#bfd08b" stopOpacity=".19"/><stop offset="1" stopColor="#cad29a" stopOpacity="0"/></radialGradient>
              <linearGradient id="labBark"><stop offset="0" stopColor="#28170d"/><stop offset=".22" stopColor="#4a2b1b"/><stop offset=".49" stopColor="#815239"/><stop offset=".76" stopColor="#50301d"/><stop offset="1" stopColor="#27170e"/></linearGradient>
              <filter id="labSoft"><feDropShadow dx="1.2" dy="2.8" stdDeviation="2" floodColor="#1b2d16" floodOpacity=".18"/></filter>
              <pattern id="labGrain" width="65" height="65" patternUnits="userSpaceOnUse"><circle cx="10" cy="18" r="1.1" fill="#bdaf80" opacity=".10"/><circle cx="43" cy="50" r=".7" fill="#caba82" opacity=".12"/></pattern>
            </defs>
            <rect width="1400" height="1600" fill="url(#labPaper)"/>
            <rect width="1400" height="1600" fill="url(#labGrain)"/>
            <rect x="20" y="20" width="1360" height="1560" stroke="#183c35" strokeWidth="14" fill="none"/>
            <rect x="35" y="35" width="1330" height="1530" stroke="#b4945f" strokeWidth="2" fill="none"/>
            <text x="700" y="76" textAnchor="middle" fontFamily="'Amiri',serif" fontSize="35" fill="#3a4e35">بِسْمِ اللّٰهِ الرَّحْمَٰنِ الرَّحِيمِ</text>
            <text x="700" y="126" textAnchor="middle" fontFamily="'Amiri',serif" fontWeight="700" fontSize="54" fill="#153c35">شجرة ذرية حمد بن محمد</text>
            <text x="700" y="158" textAnchor="middle" fontFamily="'Noto Kufi Arabic',sans-serif" fontSize="18" fill="#90784f">حمد وأبناؤه منيع وسليمان وعبد الله</text>
            <text x="700" y="187" textAnchor="middle" fontFamily="'Amiri',serif" fontSize="23" fill="#949e69">❧ الجذور التي تجمعنا ❧</text>
            <ellipse cx="700" cy="679" rx="640" ry="530" fill="url(#labCanopy)"/>
            {/* The hand-shaped woody root is behind every connected branch. */}
            <path d="M 570 1510 C 607 1417 633 1327 649 1223 C 671 1183 679 1146 698 1143 Q 718 1163 741 1223 C 754 1336 780 1428 827 1510 Q 704 1537 570 1510 Z"
              fill="url(#labBark)" stroke="#29160e" strokeWidth="7"/>
            <path d="M 595 1499 Q 656 1338 677 1193 M 622 1499 Q 677 1352 693 1205 M 788 1504 Q 734 1361 716 1185 M 744 1492 Q 711 1360 706 1216" fill="none" stroke="#c39a69" strokeWidth="5" opacity=".35"/>
            {art.boughs.map(segment=>{
              const muted=branch!=="all"&&segment.throughIds.every(id=>byId.get(id)?.branchId!==branch);
              const selectedPath=!!selected&&segment.throughIds.some(id=>lineage.has(id));
              const base=branchWidth(segment.parentDescendants,art.sourceCount);
              const tip=branchWidth(segment.descendantCount,art.sourceCount);
              const ribbon=taperedWood(segment.from,segment.to,
                Math.min(base*.91,Math.max(tip*1.36,base*.50)),Math.max(2.6,tip*.63));
              return <g key={segment.id} opacity={muted ? .20 : selected && !selectedPath ? .24 : 1}>
                <path d={ribbon.area} fill="url(#labBark)" stroke="#24170e" strokeWidth=".65"/>
                <path d={ribbon.line} fill="none" stroke="#a57c50" strokeWidth={Math.max(.7,Math.min(base,tip)*.12)} opacity=".36" strokeLinecap="round"/>
              </g>;
            })}
            {/* Space-colonization-inspired shoots attach to real boughs, not
                to invented genealogy records or the center of a named leaf. */}
            <g aria-hidden="true">
              {art.foliage.map((leaf,index)=><g key={index} opacity=".87">
                <path d={`M ${round(leaf.anchorX)} ${round(leaf.anchorY)} Q ${round((leaf.anchorX+leaf.x)/2+8)} ${round((leaf.anchorY+leaf.y)/2-9)} ${round(leaf.x)} ${round(leaf.y)}`}
                  fill="none" stroke="#4b321e" strokeWidth="1.35" strokeLinecap="round"/>
                <g transform={`translate(${round(leaf.x)} ${round(leaf.y)}) rotate(${round(leaf.angle)})`}>
                  <path d={leafPath(leaf.width,leaf.height,index%3-1)} fill={palette[leaf.shade]} stroke="#77a846" strokeWidth=".8"/>
                  <path d={`M 0 ${round(leaf.height*.42)} L 0 ${round(-leaf.height*.44)}`} stroke="#e9f1b1" strokeWidth=".75" opacity=".6"/>
                </g>
              </g>)}
            </g>
            {art.nodes.filter(node=>node.id!==rootId).map(node=><PersonLeaf key={node.id} node={node}
              active={node.id===selectedId} faded={(branch!=="all"&&node.branchId!==branch)||(!!selected&&!lineage.has(node.id))}
              onPick={pick}/>)}
            <g transform="translate(700 1290)" role="button" tabIndex={0} aria-label="حمد، أصل المشجرة" onClick={()=>pick(rootId)}
              onKeyDown={event=>{if(event.key==="Enter")pick(rootId);}}>
              <path d="M -77 -34 Q 0 -52 76 -34 Q 98 -20 80 0 Q 94 27 71 40 Q 0 59 -74 40 Q -94 25 -79 0 Q -96 -21 -77 -34Z" fill="#fff4cf" stroke="#80613a" strokeWidth="5"/>
              <path d="M -70 -29 Q 0 -44 68 -29 Q 83 0 70 31 Q 0 47 -67 32 Q -82 0 -70 -29Z" fill="none" stroke="#d4b675" strokeWidth="2.1"/>
              <text x="0" y="15" fontSize="42" fontWeight="700" fill="#372516" textAnchor="middle" fontFamily="'Amiri',serif">حمد</text>
            </g>
            <g transform="translate(700 1508)" aria-hidden="true">
              <path d="M -160 0 Q -90 -18 0 0 Q 100 -23 175 3" stroke="#699743" strokeWidth="15" strokeLinecap="round" fill="none"/>
              {Array.from({length:40},(_,i)=><path key={i} d={`M ${-155+i*8} 5 q ${i%2?8:-9} -12 ${i%2?9:-8} ${-15-(i*17)%29}`} stroke={i%3?"#7eaa48":"#b0c96a"} strokeWidth="3.5" fill="none" strokeLinecap="round"/>)}
            </g>
            <text x="700" y="1550" textAnchor="middle" fontSize="14" fontFamily="'Noto Kufi Arabic',sans-serif" fill="#88754f">لوحة اختبار فني · أسماء المشجرة الحقيقية فقط · لا تعديل على السجل</text>
          </svg>
        </div>
        <div className="canopy-lab-legend"><span><i className="gold"/> اسم على غصن: لديه ذرية مسجلة</span><span><i className="green"/> ورقة باسم: طرف مسجل</span><span><i className="tiny"/> أوراق صغيرة غير مسماة: زخرفية</span></div>
      </section>
      <aside className="canopy-lab-inspector">
        <div className="canopy-lab-inspector-head"><Focus size={19}/> فحص الفرع</div>
        {selected?<div className="canopy-lab-card">
          <strong>{selected.name}</strong><span>الجيل {selected.generation}</span>
          <dl><div><dt>الأب</dt><dd>{selected.parentId?byId.get(selected.parentId)?.name||"غير ظاهر":"أصل الشجرة"}</dd></div><div><dt>الأبناء المباشرون</dt><dd>{selected.childCount}</dd></div><div><dt>الذرية المسجلة</dt><dd>{selected.descendantCount}</dd></div></dl>
          <button onClick={()=>focus(selected)}>تكبير الاسم في الرسم</button>
        </div>:<div className="canopy-lab-card neutral"><TreeDeciduous size={33}/><h3>اختر ورقة أو اسمًا على غصن</h3><p>ستظهر بيانات الارتباط النسبي، وتُبرز السلسلة من حمد إلى الاسم المختار.</p></div>}
        <div className="canopy-lab-note"><strong>ما الذي نختبره هنا؟</strong><p>توزيع الأسماء داخل تاج بيضاوي، والأغصان التي تتحد قبل التشعب، وسماكة تعتمد على الذريات، وأوراق زينة لا تضيف أشخاصًا وهميين.</p></div>
        <a href="/tree-art"><ArrowLeft size={15}/> العودة إلى النسخة الحالية</a>
        <small>{sourceLabel} · معاينة للقراءة فقط</small>
      </aside>
    </div>
  </main>;
}
