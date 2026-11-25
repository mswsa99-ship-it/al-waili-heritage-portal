import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, councilTasks } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const allowedRoles = new Set(["central", "secretary", "council", "branch"]);
const managingRoles = new Set(["central", "secretary"]);
const states = new Set(["planned", "in_progress", "blocked", "completed"]);
const committees = new Set(["general", "genealogy", "media", "education", "social", "women", "branch"]);
const safe = (v: unknown, length: number) => typeof v === "string" ? v.trim().slice(0, length) : "";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor || !allowedRoles.has(actor.role)) return fail("سجل مهام المجلس للمكلفين فقط.", 403);
  const items = await getDb().select().from(councilTasks).orderBy(desc(councilTasks.createdAt)).limit(150);
  const filtered = actor.role === "branch" ? items.filter(t => t.assignedBranch === actor.branch && t.assignedBranch) : items;
  return NextResponse.json({ tasks: filtered, canManage: managingRoles.has(actor.role) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor || !managingRoles.has(actor.role)) return fail("إدارة التكليفات للإدارة المركزية وأمين السر فقط.", 403);
  if (!sameOrigin(req)) return fail("مصدر غير موثوق.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير صحيحة.", 415);
  const raw = await req.text();
  if (raw.length > 6500) return fail("المحتوى أطول من المسموح.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail("تعذّرت قراءة الطلب."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("يجب إرسال كائن بيانات صالح.", 400);
  const db = getDb(), time = new Date().toISOString();
  if (body.action === "create") {
    const title = safe(body.title, 170), description = safe(body.description, 2500);
    const committee = safe(body.committee, 30), assignedBranch = safe(body.assignedBranch, 100);
    const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";
    if (title.length < 5 || !committees.has(committee) || (dueDate && !validDate(dueDate))) return fail("أكمل المهمة واللجنة والتاريخ الصحيح.");
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(councilTasks).values({ id, title, description, committee, assignedBranch, dueDate, createdBy: actor.userId, updatedBy: actor.userId, createdAt: time, updatedAt: time }),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "council.task.created", subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true, id });
  }
  if (body.action === "update") {
    const id = safe(body.id, 80), status = safe(body.status, 25), decisionNote = safe(body.decisionNote, 2000);
    if (!states.has(status) || decisionNote.length < 8) return fail("حالة المهمة ومحضر التحديث المسبب مطلوبان.");
    const found = (await db.select().from(councilTasks).where(eq(councilTasks.id, id)).limit(1))[0];
    if (!found) return fail("التكليف غير موجود.", 404);
    await db.batch([
      db.update(councilTasks).set({ status, decisionNote, updatedBy: actor.userId, updatedAt: time }).where(eq(councilTasks.id, id)),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "council.task." + status, subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true });
  }
  return fail("إجراء غير معروف.", 404);
}
