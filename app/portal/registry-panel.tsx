"use client";
import { useCallback, useEffect, useState } from "react";
import { Network, ShieldCheck, CheckCircle2 } from "lucide-react";

type Person={personId:string;name:string;parentPersonId:string|null;parentRelation:string|null;gender:string;branch:string;living:boolean;minor:boolean;decisionId?:string};
type View={records:Person[];consumedDecisionIds?:string[];policy:{root:string;approvedOnly:boolean;coversDaughters:boolean}};

export default function RegistryPanel({canPublish}:{canPublish:boolean}) {
  const [data,setData]=useState<View|null>(null);
  const [decisions,setDecisions]=useState<{id:string;personRef:string;status:string}[]>([]);
  const [decisionError,setDecisionError]=useState("");
  const loadDecisions=useCallback(async()=>{if(!canPublish)return;try{const r=await fetch("/api/portal",{cache:"no-store"});const raw=await r.json() as {error?:string;corrections?:{id:string;personRef:string;status:string}[]};if(!r.ok)throw Error(raw.error||"تعذر تحميل قرارات اللجنة");setDecisions(raw.corrections||[]);setDecisionError("");}catch(e){setDecisionError(e instanceof Error?e.message:"تعذر تحميل قرارات اللجنة");}},[canPublish]);
  useEffect(()=>{void loadDecisions();},[loadDecisions]);
  const [selectedDecision,setSelectedDecision]=useState("");
  const [operation,setOperation]=useState("create");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const r=await fetch("/api/genealogy",{cache:"no-store"});const v=await r.json() as View & {error?:string};if(!r.ok)throw Error(v.error||"تعذر فتح السجل");setData(v);},[]);
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[load]);
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");const form=e.currentTarget;const payload=Object.fromEntries(new FormData(form).entries());
    try {const r=await fetch("/api/genealogy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,living:payload.living==="on",minor:payload.minor==="on"})});const v=await r.json() as {error?:string};if(!r.ok)throw Error(v.error||"تعذر ترحيل السجل");setMessage("حُفظ السجل المعتمد وفق قرار اللجنة المسجل.");setSelectedDecision("");form.reset();try{await Promise.all([load(),loadDecisions()]);}catch{setMessage("حُفظ السجل، لكن تعذر تحديث القائمة. أعد تحميل السجل قبل أي ترحيل جديد.");}}catch(e){setMessage(e instanceof Error?e.message:"تعذر الحفظ");}finally{setBusy(false);}
  }
  const byId=new Map((data?.records||[]).map(r=>[r.personId,r]));
  const availableDecisions=decisions.filter(d=>d.status==="approved"&&!data?.consumedDecisionIds?.includes(d.id)&&!data?.records.some(p=>p.decisionId===d.id));
  const selected=availableDecisions.find(d=>d.id===selectedDecision);
  const existing=selected?byId.get(selected.personRef):undefined;
  return <div className="portal-columns"><div>{message&&<div className="portal-message" role="status">{message}</div>}<section className="portal-card"><h3><Network size={21} style={{display:"inline",marginLeft:8}}/> سجل النسب المعتمد</h3><p>يشمل ذرية حمد بن محمد بن حمد بن عثمان بن ناصر المثبتة عبر الأبناء والبنات. ويستقل عن الحسابات وعضوية المجلس.</p><div className="portal-note"><ShieldCheck size={17} style={{display:"inline",marginLeft:7}}/> تُعرض السجلات المعتمدة فقط. أسماء القاصرين محمية عن غير المخولين.</div>
    {!data?<p>جارٍ تحميل السجل…</p>:data.records.length?data.records.map(p=><div className="portal-item" key={p.personId}><div><h4>{p.name}</h4><p>صلة النسب: {p.parentPersonId?`من ${p.parentRelation==="mother"?"الأم":"الأب"} ${byId.get(p.parentPersonId)?.name||"أصل معتمد"}`:"أصل نطاق المبادرة"}</p>{p.branch&&<span className="portal-tag">{p.branch}</span>}</div><span className="portal-small"><CheckCircle2 size={14} style={{display:"inline"}}/> معتمد</span></div>):<div className="portal-empty">لا توجد حتى الآن سجلات نسب معتمدة منشورة. تُبنى هذه القائمة فقط بعد قرارات اللجنة.</div>}
    </section></div><div>{canPublish?<section className="portal-card"><h3>ترحيل قرار لجنة الأنساب</h3><p>تُراجع حقول السجل قبل نشره. لا يكفي وجود اسم في اللوحة القديمة؛ يلزم رقم قرار لجنة معتمد لم يُستخدم سابقًا.</p>{message&&<div className="portal-message">{message}</div>}{decisionError&&<div role="alert">{decisionError} <button type="button" onClick={()=>void loadDecisions()}>إعادة تحميل القرارات</button></div>}{data&&!decisionError&&!availableDecisions.length&&<p className="portal-note">لا توجد قرارات معتمدة جاهزة للترحيل. تبدأ العملية من «مراجعة طلبات النسب»، ثم يظهر القرار هنا بعد اعتماده. <a href="/admin?tab=committee">فتح مراجعة طلبات النسب</a></p>}<form key={selectedDecision} className="portal-form" onSubmit={save}>
      <label>نوع التعديل<select name="operation" value={operation} onChange={e=>setOperation(e.target.value)}><option value="create">إضافة سجل نسب معتمد</option><option value="update">تصحيح سجل موجود</option><option value="archive">أرشفة سجل بقرار مسبب</option></select></label>
      <label>قرار اللجنة المعتمد<select name="decisionId" required value={selectedDecision} onChange={e=>{const id=e.target.value;setSelectedDecision(id);const d=availableDecisions.find(d=>d.id===id);setOperation(d&&byId.has(d.personRef)?"update":"create");}}><option value="">اختر قرارًا معتمدًا</option>{availableDecisions.map(d=><option key={d.id} value={d.id}>{d.personRef} · {d.id}</option>)}</select></label>
      <label>معرّف الشخص المطابق لقرار اللجنة<input name="personId" required readOnly value={selected?.personRef||""} placeholder="يُملأ من قرار اللجنة"/></label>
      {operation!=="archive"&&<><label>الاسم الكامل<input defaultValue={existing?.name||""} required name="name" placeholder="مثال: حمد بن محمد بن حمد بن عثمان بن ناصر"/></label>
      <label>الجنس<select name="gender" defaultValue={existing?.gender||"unknown"}><option value="male">ذكر</option><option value="female">أنثى</option><option value="unknown">غير محدد</option></select></label>
      <label>الأب أو الأم في السجل المعتمد<select name="parentPersonId" defaultValue={existing?.parentPersonId||""}><option value="">دون أصل — جذر النطاق فقط</option>{data?.records.filter(p=>p.personId!==selected?.personRef).map(p=><option key={p.personId} value={p.personId}>{p.name} · {p.personId}</option>)}</select></label>
      <label>نوع الصلة<select name="parentRelation" defaultValue={existing?.parentRelation||"father"}><option value="father">الأب</option><option value="mother">الأم</option></select></label>
      <label>الفرع<input name="branch" defaultValue={existing?.branch||""}/></label>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input style={{width:18,minHeight:18}} type="checkbox" name="living" defaultChecked={existing?.living||false}/> الشخص على قيد الحياة</label>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input style={{width:18,minHeight:18}} type="checkbox" name="minor" defaultChecked={existing?.minor||false}/> قاصر (حماية الاسم)</label></>}
      <button className="portal-button" disabled={busy||Boolean(decisionError)||!data||!selected}>{busy?"جارٍ الترحيل...":"ترحيل القرار إلى السجل"}</button>
    </form></section>:<section className="portal-card"><h3>ضوابط الإثبات</h3><p>هذا السجل للعرض المعتمد فقط. المسودات وطلبات التصحيح والمصادر الحساسة لا تُعرض إلا لأصحاب صلاحيات التحقيق.</p></section>}</div></div>;
}
