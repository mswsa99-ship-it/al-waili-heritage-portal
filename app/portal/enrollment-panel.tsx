"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Fingerprint, LockKeyhole, Search, UserRoundPlus } from "lucide-react";

type ApprovedPerson = { personId: string; name: string; branch: string; accountStatus: string | null };
type Enrollment = { id: string; personId: string; channel: string; status: string; preparedAt: string };
type Data = { approvedPeople: ApprovedPerson[]; enrollmentQueue: Enrollment[]; error?: string };

export default function EnrollmentPanel() {
  const [data, setData] = useState<Data | null>(null), [search, setSearch] = useState(""), [personId, setPersonId] = useState("");
  const [channel, setChannel] = useState("email"), [phone, setPhone] = useState(""), [email, setEmail] = useState("");
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/family-enrollment", { cache: "no-store" });
    const json = await response.json() as Data;
    if (!response.ok) throw Error(json.error || "تعذر تحميل السجل المعتمد.");
    setData(json);
  }, []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  const eligible = useMemo(() => (data?.approvedPeople || []).filter(p => !p.accountStatus && (p.name + " " + p.branch).includes(search.trim())), [data, search]);
  const selected = eligible.find(p => p.personId === personId);
  async function prepare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/family-enrollment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepare", personId, channel, phone, email, note }) });
      const json = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw Error(json.error || "تعذر تجهيز العضوية.");
      setNotice(json.message || "حُفظ ملف الإعداد."); setPersonId(""); setPhone(""); setEmail(""); setNote("");
      await load();window.dispatchEvent(new Event("membership-changed"));
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر الإجراء."); }
    finally { setBusy(false); }
  }
  return <section className="portal-card">
    <h3><Fingerprint size={20} style={{display:"inline",marginLeft:8}}/> اختيار عضو من المشجرة المعتمدة</h3>
    <p>مسار مباشر لمسؤول البوابة: يختار فردًا من سجل النسب المعتمد بدل كتابة اسم حرّ. لا يظهر هنا شخص قاصر أو متوفى، ولا يسمح النظام بحساب مكرر.</p>
    {notice && <div className="portal-message" role="status">{notice}</div>}{error && <div className="portal-message error" role="alert">{error}</div>}
    <div className="portal-note"><LockKeyhole size={17} style={{display:"inline",marginLeft:7}}/> هذا الإجراء <strong>يجهز ملف عضوية فقط</strong>؛ بعد الإعداد، انتقل إلى «العضويات والدعوات» لإصدار رمز مرتبط بالبريد وتسليمه بصورة خاصة.</div>
    <form className="portal-form" onSubmit={prepare}>
      <label><Search size={16} style={{display:"inline",marginLeft:7}}/> البحث داخل الأشخاص المعتمدين<input value={search} onChange={e => {setSearch(e.target.value);setPersonId("");}} placeholder="الاسم أو الفرع"/></label>
      <label>الفرد المختار من سجل النسب<select required value={personId} onChange={e => setPersonId(e.target.value)}><option value="">{!data ? "جارٍ تحميل السجل..." : eligible.length ? "اختر شخصًا" : "لا يوجد فرد متاح للإعداد"}</option>{eligible.map(p => <option key={p.personId} value={p.personId}>{p.name} {p.branch ? `— ${p.branch}` : ""}</option>)}</select></label>
      {selected && <div className="portal-note">الاسم من المصدر المعتمد: <strong>{selected.name}</strong> — لا يمكن تغييره من شاشة الدعوة.</div>}
      <label>وسيلة ربط الدعوة<select value={channel} onChange={e => setChannel(e.target.value)}><option value="email">البريد الإلكتروني</option></select></label>
      {channel === "sms" ? <label>رقم الجوال الخاص بالمدعو<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="05xxxxxxxx أو +966..."/></label> : <label>البريد المعتمد<input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label>}
      <label>ملاحظات إدارية لا تظهر للمستفيد<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500}/></label>
      <button className="portal-button" disabled={busy || !personId}><UserRoundPlus size={16}/>{busy ? "جارٍ الحفظ..." : "إعداد عضوية مرتبطة بالمشجرة"}</button>
    </form>
    <div className="portal-section-heading" style={{marginTop:27}}><h3>الطلبات المحضّرة</h3></div>
    {data?.enrollmentQueue.length ? data.enrollmentQueue.map(x => <div className="portal-item" key={x.id}><div><strong>{data.approvedPeople.find(p => p.personId === x.personId)?.name || "سجل معتمد"}</strong><p>{x.channel === "sms" ? "قناة الجوال" : "قناة البريد"} · ملف مجهز — تابع إصدار الرمز في العضويات والدعوات</p></div><span className="portal-small">{new Date(x.preparedAt).toLocaleDateString("ar-SA")}</span></div>) : <div className="portal-empty">لا توجد ملفات معدّة من المشجرة بعد.</div>}
  </section>;
}
