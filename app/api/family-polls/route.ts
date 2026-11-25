import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, familyPolls, familyPollVotes } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";
import { query, siteDb, sameOrigin } from "@/lib/site-db";

async function guarded(condition: string, params: (string | number | null)[], writes: D1PreparedStatement[]) {
  const lock = crypto.randomUUID();
  await siteDb().batch([
    query(`INSERT INTO lineage_work_guard(id,ok) VALUES(?,CASE WHEN (${condition}) THEN 1 ELSE 0 END)`, lock, ...params),
    ...writes, query("DELETE FROM lineage_work_guard WHERE id=?", lock),
  ]);
}

export const dynamic = "force-dynamic";
const managers = new Set(["central", "council", "secretary"]);
const safe = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const readOptions = (value: string): string[] => {
  try { const result: unknown = JSON.parse(value); return Array.isArray(result) && result.every(x => typeof x === "string") ? result : []; } catch { return []; }
};

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor) return fail("التصويت متاح للأعضاء المتحقق من نسبهم فقط.", 403);
  const db = getDb(), canManage = managers.has(actor.role), current = new Date().toISOString();
  const [polls, ballotCounts, mine] = await Promise.all([
    db.select().from(familyPolls).orderBy(desc(familyPolls.createdAt)).limit(100),
    db.select({ pollId: familyPollVotes.pollId, optionIndex: familyPollVotes.optionIndex, count: sql<number>`count(*)` }).from(familyPollVotes).groupBy(familyPollVotes.pollId, familyPollVotes.optionIndex),
    db.select().from(familyPollVotes).where(eq(familyPollVotes.userId, actor.userId)),
  ]);
  return NextResponse.json({
    canManage, canVote: Boolean(actor.personId),
    polls: polls.filter(p => canManage || p.status !== "draft").map(p => {
      const options = readOptions(p.optionsJson), isClosed = p.status === "closed" || p.closesAt <= current;
      const mineVote = mine.find(v => v.pollId === p.id);
      const showResults = Boolean(mineVote) || isClosed || canManage;
      const counts = options.map((_, i) => Number(ballotCounts.find(b => b.pollId === p.id && b.optionIndex === i)?.count || 0));
      return {
        id: p.id, title: p.title, description: p.description, options,
        status: isClosed ? "closed" : p.status, closesAt: p.closesAt,
        myChoice: mineVote?.optionIndex ?? null, totalVotes: showResults ? counts.reduce((a, b) => a + b, 0) : null,
        counts: showResults ? counts : null,
        canCast: p.status === "open" && !isClosed && Boolean(actor.personId) && !mineVote,
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor) return fail("دخول العضوية مطلوب.", 403);
  if (!sameOrigin(req)) return fail("مصدر غير مخول.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير صحيحة.", 415);
  const raw = await req.text();
  if (raw.length > 6000) return fail("حجم الطلب غير مقبول.", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return fail("تعذر قراءة الطلب."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("بيانات الطلب غير صحيحة.");
  const db = getDb(), time = new Date().toISOString();
  if (body.action === "create") {
    if (!managers.has(actor.role)) return fail("فتح استطلاعات الأسرة للإدارة المخولة فقط.", 403);
    const title = safe(body.title, 170), description = safe(body.description, 1500), closesAt = safe(body.closesAt, 30);
    const options = Array.isArray(body.options) ? body.options.map(x => safe(x, 140)).filter(Boolean) : [];
    if (title.length < 5 || options.length < 2 || options.length > 8 || new Set(options).size !== options.length) return fail("يلزم عنوان واضح وخياران إلى ثمانية خيارات غير مكررة.");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(closesAt) || Number.isNaN(Date.parse(closesAt)) || new Date(closesAt).toISOString() <= time) return fail("حدد موعد إغلاق مستقبليًا صحيحًا.");
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(familyPolls).values({ id, title, description, optionsJson: JSON.stringify(options), status: "draft", closesAt: new Date(closesAt).toISOString(), createdBy: actor.userId, createdAt: time, updatedAt: time }),
      db.insert(auditLog).values({ id: crypto.randomUUID(), actorId: actor.userId, action: "family.poll.draft_created", subjectId: id, createdAt: time }),
    ]);
    return NextResponse.json({ ok: true, id, message: "حُفظ التصويت مسودة حتى اعتماده ونشره داخليًا." });
  }
  const id = safe(body.id, 100);
  const poll = (await db.select().from(familyPolls).where(eq(familyPolls.id, id)).limit(1))[0];
  if (!poll) return fail("التصويت غير موجود.", 404);
  if (body.action === "publish" || body.action === "close") {
    if (!managers.has(actor.role)) return fail("التحكم في التصويت للإدارة فقط.", 403);
    if (body.action === "publish" && (poll.status !== "draft" || poll.closesAt <= time || body.confirmPrivacy !== true)) return fail("لا يمكن نشر الاستطلاع دون تأكيد المراجعة وموعد صالح.", 409);
    if (body.action === "close" && poll.status !== "open") return fail("لا يمكن إغلاق هذه الحالة.", 409);
    const status = body.action === "publish" ? "open" : "closed";
    try {
      await guarded("EXISTS(SELECT 1 FROM family_polls WHERE id=? AND status=? AND updated_at=? AND (?='closed' OR closes_at>?))", [id, poll.status, poll.updatedAt, status, time], [
        query("UPDATE family_polls SET status=?,updated_at=? WHERE id=?", status, time, id),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), actor.userId, "family.poll." + status, id, time),
      ]);
    } catch { return fail("تغيرت حالة التصويت أثناء العملية؛ حدّث الصفحة.", 409); }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "vote") {
    if (!actor.personId) return fail("صوت المستفيد يشترط حسابًا مربوطًا بشخص معتمد في المشجرة؛ حساب الإدارة التأسيسي لا يصوت.", 403);
    if (poll.status !== "open" || poll.closesAt <= time) return fail("هذا التصويت مغلق.", 409);
    const index = body.optionIndex;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= readOptions(poll.optionsJson).length) return fail("الخيار غير صالح.");
    const existing = await db.select({ userId: familyPollVotes.userId }).from(familyPollVotes).where(and(eq(familyPollVotes.pollId, id), eq(familyPollVotes.userId, actor.userId))).limit(1);
    if (existing.length) return fail("تم تسجيل صوتك مسبقًا ولا يجوز تكراره.", 409);
    try {
      await guarded("EXISTS(SELECT 1 FROM family_polls WHERE id=? AND status='open' AND closes_at>?) AND NOT EXISTS(SELECT 1 FROM family_poll_votes WHERE poll_id=? AND user_id=?)", [id, new Date().toISOString(), id, actor.userId], [
        query("INSERT INTO family_poll_votes(poll_id,user_id,option_index,created_at) VALUES(?,?,?,?)", id, actor.userId, index as number, time),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), actor.userId, "family.poll.vote_cast", id, time),
      ]);
    } catch { return fail("أغلق التصويت أو سُجل صوتك مسبقًا؛ حدّث الصفحة.", 409); }
    return NextResponse.json({ ok: true, message: "سُجّل صوت واحد لك في الاستطلاع." });
  }
  return fail("إجراء غير معروف.", 404);
}
