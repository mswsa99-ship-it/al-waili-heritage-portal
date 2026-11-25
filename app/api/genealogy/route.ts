import {query, sameOrigin, siteDb} from "@/lib/site-db";
import {linkEnabled} from "@/lib/tree-link";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { corrections, genealogyRecords, members } from "@/db/schema";
import { getFamilyActor, isCommittee } from "@/lib/family-access";

export const dynamic = "force-dynamic";
const fail = (message: string, status=400) => NextResponse.json({error:message},{status,headers:{"Cache-Control":"private, no-store"}});
const safe = (v:unknown,max=200) => typeof v==="string" ? v.trim().slice(0,max):"";
const ROOT_NAME = "حمد بن محمد بن حمد بن عثمان بن ناصر";

export async function GET() {
  const actor=await getFamilyActor();
  if(!actor) return fail("الدخول بعضوية مفعلة مطلوب",403);
  const db = getDb();
  const records = await db.select().from(genealogyRecords).limit(2000);
  const linkedMember = (await db.select({personRef:members.personRef}).from(members).where(eq(members.userId,actor.userId)).limit(1))[0];
  const reviewAccess = isCommittee(actor) || actor.role === "central";
  const consumed = reviewAccess ? await query("SELECT subject_id FROM audit_log WHERE action='genealogy.decision_consumed'").all<{subject_id:string}>() : null;
  // Pending tree additions: a person added by
  // a branch delegate shows in the tree as «قيد الاعتماد» until the lineage
  // committee approves. Only name/gender/position link are exposed here.
  const pending = await query("SELECT id,parent_id,name,gender,created_at FROM working_tree_people WHERE review_status='قيد الاعتماد' AND active=1 ORDER BY created_at DESC LIMIT 500").all<{id:string;parent_id:string|null;name:string;gender:string;created_at:string}>();
  // Live primary tree (tree_draft), read on every request so any edit in the
  // editor shows here at once. Visible to every signed-in member as name + parent
  // link only, always tagged unreviewed. Nothing is copied or approved, and it
  // never becomes an approved record. The owner/committee can stop the link.
  let draftRecords:{personId:string;parentPersonId:string|null;name:string}[]|undefined, draftMeta:{revision:number;updatedAt:string}|undefined;
  const linkOn=await linkEnabled();
  if(linkOn){
    const d=await query("SELECT records_json,revision,updated_at FROM tree_draft WHERE id='family-tree-working-draft'").first<{records_json:string;revision:number;updated_at:string}>();
    if(d){try{const arr=JSON.parse(d.records_json) as {id?:unknown;name?:unknown;parent?:unknown}[];draftRecords=(Array.isArray(arr)?arr:[]).filter(r=>typeof r.id==="string"&&typeof r.name==="string"&&r.name.trim()).slice(0,3000).map(r=>({personId:"draft:"+String(r.id),parentPersonId:typeof r.parent==="string"&&r.parent?"draft:"+r.parent:null,name:String(r.name).trim().slice(0,200)}));draftMeta={revision:d.revision,updatedAt:d.updated_at};}catch{draftRecords=[];}}
  }
  return NextResponse.json({
    draftRecords, draftMeta, treeLink:{enabled:linkOn,canManage:actor.isOwner||isCommittee(actor)},
    consumedDecisionIds: reviewAccess ? [...new Set([...(consumed?.results||[]).map(r=>r.subject_id),...records.map(r=>r.decisionId)])] : undefined,
    pendingRecords: pending.results.map(r=>({personId:r.id,parentPersonId:r.parent_id,gender:r.gender,name:r.name,pending:true,addedAt:r.created_at})),
    records: records.filter(r=>r.active).map(r=>({
      personId:r.personId, parentPersonId:r.parentPersonId, parentRelation:r.parentRelation,
      gender:r.gender, branch:r.branch,
      name:r.minor && !reviewAccess ? "فرد قاصر من الأسرة" :
        r.living && !reviewAccess && !(actor.role === "branch" && actor.branch && actor.branch === r.branch) && linkedMember?.personRef !== r.personId ? "فرد من الأسرة (الاسم محجوب)" : r.name,
      living:r.living, minor:r.minor,
      approvedAt:r.approvedAt,
      decisionId:reviewAccess?r.decisionId:undefined,
    })),
    policy:{root:ROOT_NAME, approvedOnly:true, coversDaughters:true, livingNames:"restricted_pending_policy"},
  },{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(req:NextRequest) {
  const actor=await getFamilyActor();
  if(!actor || !isCommittee(actor)) return fail("اعتماد السجل محصور بلجنة الأنساب",403);
  if (!sameOrigin(req)) return fail("مصدر غير مصرح",403);
  if(!req.headers.get("content-type")?.startsWith("application/json")) return fail("صيغة غير صحيحة",415);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body || typeof body!=="object" || Array.isArray(body)) return fail("بيانات غير صالحة");
  const operation=safe(body.operation,10),decisionId=safe(body.decisionId,100),personId=safe(body.personId,100);
  if(!["create","update","archive"].includes(operation)||!decisionId) return fail("عملية أو قرار غير صالح");
  const db=getDb();
  const decision=(await db.select().from(corrections).where(eq(corrections.id,decisionId)).limit(1))[0];
  if(!decision || decision.status!=="approved") return fail("يجب صدور قرار اعتماد نهائي من اللجنة أولاً",409);
  if((await db.select().from(genealogyRecords).where(eq(genealogyRecords.decisionId,decisionId)).limit(1)).length) return fail("استُخدم هذا القرار لترحيل سجل سابق",409);
  const id=operation==="create"?(personId||decision.personRef):personId;
  if(!/^[A-Za-z0-9-]{1,100}$/.test(id)||decision.personRef!==id)return fail("معرف الشخص يجب أن يطابق مرجع قرار اللجنة",409);
  const existing=id?(await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId,id)).limit(1))[0]:null;
  if(operation==="create" && existing) return fail("معرّف الشخص مستخدم بالفعل",409);
  if(operation!=="create" && !existing) return fail("لا يوجد سجل معتمد لهذا الشخص",404);
  const now=new Date().toISOString();
  // Recheck all relational invariants in the write itself: asynchronous preflight
  // reads alone cannot protect against concurrent committee approvals.
  const decisionGuard = `EXISTS(SELECT 1 FROM genealogy_corrections WHERE id=? AND status='approved' AND person_ref=?)
    AND NOT EXISTS(SELECT 1 FROM genealogy_records WHERE decision_id=?)
    AND NOT EXISTS(SELECT 1 FROM audit_log WHERE action='genealogy.decision_consumed' AND subject_id=?)`;
  const decisionArgs = [decisionId,id,decisionId,decisionId];
  let write: ReturnType<typeof query>;
  if(operation==="archive") {
    const children=await db.select({active:genealogyRecords.active}).from(genealogyRecords).where(eq(genealogyRecords.parentPersonId,id));
    if(children.some(p=>p.active))return fail("لا يمكن أرشفة أصل له أبناء نشطون",409);
    write=query(`UPDATE genealogy_records SET active=0,decision_id=?,approved_at=? WHERE person_id=?
      AND ${decisionGuard} AND NOT EXISTS(SELECT 1 FROM genealogy_records WHERE parent_person_id=? AND active=1)`,
      decisionId,now,id,...decisionArgs,id);
  }else{
    const name=safe(body.name,180),gender=safe(body.gender,10);
    const parentPersonId=safe(body.parentPersonId,100)||null;
    const parentRelation=safe(body.parentRelation,10)||null;
    if(!name || !["male","female","unknown"].includes(gender)) return fail("الاسم والجنس مطلوبان");
    if(parentPersonId===id) return fail("لا يمكن ربط الشخص بنفسه");
    if(!parentPersonId && name!==ROOT_NAME) return fail("كل سجل جديد يحتاج صلة نسب معتمدة، باستثناء أصل النطاق");
    if(!parentPersonId && operation==="create") {
      const allExisting=await db.select({personId:genealogyRecords.personId,parentPersonId:genealogyRecords.parentPersonId,active:genealogyRecords.active}).from(genealogyRecords).limit(2000);
      if(allExisting.some(r=>!r.parentPersonId && r.active)) return fail("أصل نطاق المبادرة مُسجّل بالفعل",409);
    }
    if(parentPersonId && !["father","mother"].includes(parentRelation||"")) return fail("حدد صلة الأب أو الأم");
    if(parentPersonId) {
      const parent=(await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId,parentPersonId)).limit(1))[0];
      if(!parent?.active) return fail("صلة النسب تتطلب أصلًا معتمدًا");
      if(parentRelation==="father" && parent.gender==="female" || parentRelation==="mother" && parent.gender==="male") return fail("صلة الأب أو الأم لا تطابق بيانات الأصل");
      // Walk the approved lineage to prevent cycles when amending an existing record.
      let ancestor:typeof parent|undefined=parent;
      for(let depth=0;depth<100&&ancestor;depth++){
        if(ancestor.personId===id) return fail("التعديل يؤدي إلى دورة في شجرة النسب");
        if(!ancestor.parentPersonId) break;
        ancestor=(await db.select().from(genealogyRecords).where(eq(genealogyRecords.personId,ancestor.parentPersonId)).limit(1))[0];
      }
    }
    const lineageGuard = parentPersonId
      ? `EXISTS(SELECT 1 FROM genealogy_records WHERE person_id=? AND active=1 AND NOT(gender=?))
         AND NOT EXISTS(WITH RECURSIVE ancestors(person_id,parent_person_id) AS (
           SELECT person_id,parent_person_id FROM genealogy_records WHERE person_id=?
           UNION SELECT p.person_id,p.parent_person_id FROM genealogy_records p JOIN ancestors a ON p.person_id=a.parent_person_id
         ) SELECT 1 FROM ancestors WHERE person_id=?)`
      : `NOT EXISTS(SELECT 1 FROM genealogy_records WHERE parent_person_id IS NULL AND active=1 AND person_id<>?)`;
    const lineageArgs = parentPersonId
      ? [parentPersonId,parentRelation==="father"?"female":"male",parentPersonId,id] : [id];
    const values = [name,gender,parentPersonId,parentRelation,safe(body.branch,100),
      body.living===true || body.minor===true ? 1 : 0,body.minor===true ? 1 : 0,decisionId,now];
    if(operation==="create") {
      write=query(`INSERT INTO genealogy_records(person_id,name,gender,parent_person_id,parent_relation,branch,living,minor,decision_id,approved_at,active)
        SELECT ?,?,?,?,?,?,?,?,?,?,1 WHERE ${decisionGuard} AND ${lineageGuard}
        AND NOT EXISTS(SELECT 1 FROM genealogy_records WHERE person_id=?)`,id,...values,...decisionArgs,...lineageArgs,id);
    } else {
      write=query(`UPDATE genealogy_records SET name=?,gender=?,parent_person_id=?,parent_relation=?,branch=?,living=?,minor=?,decision_id=?,approved_at=?,active=1
        WHERE person_id=? AND ${decisionGuard} AND ${lineageGuard}`, ...values,id,...decisionArgs,...lineageArgs);
    }
  }
  const auditId=crypto.randomUUID();
  const results=await siteDb().batch([
    write,
    query(`INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1`,
      auditId,actor.userId,"genealogy."+operation,id,now),
    query(`INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_log WHERE id=?)`,
      crypto.randomUUID(),actor.userId,"genealogy.decision_consumed",decisionId,now,auditId),
  ]);
  if(!results[0].meta.changes) return fail("تغير السجل أو استُخدم القرار أثناء المراجعة؛ حدّث الصفحة وراجع صلة النسب",409);
  return NextResponse.json({ok:true,personId:id});
}
