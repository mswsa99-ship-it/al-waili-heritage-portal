import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { announcements, heritageItems } from "@/db/schema";

export async function publicNews(limit = 30) {
  const rows = await getDb().select().from(announcements)
    .where(and(eq(announcements.published, true), eq(announcements.audience, "public")))
    .orderBy(desc(announcements.createdAt)).limit(limit);
  return rows.map(r => ({ id: r.id, title: r.title, body: r.body, category: r.category, createdAt: r.createdAt }));
}

export async function publicHeritage(limit = 60) {
  const rows = await getDb().select().from(heritageItems)
    .where(eq(heritageItems.visibility, "public"))
    .orderBy(desc(heritageItems.reviewedAt)).limit(limit);
  return rows.map(r => ({ id: r.id, title: r.title, kind: r.kind, summary: r.summary,
    source: r.source, sourceAuthor:r.sourceAuthor,sourceDate:r.sourceDate,sourcePage:r.sourcePage,evidenceStatus:r.evidenceStatus,imageUrl:r.attachmentId?"/api/heritage-image?id="+encodeURIComponent(r.id):null, period: r.period, reviewedAt: r.reviewedAt }));
}

export const readableDate = (date: string | null) => date ? new Date(date).toLocaleDateString("ar-SA", {
  year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh",
}) : "";
