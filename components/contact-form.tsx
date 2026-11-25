"use client";
import { useState, useRef } from "react";
import { CheckCircle2, CircleAlert, Send } from "lucide-react";

export default function ContactForm() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reference,setReference]=useState("");
  const [length,setLength]=useState(0);
  const inFlight=useRef(false);const [failed,setFailed]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(inFlight.current)return;inFlight.current=true;setFailed(false);setBusy(true);setMessage("");setReference("");
    const form=event.currentTarget;
    const values=Object.fromEntries(new FormData(form).entries());
    try {
      const response=await fetch("/api/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",...values})});
      const result=await response.json() as {error?:string;message?:string;reference?:string};
      if(!response.ok) throw Error(result.error||"تعذّر استلام الرسالة.");
      setMessage(result.message||"حُفظت الرسالة.");setReference(result.reference||"");form.reset();setLength(0);
    } catch(e) {setFailed(true);setMessage(e instanceof Error?e.message:"تعذّر استلام الرسالة.");}finally{inFlight.current=false;setBusy(false);}
  }
  return <><form className="portal-form public-contact-form" onSubmit={submit} aria-busy={busy}>
    <h2>تواصلك محل عنايتنا</h2><p>نرحب بوثائقك ومقترحاتك ورسائلك. تُحفظ الرسالة وبيانات التواصل لدى الإدارة المركزية فقط. يتطلب الإرسال تسجيل الدخول، بحد أقصى ثلاث رسائل خلال 24 ساعة.</p>
    <label>اسمك<input autoComplete="name" disabled={busy} name="name" maxLength={140} required placeholder="اسم المرسل"/></label>
    <label>رقم الجوال (مطلوب)<input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" disabled={busy} required maxLength={30} placeholder="05XXXXXXXX" aria-describedby="contact-reply-help" name="phone"/></label>
    <label>البريد الإلكتروني للتواصل (اختياري)<input type="email" autoComplete="email" dir="ltr" disabled={busy} maxLength={254} placeholder="name@example.com" name="contactEmail"/></label>
    <p id="contact-reply-help">تُستخدم هذه البيانات لمتابعة رسالتك، ولا تظهر في الموقع العام.</p>
    <label>موضوع الرسالة<select disabled={busy} name="topic" required><option value="history">وثيقة أو رواية تاريخية</option><option value="contact">تواصل مع الإدارة</option><option value="suggestion">ملاحظة على الموقع</option><option value="privacy">استفسار عن الخصوصية والبيانات</option></select></label>
    <label>نص الرسالة<textarea disabled={busy} aria-describedby="message-help" onChange={e=>setLength(e.target.value.length)} name="message" required minLength={12} maxLength={3000} rows={7} placeholder="اكتب تفاصيل الرسالة دون مشاركة معلومات حساسة تخص آخرين…"/></label>
    <div id="message-help" className="contact-field-help"><span>من 12 إلى 3000 حرف</span><span>{length} / 3000</span></div>
    <button type="submit" disabled={busy} className="site-primary-action"><Send size={17}/>{busy?"جارٍ الإرسال…":"إرسال الرسالة"}</button>
    {message&&<p role={failed?"alert":"status"} className={"public-form-feedback "+(failed?"is-error":"is-success")}>{failed?<CircleAlert size={16}/>:<CheckCircle2 size={16}/>} {message}{reference&&` · مرجع المتابعة: ${reference}`}</p>}
  </form></>;
}
