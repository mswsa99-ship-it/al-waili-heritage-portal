import {sameOrigin} from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, genealogyRecords, members, nominations, pendingInvitations } from "@/db/schema";
import { getFamilyActor, isCentral } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const deny=(message:string,status=403)=>NextResponse.json({error:message},{status});

export async function GET() {
  const actor=await getFamilyActor();
  if(!actor || !isCentral(actor)) return deny("لإدارة العضويات المركزية فقط");
  const db=getDb();
  const [queue,memberList]=await Promise.all([
    db.select().from(pendingInvitations).orderBy(desc(pendingInvitations.preparedAt)).limit(200),
    db.select().from(members).limit(350),
  ]);
  return NextResponse.json({
    invitations:queue.map(q=>({id:q.id,nominationId:q.nominationId,memberId:q.memberId,channel:q.channel,status:q.status,preparedAt:q.preparedAt})),
    members:memberList.map(m=>({id:m.id,name:m.name,branch:m.branch,personRef:m.personRef,role:m.role,status:m.status,minor:m.minor,phoneHint:m.phone?"•••"+m.phone.slice(-4):""})),
    delivery:{sms:false,email:false,authentication:"Email and password sign-in",readyForFamilyEnrollment:true},
  },{headers:{"Cache-Control":"no-store"}});
}

export async function POST(req:NextRequest) {
  const actor=await getFamilyActor();
  if(!actor || !isCentral(actor)) return deny("إصدار الدعوات للإدارة المركزية فقط");
  if (!sameOrigin(req)) return deny("مصدر غير موثوق");
  if(!req.headers.get("content-type")?.startsWith("application/json")) return deny("صيغة غير صحيحة",415);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body || body.action!=="prepare") return deny("العملية غير متاحة",400);
  const nominationId=typeof body.nominationId==="string"?body.nominationId.slice(0,100):"";
  const channel=body.channel==="email"?"email":"sms";
  const db=getDb();
  const nomination=(await db.select().from(nominations).where(eq(nominations.id,nominationId)).limit(1))[0];
  if(!nomination || nomination.status!=="nominated") return deny("يجب وجود ترشيح جديد معتمد من ممثل الفرع",409);
  const person=(await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId,nomination.personRef)).limit(1))[0];
  if(!person?.active||!person.living||person.minor) return deny("لا يمكن تجهيز دعوة قبل إثبات الشخص في سجل النسب المعتمد",409);
  if(channel==="email"&&(!nomination.email||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nomination.email))) return deny("البريد غير متوفر في هذا الترشيح",400);
  if((await db.select().from(members).where(eq(members.personRef,person.personId)).limit(1)).length) return deny("هذا الفرد مرتبط بسجل عضوية سابق",409);
  const memberId=crypto.randomUUID(),inviteId=crypto.randomUUID(),now=new Date().toISOString();
  try {
  await db.batch([
    db.insert(members).values({id:memberId,name:person.name,email:nomination.email,phone:nomination.phone,branch:nomination.branch,personRef:person.personId,role:"member",status:"awaiting_invitation",minor:person.minor,createdAt:now}),
    db.insert(pendingInvitations).values({id:inviteId,nominationId,memberId,channel,status:"awaiting_provider",preparedBy:actor.userId,preparedAt:now}),
    db.update(nominations).set({status:"awaiting_sms_provider"}).where(eq(nominations.id,nomination.id)),
    db.insert(auditLog).values({id:crypto.randomUUID(),actorId:actor.userId,action:"membership.invite_prepared",subjectId:inviteId,createdAt:now}),
  ]);
  } catch (error) {
    // Another request can prepare this same person after the preflight read.
    // The unique constraint rolls the entire batch back; expose a conflict.
    if ((await db.select({ id: members.id }).from(members).where(eq(members.personRef, person.personId)).limit(1)).length) {
      return deny("سبق تجهيز عضوية لهذا الفرد. حدّث القائمة قبل المحاولة مجددًا", 409);
    }
    throw error;
  }
  return NextResponse.json({ok:true,invitationId:inviteId,status:"awaiting_invitation",message:"تم تجهيز العضوية. اخترها من قائمة العضويات لإصدار رمز التفعيل الخاص؛ لم يرسل بريد تلقائيًا."});
}
