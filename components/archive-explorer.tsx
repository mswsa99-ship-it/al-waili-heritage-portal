"use client";
import { useMemo, useState } from "react";
import { BookOpenText, Search, ScrollText } from "lucide-react";

export type PublicArchiveItem = { id:string; title:string; kind:string; summary:string; source:string; period:string; reviewedAt:string|null };
const kinds:Record<string,string> = { all:"كل المواد", document:"الوثائق", photo:"الصور", oral:"الروايات", biography:"السير", history:"التاريخ" };
const normalize = (s:string) => s.normalize("NFKC").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/[\u064B-\u065F]/g,"").toLowerCase();

export default function ArchiveExplorer({items}:{items:PublicArchiveItem[]}) {
  const [kind,setKind]=useState("all"),[query,setQuery]=useState("");
  const filtered=useMemo(()=>items.filter(i=>(kind==="all"||i.kind===kind)&&normalize([i.title,i.summary,i.source,i.period].join(" ")).includes(normalize(query.trim()))),[items,kind,query]);
  return <div>
    <div className="public-filters"><label className="public-search"><Search size={18}/><input aria-label="ابحث في الأرشيف" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بعنوان أو رواية أو مصدر…"/></label><div className="public-filter-tabs" role="group" aria-label="نوع المادة">{Object.entries(kinds).map(([key,label])=><button aria-pressed={kind===key} className={kind===key?"selected":""} key={key} onClick={()=>setKind(key)}>{label}</button>)}</div></div>
    <p className="public-results">{filtered.length} مادة متاحة وفق فلتر البحث</p>
    {filtered.length?<div className="public-card-grid">{filtered.map(item=><article className="public-story-card" key={item.id}><span className="public-pill">{kinds[item.kind]||"مادة تاريخية"}</span><h3>{item.title}</h3><p style={{whiteSpace:"pre-line"}}>{item.summary}</p>{item.period&&<span className="public-date">الفترة: {item.period}</span>}<div className="public-meta"><ScrollText size={15}/> المصدر المسجل: {item.source}</div></article>)}</div>:<div className="public-empty"><BookOpenText size={28}/><p>{items.length?"لا توجد نتائج مطابقة. جرّب كلمة بحث أخرى أو اختر جميع المواد.":"لا توجد مواد منشورة بعد؛ المواد المرسلة تمر أولًا بالمراجعة."}</p></div>}
  </div>;
}
