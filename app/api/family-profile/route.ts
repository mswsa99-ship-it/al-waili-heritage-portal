import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberProfiles, members } from "@/db/schema";
import { getFamilyActor } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const deny = () => NextResponse.json({ error: "عضوية مفعلة مطلوبة" }, { status: 403 });
const clamp = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

export async function GET() {
  const actor = await getFamilyActor();
  if (!actor) return deny();
  const db = getDb();
  const profile = (await db.select().from(memberProfiles).where(eq(memberProfiles.userId, actor.userId)).limit(1))[0] ?? null;
  const identity = (await db.select({personRef:members.personRef}).from(members).where(eq(members.userId,actor.userId)).limit(1))[0];
  const directoryProfiles = await db.select().from(memberProfiles).limit(350);
  const activeMembers = await db.select({ userId: members.userId, minor: members.minor }).from(members).where(eq(members.status, "active"));
  const eligibleIds = new Set(activeMembers.filter(m=>!m.minor).map(m=>m.userId));
  const directory = directoryProfiles.filter(p=>eligibleIds.has(p.userId) && (p.showSkills || p.showCity || p.showBiography || p.showVolunteering)).map(p=>({
    displayName: p.displayName,
    city: p.showCity ? p.city : "",
    skills: p.showSkills ? p.skills : "",
    biography: p.showBiography ? p.biography : "",
    volunteering: p.showVolunteering ? p.volunteering : "",
  }));
  return NextResponse.json({
    me: { name: actor.name, role: actor.role, personRef: identity?.personRef ?? null },
    profile: profile ? { displayName: profile.displayName, city: profile.city, biography: profile.biography, skills: profile.skills, volunteering: profile.volunteering, showCity: profile.showCity, showSkills: profile.showSkills, showBiography: profile.showBiography, showVolunteering: profile.showVolunteering } : null,
    directory,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const actor = await getFamilyActor();
  if (!actor) return deny();
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "صيغة غير صحيحة" }, { status: 415 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "المصدر غير موثوق" }, { status: 403 });
  const incoming = await req.json().catch(()=>null) as Record<string,unknown>|null;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const displayName = clamp(incoming.displayName, 140) || actor.name;
  const values = {
    displayName, city: clamp(incoming.city, 100), biography: clamp(incoming.biography, 1000),
    skills: clamp(incoming.skills, 600), volunteering: clamp(incoming.volunteering, 600),
    showCity: incoming.showCity === true, showSkills: incoming.showSkills === true,
    showBiography: incoming.showBiography === true, showVolunteering: incoming.showVolunteering === true,
    updatedAt: new Date().toISOString(),
  };
  await getDb().insert(memberProfiles).values({ userId: actor.userId, ...values }).onConflictDoUpdate({target:memberProfiles.userId,set:values});
  return NextResponse.json({ok:true});
}
