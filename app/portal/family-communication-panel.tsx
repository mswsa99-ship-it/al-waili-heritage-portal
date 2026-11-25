"use client";
import { useCallback, useEffect, useState } from "react";
import { HeartHandshake, MessageSquareText, ShieldCheck, Vote } from "lucide-react";

type Poll = { id:string; title:string; description:string; options:string[]; status:string; closesAt:string; myChoice:number|null; totalVotes:number|null; counts:number[]|null; canCast:boolean };
type PollView = { polls:Poll[]; canManage:boolean; canVote:boolean; error?:string };
type Contribution = { id:string; kind:string; title:string; authorName:string; body:string; status:string; responseNote:string; createdAt:string };
type ContributionView = { contributions:Contribution[]; canManage:boolean; error?:string };
const kinds:Record<string,string> = { proposal:"مقترح",plan:"خطة عمل",initiative:"مبادرة عائلية",volunteer:"طلب تطوع",poll_request:"اقتراح موضوع للتصويت",branch_update:"استكمال بيانات فرع",question:"استفسار وملاحظة",media:"محتوى للتواصل والإعلام" };
const states:Record<string,string> = { new:"جديد",in_review:"قيد الدراسة",accepted:"مقبول للتنفيذ",returned:"أعيد للاستكمال",completed:"منجز" };

