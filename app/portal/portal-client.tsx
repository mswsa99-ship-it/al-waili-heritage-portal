"use client";
import "./member-design.css";
import ConnectionStatus from '@/components/connection-status';
import {allowedAdminTools,permissionsMatrix} from '@/lib/portal-permissions';
import {PortalWorkflowGuide} from "@/components/portal-workflow-guide";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "@/components/portal-link";
import {memberGroups,adminGroups,portalDestination,type PortalTab as Tab} from "@/lib/portal-navigation";
import {portalHelp,roleStartingPoint} from "@/lib/portal-help";
import LineageClient from "@/app/lineage-workspace/lineage-client";
import "@/app/lineage-workspace/lineage.css";
import EventCalendar from "./event-calendar";
import GovernancePanel from "./governance-panel";
import CommunityPrograms from "./community-programs";
import PrivateFiles from "@/components/private-files";
import InviteActions from "./invite-actions";
import ProfilePanel from "./profile-panel";
import RegistryPanel from "./registry-panel";
import InvitationPanel from "./invitation-panel";
import ArchivePanel from "./archive-panel";
import CouncilPanel from "./council-panel";
import InquiriesPanel from "./inquiries-panel";
import LineagePanel from "./lineage-panel";
import EnrollmentPanel from "./enrollment-panel";
import MemberTasksPanel from "./member-tasks-panel";
import FamilyCommunicationPanel from "./family-communication-panel";

import { Archive, BookOpenText, CalendarDays, ClipboardList, FileClock, Fingerprint, HeartHandshake, Home, Inbox, LayoutDashboard, ListTodo, Megaphone, MessageCircle, Network, ShieldCheck, Users, UserRoundPlus, Vote, ChevronLeft, Send } from "lucide-react";

type Row = Record<string, string | number | boolean | null | undefined>;
type View = {
  me: { userId: string; name: string; role: string; branch: string; isOwner: boolean; canEditTree: boolean };
  announcements: Row[]; events: Row[]; requests: Row[]; nominations: Row[];
  corrections: Row[]; rsvps: Row[]; members: Row[];
  counts: { approvedPeople: number; draftTranscriptions: number; pendingCorrections: number };
};

const nameOfRole: Record<string,string> = { central:"الإدارة المركزية", council:"عضو المجلس", branch:"ممثل الفرع", genealogy:"لجنة الأنساب", secretary:"أمين السر", social:"فريق التكافل", oversight:"المتابعة المستقلة", member:"عضو الأسرة" };
const kindLabel: Record<string,string> = { observation:"ملاحظة على النسب", social:"طلب اجتماعي سري", volunteer:"التطوع", education:"التعليم والشباب", skills:"الخبرات والمهارات", document:"طلب وثيقة", general:"استفسار عام", procedural:"مراجعة إجرائية" };
const statusLabel: Record<string,string> = { new:"جديد",closed:"مغلق", committee_review:"بانتظار لجنة الأنساب",approved:"معتمد بقرار اللجنة",rejected:"مرفوض",nominated:"مرشح",awaiting_sms_provider:"تم تجهيز العضوية للدعوة الخاصة",attending:"سأحضر",not_attending:"لن أحضر" };
const rowString = (row: Row, key: string) => String(row[key] ?? "");
const formatDate = (s: unknown) => {
  if (typeof s !== "string" || !s) return "";
  try { return new Date(s).toLocaleDateString("ar-SA", { day:"numeric", month:"long", year:"numeric" }); } catch { return s; }
};
const menu: { key: Tab; title:string; icon: typeof Home; category?: string }[] = [
  { key:"home", title:"الرئيسية", icon:LayoutDashboard },
  { key:"lineage", title:"المشجرة والنسب", icon:Network },
  { key:"treeWorkspace", title:"استكمال بيانات المشجرة", icon:Fingerprint },
  { key:"registry", title:"سجل النسب المعتمد", icon:Fingerprint },
  { key:"archive", title:"الأرشيف والمساهمات", icon:Archive },
  { key:"profile", title:"ملفي ودليل الخبرات", icon:UserRoundPlus },
  { key:"news", title:"أخبار الأسرة", icon:Megaphone },
  { key:"events", title:"المناسبات واللقاءات", icon:CalendarDays },
  { key:"services", title:"الخدمات والطلبات", icon:HeartHandshake },
  { key:"communication", title:"التواصل والتصويت", icon:MessageCircle },
  { key:"tasks", title:"مهامي الفردية", icon:ListTodo },
  { key:"branch", title:"متابعة الفروع", icon:Users },
  { key:"committee", title:"لجنة الأنساب", icon:Vote },
  { key:"membership", title:"العضويات والدعوات", icon:UserRoundPlus },
  { key:"enrollment", title:"اختيار أعضاء من المشجرة", icon:Fingerprint },
  { key:"office", title:"مهام المجلس واللجان", icon:ListTodo },
  { key:"inbox", title:"صندوق التواصل", icon:Inbox },
  { key:"governance", title:"الحوكمة والخصوصية", icon:ShieldCheck },
];
const administrationTabs = new Set<Tab>(["home","treeWorkspace","registry","archive","news","events","communication","tasks","services","branch","committee","membership","enrollment","office","inbox","governance"]);
const beneficiaryTabs = new Set<Tab>(["home","lineage","treeWorkspace","registry","archive","profile","news","events","services","communication","tasks","governance"]);
const administrationRoles = new Set(["central","branch","council","secretary","genealogy","social","oversight"]);

