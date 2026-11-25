"use client";
import { useEffect, useState } from "react";
import { BookHeart, EyeOff, ShieldCheck, UserRound } from "lucide-react";

type Profile = {displayName:string;city:string;biography:string;skills:string;volunteering:string;showCity:boolean;showSkills:boolean;showBiography:boolean;showVolunteering:boolean};
type Result = {me:{name:string;role:string;personRef:string|null};profile:Profile|null;directory:{displayName:string;city:string;skills:string;biography:string;volunteering:string}[]};

export default function ProfilePanel() {
  const [data,setData]=useState<Result|null>(null);
  const [form,setForm]=useState<Profile|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [directorySearch,setDirectorySearch]=useState("");
  async function load() {
    const r=await fetch("/api/family-profile",{cache:"no-store"});const result=await r.json() as Result & {error?:string};
    if(!r.ok) throw Error(result.error||"تعذر قراءة الملف");
    setData(result);setForm(result.profile??{displayName:result.me.name,city:"",biography:"",skills:"",volunteering:"",showCity:false,showSkills:false,showBiography:false,showVolunteering:false});
  }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  const update=(key:keyof Profile,value:string|boolean)=>setForm(p=>p?{...p,[key]:value}:p);
  async function save(e:React.FormEvent) {
    e.preventDefault();if(!form)return;setBusy(true);setMessage("");
    try {const r=await fetch("/api/family-profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const result=await r.json() as {error?:string};if(!r.ok)throw Error(result.error||"تعذر الحفظ");setMessage("تم حفظ الملف الشخصي وإعدادات الخصوصية.");await load();}
    catch(error){setMessage(error instanceof Error?error.message:"تعذر الحفظ");}finally{setBusy(false);}
  }
  return <div className="portal-columns"><div>
    <section className="portal-card"><h3><UserRound size={20} style={{display:"inline",marginLeft:8}}/> ملف الفرد العائلي</h3><p>هذا الملف منفصل عن سجلات النسب المعتمدة وعن عضوية المجلس. لا تتغير العلاقات العائلية بتحديث المعلومات الشخصية.</p>
      {data&&<div className="portal-note">مرجع النسب المرتبط بالحساب: {data.me.personRef||"لم يُربط حسابك بسجل نسب معتمد بعد"}</div>}
      {message&&<div className="portal-message" role="status">{message}</div>}
      {form?<form className="portal-form" onSubmit={save}>
        <label>الاسم المعروض داخل ملفي<input value={form.displayName} onChange={e=>update("displayName",e.target.value)} required maxLength={140}/></label>
        <label>المدينة (اختياري)<input value={form.city} onChange={e=>update("city",e.target.value)} maxLength={100}/></label>
        <label>نبذة مختصرة (اختياري)<textarea value={form.biography} onChange={e=>update("biography",e.target.value)} maxLength={1000}/></label>
        <label>الخبرات والمهارات (اختياري)<textarea value={form.skills} onChange={e=>update("skills",e.target.value)} maxLength={600}/></label>
        <label>مجالات التطوع المفضلة (اختياري)<textarea value={form.volunteering} onChange={e=>update("volunteering",e.target.value)} maxLength={600}/></label>
        <div className="portal-note"><ShieldCheck size={17} style={{display:"inline",marginLeft:9}}/> كل بيان اختياري يظهر في دليل العائلة بموافقتك المنفصلة فقط، والاسم يبقى ظاهرًا دائمًا. أرقام التواصل لا تدخل في الدليل.</div>
        <label style={{display:"flex",alignItems:"center",gap:9}}><input type="checkbox" style={{width:18,minHeight:18}} checked={form.showCity} onChange={e=>update("showCity",e.target.checked)}/> السماح بعرض المدينة لأعضاء الأسرة</label>
        <label style={{display:"flex",alignItems:"center",gap:9}}><input type="checkbox" style={{width:18,minHeight:18}} checked={form.showSkills} onChange={e=>update("showSkills",e.target.checked)}/> السماح بعرض خبراتي للأعضاء</label>
        <label style={{display:"flex",alignItems:"center",gap:9}}><input type="checkbox" style={{width:18,minHeight:18}} checked={form.showBiography} onChange={e=>update("showBiography",e.target.checked)}/> السماح بعرض نبذتي للأعضاء</label>
        <label style={{display:"flex",alignItems:"center",gap:9}}><input type="checkbox" style={{width:18,minHeight:18}} checked={form.showVolunteering} onChange={e=>update("showVolunteering",e.target.checked)}/> السماح بعرض مجالات تطوعي للأعضاء</label>
        <div><button className="portal-button" type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ الملف والخصوصية"}</button></div>
      </form>:message?<button className="portal-button" onClick={()=>{setMessage("");void load().catch(e=>setMessage(e.message));}}>إعادة تحميل الملف</button>:<p>جارٍ تحميل ملف الفرد...</p>}
    </section>
  </div><div>
    <section className="portal-card"><h3><BookHeart size={20} style={{display:"inline",marginLeft:8}}/> دليل الخبرات العائلية</h3><p>يظهر هنا الأعضاء البالغون الذين اختاروا مشاركة المدينة أو المهارات أو النبذة أو مجالات التطوع. لا تُعرض أرقام الجوال أو البريد.</p>
      <label className="portal-form">البحث بالاسم أو المهارة أو المدينة<input value={directorySearch} onChange={e=>setDirectorySearch(e.target.value)} /></label>
      {data?.directory.length?data.directory.filter(p=>(p.displayName+" "+p.city+" "+p.skills+" "+p.biography+" "+p.volunteering).includes(directorySearch)).map((p,i)=><div className="portal-item" key={p.displayName+i}><div><h4>{p.displayName}</h4>{p.city&&<p>المدينة: {p.city}</p>}{p.skills&&<p>المهارات: {p.skills}</p>}{p.biography&&<p>نبذة: {p.biography}</p>}{p.volunteering&&<p>التطوع: {p.volunteering}</p>}</div></div>):<div className="portal-empty"><EyeOff size={24} style={{margin:"0 auto 12px"}}/> لم يفعّل أي عضو مشاركة بياناته الاختيارية بعد.</div>}
    </section>
  </div></div>;
}
