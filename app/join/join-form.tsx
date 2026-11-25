'use client';

import { FormEvent, useEffect, useState } from 'react';

type Person = { name: string; gender: string; birthYear: string; deathYear: string; education: string; city: string; profession: string; phone: string; email: string; position: string };

const genderLabels: Record<string, string> = { male: 'ذكر', female: 'أنثى', unknown: 'غير محدد' };

export default function JoinForm() {
  // Token travels in the URL fragment, never the query string, so it stays
  // out of request URLs, server logs and referrers.
  const [token, setToken] = useState('');
  useEffect(() => { setToken((window.location.hash || '').replace(/^#/, '').slice(0, 200)); }, []);
  const [mode, setMode] = useState<'redeem' | 'complete' | 'done'>('redeem');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [person, setPerson] = useState<Person | null>(null);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/tree-add', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json() as { person?: Person; reviewStatus?: string };
    if (j.person) { setPerson(j.person); setMode(j.reviewStatus === 'قيد الاعتماد' ? 'complete' : 'done'); }
  }
  useEffect(() => { void load(); }, []);

  async function redeem(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(''); setOk(false);
    try {
      const r = await fetch('/api/tree-add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', token, password, email: email || undefined }),
      });
      const j = await r.json() as { message?: string; error?: string };
      setOk(r.ok); setMessage(r.ok ? (j.message || '') : (j.error || 'تعذر تفعيل الدعوة'));
      if (r.ok) await load();
    } finally { setBusy(false); }
  }

  async function complete(e: FormEvent) {
    e.preventDefault(); if (!person) return;
    setBusy(true); setMessage(''); setOk(false);
    try {
      const r = await fetch('/api/tree-add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', ...person }),
      });
      const j = await r.json() as { message?: string; error?: string };
      setOk(r.ok); setMessage(r.ok ? (j.message || '') : (j.error || 'تعذر حفظ البيانات'));
      if (r.ok) setMode('done');
    } finally { setBusy(false); }
  }

  if (mode === 'done') {
    return (
      <div>
        <h2>اكتمل استكمال بياناتك</h2>
        <p role="status">{message || 'تظهر إضافتك في الشجرة بحالة «قيد الاعتماد» حتى تعتمدها لجنة الأنساب.'}</p>
        <a target="_top" className="site-primary-action" href="/member/dashboard">الانتقال إلى بوابة الأسرة</a>
      </div>
    );
  }

  if (mode === 'complete' && person) {
    return (
      <form className="portal-form" onSubmit={complete}>
        <h2>بياناتك في الشجرة</h2>
        <label>الاسم (إلزامي)<input value={person.name} required maxLength={180} onChange={e => setPerson({ ...person, name: e.target.value })} /></label>
        <label>الجنس
          <select value={person.gender} onChange={e => setPerson({ ...person, gender: e.target.value })}>
            {Object.entries(genderLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>سنة الميلاد (اختياري)<input value={person.birthYear} maxLength={8} placeholder="مثال 1400 أو 1980" onChange={e => setPerson({ ...person, birthYear: e.target.value })} /></label>
        <label>سنة الوفاة (اختياري)<input value={person.deathYear} maxLength={8} onChange={e => setPerson({ ...person, deathYear: e.target.value })} /></label>
        <label>المؤهل (اختياري)<input value={person.education} maxLength={250} onChange={e => setPerson({ ...person, education: e.target.value })} /></label>
        <label>المدينة (اختياري)<input value={person.city} maxLength={120} onChange={e => setPerson({ ...person, city: e.target.value })} /></label>
        <label>المهنة (اختياري)<input value={person.profession} maxLength={160} onChange={e => setPerson({ ...person, profession: e.target.value })} /></label>
        <label>المنصب (اختياري)<input value={person.position} maxLength={180} onChange={e => setPerson({ ...person, position: e.target.value })} /></label>
        <label>الجوال (اختياري)<input value={person.phone} maxLength={28} dir="ltr" onChange={e => setPerson({ ...person, phone: e.target.value })} /></label>
        <label>البريد الإلكتروني (اختياري)<input value={person.email} type="email" maxLength={160} dir="ltr" onChange={e => setPerson({ ...person, email: e.target.value })} /></label>
        <button disabled={busy || !person.name.trim()}>{busy ? 'جارٍ الحفظ…' : 'حفظ البيانات'}</button>
        <p role="status">{message}</p>
      </form>
    );
  }

  return (
    <form className="portal-form" onSubmit={redeem}>
      <h2>تفعيل الدعوة</h2>
      {!token ? <p>افتح رابط الدعوة الذي وصلك حتى يظهر الرمز تلقائيًا.</p> : null}
      <label>رمز الدعوة<input value={token} readOnly autoComplete="off" dir="ltr" /></label>
      <label>كلمة مرور جديدة لحسابك (٨ أحرف فأكثر)<input type="password" value={password} required minLength={8} autoComplete="new-password" dir="ltr" onChange={e => setPassword(e.target.value)} /></label>
      <label>بريدك الإلكتروني (مطلوب فقط إذا لم تتضمن الدعوة بريدًا)<input type="email" value={email} dir="ltr" placeholder="اختياري" onChange={e => setEmail(e.target.value)} /></label>
      <button disabled={busy || !token || !password}>{busy ? 'جارٍ التفعيل…' : 'تفعيل الدعوة'}</button>
      <p role="status">{message}</p>
    </form>
  );
}