function GenericForm({ title, fields, action, onSubmit, submitLabel="حفظ وإرسال" }: {
  title:string; fields: { name:string; label:string; type?:string; required?:boolean; options?:[string,string][]; placeholder?:string }[];
  action:string; onSubmit: (a:string,p:Record<string,unknown>)=>Promise<void>; submitLabel?:string;
}) {
  const [sending,setSending] = useState(false);
  const [requestKind,setRequestKind]=useState("observation");
  return <section className="portal-card"><h3>{title}</h3><form className="portal-form" aria-busy={sending} onSubmit={async(e)=>{
    e.preventDefault(); if(sending)return; const form=e.currentTarget;
    const obj=Object.fromEntries(new FormData(form).entries());
    setSending(true);try { await onSubmit(action,obj);form.reset();setRequestKind("observation"); } catch { /* Error is shown in the parent panel. */ } finally {setSending(false);}
  }}>{fields.map(f=><label key={f.name}>{f.label}{f.required?" (مطلوب)":f.options?"":" (اختياري)"}
    {f.options ? <select name={f.name} required={f.required} onChange={f.name==="kind"?e=>setRequestKind(e.target.value):undefined}>{f.options.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}</select> :
      f.type==="textarea" ? <textarea name={f.name} required={f.required} placeholder={f.placeholder}/> :
      <input name={f.name} required={f.required} type={f.type||"text"} placeholder={f.placeholder}/>}
  </label>)}{action==="request.create"&&requestKind==="procedural"&&<label>رقم الملاحظة المغلقة (مطلوب)<input name="parentRequestId" required placeholder="انسخ رقم ملاحظتك السابقة بعد إغلاقها"/></label>}<div><button className="portal-button" disabled={sending} type="submit"><Send size={15}/>{sending?"جارٍ الحفظ...":submitLabel}</button></div></form></section>;
}

function Empty({ label }: {label:string}) { return <div className="portal-empty"><BookOpenText size={24} style={{margin:"0 auto 9px",opacity:.55}}/><div>{label}</div></div>; }
function Item({ title, detail, meta, status, children }: {title:string;detail?:string;meta?:string;status?:string;children?:React.ReactNode}) {
  return <div className="portal-item"><div><h4>{title}</h4>{detail&&<p>{detail}</p>}{status&&<span className="portal-tag">{statusLabel[status]||status}</span>}{children&&<div className="portal-task-row">{children}</div>}</div><div className="portal-small">{meta}</div></div>;
}

