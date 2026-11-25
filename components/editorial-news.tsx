import {editorialNews} from "@/lib/editorial-content";

const CAT_LABEL:Record<string,string>={news:"أخبار",events:"مناسبات",achievements:"إنجازات",publications:"إصدارات",history:"تاريخ",document:"وثائق"};
const Arrow=()=>(<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>);

function hijri(a:{iso?:string;date:string}){
  if(!a.iso) return a.date;
  try{return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a.iso+"T12:00:00Z"));}catch{return a.date;}
}

export function EditorialNews({category="all",limit=200}:{category?:string;limit?:number}){
  const items=editorialNews.filter(a=>category==="all"||a.category===category).slice(0,limit);
  return <div className="public-card-grid">{items.map(a=>{
    const label=CAT_LABEL[a.category]||"أخبار";
    const cover=a.images&&a.images.length?null:true;
    return <details className="public-story-card visual-news-card news-toggle" key={a.id}>
      <summary>
        <span className="news-cover">
          {cover
            ? <span className="news-cover-fallback"><img src="/waili-seal.png" alt="ختم الأسرة"/><span>{label}</span></span>
            : <img src={a.images![0]} alt={a.title} loading="lazy"/>}
          <span className="news-date-badge">{hijri(a)}</span>
        </span>
        <span className="news-card-content">
          <span className="story-category">{label}</span>
          <h3>{a.title}</h3>
          <p className="news-summary">{a.summary}</p>
          <span className="news-read-button">اقرأ تفاصيل الخبر والصور <Arrow/></span>
        </span>
      </summary>
      <div className="news-full-body">
        {a.sections.map(s=><div key={s.title}><h4>{s.title}</h4><p>{s.text}</p></div>)}
        {a.images?.map(src=><img key={src} src={src} alt={a.title} loading="lazy" style={{maxWidth:"100%",height:"auto"}}/>)}
        {a.sources.length>0&&category==="history"?<p className="news-sources">المصادر: {a.sources.join("؛ ")}</p>:null}
      </div>
    </details>;})}</div>;
}
