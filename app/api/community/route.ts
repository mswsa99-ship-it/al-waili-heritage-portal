import {NextRequest,NextResponse} from 'next/server';
import {getFamilyActor} from '@/lib/family-access';
import {siteDb,query,sameOrigin} from '@/lib/site-db';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const text=(v:unknown,max=3000)=>typeof v==='string'?v.trim().slice(0,max):'';
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export async function GET(){
 const a=await getFamilyActor();if(!a)return reply({error:'العضوية مطلوبة'},403);
 const admin=['central','council','secretary'].includes(a.role);
 const [programs,meetings,participants]=await Promise.all([
  (admin?query('SELECT * FROM family_programs'):query("SELECT id,title,kind,body,starts_at,status FROM family_programs WHERE status='published'")).all(),
  admin?query('SELECT * FROM council_meetings ORDER BY held_at DESC').all():Promise.resolve({results:[]}),
  query('SELECT program_id,note FROM program_participants WHERE user_id=?',a.userId).all(),
 ]);
 const roster=admin?(await query("SELECT p.program_id,p.user_id,p.note,p.created_at,COALESCE(m.name,'مشارك') AS name FROM program_participants p LEFT JOIN members m ON m.user_id=p.user_id ORDER BY p.created_at DESC").all()).results:[];
 return reply({programs:programs.results,meetings:meetings.results,participants:participants.results,roster,canManage:admin,actorId:a.userId});
}
export async function POST(req:NextRequest){
 const a=await getFamilyActor();if(!a)return reply({error:'العضوية مطلوبة'},403);
 if(!sameOrigin(req))return reply({error:'مصدر غير مصرح'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'صيغة JSON مطلوبة'},415);
 const raw=await req.text();if(raw.length>18000)return reply({error:'الطلب طويل'},413);
 let b:Record<string,unknown>;try{b=JSON.parse(raw)}catch{return reply({error:'تعذر قراءة الطلب'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'بيانات الطلب غير صحيحة'},400);
 const action=text(b.action,30),admin=['central','council','secretary'].includes(a.role);
 const id=text(b.id,90)||crypto.randomUUID(),time=new Date().toISOString();let write:D1PreparedStatement;
 let condition:string|null=null,params:(string|number|null)[]=[];
 if(action==='program.create'){
  if(!admin)return reply({error:'للإدارة فقط'},403);
  if(!text(b.title)||!['volunteer','education','mentoring','honor','initiative'].includes(text(b.kind)))return reply({error:'بيانات البرنامج غير صحيحة'},400);
  const startsAt=text(b.startsAt,32);if(startsAt&&!validDate(startsAt))return reply({error:'تاريخ البرنامج غير صالح'},400);
  write=query('INSERT INTO family_programs(id,title,kind,body,status,starts_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',id,text(b.title,180),text(b.kind),text(b.body,6000),'draft',startsAt||null,a.userId,time);
 }else if(action==='program.publish'){
  if(!admin||b.confirmPrivacy!==true)return reply({error:'يلزم مسؤول وتأكيد الخصوصية'},403);
  if(typeof b.published!=='boolean')return reply({error:'حالة النشر غير صحيحة'},400);
  const program=await query('SELECT status FROM family_programs WHERE id=?',id).first<{status:string}>();if(!program)return reply({error:'البرنامج غير موجود'},404);
  const status=b.published?'published':'draft';if(program.status===status)return reply({error:'البرنامج في الحالة المطلوبة بالفعل'},409);
  condition='EXISTS(SELECT 1 FROM family_programs WHERE id=? AND status=?)';params=[id,program.status];
  write=query('UPDATE family_programs SET status=? WHERE id=?',status,id);
 }else if(action==='program.join'){
  if(!await query("SELECT id FROM family_programs WHERE id=? AND status='published'",id).first())return reply({error:'البرنامج غير متاح'},404);
  condition="EXISTS(SELECT 1 FROM family_programs WHERE id=? AND status='published')";params=[id];
  write=query('INSERT INTO program_participants(program_id,user_id,note,created_at) VALUES(?,?,?,?) ON CONFLICT(program_id,user_id) DO UPDATE SET note=excluded.note',id,a.userId,text(b.note,1000),time);
 }else if(action==='program.leave'){
  write=query('DELETE FROM program_participants WHERE program_id=? AND user_id=?',id,a.userId);
 }else if(action==='meeting.create'){
  if(!admin)return reply({error:'للأمانة والمجلس فقط'},403);
  const heldAt=text(b.heldAt,32);if(!text(b.title)||!validDate(heldAt))return reply({error:'العنوان والتاريخ الصحيح مطلوبان'},400);
  write=query('INSERT INTO council_meetings(id,title,held_at,minutes,decisions,status,author_id,created_at) VALUES(?,?,?,?,?,?,?,?)',id,text(b.title,180),heldAt,text(b.minutes,6000),text(b.decisions,4000),'draft',a.userId,time);
 }else if(action==='meeting.approve'){
  if(!admin)return reply({error:'للمجلس فقط'},403);
  const row=await query('SELECT author_id,status FROM council_meetings WHERE id=?',id).first<{author_id:string;status:string}>();
  if(!row||row.author_id===a.userId||row.status!=='draft')return reply({error:'يلزم محضر مسودة ومراجع مستقل'},409);
  condition="EXISTS(SELECT 1 FROM council_meetings WHERE id=? AND status='draft' AND author_id<>?)";params=[id,a.userId];
  write=query("UPDATE council_meetings SET status='approved',approved_by=? WHERE id=?",a.userId,id);
 }else return reply({error:'إجراء غير معروف'},400);
 const lock=crypto.randomUUID();
 const writes=[write,query('INSERT INTO audit_log(id,actor_id,action,subject_id,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),a.userId,action,id,time)];
 if(condition){writes.unshift(query(`INSERT INTO lineage_work_guard(id,ok) VALUES(?,CASE WHEN (${condition}) THEN 1 ELSE 0 END)`,lock,...params));writes.push(query('DELETE FROM lineage_work_guard WHERE id=?',lock));}
 try{await siteDb().batch(writes);return reply({ok:true})}catch{return reply({error:'تغير السجل أثناء العملية أو تعذر الحفظ؛ حدّث البيانات وأعد المحاولة'},409)}
}