function NewsEditor({row,onSubmit}:{row:Row;onSubmit:(action:string,payload:Record<string,unknown>)=>Promise<void>}) {
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[title,setTitle]=useState(rowString(row,"title")),[body,setBody]=useState(rowString(row,"body"));
  const [category,setCategory]=useState(rowString(row,"category")||"news"),[audience,setAudience]=useState(rowString(row,"audience")),[published,setPublished]=useState(row.published===true),[confirmed,setConfirmed]=useState(false);
  useEffect(()=>{if(!editing){setCategory(rowString(row,"category")||"news");setTitle(rowString(row,"title"));setBody(rowString(row,"body"));setAudience(rowString(row,"audience"));setPublished(row.published===true);setConfirmed(false);}},[editing,row.title,row.body,row.audience,row.published,row.category]);
  return <div style={{marginTop:12}}>{!editing?<button className="portal-button outline" onClick={()=>setEditing(true)}>تحرير / إدارة النشر</button>:<form className="portal-form portal-review-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try {await onSubmit("announcement.update",{id:row.id,title,body,category,audience,published,confirmPublic:confirmed});setEditing(false);}catch{/* Displayed by parent */}finally{setBusy(false);}}}>
    <label>عنوان الخبر<input value={title} minLength={4} required onChange={e=>setTitle(e.target.value)} maxLength={180}/></label>
    <label>نص الخبر<textarea value={body} required onChange={e=>setBody(e.target.value)} maxLength={6000}/></label>
    <label>نوع المادة<select value={category} onChange={e=>setCategory(e.target.value)}><option value="news">أخبار</option><option value="events">مناسبات</option><option value="achievements">إنجازات</option><option value="publications">إصدارات</option></select></label><label>جمهور الخبر<select value={audience} onChange={e=>{setAudience(e.target.value);setConfirmed(false);}}><option value="family">داخل الأسرة</option><option value="public">للواجهة العامة</option></select></label>
    <label>حالة الإتاحة<select value={published?"published":"draft"} onChange={e=>setPublished(e.target.value==="published")}><option value="draft">مسودة غير منشورة</option><option value="published">منشور</option></select></label>
    {published&&audience==="public"&&<label className="portal-checkline"><input type="checkbox" checked={confirmed} required onChange={e=>setConfirmed(e.target.checked)}/> راجعت خصوصية الأشخاص وحقوق نشر هذه المادة</label>}
    <div className="portal-task-row"><button className="portal-button" disabled={busy}>حفظ التحديث</button><button type="button" className="portal-button secondary" onClick={()=>setEditing(false)}>إلغاء</button></div>
  </form>}</div>;
}

function EventEntry({event,response,onSubmit}:{event:Row;response:string;onSubmit:(action:string,payload:Record<string,unknown>)=>Promise<void>}) {
  const [saving,setSaving]=useState(false);const inFlight=useRef(false);
  async function respond(value:string){if(inFlight.current)return;inFlight.current=true;setSaving(true);try{await onSubmit("event.rsvp",{eventId:event.id,response:value})}catch{/* submit displays the error */}finally{inFlight.current=false;setSaving(false)}}
  return <div id={"event-"+rowString(event,"id")}><Item title={rowString(event,"title")} detail={rowString(event,"description")+(event.place?" · "+rowString(event,"place"):"")} meta={formatDate(event.eventDate)}>
    {response&&<span className="portal-tag">استجابتك الحالية: {statusLabel[response]||response}</span>}
    <button className="portal-button outline" disabled={saving} aria-pressed={response==="attending"} onClick={()=>void respond("attending")}>سأحضر</button>
    <button className="portal-button secondary" disabled={saving} aria-pressed={response==="not_attending"} onClick={()=>void respond("not_attending")}>اعتذار</button>
  </Item></div>;
}

