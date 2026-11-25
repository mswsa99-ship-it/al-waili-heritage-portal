import {sameOrigin, query, siteDb} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { announcements, auditLog, corrections, events, genealogyRecords, members, nominations, proceduralReviews, requests, rsvps, lineageWorkDelegations, workingTreePeople, votes } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";

const managerRoles = new Set(["central", "council"]);
const kindNames = new Set(["observation", "social", "volunteer", "education", "skills", "document", "general", "procedural"]);
const safeText = (v: unknown, max = 2000) => typeof v === "string" ? v.trim().slice(0, max) : "";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const now = () => new Date().toISOString();
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const uuid = () => crypto.randomUUID();

type Access = NonNullable<Awaited<ReturnType<typeof getFamilyActor>>>;
const access = getFamilyActor;
const isCentral = (a: Access) => a.role === "central";
const isBranch = (a: Access) => a.role === "branch";
const isCommittee = (a: Access) => a.role === "genealogy";
const managesNews = (a: Access) => managerRoles.has(a.role);
const privateKind = (kind: string) => kind === "social" || kind === "procedural";

async function log(actorId: string, action: string, subjectId: string) {
  await getDb().insert(auditLog).values({ id: uuid(), actorId, action, subjectId, createdAt: now() });
}

export async function GET() {
  const a = await access();
  if (!a) return fail("الدخول يتطلب عضوية مفعلة بدعوة الإدارة المركزية.", 403);
  const db = getDb();
  const [allNews, allEvents, allRequests, allNominations, allCorrections, allVotes, allRsvps, allMembers, allGenealogy, myDelegations, workPeople] = await Promise.all([
    db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(60),
    db.select().from(events).orderBy(desc(events.eventDate)).limit(60),
    db.select().from(requests).orderBy(desc(requests.createdAt)).limit(150),
    db.select().from(nominations).orderBy(desc(nominations.createdAt)).limit(100),
    db.select().from(corrections).orderBy(desc(corrections.createdAt)).limit(100),
    db.select().from(votes).limit(300),
    db.select().from(rsvps).limit(400),
    db.select().from(members).limit(300),
    db.select({active:genealogyRecords.active}).from(genealogyRecords).limit(2500),
    a.personId ? db.select({status:lineageWorkDelegations.status,expiresAt:lineageWorkDelegations.expires_at}).from(lineageWorkDelegations).where(eq(lineageWorkDelegations.delegate_person_id,a.personId)).limit(30) : Promise.resolve([]),
    db.select({active:workingTreePeople.active}).from(workingTreePeople),
  ]);
  const canSeeRequest = (r: typeof allRequests[number]) =>
    r.userId === a.userId ||
    (!privateKind(r.kind) && (isCentral(a) || a.role === "council" || (isBranch(a) && a.branch === r.branch))) ||
    (r.kind === "procedural" && ["secretary", "oversight"].includes(a.role)) ||
    (r.kind === "social" && a.role === "social");
  const canSeeCorrection = (c: typeof allCorrections[number]) =>
    isCommittee(a) || (isBranch(a) && c.branch === a.branch) || a.role === "secretary";
  return NextResponse.json({
    me: { userId: a.userId, name: a.name, role: a.role, branch: a.branch, isOwner: a.isOwner, canEditTree: isCentral(a) || isCommittee(a) || myDelegations.some(g=>g.status==="active"&&(!g.expiresAt||g.expiresAt>now())) },
    announcements: allNews.filter((n) => n.published || managesNews(a)),
    events: allEvents,
    requests: allRequests.filter(canSeeRequest),
    nominations: isCentral(a) ? allNominations : isBranch(a) ? allNominations.filter((n) => n.proposerId === a.userId) : [],
    corrections: allCorrections.filter(canSeeCorrection).map(c => ({
      ...c, votes: isCommittee(a) ? allVotes.filter(v => v.correctionId === c.id) : [],
    })),
    rsvps: allRsvps.filter(r => r.userId === a.userId || managesNews(a)),
    members: isCentral(a) ? allMembers.map(m => ({ ...m, phone: m.phone ? "•••" + m.phone.slice(-4) : null, email: m.email ? "محمي" : null })) : [],
    counts: { approvedPeople: allGenealogy.filter(r=>r.active).length, draftTranscriptions: workPeople.filter(p=>p.active).length, pendingCorrections: allCorrections.filter(c => canSeeCorrection(c)&&c.status === "committee_review").length },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const a = await access();
  if (!a) return fail("غير مصرح: العضوية المفعلة مطلوبة.", 403);
  if (!sameOrigin(request)) return fail("طلب من مصدر غير مصرح.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("يجب إرسال JSON.", 415);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return fail("طلب غير صالح.");
  const db = getDb();
  const action = body.action;
  const id = uuid();
  const createdAt = now();
  try {
    if (action === "announcement.create") {
      if (!managesNews(a)) return fail("إنشاء الأخبار للإدارة فقط.", 403);
      const title = safeText(body.title, 180), content = safeText(body.body, 6000);
      if (!title || !content) return fail("أدخل عنوان الخبر ومحتواه.");
      const published = body.published === true || body.published === "true";
      if (published && body.audience === "public" && body.confirmPublic !== "true" && body.confirmPublic !== true)
        return fail("يلزم تأكيد مراجعة حقوق النشر وخصوصية الأحياء قبل النشر العام.");
      await db.insert(announcements).values({ id, title, body: content, category: ["news","events","achievements","publications"].includes(String(body.category)) ? String(body.category) : "news", audience: body.audience === "public" ? "public" : "family", published, authorId: a.userId, createdAt });
    } else if (action === "announcement.update") {
      if (!managesNews(a)) return fail("تحديث الأخبار للإدارة المخولة فقط.", 403);
      const existing = (await db.select().from(announcements).where(eq(announcements.id, safeText(body.id, 80))).limit(1))[0];
      if (!existing) return fail("الخبر غير موجود.", 404);
      const title = safeText(body.title, 180) || existing.title;
      const content = safeText(body.body, 6000) || existing.body;
      const published = body.published === true;
      const audience = body.audience === "public" ? "public" : "family";
      if (published && audience === "public" && body.confirmPublic !== true) return fail("يلزم تأكيد مراجعة خصوصية المادة وحقوق النشر قبل نشرها للعامة.");
      await db.update(announcements).set({ title, body: content, audience, published, category: ["news","events","achievements","publications"].includes(String(body.category)) ? String(body.category) : existing.category }).where(eq(announcements.id, existing.id));
      await log(a.userId, "announcement.update", existing.id);
    } else if (action === "event.create") {
      if (!managesNews(a)) return fail("إنشاء المناسبات للإدارة فقط.", 403);
      const title = safeText(body.title, 180), eventDate = safeText(body.eventDate, 32);
      if (!title || !validDate(eventDate)) return fail("أدخل المناسبة وتاريخها.");
      await db.insert(events).values({ id, title, description: safeText(body.description, 3000), eventDate, place: safeText(body.place, 180), authorId: a.userId, createdAt });
    } else if (action === "event.rsvp") {
      const eventId = safeText(body.eventId, 70), response = safeText(body.response, 16);
      if (!["attending", "not_attending"].includes(response)) return fail("استجابة غير صالحة.");
      if (!(await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1)).length) return fail("المناسبة غير موجودة.", 404);
      await db.insert(rsvps).values({ eventId, userId: a.userId, response, updatedAt: createdAt }).onConflictDoUpdate({ target: [rsvps.eventId, rsvps.userId], set: { response, updatedAt: createdAt } });
    } else if (action === "request.create") {
      const kind = safeText(body.kind, 30), subject = safeText(body.subject, 180), content = safeText(body.body, 4000);
      if (!kindNames.has(kind) || !subject || !content) return fail("بيانات الطلب غير مكتملة.");
      let parentRequestId: string | null = null;
      if (kind === "procedural") {
        parentRequestId = safeText(body.parentRequestId, 70);
        const parent = (await db.select().from(requests).where(eq(requests.id, parentRequestId)).limit(1))[0];
        if (!parent || parent.userId !== a.userId || parent.kind !== "observation" || parent.status !== "closed") return fail("المراجعة الإجرائية تتطلب ملاحظة نسب مغلقة تخص مقدم الطلب.");
      }
      await db.insert(requests).values({ id, userId: a.userId, kind, subject, body: content, parentRequestId, branch: a.branch, status: "new", createdAt, updatedAt: createdAt });
    } else if (action === "request.resolve") {
      const record = (await db.select().from(requests).where(eq(requests.id, safeText(body.id, 70))).limit(1))[0];
      if (!record) return fail("الطلب غير موجود.", 404);
      const canResolve = (record.kind === "social" && a.role === "social") ||
        (!privateKind(record.kind) && (isCentral(a) || (isBranch(a) && record.branch === a.branch)));
      if (!canResolve) return fail("لا تملك صلاحية إغلاق هذا النوع من الطلبات.", 403);
      const resolution = safeText(body.resolution, 3000);
      if (resolution.length < 8) return fail("يلزم تسبيب قرار الإغلاق.");
      await db.update(requests).set({ status: "closed", resolution, updatedAt: createdAt }).where(eq(requests.id, record.id));
      await log(a.userId, "request.resolve", record.id);
    } else if (action === "procedural.review") {
      if (!["secretary", "oversight"].includes(a.role)) return fail("المراجعة الإجرائية لأمين السر وعضو المتابعة المستقل فقط.", 403);
      const record = (await db.select().from(requests).where(eq(requests.id, safeText(body.id, 70))).limit(1))[0];
      if (!record || record.kind !== "procedural" || record.status === "closed" || record.userId === a.userId) return fail("لا يجوز مراجعة هذه المعاملة.", 403);
      const note = safeText(body.note, 2000);
      if (note.length < 8) return fail("المراجعة المسببة مطلوبة.");
      await db.insert(proceduralReviews).values({ requestId: record.id, reviewerId: a.userId, reviewerRole: a.role, note, createdAt }).onConflictDoNothing();
      const reviews = await db.select().from(proceduralReviews).where(eq(proceduralReviews.requestId, record.id));
      if (reviews.some(r => r.reviewerRole === "secretary") && reviews.some(r => r.reviewerRole === "oversight") && reviews[0].reviewerId !== reviews[1].reviewerId) {
        await db.update(requests).set({ status: "closed", resolution: "اكتملت مراجعة الإجراءات من أمين السر وعضو المتابعة المستقل؛ دون إصدار قرار في صحة النسب.", updatedAt: createdAt }).where(eq(requests.id, record.id));
      }
      await log(a.userId, "procedural.review", record.id);
    } else if (action === "nomination.create") {
      if (!isBranch(a)) return fail("الترشيح لممثل الفرع فقط.", 403);
      const personName = safeText(body.personName, 180), personRef = safeText(body.personRef, 100), phone = safeText(body.phone, 30);
      if (!personName || !personRef || phone.length < 9) return fail("الاسم ومرجع النسب والجوال مطلوبة.");
      await db.insert(nominations).values({ id, proposerId: a.userId, personName, personRef, branch: a.branch, phone, email: safeText(body.email, 160) || null, createdAt });
    } else if (action === "nomination.review") {
      if (!isCentral(a)) return fail("مراجعة الترشيحات للإدارة المركزية فقط.", 403);
      if (body.status !== "rejected") return fail("تحضير الدعوات يتم عبر خدمة الدعوات الجديدة بعد التحقق من سجل النسب المعتمد.", 409);
      const record = (await db.select().from(nominations).where(eq(nominations.id, safeText(body.id, 70))).limit(1))[0];
      if (!record) return fail("الترشيح غير موجود.", 404);
      const status = "rejected";
      await db.update(nominations).set({ status }).where(eq(nominations.id, record.id));
      await log(a.userId, "nomination.review." + status, record.id);
    } else if (action === "correction.create") {
      if (!isBranch(a)) return fail("طلب تصحيح النسب الرسمي لممثل الفرع فقط.", 403);
      const personRef = safeText(body.personRef, 100), proposedChange = safeText(body.proposedChange, 3000), evidence = safeText(body.evidence, 4000);
      if (!personRef || proposedChange.length < 6 || evidence.length < 8) return fail("مرجع الشخص والتغيير والأدلة مطلوبة.");
      const level = ["textual", "ordinary", "material"].includes(String(body.level)) ? String(body.level) : "ordinary";
      await db.insert(corrections).values({ id, proposerId: a.userId, branch: a.branch, personRef, proposedChange, evidence, level, branchReview: safeText(body.branchReview, 2000), createdAt });
    } else if (action === "correction.independent") {
      if (!isCommittee(a)) return fail("المراجعة المستقلة لمراجع أنساب مخول فقط.", 403);
      const record = (await db.select().from(corrections).where(eq(corrections.id, safeText(body.id, 70))).limit(1))[0];
      if (!record || record.proposerId === a.userId) return fail("غير مؤهل لمراجعة هذا الطلب.", 403);
      const note = safeText(body.note, 2000);
      if (note.length < 8) return fail("تقرير المراجعة المستقلة مطلوب.");
      const guardId=uuid();
      await siteDb().batch([
        query("INSERT INTO lineage_work_guard(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM genealogy_corrections WHERE id=? AND status='committee_review') THEN 1 ELSE 0 END",guardId,record.id),
        query("UPDATE genealogy_corrections SET independent_review_by=?,independent_review_note=? WHERE id=?",a.userId,note,record.id),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)",uuid(),a.userId,"correction.independent",record.id,createdAt),
        query("DELETE FROM lineage_work_guard WHERE id=?",guardId),
      ]);
    } else if (action === "correction.vote") {
      if (!isCommittee(a)) return fail("التصويت لأعضاء لجنة الأنساب فقط.", 403);
      const record = (await db.select().from(corrections).where(eq(corrections.id, safeText(body.id, 70))).limit(1))[0];
      if (!record || record.status !== "committee_review") return fail("الطلب غير مطروح للتصويت.", 409);
      const vote = safeText(body.vote, 10), reason = safeText(body.reason, 2000);
      if (!["yes", "no", "recuse"].includes(vote) || reason.length < 5) return fail("حدد التصويت واكتب السبب.");
      if (record.level === "material" && !record.independentReviewBy) return fail("يلزم تقرير مراجعة مستقل للتغيير الجوهري.");
      const quorum = record.level === "textual" ? 3 : 4;
      const needed = record.level === "material" ? 4 : record.level === "textual" ? 2 : 3;
      const guardId=uuid();
      // Serialize eligibility, vote, quorum calculation and audit in one D1 transaction.
      const count=(choice:string)=>`(SELECT COUNT(*) FROM genealogy_votes WHERE correction_id=genealogy_corrections.id AND ${choice})`;
      const eligible=count("vote!='recuse'"), yes=count("vote='yes'"), no=count("vote='no'");
      await siteDb().batch([
        query("INSERT INTO lineage_work_guard(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM genealogy_corrections WHERE id=? AND status='committee_review' AND (level!='material' OR independent_review_by IS NOT NULL)) THEN 1 ELSE 0 END",guardId,record.id),
        query("INSERT INTO genealogy_votes(correction_id,member_user_id,vote,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(correction_id,member_user_id) DO UPDATE SET vote=excluded.vote,reason=excluded.reason,created_at=excluded.created_at",record.id,a.userId,vote,reason,createdAt),
        query(`UPDATE genealogy_corrections SET status=CASE WHEN ${yes}>=? THEN 'approved' ELSE 'rejected' END,decision_note='قرار اللجنة وفق التصويت المسجل: موافقة '||${yes}||'، رفض '||${no}||'، نصاب '||${eligible}||'. لا تُعدل المشجرة الأصلية آليًا قبل تحقيق السجل.' WHERE id=? AND status='committee_review' AND ${eligible}>=? AND (${yes}>=? OR ${no}>${eligible}-?)`,needed,record.id,quorum,needed,needed),
        query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)",uuid(),a.userId,"correction.vote",record.id,createdAt),
        query("DELETE FROM lineage_work_guard WHERE id=?",guardId),
      ]);
    } else {
      return fail("الإجراء غير معروف.", 404);
    }
    if (!["event.rsvp", "correction.vote", "correction.independent", "request.resolve", "nomination.review", "procedural.review", "announcement.update"].includes(action)) await log(a.userId, action, id);
    return NextResponse.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if(String(error).includes("CHECK stale lineage revision")) return fail("تغيرت حالة الطلب أو صدر القرار. حدّث الصفحة قبل المحاولة.",409);
    console.error("portal action failed", action, error);
    return fail("تعذر إتمام العملية. حاول مجددًا أو راجع الإدارة.", 500);
  }
}
