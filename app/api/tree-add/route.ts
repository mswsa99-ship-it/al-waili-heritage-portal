import { NextRequest, NextResponse } from 'next/server';
import { query, sameOrigin, sha256, siteDb } from '@/lib/site-db';
import { getSessionUser, SESSION_COOKIE, SESSION_DAYS } from '@/app/session-auth';
import { hashPassword, passwordPolicyError } from '@/lib/password';

// Tree-add invitation flow: a person added from
// the tree by a branch delegate redeems a privately delivered token, sets a
// password, and completes their own data. Only the name is mandatory; every
// other field stays optional. The record keeps «قيد الاعتماد» status until
// the lineage committee approves it. Nothing here sends email or messages.
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const clamp = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const now = () => new Date().toISOString();

type Invite = { id: string; person_id: string; email: string; status: string; expires_at: string };
type PersonRow = { id: string; parent_id: string | null; name: string; gender: string; birth_year: string; death_year: string; education: string; city: string; profession: string; phone: string; email: string; position: string; review_status: string; active: number };

async function inviteForEmail(email: string): Promise<(Invite & { person: PersonRow | null }) | null> {
  const invite = await query(
    "SELECT id,person_id,email,status,expires_at FROM member_data_invites WHERE email=? AND status IN ('redeemed','completed') ORDER BY redeemed_at DESC LIMIT 1",
    email,
  ).first<Invite>();
  if (!invite) return null;
  const person = await query('SELECT * FROM working_tree_people WHERE id=?', invite.person_id).first<PersonRow>();
  return { ...invite, person: person ?? null };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return reply({ error: 'الدخول مطلوب' }, 401);
  const found = await inviteForEmail(user.email.toLowerCase());
  if (!found?.person || !found.person.active) return reply({ error: 'لا توجد بيانات قيد الاستكمال مرتبطة بهذا الحساب' }, 404);
  const p = found.person;
  return reply({
    status: found.status,
    reviewStatus: p.review_status,
    person: {
      name: p.name, gender: p.gender, birthYear: p.birth_year, deathYear: p.death_year,
      education: p.education, city: p.city, profession: p.profession, phone: p.phone,
      email: p.email, position: p.position,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: 'مصدر غير مصرح' }, 403);
  const raw = await req.text();
  if (raw.length > 12000) return reply({ error: 'طلب طويل' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return reply({ error: 'بيانات غير صالحة' }, 400); }
  const action = clamp(b.action, 20);

  if (action === 'redeem') {
    const token = clamp(b.token, 200);
    if (!token) return reply({ error: 'رمز الدعوة مطلوب' }, 400);
    const invite = await query(
      "SELECT id,person_id,email,status,expires_at FROM member_data_invites WHERE token_hash=?",
      await sha256(token),
    ).first<Invite>();
    const time = now();
    if (!invite || invite.status !== 'issued' || invite.expires_at < time) {
      return reply({ error: 'الدعوة غير صالحة أو انتهت' }, 403);
    }
    let email = invite.email;
    if (!email) {
      email = clamp(b.email, 160).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ error: 'أدخل بريدًا صحيحًا لربط حسابك' }, 400);
    }
    const target = await query('SELECT id FROM working_tree_people WHERE id=? AND active=1', invite.person_id).first<{ id: string }>();
    if (!target) return reply({ error: 'هذا السجل لم يعد متاحًا؛ راجع مفوض الفرع' }, 409);
    const existing = await query('SELECT email FROM auth_accounts WHERE email=?', email).first<{ email: string }>();
    if (existing) {
      // Never reset an existing account's password or mint a session for it on
      // token possession alone. The invitee must already be authenticated as
      // that exact account; redeem then only links the invite to it.
      const user = await getSessionUser();
      if (!user || user.email.toLowerCase() !== email) {
        return reply({ error: 'هذا البريد له حساب قائم. سجّل الدخول بحسابك أولًا ثم افتح رابط الدعوة مرة أخرى؛ لن تتغير كلمة مرورك.' }, 409);
      }
      const claim = await query("UPDATE member_data_invites SET status='redeemed',email=?,redeemed_at=? WHERE id=? AND status='issued'", email, time, invite.id).run();
      if (!claim.meta.changes) return reply({ error: 'الدعوة غير صالحة أو انتهت' }, 403);
      await query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), email, 'tree_add.invite.redeemed', invite.person_id, time).run();
      return reply({ ok: true, message: 'رُبطت الدعوة بحسابك الحالي. أكمل بياناتك الآن؛ الاسم فقط إلزامي.' });
    }
    const pwErr = passwordPolicyError(b.password);
    if (pwErr) return reply({ error: pwErr }, 400);
    const passwordHash = await hashPassword(String(b.password));
    const sessionToken = crypto.randomUUID() + crypto.randomUUID();
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    // Atomic single-use claim first: exactly one concurrent request can flip
    // issued → redeemed. Only the winner creates the account and session.
    const claim = await query("UPDATE member_data_invites SET status='redeemed',email=?,redeemed_at=? WHERE id=? AND status='issued'", email, time, invite.id).run();
    if (!claim.meta.changes) return reply({ error: 'الدعوة غير صالحة أو انتهت' }, 403);
    try {
      await siteDb().batch([
        query("INSERT INTO auth_accounts(email,password_hash,created_at,updated_at,provenance) VALUES(?,?,?,?,'tree_add_unverified')", email, passwordHash, time, time),
        query('INSERT INTO auth_sessions(id,email,created_at,expires_at) VALUES(?,?,?,?)', await sha256(sessionToken), email, time, expires),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), email, 'tree_add.invite.redeemed', invite.person_id, time),
      ]);
    } catch (e) {
      // Roll back the claim to its exact prior state, including the original
      // invite email (which may have been empty). Conditioned on the exact
      // claimed state so it can never clobber a different successful claim.
      await query("UPDATE member_data_invites SET status='issued',email=?,redeemed_at=NULL WHERE id=? AND status='redeemed' AND email=? AND redeemed_at=?", invite.email, invite.id, email, time).run();
      throw e;
    }
    const res = reply({ ok: true, message: 'فُعّل حسابك. أكمل بياناتك الآن؛ الاسم فقط إلزامي.' });
    res.cookies.set(SESSION_COOKIE, sessionToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: new Date(expires) });
    return res;
  }

  if (action === 'complete') {
    const user = await getSessionUser();
    if (!user) return reply({ error: 'الدخول مطلوب' }, 401);
    const found = await inviteForEmail(user.email.toLowerCase());
    if (!found?.person || !found.person.active) return reply({ error: 'لا توجد بيانات قيد الاستكمال مرتبطة بهذا الحساب' }, 404);
    if (found.person.review_status !== 'قيد الاعتماد') return reply({ error: 'اعتُمد هذا السجل بالفعل؛ تُحدَّث بياناته من مساحة العائلة' }, 409);
    const name = clamp(b.name, 180);
    if (!name) return reply({ error: 'الاسم إلزامي' }, 400);
    const genderRaw = clamp(b.gender, 10);
    const gender = ['male', 'female', 'unknown'].includes(genderRaw) ? genderRaw : found.person.gender;
    const year = (v: unknown) => { const t = clamp(v, 8); return /^\d{4}$/.test(t) ? t : ''; };
    const time = now();
    await siteDb().batch([
      query(
        "UPDATE working_tree_people SET name=?,gender=?,birth_year=?,death_year=?,education=?,city=?,profession=?,phone=?,email=?,position=?,revision=revision+1,updated_at=? WHERE id=? AND review_status='قيد الاعتماد' AND active=1",
        name, gender, year(b.birthYear), year(b.deathYear), clamp(b.education, 250), clamp(b.city, 120),
        clamp(b.profession, 160), clamp(b.phone, 28), clamp(b.email, 160), clamp(b.position, 180), time, found.person.id,
      ),
      query("UPDATE member_data_invites SET status='completed',completed_at=? WHERE id=?", time, found.id),
      query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), user.email.toLowerCase(), 'tree_add.data.completed', found.person.id, time),
    ]);
    return reply({ ok: true, message: 'حُفظت بياناتك. يبقى ظهورك في الشجرة بحالة «قيد الاعتماد» حتى اعتماد اللجنة.' });
  }

  return reply({ error: 'إجراء غير معروف' }, 400);
}
