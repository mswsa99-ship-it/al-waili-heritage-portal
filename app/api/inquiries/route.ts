import {query,sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/app/session-auth";
import { getDb } from "@/db";
import { auditLog, publicInquiries } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor || actor.role !== "central") return fail("رسائل التواصل للإدارة المركزية فقط.", 403);
  const records = await getDb().select().from(publicInquiries).orderBy(desc(publicInquiries.createdAt)).limit(200);
  return NextResponse.json({ inquiries: records }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("مصدر غير موثوق.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير صحيحة.", 415);
  const raw = await req.text();
  if (raw.length > 6000) return fail("الرسالة طويلة جدًا.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail("بيانات غير صالحة."); }
  if (!body || typeof body!=="object" || Array.isArray(body)) return fail("بيانات غير صالحة.");
  const db = getDb(), time = new Date().toISOString();
  if (body.action === "submit") {
    const user = await getSessionUser();
    if (!user) return fail("سجّل الدخول أولًا لإرسال رسالة آمنة.", 401);
    const name = text(body.name, 140) || user.displayName, email = user.email;
    const phone = text(body.phone, 30), contactEmail = text(body.contactEmail, 254);
    const topic = text(body.topic, 50), message = text(body.message, 3000);
    if (!name || !phone || !["history", "contact", "suggestion", "privacy"].includes(topic) || message.length < 12)
      return fail("اكتب اسمك ورقم جوالك، واختر موضوعًا واكتب رسالة لا تقل عن 12 حرفًا.");
    if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) return fail("صيغة البريد الإلكتروني غير صحيحة.");
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const id = crypto.randomUUID();
    const saved=await query('INSERT INTO public_inquiries(id,user_id,name,email,phone,contact_email,topic,message,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM public_inquiries WHERE user_id=? AND created_at>=?)<3',id,user.userId,name,email,phone,contactEmail,topic,message,time,time,user.userId,since).run();
    if(!saved.meta.changes)return fail("وصلت إلى حد ثلاث رسائل خلال 24 ساعة. يُرجى المحاولة لاحقًا.",429);
    return NextResponse.json({ ok: true, reference: id.slice(0, 8), message: "استلمت البوابة رسالتك وحُفظت لدى الإدارة." });
  }
  if (body.action === "resolve") {
    const actor = await getFamilyActor();
    if (!actor || actor.role !== "central") return fail("معالجة الرسائل للإدارة المركزية فقط.", 403);
    const id = text(body.id, 80), responseNote = text(body.responseNote, 2000);
    const status = text(body.status, 20);
    if (!["in_review", "closed"].includes(status) || responseNote.length < 8) return fail("حدد الحالة وملخص الإجراء.");
    const found = (await db.select({ id: publicInquiries.id }).from(publicInquiries).where(eq(publicInquiries.id, id)).limit(1))[0];
    if (!found) return fail("الرسالة غير موجودة.", 404);
    await db.batch([
      db.update(publicInquiries).set({ status, responseNote, updatedAt: time }).where(eq(publicInquiries.id, id)),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "inquiry." + status, subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true });
  }
  return fail("إجراء غير معروف.", 404);
}
