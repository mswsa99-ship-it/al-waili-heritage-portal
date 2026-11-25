import {NextRequest,NextResponse} from "next/server";
import {query,sameOrigin} from "@/lib/site-db";
import {getFamilyActor,isCommittee} from "@/lib/family-access";
import {linkEnabled} from "@/lib/tree-link";
import {notifyTreeChange} from "@/lib/tree-hub";

export const dynamic="force-dynamic";
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{"Cache-Control":"private, no-store"}});

// The live link from the primary tree to the member view can be stopped and
// resumed only by the portal owner and the lineage committee. The state is
// the latest tree_link.* audit event; no event means the link is on.
export async function GET(){
  const actor=await getFamilyActor();
  if(!actor)return reply({error:"الدخول بعضوية مفعلة مطلوب"},403);
  // Tiny version token for open pages: the draft revision number plus the link state, no names.
  const d=await query("SELECT revision FROM tree_draft WHERE id='family-tree-working-draft'").first<{revision:number}>();
  return reply({enabled:await linkEnabled(),canManage:isCommittee(actor)||actor.isOwner,revision:d?.revision??null});
}
export async function POST(req:NextRequest){
  if(!sameOrigin(req))return reply({error:"مصدر غير مصرح"},403);
  const actor=await getFamilyActor();
  if(!actor||!(isCommittee(actor)||actor.isOwner))return reply({error:"إيقاف الربط واستئنافه محصور بالمالك ولجنة الأنساب"},403);
  const body=await req.json().catch(()=>null) as {enabled?:unknown}|null;
  if(!body||typeof body.enabled!=="boolean")return reply({error:"الحالة مطلوبة"},400);
  const now=new Date().toISOString();
  await query("INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),actor.userId,body.enabled?'tree_link.resume':'tree_link.pause','family-tree-working-draft',now).run();
  await notifyTreeChange();
  return reply({enabled:body.enabled});
}
