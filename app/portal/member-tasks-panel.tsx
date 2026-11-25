"use client";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, ListTodo, ShieldCheck } from "lucide-react";

type Person = { personId: string; name: string; branch: string };
type Task = { id: string; personId: string; personName: string; canReport: boolean; kind: string; title: string; description: string; dueDate: string; status: string; memberReport: string; reviewNote: string; updatedAt: string };
type Data = { tasks: Task[]; approvedPeople: Person[]; canManage: boolean; error?: string };
const labels: Record<string,string> = { complete_branch: "استكمال فرع العائلة", verify_details: "مراجعة البيانات", research: "البحث والتحقق", documentation: "جمع المصادر والوثائق", other: "تكليف آخر" };
const states: Record<string,string> = { assigned: "بانتظار الفرد", submitted: "بانتظار مراجعة المسؤول", returned: "أعيد لاستكماله", completed: "مكتمل ومعتمد" };

export default function MemberTasksPanel() {
  const [data,setData]=useState<Data|null>(null), [busy,setBusy]=useState(false), [notice,setNotice]=useState(""), [error,setError]=useState("");
  const [responses,setResponses]=useState<Record<string,string>>({}), [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{const r=await fetch("/api/member-tasks",{cache:"no-store"});const j=await r.json() as Data;if(!r.ok)throw Error(j.error||"تعذر تحميل المهام.");setData(j);},[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function send(payload:Record<string,unknown>) {
    setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/member-tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json() as {error?:string};if(!r.ok)throw Error(j.error||"تعذر حفظ المهمة.");setNotice("سُجّل الإجراء في سجل المهام مع أثر للمراجعة.");try{await load();}catch{setError("تم حفظ الإجراء، لكن تعذر تحديث القائمة. أعد تحميل المهام؛ لا حاجة لإرسال الإجراء مرة أخرى.");}return true;}
    catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ الإجراء.");return false;}
    finally{setBusy(false);}
  }
  return <div className="portal-columns"><div><section className="portal-card">
    <h3><ListTodo size={20} style={{display:"inline",marginLeft:8}}/> مهامي ومهام أفراد الفروع</h3>
    <p>يرتبط كل تكليف بمعرّف فرد من المشجرة المعتمدة، وتبقى المتابعة محفوظة عند تفعيل عضويته لاحقًا. لا تُعد تقارير الأفراد تعديلات نسب معتمدة.</p>
    {notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}<button type="button" className="portal-button outline" disabled={busy} onClick={()=>{setError("");load().catch(e=>setError(e.message));}}>إعادة تحميل المهام</button></div>}
    {!data ? <p role="status">{error?"تعذر عرض المهام حاليًا.":"جارٍ تحميل المهام…"}</p> : data.tasks.length ? data.tasks.map(task=><article className="portal-item" key={task.id}><div style={{width:"100%"}}><h4>{task.title}</h4>
      <div className="portal-task-row"><span className="portal-tag">{states[task.status]||task.status}</span><span className="portal-tag">{labels[task.kind]||task.kind}</span></div>
      <p>{task.description}</p><p><strong>الفرد:</strong> {task.personName||"سجل معتمد"}{task.dueDate?` · الموعد ${task.dueDate}`:""}</p>
      {task.memberReport&&<div className="portal-note">تقرير الفرد: {task.memberReport}</div>}
      {task.reviewNote&&<div className="portal-note">ملاحظة المسؤول: {task.reviewNote}</div>}
      {task.canReport && task.status!=="completed" && <form className="portal-form portal-review-form" onSubmit={async e=>{e.preventDefault();if(await send({action:"report",id:task.id,memberReport:responses[task.id]||""}))setResponses(q=>({...q,[task.id]:""}));}}>
        <label>تحديث المهمة وإرسال الإنجاز للمراجعة<textarea required minLength={10} maxLength={3000} value={responses[task.id]||""} onChange={e=>setResponses(q=>({...q,[task.id]:e.target.value}))} placeholder="ما الذي جُمِع أو أُنجز؟ وما الذي يحتاج إلى تحقق اللجنة؟"/></label><button className="portal-button outline" disabled={busy}>رفع تقرير المهمة</button></form>}
      {data.canManage&&task.status==="submitted"&&<form className="portal-form portal-review-form" onSubmit={e=>e.preventDefault()}>
        <label>ملاحظة المراجعة<textarea required minLength={8} value={reviewNotes[task.id]||""} onChange={e=>setReviewNotes(q=>({...q,[task.id]:e.target.value}))}/></label>
        <div className="portal-task-row"><button className="portal-button" disabled={busy} onClick={()=>send({action:"review",id:task.id,status:"completed",reviewNote:reviewNotes[task.id]||""})}>اعتماد إنجاز التكليف</button><button className="portal-button secondary" disabled={busy} onClick={()=>send({action:"review",id:task.id,status:"returned",reviewNote:reviewNotes[task.id]||""})}>إعادة للاستكمال</button></div>
      </form>}
    </div></article>) : <div className="portal-empty">لا توجد مهام فردية حتى الآن. تظهر المهام الشخصية هنا بمجرد إسنادها إلى سجل نسب معتمد.</div>}
  </section></div>
  <div>{data?.canManage&&<section className="portal-card"><h3><ClipboardList size={20} style={{display:"inline",marginLeft:8}}/> إسناد مهمة لفرد محدد</h3>
    <form className="portal-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await send({action:"create",...Object.fromEntries(new FormData(form))}))form.reset();}}>
      {!data.approvedPeople.length&&<p className="portal-note">لا يوجد حاليًا أفراد بالغون أحياء في السجل المعتمد ضمن نطاق صلاحيتك. يظهر اختيار الشخص بعد اعتماد بياناته؛ وجود الاسم في مسودة المشجرة وحده لا يكفي.</p>}
      <label>اختر من أفراد المشجرة المعتمدة<select name="personId" required defaultValue=""><option value="">اختر الشخص</option>{data.approvedPeople.map(p=><option key={p.personId} value={p.personId}>{p.name} {p.branch?`— ${p.branch}`:""}</option>)}</select></label>
      <label>نوع التكليف<select name="kind">{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>عنوان المهمة<input name="title" minLength={5} maxLength={180} required placeholder="مثل: توثيق أسماء أبناء الفرع"/></label>
      <label>تفاصيل المطلوب<textarea name="description" maxLength={2800} placeholder="المعلومات المطلوبة والمصادر المناسبة، مع تجنب نشر بيانات حساسة."/></label>
      <label>الموعد المستهدف<input name="dueDate" type="date"/></label>
      <button className="portal-button" disabled={busy||!data.approvedPeople.length}>إسناد المهمة وحفظها</button>
    </form></section>}
    <div className="portal-note"><ShieldCheck size={18} style={{display:"inline",marginLeft:8}}/> إسناد مهمة «استكمال المشجرة» لا يسمح للفرد بتعديل النسب المعتمد مباشرة؛ تُرفع المقترحات والأدلة للجنة الأنساب وفق مسار القرار.</div>
  </div></div>;
}