const memberNavigation=[["dashboard","لوحتي"],["family","عائلتي"],["community","مجتمعنا"],["services","خدماتي"]] as const;
export default function PortalClient({mode="beneficiary",section="dashboard"}:{mode?:"beneficiary"|"administration";section?:string}) {
  const [group,setGroup]=useState(0);
  const [tab,setTab] = useState<Tab>(mode==="administration"?"home":memberGroups[section]?.[0]||"home");
  const [data,setData] = useState<View|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const reload = useCallback(async () => {
    const r = await fetch("/api/portal",{cache:"no-store"});
    const j = await r.json() as View & { error?: string };
    if(!r.ok) throw new Error(j.error||"تعذر فتح البوابة.");
    setData(j);
  },[]);
  useEffect(()=>{reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[reload]);
  const submit = async(action:string,payload:Record<string,unknown>) => {
    setNotice("");setError("");
    try {
      const r=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
      const j=await r.json() as { error?: string };
      if(!r.ok) throw new Error(j.error||"تعذر إرسال الطلب.");
      setNotice("تم الحفظ بنجاح.");
      try { await reload(); } catch { setError("تم الحفظ، لكن تعذر تحديث القائمة. أعد تحميل الصفحة لعرض التحديث؛ لا حاجة لإرسال الطلب مرة أخرى."); }
    } catch(e) { setError(e instanceof Error?e.message:"تعذر إتمام الإجراء.");throw e; }
  };
  const current = {...menu.find(m=>m.key===tab)!,...portalHelp[tab]};
  const role=data?.me.role||"";
  const manageNews=role==="central"||role==="council";
  const rep=role==="branch";
  const committee=role==="genealogy";
  const central=role==="central";
  const canAdmin=administrationRoles.has(role)||!!data?.me.canEditTree;
  const permittedTabs=menu.filter(m=>mode==='administration'?(m.key==='home'||allowedAdminTools(role,!!data?.me.canEditTree).includes(m.key)):Object.values(memberGroups).flat().includes(m.key));
  const visibleTabs=permittedTabs.filter(m=>mode==='administration'?m.key!=='home':(memberGroups[section]||memberGroups.dashboard).includes(m.key));
  const choose=(next:Tab,preferredGroup?:number)=>{
    const destination=portalDestination(next,mode,section);
    const currentPath=mode==='administration'?'/admin':'/member/'+section;
    if(destination.path!==currentPath){window.location.assign(destination.path+'?tab='+encodeURIComponent(next));return;}
    if(!permittedTabs.some(m=>m.key===next)){setError('هذه الخدمة غير متاحة ضمن صلاحياتك الحالية.');return;}
    setGroup(preferredGroup??(adminGroups[group]?.tabs.includes(next)?group:destination.group));setTab(next);setNotice('');setError('');
    window.history.pushState(null,'','?tab='+encodeURIComponent(next));window.scrollTo({top:0,behavior:'smooth'});
  };
  useEffect(()=>{
    const restore=()=>{const desired=new URLSearchParams(window.location.search).get('tab') as Tab|null;
      const allowed=permittedTabs;
      const defaultTab=mode==='administration'?'home':memberGroups[section]?.[0]||'home';
      const target=desired&&allowed.some(m=>m.key===desired)&&portalDestination(desired,mode,section).path===(mode==='administration'?'/admin':'/member/'+section)?desired:defaultTab;
      setTab(target);setGroup(portalDestination(target,mode,section).group);
    };restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
  },[mode,section,role,data?.me.canEditTree]);
  if(loading) return <main className="site-home" style={{minHeight:"100vh",display:"grid",placeItems:"center"}}><span style={{color:"#52745d"}}>جارٍ تحميل المساحة العائلية...</span></main>;
  if(!data) return <main className="site-home" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:28}}><section className="portal-card" style={{maxWidth:520,textAlign:"center"}}><ShieldCheck size={38} style={{margin:"auto",color:"#b18c55"}}/><h3>مرحبًا بك في بوابة الأسرة</h3><p>{error||"لم يتم ربط حسابك بعضوية مفعلة."}</p><p>إذا لم تُفعّل عضويتك بعد، تواصل مع ممثل فرعك لترشيحك، ثم تتولى الإدارة مراجعة البيانات وإصدار الدعوة. ظهور الاسم في المشجرة مستقل عن تفعيل الحساب.</p><button className="portal-button" onClick={()=>{setLoading(true);reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>إعادة المحاولة</button><Link href="/" className="portal-button" style={{marginTop:18}}>العودة للرئيسية</Link></section></main>;
  return <div className={"portal-shell easy-portal member-design"+(tab==='home'&&mode==='beneficiary'?" member-start":"")}>
    <a className="member-skip" href="#member-content">انتقل إلى الخدمات</a><div className="portal-content">
      <nav className="easy-account-nav" aria-label="أقسام البوابة"><Link href="/member/dashboard" aria-current={section==='dashboard'&&mode!=='administration'?'page':undefined}><Home size={22} aria-hidden="true"/><span>الرئيسية</span></Link><Link href="/member/family" aria-current={section==='family'?'page':undefined}><Network size={22} aria-hidden="true"/><span>الشجرة والبيانات</span></Link><Link href="/member/community" aria-current={section==='community'?'page':undefined}><MessageCircle size={22} aria-hidden="true"/><span>التواصل والأخبار</span></Link><Link href="/member/tasks" aria-current={section==='tasks'?'page':undefined}><ListTodo size={22} aria-hidden="true"/><span>المهام والتكليفات</span></Link>{canAdmin&&<Link href="/admin" aria-current={mode==='administration'?'page':undefined}><ShieldCheck size={22} aria-hidden="true"/><span>الإدارة والتحكم</span></Link>}</nav>
      <header className="portal-toolbar"><div className="executive-context"><p className="portal-kicker">{mode==="administration"?"إدارة ومتابعة مجلس ذرية حمد":"مجلس ذرية حمد بن محمد بن حمد بن عثمان بن ناصر"}</p><div className="portal-breadcrumb">{mode==="administration"?"لوحة الإدارة":"حسابي العائلي"} <ChevronLeft size={11} style={{display:"inline"}}/> {current.title}</div></div><div className="portal-profile"><div className="portal-avatar">{data.me.name.slice(0,1)}</div><div><strong>{data.me.name}</strong><div className="member-role">{nameOfRole[role]||role}</div></div><Link href="/" className="member-public-link"><Home size={17}/>الموقع العام</Link></div></header>
      <main className="portal-main" id="member-content" tabIndex={-1}><ConnectionStatus/>{mode==='administration'?<details className="easy-services" key={tab} open={tab==='home'}><summary>الإدارة والتحكم · أدواتك المكلّف بها</summary><nav className="easy-service-grid" aria-label="أدوات الإدارة المصرح بها">{visibleTabs.map(m=><button type="button" key={m.key} onClick={()=>choose(m.key)}><m.icon aria-hidden="true" size={28}/><strong>{portalHelp[m.key].title}</strong></button>)}</nav></details>:section!=='dashboard'&&visibleTabs.length>1?<nav className="four-section-tools" aria-label="خدمات القسم">{visibleTabs.map(m=><button key={m.key} aria-pressed={tab===m.key} onClick={()=>choose(m.key)}>{portalHelp[m.key].title}</button>)}</nav>:null}

        <div className="portal-heading"><div><h1>{tab==='home'?(mode==='administration'?'الإدارة والتحكم':'بوابة أبناء الأسرة'):current.title}</h1><p>{tab==="home"&&mode==="administration"?(roleStartingPoint[role]||"اختر القسم المناسب من قائمة الإدارة. تظهر لك الإجراءات المتاحة لدورك."):current.intro}</p></div><span className="portal-badge">{mode==="administration"?"مساحة الإدارة":"مساحتي الخاصة"}</span></div>
        {tab!=='home'&&<PortalWorkflowGuide tab={tab}/>}{notice&&<div className="portal-message" role="status">{notice}</div>}{error&&<div className="portal-message error" role="alert">{error}<button onClick={()=>setError("")} style={{marginRight:10,textDecoration:"underline"}}>إغلاق</button></div>}

        {tab==="profile"&&<ProfilePanel/>}
        {tab==="registry"&&<RegistryPanel canPublish={committee}/>}
        {tab==="archive"&&<><ArchivePanel canPublish={manageNews}/><PrivateFiles/></>}
        {tab==="office"&&<><CouncilPanel/><CommunityPrograms meetings/></>}
        {tab==="inbox"&&<><InquiriesPanel/><PrivateFiles/></>}
        {tab==="enrollment"&&<EnrollmentPanel/>}
        {tab==="tasks"&&<MemberTasksPanel/>}
        {tab==="communication"&&<><FamilyCommunicationPanel/><CommunityPrograms/></>}
        {tab==="treeWorkspace"&&<LineageClient embedded/>}
        {tab==='home'&&mode==='beneficiary'&&<div className="four-home"><Link href="/member/family"><Network size={36}/><h2>الشجرة والبيانات</h2><p>ابحث عن قريب، حدّث ملفك، واطّلع على الوثائق.</p><span className="member-card-action">فتح الشجرة والبيانات ←</span></Link><Link href="/member/community"><MessageCircle size={36}/><h2>التواصل والأخبار</h2><p>تابع الأخبار واللقاءات، وتواصل أو قدّم طلبًا.</p><span className="member-card-action">فتح التواصل والأخبار ←</span></Link><Link href="/member/tasks"><ListTodo size={36}/><h2>المهام والتكليفات</h2><p>اعرف ما هو مطلوب منك، وحدّث تقدم العمل.</p><span className="member-card-action">فتح المهام والتكليفات ←</span></Link>{canAdmin&&<Link href="/admin"><ShieldCheck size={36}/><h2>الإدارة والتحكم</h2><p>راجع الطلبات وأدِر الأعمال ضمن صلاحياتك.</p><span className="member-card-action">فتح الإدارة والتحكم ←</span></Link>}</div>}
        {tab==='home'&&mode==='administration'&&<section className="portal-card"><h2>مصفوفة الصلاحيات</h2><p>تظهر الأدوات بحسب الدور المسند. لا يمنح ظهور القسم صلاحية تعديل خارج نطاق التكليف.</p><div style={{overflowX:'auto'}}><table className="permission-matrix"><thead><tr><th>العملية</th><th>المخوّل</th><th>نطاق الصلاحية</th></tr></thead><tbody>{permissionsMatrix.map(row=><tr key={row[0]}>{row.map((text,i)=><td key={i}>{text}</td>)}</tr>)}</tbody></table></div></section>}

        {tab==="lineage"&&<><LineagePanel/><div className="portal-columns"><section className="portal-card"><h3>طلبات التصحيح وملاحظات النسب</h3><p>يستطيع الفرد رفع ملاحظة لممثل الفرع، ثم يتولى الممثل تقديم طلب النسب الرسمي عند توافر الأدلة المطلوبة.</p><button onClick={()=>choose("services")} className="portal-button secondary">إرسال ملاحظة موثقة</button></section><section className="portal-card"><h3>مسودة المطابقة التاريخية</h3><p>تضم نسخة المطابقة التاريخية ٢١٦ سجلًا للمراجعة. تُنشر الأسماء والعلاقات في السجل المعتمد بعد صدور قرارات اللجنة.</p>{(central||committee)&&<a href="/review" target="_top" className="portal-button">فتح محرر المشجرة التاريخية <ChevronLeft size={16}/></a>}{!(central||committee)&&<div className="portal-note">المسودة الأصلية محصورة بالمراجعين المخولين.</div>}</section></div></>}

        {tab==="news"&&<div className="portal-columns"><section className="portal-card"><h3>أخبار وإعلانات الأسرة</h3>
          {data.announcements.length?data.announcements.map(n=><div key={rowString(n,"id")} className="portal-item"><div style={{width:"100%"}}><h4>{rowString(n,"title")}</h4><p style={{whiteSpace:"pre-line"}}>{rowString(n,"body")}</p><span className="portal-tag">{n.published?"منشور":"مسودة"} · {n.audience==="public"?"عام":"داخلي"}</span>{manageNews&&<NewsEditor key={rowString(n,"id")} row={n} onSubmit={submit}/>}</div><span className="portal-small">{formatDate(n.createdAt)}</span></div>):<Empty label="لا توجد أخبار مسجلة حتى الآن. يمكن للإدارة إنشاء الخبر ومراجعته قبل نشره."/>}
        </section><div>{manageNews?<GenericForm title="إضافة إعلان" action="announcement.create" onSubmit={submit} fields={[{name:"title",label:"العنوان",required:true},{name:"body",label:"التفاصيل",type:"textarea",required:true},{name:"category",label:"نوع المادة",options:[["news","أخبار"],["events","مناسبات"],["achievements","إنجازات"],["publications","إصدارات"]]},{name:"audience",label:"الجمهور",options:[["family","داخل الأسرة"],["public","مناسب للواجهة العامة"]]},{name:"published",label:"الحالة",options:[["","حفظ كمسودة"],["true","نشر الآن"]]},{name:"confirmPublic",label:"اعتماد المراجعة قبل نشر خبر عام",options:[["","لم تتم المراجعة"],["true","راجعت حقوق النشر وخصوصية الأحياء"]]}]}/>:<section className="portal-card"><h3>قناة الأخبار</h3><p>تُنشر الأخبار بعد مراجعة الجهة المخولة. يمكنك تقديم خبر أو اقتراح عبر الخدمات.</p></section>}</div></div>}

        {tab==="events"&&<div className="portal-columns"><section className="portal-card"><h3>تقويم المناسبات</h3><EventCalendar events={data.events.map(e=>({id:rowString(e,"id"),title:rowString(e,"title"),eventDate:rowString(e,"eventDate"),place:rowString(e,"place")}))}/>{data.events.length?data.events.map(ev=><EventEntry key={rowString(ev,"id")} event={ev} response={rowString(data.rsvps.find(r=>r.eventId===ev.id&&r.userId===data.me.userId)||{},"response")} onSubmit={submit}/>):<Empty label="لا توجد مناسبات مجدولة بعد."/>}</section><div>{manageNews&&<GenericForm title="إضافة مناسبة" action="event.create" onSubmit={submit} fields={[{name:"title",label:"عنوان المناسبة",required:true},{name:"eventDate",label:"تاريخ المناسبة",type:"date",required:true},{name:"place",label:"المكان"},{name:"description",label:"تفاصيل المناسبة",type:"textarea"}]}/>}<section className="portal-card"><h3>المشاركة</h3><p>عند إضافة مناسبة ستظهر للأعضاء، ويمكن لكل عضو تسجيل الحضور أو الاعتذار، وتظهر له استجابته الحالية. تظل البيانات داخل البوابة.</p></section></div></div>}

        {tab==="services"&&<div className="portal-columns"><div><section className="portal-card"><h3>طلباتك ومتابعتها</h3>{data.requests.length?data.requests.map(r=><Item key={rowString(r,"id")} title={rowString(r,"subject")} detail={rowString(r,"body")} meta={formatDate(r.createdAt)} status={rowString(r,"status")}><span className="portal-tag">{kindLabel[rowString(r,"kind")]||rowString(r,"kind")}</span>{r.resolution&&<p>قرار المعالجة: {rowString(r,"resolution")}</p>}{r.kind==="observation"&&r.status==="closed"&&r.userId===data.me.userId&&<p>رقم الملاحظة للمراجعة: <code style={{overflowWrap:"anywhere",userSelect:"all"}}>{rowString(r,"id")}</code></p>}{((role==="social"&&r.kind==="social")||((central || (rep&&rowString(r,"branch")===data.me.branch)) && !["social","procedural"].includes(rowString(r,"kind")))) &&r.status!=="closed"&&<button className="portal-button outline" onClick={()=>{const resolution=prompt("سبب الإغلاق ونتيجة المعالجة:");if(resolution)submit("request.resolve",{id:r.id,resolution}).catch(()=>{});}}>إغلاق مع توضيح السبب</button>}{["secretary","oversight"].includes(role)&&r.kind==="procedural"&&r.status!=="closed"&&r.userId!==data.me.userId&&<button className="portal-button" onClick={()=>{const note=prompt("تقرير المراجعة الإجرائية المستقلة:");if(note)submit("procedural.review",{id:r.id,note}).catch(()=>{});}}>تسجيل المراجعة الإجرائية</button>}</Item>):<Empty label="ليس لديك طلبات أو ملاحظات مسجلة."/ >}</section><div className="portal-note">الملاحظات على النسب ليست طلبات تصحيح رسمية، ولا تتحول إليها تلقائيًا. وتبقى الحالات الاجتماعية سرية.</div></div><GenericForm title="تقديم طلب أو ملاحظة" action="request.create" onSubmit={submit} fields={[{name:"kind",label:"نوع الخدمة",required:true,options:Object.entries(kindLabel).map(([k,v])=>[k,v])},{name:"subject",label:"عنوان مختصر",required:true},{name:"body",label:"تفاصيل الملاحظة أو الطلب",type:"textarea",required:true,placeholder:"أدخل ما يلزم فقط، وتجنب نشر بيانات أشخاص آخرين دون مسوغ."}]}/></div>}

        {tab==="branch"&&<div className="portal-columns"><div><section className="portal-card"><h3>الترشيحات ومتابعة الفرع</h3>{data.nominations.length?data.nominations.map(n=><Item key={rowString(n,"id")} title={rowString(n,"personName")} detail={`الفرع: ${rowString(n,"branch")} · مرجع النسب: ${rowString(n,"personRef")}`} status={rowString(n,"status")} meta={formatDate(n.createdAt)}/>):<Empty label="لا توجد ترشيحات ضمن الصلاحيات الحالية."/ >}</section><section className="portal-card"><h3>ضوابط ممثل الفرع</h3><p>الترشيح لا يثبت النسب. لا يتحول تعليق عضو الأسرة إلى تصحيح رسمي إلا بإجراء مستقل من ممثل الفرع، بعد الاستماع لأهل المعرفة وتوثيق المبررات.</p></section></div><div>{rep&&<><GenericForm title="ترشيح فرد للعضوية" action="nomination.create" onSubmit={submit} fields={[{name:"personName",label:"اسم الفرد",required:true},{name:"personRef",label:"مرجع النسب المعتمد",required:true},{name:"phone",label:"رقم الجوال",required:true,type:"tel"},{name:"email",label:"البريد (استثنائي)"}]}/><GenericForm title="إرسال طلب تصحيح نسب" action="correction.create" onSubmit={submit} fields={[{name:"personRef",label:"معرّف الشخص في المشجرة",required:true},{name:"proposedChange",label:"التغيير المقترح",type:"textarea",required:true},{name:"evidence",label:"الأدلة والمصادر",type:"textarea",required:true},{name:"branchReview",label:"رأي ممثل الفرع وأهل المعرفة",type:"textarea"},{name:"level",label:"مستوى التأثير",options:[["textual","تحرير اسم دون علاقة"],["ordinary","تعديل نسب اعتيادي"],["material","تغيير جوهري في علاقة النسب"]]}]}/></>}{!rep&&<section className="portal-card"><h3>فصل المسؤوليات</h3><p>ممثل الفرع يرشح الأعضاء ويرفع التصحيحات الرسمية. الإدارة المركزية تدير الدعوات. لجنة الأنساب وحدها تصدر قرارات النسب.</p></section>}</div></div>}

        {tab==="committee"&&<div className="portal-columns"><section className="portal-card"><h3>الطلبات الخاضعة للبحث</h3>{data.corrections.length?data.corrections.map(c=><Item key={rowString(c,"id")} title={`المرجع: ${rowString(c,"personRef")}`} detail={rowString(c,"proposedChange")} status={rowString(c,"status")} meta={formatDate(c.createdAt)}><div style={{width:"100%",fontSize:12,color:"#66756a"}}>الأدلة: {rowString(c,"evidence")}</div>{committee&&c.status==="committee_review"&&<div className="portal-task-row"><button className="portal-button" onClick={()=>{const reason=prompt("سبب الموافقة وتقريرك:");if(reason)submit("correction.vote",{id:c.id,vote:"yes",reason}).catch(()=>{});}}>موافقة موثقة</button><button className="portal-button outline" onClick={()=>{const reason=prompt("سبب الرفض وتقريرك:");if(reason)submit("correction.vote",{id:c.id,vote:"no",reason}).catch(()=>{});}}>رفض مسبب</button><button className="portal-button secondary" onClick={()=>{const reason=prompt("سبب التنحي وتعارض المصالح:");if(reason)submit("correction.vote",{id:c.id,vote:"recuse",reason}).catch(()=>{});}}>تنحٍّ عن التصويت</button></div>}{committee&&c.status==="committee_review"&&c.proposerId!==data.me.userId&&c.level==="material"&&!c.independentReviewBy&&<button className="portal-button secondary" onClick={()=>{const note=prompt("تقرير المراجع المستقل:");if(note)submit("correction.independent",{id:c.id,note}).catch(()=>{});}}>رفع مراجعة مستقلة</button>}</Item>):<Empty label="لا توجد طلبات نسب رسمية منظورة."/ >}</section><div><section className="portal-card"><h3>حوكمة الاعتماد</h3><p>خمسة أعضاء متخصصين مستقلين عن التمثيل التلقائي للفروع. القرارات بالتصويت الموثق، مع التنحي عند تضارب المصالح.</p><div className="portal-note">التصحيح النصي: نصاب 3. الاعتيادي: نصاب 4 و3 موافقات. الجوهري: 4 موافقات ومراجعة مستقلة. لا يحرر القرار مشجرة الأصول تلقائيًا.</div></section><section className="portal-card"><h3>حماية المسودات</h3><p>نصوص التصحيحات والمصادر غير المعتمدة محجوبة عن بقية أعضاء الأسرة.</p></section></div></div>}

        {tab==="membership"&&<><InviteActions/><InvitationPanel nominations={data.nominations.map(n=>({id:rowString(n,"id"),personName:rowString(n,"personName"),personRef:rowString(n,"personRef"),branch:rowString(n,"branch"),status:rowString(n,"status"),email:rowString(n,"email")||null}))}/></>}

        {tab==="governance"&&central&&<GovernancePanel/>}
        {tab==="governance"&&<div className="portal-columns"><section className="portal-card"><h3>المبادئ المعتمدة</h3><Item title="سجل النسب مستقل عن العضوية" detail="يتضمن الذرية المثبتة عبر الأبناء والبنات، من دون اعتبار عضوية المجلس شرطًا للنسب."/ ><Item title="النسخ التاريخية غير المعتمدة" detail="المراجعات والمسودات محصورة بالمراجعين، ولا تصبح بيانات أعضاء حتى تصدر لجنة الأنساب قرارها."/ ><Item title="الخصوصية أولًا" detail="لا يُعرض الهاتف أو البريد علنًا، مع قيود خاصة بالقاصرين والحالات الاجتماعية."/ ><Item title="صلاحيات متدرجة" detail="ممثلو الفروع يرفعون الطلبات الرسمية، والإدارة تصدر الدعوات، واللجنة وحدها تعتمد الأنساب."/ ></section><div><section className="portal-card"><h3>الخدمات المالية</h3><p>لا يُفعّل جمع التبرعات أو الصرف أو أي خدمات مالية قبل التحقق من الصفة التنظيمية والتراخيص والضوابط المناسبة.</p></section><section className="portal-card"><h3>سياسة الدخول المستهدفة</h3><p>للأعضاء: خمول 60 دقيقة وحد أقصى 24 ساعة. للإداريين: خمول 15 دقيقة وحد أقصى 8 ساعات، مع إعادة تحقق للعمليات الحساسة.</p><div className="portal-note">تنفيذ هذه السياسة بالكامل يتطلب موفر هوية داعمًا للجلسات والتحقق متعدد العوامل؛ النسخة الحالية تستخدم هوية المنصة.</div></section><Link href="/privacy" className="portal-button secondary">مبادئ حماية البيانات</Link></div></div>}
        {tab==="governance"&&<section className="portal-card"><h3>وثيقة قرارات البوابة</h3><p>يوضح مرجع الحوكمة نطاق ذرية حمد، رحلة العضوية، الفصل بين سجل النسب والحساب، خصوصية الأحياء، وآلية عمل الخدمات وما لم يستكمل بعد.</p><Link href="/framework" className="portal-button secondary">فتح مرجع القرارات المعتمدة</Link></section>}
      </main>
    </div>
  </div>;
}
