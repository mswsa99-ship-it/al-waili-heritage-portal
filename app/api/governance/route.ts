import {NextRequest,NextResponse} from 'next/server';
import {getFamilyActor} from '@/lib/family-access';
import {query,siteDb,sameOrigin} from '@/lib/site-db';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(req:NextRequest){
 const actor=await getFamilyActor();if(!actor||(!actor.isOwner&&actor.role!=='central'))return reply({error:'لإدارة البوابة فقط'},403);
 if(req.nextUrl.searchParams.get('export')==='backup'){
  if(!actor.isOwner)return reply({error:'النسخة الكاملة لمالك البوابة فقط'},403);
  const tables=(await query("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '__drizzle%' ORDER BY name").all<{name:string;sql:string}>()).results.filter(t=>/^[a-zA-Z][a-zA-Z0-9_]*$/.test(t.name));
  const results=await siteDb().batch(tables.map(t=>query(`SELECT * FROM "${t.name}" LIMIT 10001`)));
  if(results.some(r=>r.results.length>10000))return reply({error:'تجاوز جدول حد التصدير؛ استخدم نسخة قاعدة البيانات الكاملة من إعدادات الاستضافة'},413);
  const payload={format:'al-wayli-backup-v1',createdAt:new Date().toISOString(),tables:tables.map((t,i)=>({name:t.name,schema:t.sql,rows:results[i].results}))};
  const body=JSON.stringify(payload);if(new TextEncoder().encode(body).length>16000000)return reply({error:'النسخة أكبر من حد التنزيل؛ استخدم تصدير الاستضافة'},413);
  return new NextResponse(body,{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="al-wayli-private-backup.json"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const [audit,lineage,members,counts]=await Promise.all([
  query('SELECT id,actor_id,action,subject_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 200').all(),
  query('SELECT id,actor_id,event AS action,entity_id AS subject_id,at AS created_at FROM lineage_work_audit ORDER BY at DESC LIMIT 200').all(),
  actor.isOwner?query('SELECT id,name,role,status,person_ref FROM members ORDER BY name').all():Promise.resolve({results:[]}),
  query("SELECT (SELECT COUNT(*) FROM members WHERE status='active') AS active_members,(SELECT COUNT(*) FROM working_tree_people WHERE active=1) AS active_people,(SELECT COUNT(*) FROM lineage_work_requests WHERE status='pending') AS pending_lineage,(SELECT COUNT(*) FROM member_tasks WHERE status NOT IN ('completed')) AS open_tasks,(SELECT COUNT(*) FROM family_programs WHERE status='published') AS active_programs").first()
 ]);
 const events=[...audit.results,...lineage.results].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,200);
 return reply({events,members:members.results,counts,canManageRoles:actor.isOwner,canBackup:actor.isOwner});
}
export async function POST(req:NextRequest){
 const actor=await getFamilyActor();if(!actor?.isOwner)return reply({error:'تغيير الأدوار لمالك البوابة فقط'},403);
 if(!sameOrigin(req))return reply({error:'مصدر غير مصرح'},403);
 const b=await req.json().catch(()=>null) as {action?:string;role?:string;id?:string}|null;if(!b||b.action!=='member.role'||!['central','council','secretary','genealogy','branch','social','oversight','member'].includes(b.role||''))return reply({error:'دور أو إجراء غير صالح'},400);
 const member=await query('SELECT id,user_id,status,person_ref,minor FROM members WHERE id=?',String(b.id||'')).first<{id:string;user_id:string;status:string;person_ref:string;minor:number}>();
 if(!member||member.status!=='active'||member.minor||member.user_id===actor.userId)return reply({error:'يلزم عضو نشط آخر بالغ'},409);
 if(!await query('SELECT person_id FROM genealogy_records WHERE person_id=? AND active=1 AND living=1 AND minor=0',member.person_ref).first())return reply({error:'لا يوجد سجل شخص مؤهل مرتبط بالعضوية'},409);
 await siteDb().batch([query('UPDATE members SET role=? WHERE id=?',b.role!,member.id),query('INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),actor.userId,'member.role.'+b.role,member.id,new Date().toISOString())]);return reply({ok:true});
}
