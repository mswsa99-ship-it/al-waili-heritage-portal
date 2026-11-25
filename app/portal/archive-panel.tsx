"use client";
import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, FileText, ShieldCheck } from "lucide-react";

type Item={id:string;title:string;kind:string;summary:string;source:string;period:string;visibility:string;reviewNote?:string;createdAt:string;sourceAuthor:string;sourceDate:string;sourcePage:string;evidenceStatus:string;attachmentId:string|null};
const kindNames:Record<string,string>={document:"نص وثيقة",photo:"وصف صورة تاريخية",oral:"رواية شفوية مكتوبة",biography:"سيرة شخصية تاريخية",history:"تاريخ وموضع"};
const statuses:Record<string,string>={pending:"قيد المراجعة",members:"متاح للأعضاء",public:"منشور للعامة",rejected:"بحاجة استكمال / موقوف"};

export default function ArchivePanel({canPublish}:{canPublish:boolean}) {
  const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const [files,setFiles]=useState<{id:string;name:string;mime:string}[]>([]);
  useEffect(()=>{fetch("/api/private-attachments").then(r=>r.json()).then(raw=>{const d=raw as {files?:{id:string;name:string;mime:string}[]};setFiles((d.files||[]).filter(f=>f.mime.startsWith("image/")));}).catch(()=>{});},[]);
  const [reviews,setReviews]=useState<Record<string,{visibility:string;reviewNote:string;confirmed:boolean}>>({});
  const load=useCallback(async()=>{const r=await fetch(`/api/heritage?scope=${canPublish?"manage":"mine"}`,{cache:"no-store"});const j=await r.json() as {items?:Item[];error?:string};if(!r.ok)throw Error(j.error||"تعذر تحميل الأرشيف");setItems(j.items||[]);},[canPublish]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function submit(payload:Record<string,unknown>) {setBusy(true);setError("");setNotice("");try {const r=await fetch("/api/heritage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json() as {message?:string;error?:string};if(!r.ok)throw Error(j.error||"تعذّر الحفظ");setNotice(j.message||"سُجّل القرار في البوابة.");await load();return true;}catch(e){setError(e instanceof Error?e.message:"تعذّر الحفظ");return false;}finally{setBusy(false);}}
  return <div className="portal-columns"><div>
    {notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}</div>}
    <section className="portal-card"><h3><Archive size={20} style={{display:"inline",marginLeft:8}}/> مواد الأرشيف ومراحل مراجعتها</h3><p>كل مادة تُحفظ خاصة أولًا. ويمكن للمحرر المخوّل مراجعة مصدرها وحدود نشرها بصورة مستقلة عن قرارات الأنساب.</p>
      {items.length?items.map(i=>{const choice=reviews[i.id]||{visibility:i.visibility,reviewNote:"",confirmed:false};return <div className="portal-item" key={i.id}><div style={{width:"100%"}}><h4>{i.title}</h4><p>{i.summary}</p><p><strong>المصدر:</strong> {i.source}{i.period&&` · الفترة: ${i.period}`}</p><span className="portal-tag">{kindNames[i.kind]||i.kind} · {statuses[i.visibility]||i.visibility}</span>
        <p>المؤلف: {i.sourceAuthor||"غير محدد"} · التاريخ: {i.sourceDate||"غير محدد"} · الصفحة/الحفظ: {i.sourcePage||"غير محدد"}</p>{i.attachmentId&&<img src={"/api/heritage-image?id="+encodeURIComponent(i.id)} alt="صورة الوثيقة الخاصة للمراجعة" style={{maxWidth:"100%",maxHeight:300}}/>}{i.reviewNote&&<p>ملاحظة المراجعة السابقة: {i.reviewNote}</p>}
        {canPublish&&<form className="portal-form portal-review-form" onSubmit={async e=>{e.preventDefault();await submit({action:"review",id:i.id,visibility:choice.visibility,reviewNote:choice.reviewNote,confirmPublication:choice.confirmed});}}>
          <label>قرار الإتاحة<select value={choice.visibility} onChange={e=>setReviews(v=>({...v,[i.id]:{...choice,visibility:e.target.value,confirmed:false}}))}>{Object.entries(statuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
          <label>سبب القرار والمصادر التي تمت مراجعتها<textarea value={choice.reviewNote} onChange={e=>setReviews(v=>({...v,[i.id]:{...choice,reviewNote:e.target.value}}))} minLength={8} required/></label>
          {["public","members"].includes(choice.visibility)&&<label className="portal-checkline"><input type="checkbox" checked={choice.confirmed} onChange={e=>setReviews(v=>({...v,[i.id]:{...choice,confirmed:e.target.checked}}))} required/> راجعت النص والصورة المرفقة وحقوق نشرهما وخصوصية الأحياء وأجيز إتاحتهما لهذا الجمهور</label>}
          <button disabled={busy} className="portal-button" type="submit"><CheckCircle2 size={16}/> تسجيل قرار المراجعة</button>
        </form>}
      </div></div>;}):<div className="portal-empty"><FileText size={23} style={{margin:"0 auto 12px"}}/> لا توجد مواد مقدمة بعد. ابدأ بوصف مادة تاريخية موثقة المصدر.</div>}
    </section>
  </div><div><section className="portal-card"><h3>إضافة مادة تاريخية</h3><p>يمكن إدخال نص وثيقة أو رواية أو وصف صورة، مع مصدرها. ارفع صورة الوثيقة في قسم المرفقات الخاصة، ثم حدّث الصفحة واخترها أدناه. تبقى خاصة حتى اعتماد إتاحة المادة.</p><form className="portal-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));if(await submit({action:"create",...values}))form.reset();}}>
      <label>نوع المادة<select name="kind">{Object.entries(kindNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>عنوان المادة<input name="title" minLength={4} maxLength={180} required/></label>
      <label>النص أو الوصف التفصيلي<textarea name="summary" minLength={25} maxLength={6000} required/></label>
      <label>وصف المصدر وحقوق إتاحته<textarea name="source" minLength={6} maxLength={900} placeholder="من أين وصلت المعلومة؟ هل أذن صاحبها بمراجعتها؟" required/></label>
      <label>المؤلف<input name="sourceAuthor" maxLength={160}/></label><label>تاريخ المخطوط أو الطبعة<input name="sourceDate" maxLength={100}/></label><label>رقم الصفحة أو الحفظ<input name="sourcePage" maxLength={100}/></label><label>حالة الإثبات<select name="evidenceStatus"><option value="pending">قيد التحقق</option><option value="historical">نص من مصدر تاريخي</option><option value="family">رواية أسرية</option></select></label><label>صورة الوثيقة المودعة بحسابك<select name="attachmentId"><option value="">دون صورة</option>{files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>الفترة الزمنية إن كانت معروفة<input name="period" maxLength={120} placeholder="لا تفترض سنة دون مصدر"/></label>
      <button className="portal-button" disabled={busy} type="submit">حفظ المادة للمراجعة</button>
    </form></section><div className="portal-note"><ShieldCheck size={18} style={{display:"inline",marginLeft:7}}/> لا تُعد المادة المرسلة منشورة ولا إثباتًا لصحة النسب. تُحفظ المساهمة ومعرّف صاحب الحساب وسجل قرار المراجع.</div></div></div>;
}
