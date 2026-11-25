import {sameOrigin, query, siteDb} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, genealogyRecords, memberTasks } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const management = new Set(["central", "secretary", "branch"]);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const kinds = new Set(["complete_branch", "verify_details", "research", "documentation", "other"]);
const safe = (value: unknown, n: number) => typeof value === "string" ? value.trim().slice(0, n) : "";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor) return fail("يلزم دخول فرد مرتبط بنسب معتمد.", 403);
  const db = getDb(), canManage = management.has(actor.role);
  const [all, people] = await Promise.all([
    db.select().from(memberTasks).orderBy(desc(memberTasks.createdAt)).limit(400),
    canManage ? db.select().from(genealogyRecords).limit(3000) : Promise.resolve([]),
  ]);
  const allowedPeople = people.filter(p => p.active && p.living && !p.minor && (actor.role !== "branch" || (actor.branch && p.branch === actor.branch)));
  const visiblePersonIds = new Set(allowedPeople.map(p => p.personId));
  return NextResponse.json({
    tasks: all.filter(t => (actor.personId && t.personId === actor.personId) || (canManage && visiblePersonIds.has(t.personId)))
      .map(t => ({ ...t, personName: allowedPeople.find(p => p.personId === t.personId)?.name || (t.personId === actor.personId ? actor.name : ""), canReport: Boolean(actor.personId && t.personId === actor.personId) })),
    approvedPeople: allowedPeople.map(p => ({ personId: p.personId, name: p.name, branch: p.branch })),
    canManage,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor) return fail("ليس لديك صلاحية.", 403);
  if (!sameOrigin(req)) return fail("مصدر غير معتمد.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير مدعومة.", 415);
  const raw = await req.text();
  if (raw.length > 6500) return fail("حجم الطلب كبير.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail("طلب غير صالح."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("يجب إرسال كائن بيانات صالح.", 400);
  const db = getDb(), time = new Date().toISOString(), action = body.action;
  if (action === "create") {
    if (!management.has(actor.role)) return fail("إسناد المهام للإدارة المخولة فقط.", 403);
    const personId = safe(body.personId, 100), kind = safe(body.kind, 35), title = safe(body.title, 180), description = safe(body.description, 2800), dueDate = safe(body.dueDate, 32);
    if (!kinds.has(kind) || title.length < 5 || (dueDate && !validDate(dueDate))) return fail("حدد المستفيد ونوع المهمة والعنوان والموعد الصحيح.");
    const person = (await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId, personId)).limit(1))[0];
    if (!person?.active || !person.living || person.minor) return fail("لا يمكن إسناد هذه المهمة إلا لفرد بالغ حي من سجل نسب معتمد.", 409);
    if (actor.role === "branch" && (!actor.branch || person.branch !== actor.branch)) return fail("التكليف خارج الفرع المخول.", 403);
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(memberTasks).values({ id, personId, kind, title, description, dueDate, assignedBy: actor.userId, updatedBy: actor.userId, createdAt: time, updatedAt: time }),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "member.task.assigned", subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true, id });
  }
  const id = safe(body.id, 100);
  const task = (await db.select().from(memberTasks).where(eq(memberTasks.id, id)).limit(1))[0];
  if (!task) return fail("المهمة غير موجودة.", 404);
  if (action === "report") {
    if (!actor.personId || actor.personId !== task.personId) return fail("التحديث لصاحب المهمة المتحقق من نسبه فقط.", 403);
    if (task.status === "completed") return fail("المهمة منجزة ومقفلة.", 409);
    const memberReport = safe(body.memberReport, 3000);
    if (memberReport.length < 10) return fail("اكتب ملخصًا للإجراء المنجز أو للمعلومات المطلوبة.");
    const guardId = crypto.randomUUID();
    try {
      await siteDb().batch([
        query("INSERT INTO lineage_work_guard(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM member_tasks WHERE id=? AND status=? AND member_report=? AND updated_by=?) THEN 1 ELSE 0 END",guardId,id,task.status,task.memberReport,task.updatedBy),
        query("UPDATE member_tasks SET member_report=?,status='submitted',updated_by=?,updated_at=? WHERE id=?",memberReport,actor.userId,time,id),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),actor.userId,"member.task.report_submitted",id,time),
        query("DELETE FROM lineage_work_guard WHERE id=?",guardId),
      ]);
    } catch(error) {
      if(String(error).includes("CHECK stale lineage revision")) return fail("تغيرت المهمة أثناء الإرسال. حدّث الصفحة وراجع حالتها.",409);
      throw error;
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "review") {
    if (!management.has(actor.role)) return fail("الاعتماد للإدارة المكلفة فقط.", 403);
    const person = (await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId, task.personId)).limit(1))[0];
    if (!person?.active || (actor.role === "branch" && (!actor.branch || person.branch !== actor.branch))) return fail("هذه المهمة خارج صلاحيتك.", 403);
    if (task.personId===actor.personId || task.updatedBy===actor.userId) return fail("يلزم مراجع مستقل لتقريرك.",403);
    if (task.status !== "submitted") return fail("يجب أن يقدم الفرد تقرير المهمة قبل اعتمادها.", 409);
    const status = body.status === "completed" ? "completed" : body.status === "returned" ? "returned" : "";
    const reviewNote = safe(body.reviewNote, 1800);
    if (!status || reviewNote.length < 8) return fail("حدد القبول أو الإعادة وسبب القرار.");
    const guardId = crypto.randomUUID();
    try {
      await siteDb().batch([
        query("INSERT INTO lineage_work_guard(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM member_tasks WHERE id=? AND status='submitted' AND member_report=? AND updated_by=?) THEN 1 ELSE 0 END",guardId,id,task.memberReport,task.updatedBy),
        query("UPDATE member_tasks SET status=?,review_note=?,updated_by=?,updated_at=? WHERE id=?",status,reviewNote,actor.userId,time,id),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),actor.userId,"member.task."+status,id,time),
        query("DELETE FROM lineage_work_guard WHERE id=?",guardId),
      ]);
    } catch(error) {
      if(String(error).includes("CHECK stale lineage revision")) return fail("تغير التقرير أو سبق اتخاذ القرار. حدّث الصفحة قبل المراجعة.",409);
      throw error;
    }
    return NextResponse.json({ ok: true });
  }
  return fail("إجراء غير معروف.", 404);
}
