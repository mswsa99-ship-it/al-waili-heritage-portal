import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { treeDraft } from "@/db/schema";
import { reviewerIdentity } from "@/lib/review-access";
import { notifyTreeChange } from "@/lib/tree-hub";

export const dynamic = "force-dynamic";
const key = "family-tree-working-draft";
const noCache = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!await reviewerIdentity()) return NextResponse.json({ error: "لا صلاحية" }, { status: 403 });
  const draft = (await getDb().select().from(treeDraft).where(eq(treeDraft.id, key)).limit(1))[0];
  if (!draft) return NextResponse.json({ revision: 0, draft: null }, { headers: noCache });
  return NextResponse.json({ revision: draft.revision, updatedAt: draft.updatedAt, draft: { records: JSON.parse(draft.recordsJson), positions: JSON.parse(draft.positionsJson) } }, { headers: noCache });
}

export async function POST(req: NextRequest) {
  const actor = await reviewerIdentity();
  if (!actor) return NextResponse.json({ error: "لا صلاحية" }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "مصدر غير مصرح" }, { status: 403 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "صيغة غير صحيحة" }, { status: 415 });
  const raw = await req.text();
  if (raw.length > 2000000) return NextResponse.json({ error: "حجم المسودة كبير" }, { status: 413 });
  let payload: { expectedRevision?: unknown; records?: unknown; positions?: unknown };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON غير صالح" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "محتوى مسودة غير صالح" }, { status: 400 });
  const revision = payload.expectedRevision;
  if (!Number.isInteger(revision) || typeof revision !== "number" || revision < 0 || revision > 1e8 || !Array.isArray(payload.records) || typeof payload.positions !== "object" || !payload.positions || payload.records.length > 1500) {
    return NextResponse.json({ error: "محتوى مسودة غير صالح" }, { status: 400 });
  }
  const records = payload.records as Array<{ id?: unknown; name?: unknown; parent?: unknown }>;
  if (records.some(r=>!r || typeof r.id !== "string" || r.id.length > 90 || typeof r.name !== "string" || r.name.length > 200 || (r.parent !== null && typeof r.parent !== "string"))) return NextResponse.json({ error: "سجل أسماء غير صالح" }, { status: 400 });
  const db = getDb();
  const current = (await db.select({ revision: treeDraft.revision }).from(treeDraft).where(eq(treeDraft.id, key)).limit(1))[0];
  if ((current?.revision ?? 0) !== revision) return NextResponse.json({ error: "توجد نسخة أحدث لدى مراجع آخر. صدّر عملك أولًا قبل إعادة التحميل.", revision: current?.revision ?? 0 }, { status: 409 });
  const nextRevision = revision + 1, updatedAt = new Date().toISOString();
  const recordString = JSON.stringify(payload.records), positionString = JSON.stringify(payload.positions);
  let saved: { revision: number }[];
  if (!current) {
    saved = await db.insert(treeDraft).values({ id: key, recordsJson: recordString, positionsJson: positionString, revision: nextRevision, editorId: actor, updatedAt }).onConflictDoNothing().returning({ revision: treeDraft.revision });
  } else {
    saved = await db.update(treeDraft).set({ recordsJson: recordString, positionsJson: positionString, revision: nextRevision, editorId: actor, updatedAt }).where(and(eq(treeDraft.id, key), eq(treeDraft.revision, revision))).returning({ revision: treeDraft.revision });
  }
  if (!saved.length) return NextResponse.json({ error: "عدّل مراجع آخر المسودة أثناء الحفظ. احتفظ بنسختك المحلية قبل إعادة التحميل." }, { status: 409 });
  await notifyTreeChange();
  return NextResponse.json({ revision: saved[0].revision }, { headers: noCache });
}
