'use client';
import {useState} from 'react';
export default function ResetForm({token}:{token:string}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ok,setOk]=useState(false);
  if(!token)return <p>الرابط غير مكتمل؛ اطلب رابط استعادة جديدًا من <a href="/forgot">هنا</a>.</p>;
  if(ok)return <p role="status">{message} <a href="/login">تسجيل الدخول</a></p>;
  return <form className="portal-form" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');
    try{
      const f=new FormData(e.currentTarget);
      const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:f.get('password')})});
      const j=await r.json() as {message?:string;error?:string};
      if(r.ok){setOk(true);setMessage(j.message||'عُيّنت كلمة المرور الجديدة.');}
      else setMessage(j.error||'تعذر تعيين كلمة المرور');
    }finally{setBusy(false)}
  }}>
    <label>كلمة المرور الجديدة<input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr"/></label>
    <button disabled={busy}>تعيين كلمة المرور</button>
    <p role="status">{message}</p>
  </form>;
}
