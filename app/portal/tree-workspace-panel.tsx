"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookUser, CheckCircle2, GitBranch, LockKeyhole, Search, ShieldCheck, UserRoundPlus } from "lucide-react";

type Person = { id:string; parentId:string|null; name:string; gender:string; birthYear:string; deathYear:string; education:string; city:string; profession:string; phone:string; email:string; position:string; active:boolean; revision:number; generation:number; sourceNote:string };
type Grant = { id:string; delegatePersonId:string; scopePersonId:string; status:string; note:string; createdAt:string; hasVerifiedAccount:boolean };
type Change = { id:string; action:string; targetPersonId:string|null; parentId:string|null; fieldsJson:string; sourceNote:string; status:string; authorId?:string; reviewNote:string; createdAt:string; reviewedAt:string|null; appliedPersonId:string|null };
type Data = { isAdmin:boolean; canReview:boolean; initialized:boolean; expectedBaselineCount:number; people:Person[]; delegations:Grant[]; eligibleAccounts:{id:string;name:string;personRef:string}[]; changes:Change[]; accessNote:string; error?:string };
type Operation = "update"|"create"|"delete";
const fields:{name:keyof Person;title:string;kind?:string;max?:number}[]=[
  {name:"name",title:"الاسم",max:180},{name:"gender",title:"الجنس"},
  {name:"birthYear",title:"سنة الميلاد (أربع خانات فقط)",kind:"year"},
  {name:"deathYear",title:"سنة الوفاة (اختياري)",kind:"year"},
  {name:"education",title:"التعليم أو المؤهل",max:250},
  {name:"city",title:"المدينة أو مكان الإقامة",max:120},
  {name:"profession",title:"المهنة أو مجال العمل",max:160},
  {name:"phone",title:"رقم التواصل (اختياري ومحمي)",kind:"tel",max:28},
  {name:"email",title:"البريد الإلكتروني (اختياري ومحمي)",kind:"email",max:160},
  {name:"position",title:"المهمة أو المنصب (اختياري)",max:180},
];
const stateText:Record<string,string>={pending:"بانتظار مراجعة الأنساب",approved:"معتمد في سجل العمل",rejected:"لم يُعتمد"};
const changeText:Record<string,string>={create:"إضافة فرد",update:"تحديث بيانات",delete:"طلب حذف/أرشفة"};
const proposedFields=(value:string):Record<string,string>=>{try {const parsed=JSON.parse(value);return parsed&&typeof parsed==="object"?parsed:{};}catch{return {};}};

