'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function AcceptForm() {
  // Token travels in the URL fragment, never the query string, so it stays
  // out of request URLs, server logs and referrers.
  const [token, setToken] = useState('');
  useEffect(() => { setToken((window.location.hash || '').replace(/^#/, '').slice(0, 200)); if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search); }, []);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function redeem(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(''); setOk(false);
    try {
      const r = await fetch('/api/member-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem_new', token, password }),
      });
      const j = await r.json() as { message?: string; error?: string };
      setOk(r.ok); setMessage(r.ok ? (j.message || '') : (j.error || 'تعذر تفعيل الدعوة'));
    } finally { setBusy(false); }
  }

  if (ok) {
    return (
      <div>
        <h2>تم تفعيل حسابك</h2>
        <p role="status">{message}</p>
        <p><a className="portal-button" href="/portal">دخول مساحة الأسرة</a></p>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={redeem}>
      <h2>تفعيل الدعوة</h2>
      <p>افتح رابط الدعوة الذي وصلك حتى يظهر الرمز تلقائيًا.</p>
      <label>رمز الدعوة
        <input value={token} onChange={e => setToken(e.target.value)} required maxLength={200} dir="ltr" autoComplete="off" />
      </label>
      <label>كلمة مرور جديدة لحسابك (8 أحرف فأكثر)
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} dir="ltr" autoComplete="new-password" />
      </label>
      <button className="portal-button" disabled={busy || !token}>{busy ? 'جارٍ التفعيل…' : 'تفعيل الدعوة'}</button>
      {message ? <p role="alert">{message}</p> : null}
      <p className="portal-note">إن كان لبريدك حساب قائم، سجّل الدخول أولًا ثم افتح رابط الدعوة من صفحة التفعيل؛ لن تتغير كلمة مرورك.</p>
    </form>
  );
}
