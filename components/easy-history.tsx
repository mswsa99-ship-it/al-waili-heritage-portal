'use client';
import {useEffect,useState} from 'react';
import {HistoricalMarkdown} from './historical-markdown';
import EasyReader from './easy-reader';

type Story={id:string;title:string;summary:string;body:string;group:string;chip?:string;static?:boolean;cover?:string;images?:string[]};
const GROUP_ORDER=['ابدأ هنا','أخبار الأسرة','الجذور والأجداد','الوثائق والمراجع','الأماكن والأعلام','ذاكرة الأسرة','الأحداث والشعر'];
const normalize=(s:string)=>s.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-1776)).toLowerCase();
const Chevron=()=><b className="history-chevron" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></b>;
export default function EasyHistory({stories,initial=''}:{stories:Story[];initial?:string}){
 const [query,setQuery]=useState(''),[group,setGroup]=useState(''),[opened,setOpened]=useState(initial);
 useEffect(()=>{const raw=window.location.hash.slice(1);const match=stories.find(s=>s.id===raw);if(match)setOpened(match.id);},[stories]);
 const present=new Set(stories.map(s=>s.group));
 const groups=GROUP_ORDER.filter(g=>present.has(g));
 const q=normalize(query.trim());
 const matches=stories.filter(s=>(!group||s.group===group)&&(!q||normalize(s.title+' '+s.summary+' '+s.body).includes(q)));
 return <div className="easy-history"><label className="easy-search">ابحث عن اسم أو مكان<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="اكتب هنا…"/></label><nav className="easy-topics" aria-label="موضوعات تاريخ الأسرة"><button aria-pressed={!group} onClick={()=>setGroup('')}>الكل</button>{groups.map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</nav>{(group||query)&&<p role="status">{matches.length} موضوعًا <button className="easy-reset" onClick={()=>{setGroup('');setQuery('')}}>عرض كل المواضيع</button></p>}<p className="easy-note">اضغط على عنوان الموضوع لقراءته هنا. اضغط عليه مرة أخرى لإغلاقه.</p>{matches.map(s=>s.static?<article id={s.id} key={s.id} className="easy-story history-news-entry">{s.cover&&<img className="history-news-cover" src={s.cover} alt={s.title} loading="lazy"/>}<span className="history-header-copy"><span className="story-category">{s.chip||s.group}</span><strong>{s.title}</strong><span>{s.summary}</span></span></article>:<details id={s.id} key={s.id} open={opened===s.id} className="easy-story" onToggle={e=>{if(e.currentTarget.open)setOpened(s.id);else setOpened(previous=>previous===s.id?'':previous);}}><summary><span className="history-header-copy"><span className="story-category">{s.chip||s.group}</span><strong>{s.title}</strong><span>{s.summary}</span></span><Chevron/></summary><div className="easy-story-body"><EasyReader targetId={'text-'+s.id}/><div id={'text-'+s.id}><HistoricalMarkdown text={s.body}/></div>{s.images?.map(src=><img key={src} src={src} alt={'صورة مرفقة: '+s.title} loading="lazy" style={{maxWidth:'100%',height:'auto'}}/>)}<button className="easy-close" onClick={()=>{setOpened('');document.getElementById(s.id)?.scrollIntoView({block:'start'});}}>إغلاق الموضوع ↑</button></div></details>)}{!matches.length&&<p role="status">لا توجد موضوعات مطابقة لبحثك. جرّب اسمًا أو كلمة أخرى، أو اختر «عرض كل المواضيع».</p>}</div>;
}