export default function TreeWorkspacePanel() {
  const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [search,setSearch]=useState(""),[operation,setOperation]=useState<Operation>("update"),[selected,setSelected]=useState(""),[parent,setParent]=useState("");
  const [generationFilter,setGenerationFilter]=useState(0);
  const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{const r=await fetch("/api/tree-workspace",{cache:"no-store"});const j=await r.json() as Data;if(!r.ok)throw Error(j.error||"تعذر فتح مساحة العمل");setData(j);},[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function send(payload:Record<string,unknown>) {
    setBusy(true);setError("");setNotice("");
    try {const r=await fetch("/api/tree-workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json() as {error?:string;message?:string};if(!r.ok)throw Error(j.error||"تعذر حفظ الإجراء");setNotice(j.message||"تم الحفظ مع أثر تدقيقي.");await load();return true;}
    catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الإجراء");return false;}finally{setBusy(false);}
  }
  const active=useMemo(()=>(data?.people||[]).filter(p=>p.active),[data]);
  const byId=useMemo(()=>new Map((data?.people||[]).map(p=>[p.id,p])),[data]);
  const generation=useCallback((id:string)=>byId.get(id)?.generation||1,[byId]);
  const options=active.filter(p=>(p.name+" "+p.id).includes(search.trim())).slice(0,350);
  const chosen=byId.get(selected);
  const personOption=(p:Person)=>`${p.name} · الجيل ${generation(p.id)} · ${p.id.slice(0,8)}`;
  const countMale=active.filter(p=>p.gender==="male").length,countFemale=active.filter(p=>p.gender==="female").length;
  const availableGenerations=[...new Set(active.map(p=>p.generation))].sort((a,b)=>a-b);
  const generationPeople=active.filter(p=>generationFilter===0||p.generation===generationFilter).slice(0,180);
  return <><section className="portal-card"><h3><GitBranch size={21} style={{display:"inline",marginLeft:8}}/> سجل استكمال الأنساب — المرحلة الأولى</h3>
    <p>الهيكل الأساسي من نسخة 2005، ويُعامل هنا كنقطة انطلاق لعملية جمع البيانات. الإدخال والتعديل والحذف يظلان طلبات غير نافذة حتى يراجعها المختصون؛ والسجل الرسمي المعتمد مستقل عن هذا المسار.</p>
    <div className="portal-task-row"><span className="portal-tag">الأسماء المتاحة: {active.length||data?.expectedBaselineCount||0}</span><span className="portal-tag">ذكور في سجل العمل: {countMale}</span><span className="portal-tag">إناث أُضيفن لاحقًا: {countFemale}</span><span className="portal-tag">طلبات معلّقة: {data?.changes.filter(c=>c.status==="pending").length||0}</span></div>
    {notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}</div>}
    {!data?.initialized&&data?.isAdmin&&<div className="portal-note"><p>قاعدة العمل فارغة حاليًا. يمكنك استيراد الأسماء الـ{data.expectedBaselineCount} من الهيكل بعد مراجعته؛ ستُسجل جميعها مبدئيًا «ذكر»، دون إضافة تواريخ ميلاد تخمينية أو بيانات تواصل.</p><button className="portal-button" disabled={busy} onClick={()=>{if(confirm("تأكيد إنشاء سجل عمل مستقل من المشجرة الحالية، مع تصنيف الأسماء الموجودة جميعًا كذكور وترك البيانات الأخرى غير معروفة؟"))send({action:"initialize",confirmBaseline:true});}}>إنشاء سجل العمل من المشجرة الحالية</button></div>}
    <div className="portal-note"><ShieldCheck size={18} style={{display:"inline",marginLeft:8}}/> لا يُنشر الجوال أو البريد في الواجهة العامة، ولا تعني إضافة «أنثى» في هذه المساحة اعتماد علاقة نسب قبل موافقة الفريق المختص.</div>
  </section>
  {data?.initialized&&<section className="portal-card"><h3>الأجيال في سجل العمل</h3><p>تظهر هنا الأسماء التي أُدرجت في النسخة الأساسية أو أُضيفت لاحقًا بعد المراجعة؛ الجيل محسوب من علاقة الأب أو الأم في الهيكل، وليس من سنة الميلاد.</p>
    <div className="portal-task-row"><label>تصفية الجيل <select value={generationFilter} onChange={e=>setGenerationFilter(Number(e.target.value))} style={{marginRight:8,padding:9,borderRadius:7,border:"1px solid #ded8ca"}}><option value={0}>جميع الأجيال</option>{availableGenerations.map(g=><option key={g} value={g}>الجيل {g} ({active.filter(p=>p.generation===g).length})</option>)}</select></label></div>
    <div className="portal-workspace-grid">{generationPeople.map(p=><button type="button" key={p.id} className={`portal-workspace-person ${selected===p.id?"selected":""}`} onClick={()=>{setSelected(p.id);setOperation("update");}}><strong>{p.name}</strong><span>{p.gender==="male"?"ذكر":"أنثى"} · الجيل {p.generation}</span><small>الأصل: {p.parentId?byId.get(p.parentId)?.name||"من الجيل السابق":"الأصل الأعلى"}</small></button>)}</div>
    {active.length>180&&generationFilter===0&&<p>لعرض بقية الأسماء، اختر جيلًا من القائمة.</p>}
  </section>}
  {data?.initialized&&<div className="portal-columns"><div><section className="portal-card"><h3><BookUser size={21} style={{display:"inline",marginLeft:8}}/> تقديم تعديل أو إضافة للفرع</h3>
    <div className="portal-task-row" role="group" aria-label="نوع الإجراء">{(["update","create","delete"] as Operation[]).map(o=><button key={o} type="button" className={`portal-button ${operation===o?"":"secondary"}`} onClick={()=>{setOperation(o);setSelected("");setParent("");}}>{changeText[o]}</button>)}</div>
    <label className="public-search portal-search" style={{marginTop:16}}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في الأسماء أو معرف الخلية" aria-label="بحث في الأسماء"/></label>
    <form className="portal-form" key={`${operation}-${selected}-${parent}`} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));const request={action:"propose",operation,targetPersonId:operation==="create"?null:selected,parentId:operation==="create"?parent:null,...values};if(await send(request)){if(operation==="create")form.reset();}}}>
      {operation==="create"?<label>الأب أو الأم من المشجرة (مكان إضافة الشخص)<select required value={parent} onChange={e=>setParent(e.target.value)}><option value="">اختر الأصل الموجود</option>{options.map(p=><option key={p.id} value={p.id}>{personOption(p)}</option>)}</select></label>:
        <label>الشخص الذي ستحدث بياناته<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">اختر شخصًا من السجل</option>{options.map(p=><option key={p.id} value={p.id}>{personOption(p)}</option>)}</select></label>}
      {operation!=="delete"&&fields.map(f=><label key={f.name}>{f.title}{f.name==="gender"?<select name="gender" defaultValue={chosen?.gender||"male"} required><option value="male">ذكر</option><option value="female">أنثى</option></select>:
        <input name={f.name} required={f.name==="name"} maxLength={f.max} defaultValue={operation==="update"?String(chosen?.[f.name]||""):""} type={f.kind==="email"?"email":f.kind==="tel"?"tel":"text"} inputMode={f.kind==="year"?"numeric":undefined} pattern={f.kind==="year"?"[0-9]{4}":undefined} placeholder={f.kind==="year"?"مثال: 1990، أو اتركه فارغًا":undefined}/>}</label>)}
      {operation==="delete"&&<div className="portal-note">الحذف المقترح يعني أرشفة الاسم بعد الموافقة، ولن يسمح بحذف شخص له أبناء مسجلون. لا يتم أي تغيير مباشر.</div>}
      <label>مصدر المعلومة أو سبب التغيير<textarea name="sourceNote" required minLength={5} maxLength={1200} placeholder="مثل: إفادة أحد كبار الأسرة أو مراجعة وثيقة، مع شرح موجز."/></label>
      <button className="portal-button" disabled={busy||!(operation==="create"?parent:selected)}>إرسال الطلب لفريق الأنساب</button>
    </form>
  </section></div><div><section className="portal-card"><h3>بطاقة الشخص</h3>{chosen&&operation!=="create"?<><h4>{chosen.name}</h4><div className="portal-task-row"><span className="portal-tag">{chosen.gender==="male"?"ذكر":"أنثى"}</span><span className="portal-tag">الجيل {generation(chosen.id)}</span><span className="portal-tag">المراجعة {chosen.revision}</span></div><p>الأصل: {chosen.parentId?byId.get(chosen.parentId)?.name||chosen.parentId:"أصل المشجرة"}</p>{chosen.birthYear&&<p>سنة الميلاد: {chosen.birthYear}</p>}{chosen.education&&<p>التعليم: {chosen.education}</p>}{chosen.position&&<p>المهمة/المنصب: {chosen.position}</p>}</>:<div className="portal-empty">اختر شخصًا من سجلات الفرع لاستعراض بياناته قبل طلب التعديل.</div>}</section>
    <section className="portal-card"><h3>طلباتي وحالات المراجعة</h3>{data.changes.length?data.changes.slice(0,60).map(c=><div key={c.id} className="portal-item"><div><h4>{changeText[c.action]||c.action}</h4><p>{c.sourceNote}</p><span className="portal-tag">{stateText[c.status]||c.status}</span>{c.reviewNote&&<p>ملاحظة المراجع: {c.reviewNote}</p>}</div><span className="portal-small">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</span></div>):<div className="portal-empty">لا توجد طلبات تعديل حتى الآن.</div>}</section>
  </div></div>}
  {data?.isAdmin&&data.initialized&&<section className="portal-card"><h3><UserRoundPlus size={21} style={{display:"inline",marginLeft:8}}/> تفويض استكمال فرع من المشجرة</h3>
    <p>اختر شخصًا موجودًا في الهيكل، ثم أصل الفرع الذي سيعمل ضمن ذريته. يكون التفويض محدد النطاق، ولا يفتح حساب دخول أو يرسل دعوة بمجرد حفظه.</p>
    <form className="portal-form portal-delegation-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));if(await send({action:"delegate",...values,confirmIdentity:values.confirmIdentity==="on"}))form.reset();}}>
      <label>الشخص المفوض<select name="delegatePersonId" required defaultValue=""><option value="">اختر من أسماء الهيكل</option>{active.map(p=><option key={p.id} value={p.id}>{personOption(p)}</option>)}</select></label>
      <label>أصل الفرع المخول له<select name="scopePersonId" required defaultValue=""><option value="">حدد أصل فرعه</option>{active.map(p=><option key={p.id} value={p.id}>{personOption(p)}</option>)}</select></label>
      <label>الحساب العائلي المطابق (اختياري)<select name="memberId"><option value="">لا يوجد حساب مفعّل — حفظ التفويض إلى حين التفعيل</option>{data.eligibleAccounts.map(m=><option key={m.id} value={m.id}>{m.name} · {m.personRef.slice(0,8)}</option>)}</select></label>
      <label className="portal-checkline" style={{display:"flex",alignItems:"center",gap:8}}><input name="confirmIdentity" type="checkbox" style={{width:18,minHeight:18}}/> أؤكد مطابقة هوية صاحب الحساب بفرد المشجرة عند اختيار حساب مفعّل</label>
      <label>وصف المهمة<textarea name="note" maxLength={600} placeholder="مثال: استكمال جيل 13 وما بعده وتوثيق مواليد الأسرة."/></label>
      <button className="portal-button" disabled={busy}>حفظ تفويض النطاق</button>
    </form>
    {data.delegations.length>0&&<div style={{marginTop:22}}><h4>التفويضات المسجلة</h4>{data.delegations.map(g=><div className="portal-item" key={g.id}><div><h4>{byId.get(g.delegatePersonId)?.name||g.delegatePersonId}</h4><p>الفرع: {byId.get(g.scopePersonId)?.name||g.scopePersonId} · {g.note||"استكمال بيانات الفرع"}</p><span className="portal-tag">{g.status==="assigned"?(g.hasVerifiedAccount?"مُسند إلى حساب عائلي موثق":"مُسند · بانتظار ربط هوية الدخول"):"مسحوب"}</span></div>{g.status==="assigned"&&<button className="portal-button secondary" disabled={busy} onClick={()=>{if(confirm("سحب هذا التفويض ومنع إرسال طلبات جديدة بواسطته؟"))send({action:"revoke",id:g.id});}}>سحب</button>}</div>)}</div>}
  </section>}
  {data?.canReview&&<section className="portal-card"><h3><CheckCircle2 size={21} style={{display:"inline",marginLeft:8}}/> مراجعة طلبات فروع الأنساب</h3>
    <p>لا تُرحّل أي إضافة أو تعديل أو أرشفة إلى سجل العمل إلا بعد قرار مسبب من مراجع الأنساب، ولا يمكن للمراجع قبول طلب أنشأه بنفسه.</p>
    {data.changes.filter(c=>c.status==="pending").length?data.changes.filter(c=>c.status==="pending").map(c=><div className="portal-item" key={c.id}><div style={{width:"100%"}}><h4>{changeText[c.action]} · {c.targetPersonId?byId.get(c.targetPersonId)?.name||c.targetPersonId:byId.get(c.parentId||"")?.name||"فرع جديد"}</h4><p>المصدر: {c.sourceNote}</p>
      {c.action!=="delete"&&<div className="portal-workspace-review-fields">{fields.map(f=>{const next=proposedFields(c.fieldsJson)[f.name]||"";const before=c.action==="update"?String(byId.get(c.targetPersonId||"")?.[f.name]||""):"";return <div key={f.name}><strong>{f.title}</strong><span>{f.name==="gender"?(next==="female"?"أنثى":"ذكر"):next||"غير مدخل"}</span>{c.action==="update"&&before!==next&&<small>القيمة الحالية: {f.name==="gender"?(before==="female"?"أنثى":"ذكر"):before||"فارغة"}</small>}</div>;})}</div>}
      <label className="portal-form">قرار المراجعة وسببه<textarea minLength={8} required value={reviewNotes[c.id]||""} onChange={e=>setReviewNotes(q=>({...q,[c.id]:e.target.value}))} placeholder="نتيجة فحص المعلومة والمصدر"/></label>
      <div className="portal-task-row"><button className="portal-button" disabled={busy} onClick={()=>send({action:"review",id:c.id,decision:"approved",reviewNote:reviewNotes[c.id]||""})}>اعتماد التعديل</button><button className="portal-button outline" disabled={busy} onClick={()=>send({action:"review",id:c.id,decision:"rejected",reviewNote:reviewNotes[c.id]||""})}>رفض مسبب</button></div>
    </div></div>):<div className="portal-empty">لا توجد طلبات تنتظر المراجعة.</div>}
  </section>}
  <div className="portal-note"><LockKeyhole size={17} style={{display:"inline",marginLeft:8}}/> بيانات الهواتف والبريد اختيارية وخاصة. لا تُنقل التحديثات آليًا إلى النسب المعتمد رسميًا، ولا إلى الواجهة العامة، ولا إلى حسابات الأفراد دون إجراءات الهوية والنشر.</div>
  </>;
}
