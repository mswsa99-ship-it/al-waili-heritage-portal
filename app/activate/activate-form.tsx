'use client';
import {useState} from 'react';
export default function ActivateForm(){const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ok,setOk]=useState(false);
  if(ok)return <p role="status">{message} <a href="/login">تسجيل الدخول</a></p>;
  return <form className="portal-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const f=new FormData(e.currentTarget);const r=await fetch('/api/member-invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'redeem',token:f.get('token')})});const j=await r.json() as {message:string;error:string};if(r.ok){setOk(true);setMessage(j.message);}else setMessage(j.error);}finally{setBusy(false)}}}>
    <label>رمز الدعوة<input name="token" required autoComplete="off"/></label>
    <button disabled={busy}>تفعيل العضوية</button>
    <p role="status">{message}</p>
  </form>}
