'use client';
import {useState} from 'react';
export default function ForgotForm(){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <form className="portal-form" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');
    try{
      const f=new FormData(e.currentTarget);
      const r=await fetch('/api/auth/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.get('email')})});
      const j=await r.json() as {message?:string;error?:string};
      setMessage(r.ok?(j.message||''):(j.error||'تعذر إرسال الطلب'));
    }finally{setBusy(false)}
  }}>
    <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="username" dir="ltr"/></label>
    <button disabled={busy}>إرسال رابط الاستعادة</button>
    <p role="status">{message}</p>
  </form>;
}
