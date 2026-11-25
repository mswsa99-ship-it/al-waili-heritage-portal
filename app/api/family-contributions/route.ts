import {query,siteDb,sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, familyContributions, members } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const kinds = new Set(["proposal", "plan", "initiative", "volunteer", "poll_request", "branch_update", "question", "media"]);
const manageRoles = new Set(["central", "secretary", "council", "branch"]);
const safe = (value: unknown, n: number) => typeof value === "string" ? value.trim().slice(0, n) : "";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor) return fail("الدخول بهوية مرتبطة بالمشجرة المعتمدة مطلوب.", 403);
  const db = getDb(), canManage = manageRoles.has(actor.role);
  const [all, memberList] = await Promise.all([
    db.select().from(familyContributions).orderBy(desc(familyContributions.createdAt)).limit(300),
    canManage ? db.select({ userId: members.userId, name: members.name }).from(members).limit(3000) : Promise.resolve([]),
  ]);
  const isVisible = (c: typeof all[number]) => c.userId === actor.userId ||
    (canManage && (actor.role !== "branch" || Boolean(actor.branch && actor.branch === c.branch)));
  return NextResponse.json({
    contributions: all.filter(isVisible).map(c => ({ ...c, authorName: canManage ? memberList.find(m => m.userId === c.userId)?.name || "فرد من الأسرة" : actor.name })), canManage,
    privacy: "المساهمات ليست منشورات عامة؛ تُرسل إلى جهة المراجعة ويبقى الرد في سجل مقدم الطلب.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor) return fail("العضوية المعتمدة مطلوبة.", 403);
  if (!sameOrigin(req)) return fail("مصدر غير موثوق.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير مدعومة.", 415);
  const raw = await req.text();
  if (raw.length > 6500) return fail("النص يتجاوز الحد المسموح.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail("طلب غير صالح."); }
  if (!body || typeof body!=="object" || Array.isArray(body)) return fail("بيانات غير صالحة.");
  const db = getDb(), time = new Date().toISOString();
  if (body.action === "create") {
    if (!actor.personId) return fail("لا يمكن إرسال مساهمة عائلية قبل ربط الهوية بسجل نسب معتمد.", 403);
    const kind = safe(body.kind, 35), title = safe(body.title, 180), text = safe(body.body, 3500);
    if (!kinds.has(kind) || title.length < 5 || text.length < 12) return fail("حدد نوع المساهمة وعنوانًا واضحًا وتفاصيل كافية.");
    const id = crypto.randomUUID();
    const results=await siteDb().batch([
      query('INSERT INTO family_contributions(id,user_id,person_id,branch,kind,title,body,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM family_contributions WHERE user_id=? AND created_at>=?)<5',id,actor.userId,actor.personId,actor.branch,kind,title,text,time,time,actor.userId,time.slice(0,10)),
      query('INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM family_contributions WHERE id=?)',crypto.randomUUID(),actor.userId,'contribution.created.'+kind,id,time,id)
    ]);
    if(!results[0].meta.changes)return fail("الحد اليومي خمس مساهمات؛ يرجى المتابعة لاحقًا.",429);
    return NextResponse.json({ ok: true, id, message: "وصلت مساهمتك إلى السجل الخاص، ولم تُنشر للعموم." });
  }
  if (body.action === "review") {
    if (!manageRoles.has(actor.role)) return fail("البت في المساهمات للإدارة فقط.", 403);
    const id = safe(body.id, 100), status = safe(body.status, 20), responseNote = safe(body.responseNote, 1800);
    const record = (await db.select().from(familyContributions).where(eq(familyContributions.id, id)).limit(1))[0];
    if (!record) return fail("المساهمة غير موجودة.", 404);
    if (actor.role === "branch" && (!actor.branch || record.branch !== actor.branch)) return fail("المساهمة خارج نطاق الفرع.", 403);
    if (!new Set(["in_review", "accepted", "returned", "completed"]).has(status) || responseNote.length < 8) return fail("حالة المراجعة ومبرراتها مطلوبة.");
    await db.batch([
      db.update(familyContributions).set({ status, responseNote, reviewedBy: actor.userId, updatedAt: time }).where(eq(familyContributions.id, id)),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "contribution." + status, subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true });
  }
  return fail("إجراء غير معروف.", 404);
}