export default function FamilyCommunicationPanel() {
  const [pollData,setPollData]=useState<PollView|null>(null),[contributionData,setContributionData]=useState<ContributionView|null>(null);
  const [choice,setChoice]=useState<Record<string,number>>({}),[reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const [optionsText,setOptionsText]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    const [pollResponse,contributionResponse]=await Promise.all([fetch("/api/family-polls",{cache:"no-store"}),fetch("/api/family-contributions",{cache:"no-store"})]);
    const polls=await pollResponse.json() as PollView,contributions=await contributionResponse.json() as ContributionView;
    if(!pollResponse.ok)throw Error(polls.error||"تعذر تحميل التصويت");
    if(!contributionResponse.ok)throw Error(contributions.error||"تعذر تحميل المساهمات");
    setPollData(polls);setContributionData(contributions);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function send(path:string,payload:Record<string,unknown>) {
    setBusy(true);setError("");setNotice("");
    try{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json() as {error?:string;message?:string};if(!r.ok)throw Error(j.error||"تعذر حفظ الطلب");setNotice(j.message||"سُجل الإجراء بنجاح في قاعدة البوابة.");await load();return true;}
    catch(e){setError(e instanceof Error?e.message:"تعذر حفظ العملية.");return false;}
    finally{setBusy(false);}
  }
  return <><div className="portal-note"><ShieldCheck size={17} style={{display:"inline",marginLeft:8}}/> هذه قناة تواصل للأفراد المرتبطين بسجل نسب معتمد. التصويت الأسري للاستشارة والمشاركة، ولا يحل محل تصويت لجنة الأنساب أو قرارات مجلس الإدارة.</div>
    {notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}</div>}
    <div className="portal-columns"><div><section className="portal-card"><h3><Vote size={21} style={{display:"inline",marginLeft:8}}/> تصويت واستطلاعات الأسرة</h3><p>لكل فرد صاحب حساب مرتبط بالمشجرة صوت واحد في كل استطلاع، وتُظهر البوابة النتائج المجمعة فقط بعد المشاركة أو الإغلاق.</p>
      {pollData?.polls.length?pollData.polls.map(p=><article key={p.id} className="portal-item"><div style={{width:"100%"}}><h4>{p.title}</h4><p>{p.description}</p><div className="portal-task-row"><span className="portal-tag">{p.status==="draft"?"مسودة":p.status==="open"?"مفتوح للتصويت":"مغلق"}</span><span className="portal-small">الإغلاق: {new Date(p.closesAt).toLocaleString("ar-SA")}</span></div>
        {p.options.map((label,index)=><label className="portal-ballot-option" key={`${p.id}-${index}`}>
          <input type="radio" disabled={!p.canCast||busy} name={`ballot-${p.id}`} value={index} checked={p.myChoice===index || (p.myChoice===null&&choice[p.id]===index)} onChange={()=>setChoice(q=>({...q,[p.id]:index}))}/>
          <span>{label}</span>{p.counts&&<span className="portal-vote-count">{p.counts[index]} صوت</span>}
        </label>)}
        {p.totalVotes!==null&&<p>إجمالي الأصوات المسجلة: <strong>{p.totalVotes}</strong>{p.myChoice!==null?" · صوتك محفوظ ولا يمكن تغييره":""}</p>}
        {p.canCast&&<button className="portal-button" disabled={busy||choice[p.id]===undefined} onClick={()=>send("/api/family-polls",{action:"vote",id:p.id,optionIndex:choice[p.id]})}>اعتماد صوتي</button>}
        {pollData.canManage&&p.status==="draft"&&<button className="portal-button outline" disabled={busy} onClick={()=>{if(confirm("هل راجعت صياغة التصويت وخصوصية المشاركين قبل فتحه لأفراد الأسرة؟"))send("/api/family-polls",{action:"publish",id:p.id,confirmPrivacy:true});}}>اعتماد وفتح التصويت</button>}
        {pollData.canManage&&p.status==="open"&&<button className="portal-button secondary" disabled={busy} onClick={()=>{if(confirm("إغلاق التصويت الآن؟"))send("/api/family-polls",{action:"close",id:p.id});}}>إغلاق التصويت</button>}
      </div></article>):<div className="portal-empty">لا توجد استطلاعات مفتوحة بعد؛ يمكن للإدارة إعداد استطلاع وحفظه ثم نشره داخليًا.</div>}
      {pollData&&!pollData.canVote&&<div className="portal-note">حساب مسؤول البوابة التأسيسي لا يصوت نيابة عن أفراد الأسرة. يبدأ التصويت الفردي بعد تفعيل حساب مرتبط بسجل نسب معتمد.</div>}
    </section>
    {pollData?.canManage&&<section className="portal-card"><h3>إعداد تصويت جديد</h3><form className="portal-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));const closesAt=new Date(String(data.closesAt));if(await send("/api/family-polls",{action:"create",title:data.title,description:data.description,closesAt:closesAt.toISOString(),options:optionsText.split("\n").map(s=>s.trim()).filter(Boolean)})){form.reset();setOptionsText("");}}}>
      <label>موضوع التصويت<input name="title" required minLength={5} maxLength={170}/></label>
      <label>شرح محايد للموضوع<textarea name="description" maxLength={1500}/></label>
      <label>الخيارات (خيار واحد في كل سطر، من ٢ إلى ٨)<textarea required value={optionsText} onChange={e=>setOptionsText(e.target.value)} placeholder={"موافق\nغير موافق\nأحتاج معلومات إضافية"}/></label>
      <label>آخر موعد للتصويت<input type="datetime-local" name="closesAt" required/></label>
      <button className="portal-button" disabled={busy}>حفظ مسودة التصويت</button></form></section>}
    </div><div><section className="portal-card"><h3><MessageSquareText size={21} style={{display:"inline",marginLeft:8}}/> المقترحات والخطط والمبادرات والتطوع</h3>
      <p>تسجل كل مشاركة في ملف خاص، ويظهر لصاحبها موقف المراجعة. لا تنشر تلقائيًا في أخبار الأسرة أو الواجهة الخارجية.</p>
      {contributionData?.contributions.length?contributionData.contributions.map(c=><article className="portal-item" key={c.id}><div style={{width:"100%"}}><h4>{c.title}</h4><span className="portal-tag">{kinds[c.kind]||c.kind} · {states[c.status]||c.status}</span><p>المقدم: {c.authorName}</p><p style={{whiteSpace:"pre-line"}}>{c.body}</p>{c.responseNote&&<div className="portal-note">رد المسؤول: {c.responseNote}</div>}
        {contributionData.canManage&&<form className="portal-form portal-review-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));await send("/api/family-contributions",{action:"review",id:c.id,...values});}}><label>موقف المراجعة<select name="status" defaultValue={c.status}>{Object.entries(states).filter(([k])=>k!=="new").map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label><label>رد الإدارة لصاحب المساهمة<textarea name="responseNote" required minLength={8} defaultValue={reviewNotes[c.id]||c.responseNote} onChange={e=>setReviewNotes(q=>({...q,[c.id]:e.target.value}))}/></label><button className="portal-button outline" disabled={busy}>تسجيل رد الإدارة</button></form>}
      </div></article>):<div className="portal-empty">لا توجد مساهمات مسجلة ضمن صلاحياتك.</div>}
    </section></div>
    <div><section className="portal-card"><h3><HeartHandshake size={20} style={{display:"inline",marginLeft:8}}/> إرسال مساهمة جديدة</h3>
      {pollData?.canVote ? <form className="portal-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await send("/api/family-contributions",{action:"create",...Object.fromEntries(new FormData(form))}))form.reset();}}>
        <label>نوع الطلب أو المساهمة<select name="kind">{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>عنوان واضح<input name="title" required minLength={5} maxLength={180}/></label>
        <label>التفاصيل<textarea name="body" required minLength={12} maxLength={3500} placeholder="ما الفكرة أو الخطة؟ وما المطلوب من المجلس؟ تجنب مشاركة معلومات شخصية لغيرك."/></label>
        <button className="portal-button" disabled={busy}>إرسال للمراجعة والمتابعة</button>
      </form> : <div className="portal-note">تنشط المشاركة بعد استكمال دعوة فرد بالغ وربط حسابه بسجل نسب معتمد. يمكن لمسؤول البوابة مراجعة ما يصل من الأعضاء هنا.</div>}
      <div className="portal-note">الملاحظات على النسب تحول إلى مسار لجنة الأنساب الرسمي؛ لا يعد قبول المقترح اعتمادًا لأي تغيير في المشجرة.</div>
    </section></div></div></>;
}
