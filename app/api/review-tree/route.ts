import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/app/session-auth";
import { getDb } from "@/db";
import { members } from "@/db/schema";
import source from "@/private/tree-data.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "هوية مطلوبة" }, { status: 401 });
  if (user.email.toLowerCase() !== "msw.sa99@gmail.com") {
    const record = (await getDb().select({ role: members.role, status: members.status }).from(members).where(eq(members.userId, user.userId)).limit(1))[0];
    if (!record || record.status !== "active" || record.role !== "genealogy") {
      return NextResponse.json({ error: "لا صلاحية للاطلاع على مسودة النسب" }, { status: 403 });
    }
  }
  return NextResponse.json(source, { headers: { "Cache-Control": "private, no-store" } });
}
