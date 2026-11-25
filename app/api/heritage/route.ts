import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, heritageItems } from "@/db/schema";
import { query } from "@/lib/site-db";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const kinds = new Set(["document", "photo", "oral", "biography", "history"]);
const validVisibility = new Set(["pending", "members", "public", "rejected"]);
const editor = (role: string) => role === "central" || role === "council";
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const deny = (error: string, status = 400) => NextResponse.json({ error }, { status });
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") || "public";
  const db = getDb();
  const records = await db.select().from(heritageItems).orderBy(desc(heritageItems.createdAt)).limit(250);
  if (scope === "public") {
    return NextResponse.json({ items: records.filter(r => r.visibility === "public").map(r => ({
      id: r.id, title: r.title, kind: r.kind, summary: r.summary, source: r.source,
      sourceAuthor:r.sourceAuthor,sourceDate:r.sourceDate,sourcePage:r.sourcePage,evidenceStatus:r.evidenceStatus,imageUrl:r.attachmentId?"/api/heritage-image?id="+encodeURIComponent(r.id):null,
      period: r.period, reviewedAt: r.reviewedAt, createdAt: r.createdAt,
    })) }, { headers: noStore });
  }
  const actor = await getFamilyActor();
  if (!actor) return deny("هذا الأرشيف متاح للأعضاء المخولين فقط.", 403);
  if (scope === "manage" && !editor(actor.role)) return deny("إدارة النشر للمحررين المخولين فقط.", 403);
  const visible = scope === "manage" ? records : records.filter(r =>
    editor(actor.role) || r.contributorId === actor.userId || ["public", "members"].includes(r.visibility));
  const safeRecords = visible.map(r => editor(actor.role) || r.contributorId === actor.userId ? r : {
    id: r.id, title: r.title, kind: r.kind, summary: r.summary, source: r.source,
    sourceAuthor:r.sourceAuthor,sourceDate:r.sourceDate,sourcePage:r.sourcePage,evidenceStatus:r.evidenceStatus,
    period: r.period, visibility: r.visibility, createdAt: r.createdAt,
  });
  return NextResponse.json({ items: safeRecords, canPublish: editor(actor.role) }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor) return deny("التقديم يتطلب حسابًا عائليًا مفعّلًا.", 403);
  if (!sameOrigin(req)) return deny("مصدر الطلب غير موثوق.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return deny("صيغة غير صحيحة.", 415);
  const raw = await req.text();
  if (raw.length > 17000) return deny("المحتوى أطول من المسموح.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return deny("تعذّرت قراءة المحتوى."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return deny("يجب إرسال كائن بيانات صالح.", 400);
  const db = getDb(), time = new Date().toISOString();
  if (body.action === "create") {
    const title = clean(body.title, 180), summary = clean(body.summary, 6000);
    const source = clean(body.source, 900), period = clean(body.period, 120), kind = clean(body.kind, 30);
    if (!kinds.has(kind) || title.length < 4 || summary.length < 25 || source.length < 6)
      return deny("أكمل العنوان والنص ووصف المصدر قبل تقديم المادة.");
    const sourceAuthor=clean(body.sourceAuthor,160),sourceDate=clean(body.sourceDate,100),sourcePage=clean(body.sourcePage,100),evidenceStatus=clean(body.evidenceStatus,30)||"pending",attachmentId=clean(body.attachmentId,80)||null;
    if(!["historical","family","pending"].includes(evidenceStatus))return deny("حالة الإثبات غير صالحة");
    if(attachmentId&&!await query("SELECT id FROM private_attachments WHERE id=? AND owner_id=? AND mime IN ('image/png','image/jpeg')",attachmentId,actor.userId).first())return deny("اختر صورة وثيقة أودعتها بحسابك",403);
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(heritageItems).values({ id, title, summary, source, sourceAuthor,sourceDate,sourcePage,evidenceStatus,attachmentId,period, kind, contributorId: actor.userId, visibility: "pending", createdAt: time, updatedAt: time }),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "heritage.submitted", subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true, id, message: "حُفظت المادة ضمن المراجعة الخاصة، ولم تُنشر." });
  }
  if (body.action === "review") {
    if (!editor(actor.role)) return deny("اعتماد النشر للمحررين المخولين فقط.", 403);
    const id = clean(body.id, 80), visibility = clean(body.visibility, 20), note = clean(body.reviewNote, 1200);
    if (!validVisibility.has(visibility) || note.length < 8) return deny("حدد قرار النشر واكتب ملاحظته المسببة.");
    if ((visibility === "public" || visibility === "members") && body.confirmPublication !== true)
      return deny("يجب تأكيد مراجعة المصدر وحقوق النشر وخصوصية الأحياء قبل الإتاحة.");
    const item = (await db.select().from(heritageItems).where(eq(heritageItems.id, id)).limit(1))[0];
    if (!item) return deny("المادة غير موجودة.", 404);
    await db.batch([
      db.update(heritageItems).set({ visibility, reviewNote: note, reviewedBy: actor.userId, reviewedAt: time, updatedAt: time }).where(eq(heritageItems.id, id)),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "heritage.review." + visibility, subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true, id });
  }
  return deny("الإجراء غير معروف.", 404);
}
