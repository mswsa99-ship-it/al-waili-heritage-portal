import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, directEnrollments, genealogyRecords, members } from "@/db/schema";
import { getFamilyActor, isCentral } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const deny = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const safe = (value: unknown, n: number) => typeof value === "string" ? value.trim().slice(0, n) : "";

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor || !isCentral(actor)) return deny("ملفات إعداد العضوية للإدارة المركزية فقط.", 403);
  const db = getDb();
  const [people, membersList, queue] = await Promise.all([
    db.select().from(genealogyRecords).limit(3000),
    db.select().from(members).limit(3000),
    db.select().from(directEnrollments).orderBy(desc(directEnrollments.preparedAt)).limit(200),
  ]);
  const memberByPerson = new Map(membersList.map(m => [m.personRef, m]));
  return NextResponse.json({
    approvedPeople: people.filter(p => p.active && p.living && !p.minor).map(p => ({
      personId: p.personId, name: p.name, branch: p.branch,
      accountStatus: memberByPerson.get(p.personId)?.status || null,
    })),
    enrollmentQueue: queue.map(item => ({ ...item, note: item.note.slice(0, 200) })),
    policy: { requiresApprovedGenealogy: true, minorsExcluded: true, deceasedExcluded: true, invitationsSent: false, accountsActivated: false },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor || !isCentral(actor)) return deny("إعداد العضوية للإدارة المركزية فقط.", 403);
  if (!sameOrigin(req)) return deny("مصدر غير مخول.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return deny("صيغة الطلب غير صحيحة.", 415);
  const raw = await req.text();
  if (raw.length > 3000) return deny("حجم الطلب غير مقبول.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return deny("تعذرت قراءة الطلب."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return deny("يجب إرسال كائن بيانات صالح.", 400);
  if (body.action !== "prepare") return deny("هذا الإجراء غير متاح.", 404);
  const personId = safe(body.personId, 100), phone = safe(body.phone, 32), email = safe(body.email, 160), note = safe(body.note, 500);
  const channel = body.channel === "email" ? "email" : "sms";
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return deny("أدخل بريدًا صالحًا لمسار البريد.");
  if (channel === "sms" && !/^\+?[\d\s-]{9,20}$/.test(phone)) return deny("أدخل رقم جوال صالحًا لمسار الرسائل.");
  const db = getDb();
  const person = (await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId, personId)).limit(1))[0];
  if (!person?.active || !person.living || person.minor) return deny("لا تُعد العضوية إلا لشخص بالغ حي مثبت في سجل النسب بقرار معتمد.", 409);
  const existing = await db.select({ id: members.id }).from(members).where(eq(members.personRef, personId)).limit(1);
  if (existing.length) return deny("يوجد ملف عضوية سابق لهذا الشخص؛ لا يمكن إنشاء حسابين من السجل نفسه.", 409);
  const memberId = crypto.randomUUID(), id = crypto.randomUUID(), time = new Date().toISOString();
  try {
    await db.batch([
      db.insert(members).values({ id: memberId, name: person.name, branch: person.branch, personRef: person.personId, phone: phone || null, email: email || null, role: "member", status: "awaiting_invitation", minor: false, createdAt: time }),
      db.insert(directEnrollments).values({ id, memberId, personId: person.personId, channel, note, preparedBy: actor.userId, preparedAt: time }),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "membership.direct_prepared", subjectId: id, createdAt: time }),
    ]);
  } catch { return deny("تعذر الإعداد، وربما سبق تجهيز هذا الشخص بالفعل.", 409); }
  return NextResponse.json({ ok: true, id, status: "awaiting_provider", message: "تم إعداد ملف العضوية دون إرسال دعوة أو تفعيل حساب. يرتبط حصريًا بالشخص المعتمد المحدد." }, { headers: { "Cache-Control": "no-store" } });
}
