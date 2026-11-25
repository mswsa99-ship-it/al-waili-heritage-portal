'use client';
import {useState} from 'react';
export default function LoginForm({returnTo}:{returnTo:string}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <form className="portal-form" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');
    try{
      const f=new FormData(e.currentTarget);
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:f.get('email'),password:f.get('password')})});
      const j=await r.json() as {error?:string};
      if(r.ok){window.location.href=returnTo||'/member/dashboard';return;}
      setMessage(j.error||'تعذر تسجيل الدخول');
    }finally{setBusy(false)}
  }}>
    <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="username" dir="ltr"/></label>
    <label>كلمة المرور<input name="password" type="password" required autoComplete="current-password" dir="ltr"/></label>
    <button disabled={busy}>دخول</button>
    <p role="status">{message}</p>
    <a href="/forgot">نسيت كلمة المرور؟</a>
  </form>;
}
