"use client";
import { useCallback, useEffect, useState } from "react";
import { Inbox, MessageCircleMore } from "lucide-react";

type Inquiry={id:string;name:string;email:string;topic:string;message:string;status:string;responseNote:string;createdAt:string};
const topics:Record<string,string>={history:"مساهمة تاريخية",contact:"طلب تواصل",suggestion:"اقتراح",privacy:"سؤال خصوصية"};
const states:Record<string,string>={new:"جديد",in_review:"تحت المتابعة",closed:"مغلق"};

export default function InquiriesPanel() {
  const [data,setData]=useState<Inquiry[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [updates,setUpdates]=useState<Record<string,{status:string;responseNote:string}>>({});
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/inquiries",{cache:"no-store"});const j=await r.json() as {inquiries:Inquiry[];error?:string};if(!r.ok)throw Error(j.error||"تعذر فتح الصندوق");setData(j.inquiries);setLoadError("");}catch(e){setLoadError(e instanceof Error?e.message:"تعذر فتح الصندوق");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function resolve(id:string,status:string,responseNote:string){setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"resolve",id,status,responseNote})});const j=await r.json() as {error?:string};if(!r.ok)throw Error(j.error||"تعذر تسجيل المعالجة");setNotice("حُفظت متابعة الرسالة في سجل البوابة.");await load();}catch(e){setError(e instanceof Error?e.message:"تعذر التسجيل");}finally{setBusy(false);}}
  return <section className="portal-card"><h3><Inbox size={20} style={{display:"inline",marginLeft:8}}/> صندوق التواصل</h3><p>الرسائل الواردة من صفحة التواصل محفوظة في قاعدة البيانات ومتاحة للإدارة المركزية فقط. المعالجة هنا تدوين داخلي، ولا ترسل رسالة بريد تلقائيًا إلى صاحب الطلب.</p>{notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}</div>}
    {loadError&&<div className="portal-message error" role="alert">{loadError} <button type="button" disabled={loading||busy} onClick={()=>void load()}>{loading?"جارٍ التحميل…":"إعادة المحاولة"}</button></div>}
    {data.length?data.map(i=>{const u=updates[i.id]||{status:i.status==="closed"?"closed":"in_review",responseNote:""};return <div className="portal-item" key={i.id}><div style={{width:"100%"}}><h4>{i.name} · {topics[i.topic]||i.topic}</h4><p>{i.message}</p><span className="portal-tag">{states[i.status]||i.status}</span><p>البريد المسجل في هوية البوابة: {i.email} · مرجع: {i.id.slice(0,8)}</p>{i.responseNote&&<div className="portal-note">آخر متابعة: {i.responseNote}</div>}
      {i.status!=="closed"&&<form className="portal-form portal-review-form" onSubmit={async e=>{e.preventDefault();await resolve(i.id,u.status,u.responseNote);}}><label>حالة المعالجة<select value={u.status} onChange={e=>setUpdates(s=>({...s,[i.id]:{...u,status:e.target.value}}))}><option value="in_review">تحت المتابعة</option><option value="closed">إغلاق بعد المعالجة</option></select></label><label>تفاصيل الإجراء الداخلي<textarea value={u.responseNote} minLength={8} required onChange={e=>setUpdates(s=>({...s,[i.id]:{...u,responseNote:e.target.value}}))}/></label><button disabled={busy} className="portal-button" type="submit">تسجيل المتابعة</button></form>}
    </div></div>;}):loading?<p role="status">جارٍ تحميل الرسائل…</p>:loadError?null:<div className="portal-empty"><MessageCircleMore size={24} style={{margin:"0 auto 12px"}}/> لا توجد رسائل واردة بعد.</div>}
  </section>;
}
