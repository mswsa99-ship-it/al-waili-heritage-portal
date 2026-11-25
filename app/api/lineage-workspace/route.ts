import { env } from 'cloudflare:workers';
import {notifyTreeChange} from "@/lib/tree-hub";
import { NextRequest, NextResponse } from 'next/server';
import { resolveHeritageRootId } from '@/lib/heritage-tree-layout';
import approved from '@/private/corrected-lineage-2026-10-29.json';
import baseline from '@/private/lineage-import-baseline.json';
import { getFamilyActor } from '@/lib/family-access';
import { basicSummary, descendants, fields, parsePrivatePhoto, safeProfile, shortText, validateTree, type CorrectedEntry, type WorkEntry } from '@/lib/lineage-workflow';
import {manages,reviews,validateRelation,taskTransition} from '@/lib/lineage-policy';
import { sendMail } from '@/lib/mailer';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const fail=(error:string,status=400)=>respond({error},status);
const now=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const sha256Hex=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
const seed=approved.records as CorrectedEntry[];
validateTree(seed);
const db=()=>{if(!env.DB)throw Error("قاعدة البيانات غير متاحة");return env.DB;};
const stmt=(sql:string,...args:(string|number|null)[])=>db().prepare(sql).bind(...args);
type Grant={id:string;delegate_person_id:string;root_person_id:string;permissions_json:string;status:string;expires_at:string|null};
type SnapshotPerson=WorkEntry & {source_note?:string};
type Change={id:string;operation:string;person_id:string;parent_id:string|null;proposal_json:string;expected_revision:number|null;grant_id:string|null;author_id:string;status:string;created_at:string};
type Task={id:string;delegate_person_id:string;root_person_id:string;title:string;status:string;report:string;updated_by:string;due_at:string|null};
const getPeople=async()=> (await db().prepare("SELECT *,id AS person_id,CAST(NULLIF(birth_year,'') AS INTEGER) AS birth_year,CAST(NULLIF(death_year,'') AS INTEGER) AS death_year FROM working_tree_people ORDER BY id").all<SnapshotPerson>()).results;
const allGrants=async()=> (await db().prepare('SELECT * FROM lineage_work_delegations ORDER BY issued_at DESC').all<Grant>()).results;
const memberFor=async(id:string)=>stmt("SELECT m.user_id FROM members m JOIN genealogy_records g ON g.person_id=m.person_ref WHERE m.person_ref=? AND m.status='active' AND m.minor=0 AND g.active=1 AND g.living=1 AND g.minor=0",id).first<{user_id:string}>();
async function grantsFor(userId:string){const out:Grant[]=[];for(const g of await allGrants()){if(g.status==='active'&&(!g.expires_at||g.expires_at>now())&&(await memberFor(g.delegate_person_id))?.user_id===userId)out.push(g);}return out;}
const audit=(actor:string,event:string,id:string,info:unknown={})=>stmt('INSERT INTO lineage_work_audit(id,actor_id,event,entity_id,details_json,at) VALUES(?,?,?,?,?,?)',uuid(),actor,event,id,JSON.stringify(info),now());
// A CHECK constraint makes stale guards abort the entire D1 batch, including the audit.
async function atomic(condition:string,params:(string|number|null)[],writes:D1PreparedStatement[]){const id=uuid();await db().batch([stmt(`INSERT INTO lineage_work_guard(id,ok) VALUES(?,CASE WHEN (${condition}) THEN 1 ELSE 0 END)`,id,...params),...writes,stmt('DELETE FROM lineage_work_guard WHERE id=?',id)]);}
function importPlan(people:WorkEntry[]){const map=new Map(people.map(p=>[p.person_id,p]));const before=new Map(baseline.people.map(p=>[p.id,p]));const ids=new Set(seed.map(p=>p.id));
 const missing=seed.filter(p=>!map.has(p.id));const changes=seed.filter(p=>{const c=map.get(p.id);return c&&(c.name!==p.name||c.parent_id!==p.parent||!c.active)});const conflicts=changes.filter(p=>{const c=map.get(p.id)!,b=before.get(p.id);return !b||c.revision!==b.revision||c.name!==b.name||c.parent_id!==b.parent_id||!c.active});
 const removed=baseline.people.filter(p=>!ids.has(p.id)&&map.get(p.id)?.active);return {missing,changes,conflicts,removed};}
export async function GET(){const a=await getFamilyActor();if(!a)return fail('الدخول بعضوية مفعّلة مطلوب',403);
 try{const people=await getPeople(),grants=await grantsFor(a.userId),manager=manages(a),reviewer=reviews(a);if(!manager&&!reviewer&&!grants.length)return fail('لا توجد صلاحية لإدارة سجل الأجيال',403);
 const scope=new Set<string>();for(const g of grants)for(const id of descendants(people,g.root_person_id))scope.add(id);
 const visible=people.filter(p=>manager||reviewer||scope.has(p.person_id));
 const requests=(await db().prepare('SELECT * FROM lineage_work_requests ORDER BY created_at DESC').all<Change>()).results.filter(r=>manager||reviewer||r.author_id===a.userId);
 const tasks=(await db().prepare('SELECT * FROM lineage_work_tasks ORDER BY updated_at DESC').all<Task>()).results.filter(t=>manager||reviewer||grants.some(g=>g.delegate_person_id===t.delegate_person_id&&descendants(people,g.root_person_id).has(t.root_person_id)));
 const map=new Map(people.map(p=>[p.person_id,p]));const generation=(id:string)=>{let at:string|null=id,n=0;const seen=new Set<string>();while(at&&!seen.has(at)){seen.add(at);n++;at=map.get(at)?.parent_id||null;}return n;};
 const draftState=manager?await db().prepare("SELECT revision FROM tree_draft WHERE id='family-tree-working-draft'").first<{revision:number}>():null;const plan=importPlan(people);const heritageRoot=(()=>{try{return resolveHeritageRootId(people.map(p=>({id:p.person_id,name:p.name,parentId:p.parent_id})))}catch{return ''}})();const branchStats=(manager||reviewer)?people.filter(p=>p.parent_id===heritageRoot&&p.active).map(b=>{const ids=descendants(people,b.person_id),rows=people.filter(p=>p.active&&ids.has(p.person_id));const complete=rows.filter(p=>p.birth_year&&p.education&&p.profession&&p.city).length;return {id:b.person_id,name:b.name,count:rows.length,missingBirth:rows.filter(p=>!p.birth_year).length,reviewPending:rows.filter(p=>p.review_status!=='تمت المطابقة'||p.reading_status==='تحتاج مراجعة').length,pendingChanges:requests.filter(r=>r.status==='pending'&&(ids.has(r.person_id)||Boolean(r.parent_id&&ids.has(r.parent_id)))).length,completion:Math.round(100*complete/Math.max(1,rows.length)),approvedTasks:tasks.filter(t=>ids.has(t.root_person_id)&&t.status==='approved').length};}):[];
 // Account-link status for the appointment flow (manager only): which tree
 // persons are in the official registry (account-eligible) and which already
 // have a member file. Read-only; never exposes emails here.
 const accounts=manager?{official:(await db().prepare('SELECT person_id FROM genealogy_records WHERE active=1 AND living=1 AND minor=0').all<{person_id:string}>()).results.map(r=>r.person_id),memberStatus:Object.fromEntries((await db().prepare('SELECT person_ref,status FROM members').all<{person_ref:string;status:string}>()).results.map(r=>[r.person_ref,r.status])),inviteDelivery:Object.fromEntries((await db().prepare("SELECT m.person_ref,t.delivery,t.member_id FROM member_invite_tokens t JOIN members m ON m.id=t.member_id WHERE t.consumed_at IS NULL ORDER BY t.rowid ASC").all<{person_ref:string;delivery:string;member_id:string}>()).results.map(r=>[r.person_ref,{delivery:r.delivery,memberId:r.member_id}]))}:undefined;
 return respond({actor:{name:a.name,role:a.role,isOwner:a.isOwner,userId:a.userId},accounts,people:visible.map(p=>({person_id:p.person_id,parent_id:p.parent_id,name:p.name,gender:p.gender,birth_year:p.birth_year,death_year:p.death_year,education:p.education,city:p.city,profession:p.profession,position:p.position,phone:manager||reviewer||a.personId===p.person_id?p.phone:'',email:manager||reviewer||a.personId===p.person_id?p.email:'',active:p.active,revision:p.revision,review_status:p.review_status,reading_status:p.reading_status,generation:generation(p.person_id)})),summary:{...basicSummary(visible),reviewPending:visible.filter(p=>p.active&&(p.review_status!=='تمت المطابقة'||p.reading_status==='تحتاج مراجعة')).length,tasks:tasks.length,pendingRequests:requests.filter(r=>r.status==='pending').length},delegations:manager||reviewer?await allGrants():grants,requests:requests.map(r=>{const p=JSON.parse(r.proposal_json);if(!manager&&!reviewer){if(p.profile){delete p.profile.phone;delete p.profile.email;}if(p.before?.profile){delete p.before.profile.phone;delete p.before.profile.email;}if(Array.isArray(p.changedFields))p.changedFields=p.changedFields.filter((d:{field:string})=>!['phone','email'].includes(d.field));}return {...r,proposal_json:undefined,proposal:{...p,photo:p.photo?{present:true}:null}};}),tasks,branchStats,importPreview:manager?{baselineRevision:baseline.draftRevision,currentRevision:draftState?.revision??null,draftChanged:draftState?.revision!==baseline.draftRevision,missing:plan.missing.length,conflicts:plan.conflicts.length,updates:plan.changes.length,archived:plan.removed.length,identical:seed.length-plan.missing.length-plan.changes.length}:undefined,lastImport:manager?await db().prepare('SELECT * FROM lineage_work_import_runs ORDER BY executed_at DESC LIMIT 1').first():null,needsImport:people.length===0});
 }catch(e){console.error('lineage read failed',e);return fail('تعذر قراءة سجل الأجيال. تأكد من تطبيق الترحيل.',503);}}
export async function POST(req:NextRequest){const a=await getFamilyActor();if(!a)return fail('الدخول بعضوية مفعّلة مطلوب',403);
 const origin=req.headers.get('origin');if(origin){try{if(new URL(origin).host!==req.headers.get('host'))return fail('مصدر غير مصرح',403);}catch{return fail('مصدر غير صالح',403);}}
 if(!req.headers.get('content-type')?.startsWith('application/json'))return fail('صيغة JSON مطلوبة',415);
 const raw=await req.text();if(raw.length>510000)return fail('الطلب أكبر من المسموح',413);
 try{const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return fail('بيانات غير صحيحة');const action=shortText(body.action,45),people=await getPeople(),map=new Map(people.map(p=>[p.person_id,p])),grants=await grantsFor(a.userId);const manager=manages(a),reviewer=reviews(a);
 if(action==='import_preview'||action==='import_apply'){
  if(!manager)return fail('الإدارة فقط',403);const p=importPlan(people);
  if(action==='import_preview')return respond({missing:p.missing.length,updates:p.changes.length,archived:p.removed.length,conflicts:p.conflicts.map(x=>({id:x.id,current:map.get(x.id)?.name,approved:x.name})),policy:'مسودة الشجرة الحالية 181 سجلًا؛ تحفظ البيانات الشخصية والتغييرات المتزامنة'});
  if(p.conflicts.length)return fail('تغيّرت سجلات منذ النسخة الاحتياطية؛ راجع فروقات الاستيراد قبل تطبيقها',409);
  const draft=await db().prepare("SELECT revision,records_json FROM tree_draft WHERE id='family-tree-working-draft'").first<{revision:number;records_json:string}>();
  const already=await stmt('SELECT id FROM lineage_work_import_runs WHERE checksum=?',approved.exportedAt).first();if(already)return respond({ok:true,message:'سبق تطبيق هذا الملف المعتمد، لم تتكرر العملية'});
  if(draft&&draft.revision!==baseline.draftRevision)return fail('المسودة الحية تغيرت بعد النسخة الاحتياطية؛ يلزم مقارنة أحدث قبل الاستيراد',409);
  const writes:D1PreparedStatement[]=[];const stamp=now();const combined=seed.map(r=>({id:r.id,name:r.name,parent:r.parent}));validateTree(combined.map(r=>({...r,review:'',reading:''})));
  for(const r of seed){const old=map.get(r.id);if(old){writes.push(stmt('UPDATE working_tree_people SET name=?,parent_id=?,review_status=?,reading_status=?,source_version=?,revision=revision+1,updated_at=? WHERE id=?',r.name,r.parent,r.review,r.reading,approved.exportedAt,stamp,r.id));}else{writes.push(stmt('INSERT INTO working_tree_people(id,parent_id,name,gender,source_note,original_zone,review_status,reading_status,source_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',r.id,r.parent,r.name,'unknown',r.note||'',r.zone||'',r.review,r.reading,approved.exportedAt,stamp,stamp));}}
  for(const r of p.removed){if(people.some(x=>x.active&&x.parent_id===r.id))return fail('السجل المحذوف له أبناء؛ يلزم حل التعارض',409);writes.push(stmt('UPDATE working_tree_people SET active=0,revision=revision+1,updated_at=? WHERE id=?',stamp,r.id));}
  writes.push(stmt("UPDATE tree_draft SET records_json=?,positions_json=?,revision=revision+1,editor_id=?,updated_at=? WHERE id='family-tree-working-draft'",JSON.stringify(approved.records),JSON.stringify(approved.positions),a.userId,stamp));
  writes.push(stmt('INSERT INTO lineage_work_import_runs(id,checksum,inserted_count,existing_count,conflicting_count,executed_by,executed_at) VALUES(?,?,?,?,?,?,?)',uuid(),approved.exportedAt,p.missing.length,people.length,0,a.userId,stamp),audit(a.userId,'lineage.approved_file.import',approved.exportedAt,{active:seed.length,archived:p.removed.map(r=>r.id)}));
  // Guard every observed row as well as the draft so concurrent edits cannot be overwritten.
  const lock=uuid();const checks=people.map(r=>stmt('INSERT INTO lineage_work_guard(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM working_tree_people WHERE id=? AND revision=?) THEN 1 ELSE 0 END)',lock+'-'+r.person_id,r.person_id,r.revision));
  await atomic("NOT EXISTS(SELECT 1 FROM lineage_work_import_runs WHERE checksum=?) AND EXISTS(SELECT 1 FROM tree_draft WHERE id='family-tree-working-draft' AND revision=?)",[approved.exportedAt,baseline.draftRevision],[...checks,...writes,stmt('DELETE FROM lineage_work_guard WHERE id LIKE ?',lock+'-%')]);
  await notifyTreeChange();
  return respond({ok:true,inserted:p.missing.length,archived:p.removed.length,message:'تم تطبيق مسودة الشجرة الحالية: 181 سجلًا نشطًا، مع حفظ البيانات الشخصية وأرشفة الخانة المحذوفة'});
 }
 if(action==='delegate_prepare'){
  // Unified in-tree appointment: central picks the
  // branch root, then a representative strictly from that root's descendants
  // already in the tree. Email is mandatory: the save prepares the member file
  // and emails a private activation link; the representative's first login sets
  // their password. The delegation stays pending_activation until the account
  // is active, and activation remains a separate explicit step.
  if(!manager)return fail('التفويض للإدارة فقط',403);
  const delegate=shortText(body.delegatePersonId,90),root=shortText(body.rootPersonId,90),expiry=shortText(body.expiresAt,32)||null;
  const email=shortText(body.email,160).toLowerCase();
  if(!map.get(delegate)?.active||!map.get(root)?.active||!descendants(people,root).has(delegate))return fail('المفوض يجب أن يكون شخصًا نشطًا ضمن الفرع');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return fail('البريد الإلكتروني إلزامي لتعيين الممثل؛ تصله عليه دعوة التفعيل');
  if(expiry&&(!/^\d{4}-\d\d-\d\d$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||expiry<now().slice(0,10)))return fail('تاريخ انتهاء غير صالح');
  const official=await stmt('SELECT name,branch FROM genealogy_records WHERE person_id=? AND active=1 AND living=1 AND minor=0',delegate).first<{name:string;branch:string}>();
  if(!official)return fail('يحتاج الشخص ترحيلًا إلى سجل النسب الرسمي بقرار لجنة قبل ربط حساب به');
  if(await stmt('SELECT id FROM members WHERE person_ref=?',delegate).first())return fail('يوجد ملف عضوية سابق لهذا الشخص؛ أكمل من مسار العضويات الحالي',409);
  if(await stmt('SELECT id FROM members WHERE email=?',email).first())return fail('هذا البريد مرتبط بملف عضوية آخر',409);
  const memberId=uuid(),grantId=uuid(),inviteId=uuid(),stamp=now();
  const token=crypto.randomUUID()+crypto.randomUUID();
  const base=req.headers.get('origin')||`https://${req.headers.get('host')}`;
  const link=`${base}/accept-invite#${token}`;
  // Mailbox-verified activation only: the link must travel by email. If the
  // send fails the invite stays pending_send, no token is ever disclosed for
  // manual handover, and the manager retries with resend_invite.
  const mail=await sendMail({to:email,subject:'دعوة تفعيل حسابك - بوابة الوايلي',text:`عُيّنت ممثلًا لفرعك في مشجرة أسرة الوايلي.\n\nافتح هذا الرابط الخاص خلال 7 أيام لتفعيل حسابك وتعيين كلمة مرورك:\n${link}\n\nالرابط يعمل مرة واحدة ويتحقق من ملكيتك لهذا البريد. إن لم تتوقع هذه الدعوة فتجاهل هذه الرسالة.`});
  const delivery=mail.sent?'emailed':'pending_send';
  await atomic("NOT EXISTS(SELECT 1 FROM lineage_work_delegations WHERE delegate_person_id=? AND root_person_id=? AND status!='revoked') AND NOT EXISTS(SELECT 1 FROM members WHERE person_ref=?)",[delegate,root,delegate],[
   stmt("INSERT INTO members(id,name,branch,person_ref,email,role,status,minor,created_at) VALUES(?,?,?,?,?,'member','invited',0,?)",memberId,official.name,official.branch||'',delegate,email,stamp),
   stmt("INSERT INTO lineage_work_delegations(id,delegate_person_id,root_person_id,permissions_json,status,issued_by,issued_at,expires_at,note) VALUES(?,?,?,?,'pending_activation',?,?,?,?)",grantId,delegate,root,'["add","edit","archive"]',a.userId,stamp,expiry,shortText(body.note,500)),
   stmt('INSERT INTO member_invite_tokens(id,member_id,token_hash,email,expires_at,created_by,delivery) VALUES(?,?,?,?,?,?,?)',inviteId,memberId,await sha256Hex(token),email,new Date(Date.now()+7*86400000).toISOString(),a.userId,delivery),
   audit(a.userId,'lineage.delegate.prepared',grantId,{delegate,root,member:memberId,delivery}),
  ]);
  if(!mail.sent)return respond({ok:true,id:grantId,memberId,mailSent:false,message:'حُفظ التعيين بانتظار التفعيل، لكن تعذر إرسال البريد الآن. أعد إرسال الدعوة من قائمة التفويضات عند توافر البريد؛ لا يُسلَّم رمز التفعيل يدويًا حفاظًا على تحقق الملكية.'});
  return respond({ok:true,id:grantId,memberId,mailSent:true,message:'حُفظ التفويض وأُرسلت دعوة التفعيل إلى بريد الممثل. يبقى بانتظار التفعيل حتى يفتح الرابط ويعيّن كلمة مروره.'});
 }
 if(action==='resend_invite'){
  // Manager retries delivery of an activation invite whose email never left
  // (delivery='pending_send'), or whose member email changed after issue.
  // Rotates the token, binds it to the member's current email, and only
  // marks it emailed when the provider actually accepts the send. The token
  // is never disclosed in the response.
  if(!manager)return fail('إعادة الإرسال للإدارة فقط',403);
  const memberId=shortText(body.memberId,90);
  const m=await stmt("SELECT id,email,status FROM members WHERE id=?",memberId).first<{id:string;email:string|null;status:string}>();
  if(!m||m.status!=='invited'||!m.email)return fail('لا توجد عضوية بانتظار التفعيل بهذا المعرّف',404);
  const tok=await stmt('SELECT id FROM member_invite_tokens WHERE member_id=? AND consumed_at IS NULL ORDER BY rowid DESC LIMIT 1',m.id).first<{id:string}>();
  if(!tok)return fail('لا توجد دعوة قائمة لهذه العضوية',404);
  const email=m.email.toLowerCase();
  const token=crypto.randomUUID()+crypto.randomUUID();
  const base=req.headers.get('origin')||`https://${req.headers.get('host')}`;
  const mail=await sendMail({to:email,subject:'دعوة تفعيل حسابك - بوابة الوايلي',text:`أُعيد إرسال دعوتك لتفعيل حسابك في بوابة أسرة الوايلي.\n\nافتح هذا الرابط الخاص خلال 7 أيام لتعيين كلمة مرورك:\n${base}/accept-invite#${token}\n\nالرابط يعمل مرة واحدة ويتحقق من ملكيتك لهذا البريد. إن لم تتوقع هذه الدعوة فتجاهل هذه الرسالة.`});
  const delivery=mail.sent?'emailed':'pending_send';
  await db().batch([stmt('UPDATE member_invite_tokens SET token_hash=?,email=?,expires_at=?,delivery=? WHERE id=?',await sha256Hex(token),email,new Date(Date.now()+7*86400000).toISOString(),delivery,tok.id),stmt('UPDATE member_invite_tokens SET consumed_at=? WHERE member_id=? AND consumed_at IS NULL AND id<>?',now(),m.id,tok.id),audit(a.userId,'lineage.invite.resent',tok.id,{member:m.id,delivery})]);
  if(!mail.sent)return respond({ok:true,mailSent:false,message:'ما زال إرسال البريد متعذرًا؛ بقيت الدعوة بانتظار الإرسال ولم يُسلَّم أي رمز.'});
  return respond({ok:true,mailSent:true,message:'أُعيد إرسال دعوة التفعيل إلى البريد الحالي للعضوية.'});
 }
 if(action==='delegate'||action==='activate_delegation'||action==='revoke_delegate'){
  if(!manager)return fail('التفويض للإدارة فقط',403);
  if(action==='delegate'){const delegate=shortText(body.delegatePersonId,90),root=shortText(body.rootPersonId,90),expiry=shortText(body.expiresAt,32)||null;if(!map.get(delegate)?.active||!map.get(root)?.active||!descendants(people,root).has(delegate))return fail('المفوض يجب أن يكون شخصًا نشطًا ضمن الفرع');if(expiry&&(!/^\d{4}-\d\d-\d\d$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||expiry<now().slice(0,10)))return fail('تاريخ انتهاء غير صالح');const id=uuid(),status=await memberFor(delegate)?'active':'pending_activation';await atomic("NOT EXISTS(SELECT 1 FROM lineage_work_delegations WHERE delegate_person_id=? AND root_person_id=? AND status!='revoked')",[delegate,root],[stmt('INSERT INTO lineage_work_delegations(id,delegate_person_id,root_person_id,permissions_json,status,issued_by,issued_at,expires_at,note) VALUES(?,?,?,?,?,?,?,?,?)',id,delegate,root,'["add","edit","archive"]',status,a.userId,now(),expiry,shortText(body.note,500)),audit(a.userId,'lineage.delegate',id)]);return respond({ok:true,id,status});}
  const id=shortText(body.grantId,90);const grant=await stmt('SELECT * FROM lineage_work_delegations WHERE id=?',id).first<Grant>();if(!grant)return fail('التفويض غير موجود',404);if(action==='activate_delegation'&&(grant.status!=='pending_activation'||!await memberFor(grant.delegate_person_id)))return fail('لا يوجد حساب بالغ موثق ومرتبط بنفس الشخص',409);const status=action==='revoke_delegate'?'revoked':'active';await atomic('EXISTS(SELECT 1 FROM lineage_work_delegations WHERE id=? AND status=?)',[id,grant.status],[stmt('UPDATE lineage_work_delegations SET status=? WHERE id=?',status,id),audit(a.userId,'lineage.delegate.'+status,id)]);return respond({ok:true});
 }
 if(action==='propose'){
  const op=shortText(body.operation,12);if(!['add','edit','archive'].includes(op))return fail('نوع طلب غير صالح');const id=op==='add'?'P-'+uuid():shortText(body.personId,90),old=map.get(id);const parent=Object.hasOwn(body,'parentId')?(shortText(body.parentId,90)||null):(old?.parent_id||null);validateRelation(people,id,parent,op);
  const grant=grants.find(g=>g.id===body.grantId);if(!manager&&!reviewer){if(!grant||!JSON.parse(grant.permissions_json).includes(op))return fail('لا يوجد تفويض مناسب',403);const ids=descendants(people,grant.root_person_id);if((op!=='add'&&!ids.has(id))||(parent&&!ids.has(parent))||(!parent&&op!=='archive'))return fail('الطلب خارج الفرع المفوض',403);}
  if(body.profile!==undefined&&(!body.profile||typeof body.profile!=='object'||Array.isArray(body.profile)))return fail('بيانات السجل غير صحيحة');
  const beforeProfile=old?Object.fromEntries(fields.map(field=>[field,old[field]])):null;
  const profile=op==='archive'?null:safeProfile(op==='edit'?{...beforeProfile,...body.profile}:body.profile);
  if(profile&&!manager&&!reviewer&&a.personId!==id){profile.phone=old?.phone||'';profile.email=old?.email||'';}
  const oldPhoto=old?await stmt('SELECT mime_type,base64_data FROM lineage_work_photos WHERE person_id=?',id).first<{mime_type:string;base64_data:string}>():null;
  const photo=op==='archive'?null:parsePrivatePhoto(body.photoData);
  const photoChanged=Boolean(photo&&(!oldPhoto||photo.mime!==oldPhoto.mime_type||photo.base64!==oldPhoto.base64_data));
  const sourceNote=Object.hasOwn(body,'sourceNote')?shortText(body.sourceNote,700):(old?.source_note||'');
  const changedFields:{field:string;before:unknown;after:unknown}[]=[];
  if(profile)for(const field of fields){const before=beforeProfile?.[field]??null;if(before!==profile[field])changedFields.push({field,before,after:profile[field]});}
  if((old?.parent_id??null)!==parent)changedFields.push({field:'parent_id',before:old?.parent_id??null,after:parent});
  if((old?.source_note||'')!==sourceNote)changedFields.push({field:'source_note',before:old?.source_note||'',after:sourceNote});
  if(photoChanged)changedFields.push({field:'photo',before:{present:Boolean(oldPhoto)},after:{present:true,replaced:Boolean(oldPhoto)}});
  if(op==='archive')changedFields.push({field:'active',before:1,after:0});
  if(op==='edit'&&!changedFields.length)return fail('لم تتغير بيانات السجل؛ عدّل حقلًا قبل إرسال الطلب');
  const before=old?{profile:beforeProfile,parentId:old.parent_id,sourceNote:old.source_note||'',photo:{present:Boolean(oldPhoto)},active:old.active,revision:old.revision}:null;
  const requestId=uuid();await db().batch([stmt('INSERT INTO lineage_work_requests(id,operation,person_id,parent_id,proposal_json,expected_revision,grant_id,author_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',requestId,op,id,parent,JSON.stringify({profile,photo:photoChanged?photo:null,sourceNote,before,changedFields}),old?.revision??null,grant?.id??null,a.userId,'pending',now()),audit(a.userId,'lineage.request.submit',requestId)]);return respond({ok:true,message:'حفظ الطلب للمراجعة؛ لم تتغير بيانات الشخص'});
 }
 if(action==='decide'){
  if(!reviewer)return fail('الاعتماد لمراجع الأنساب المستقل فقط',403);const id=shortText(body.requestId,90),decision=shortText(body.decision,30),note=shortText(body.note,600);if(!['approved','rejected','needs_information'].includes(decision)||note.length<5)return fail('يلزم قرار وسبب واضح');const r=await stmt('SELECT * FROM lineage_work_requests WHERE id=?',id).first<Change>();if(!r||r.status!=='pending')return fail('الطلب سبق التعامل معه',409);if(r.author_id===a.userId)return fail('لا يجوز اعتماد طلبك بنفسك',403);
  const writes:D1PreparedStatement[]=[];let guard="EXISTS(SELECT 1 FROM lineage_work_requests WHERE id=? AND status='pending')";const params:(string|number|null)[]=[id];
  if(decision==='approved'){validateRelation(people,r.person_id,r.parent_id,r.operation);const payload=JSON.parse(r.proposal_json);const p=r.operation==='archive'?null:safeProfile(payload.profile);const photo=payload.photo?parsePrivatePhoto('data:'+payload.photo.mime+';base64,'+payload.photo.base64):null;
   if(r.operation==='add'){guard+=' AND NOT EXISTS(SELECT 1 FROM working_tree_people WHERE id=?)';params.push(r.person_id);}else{guard+=' AND EXISTS(SELECT 1 FROM working_tree_people WHERE id=? AND revision=? AND active=1)';params.push(r.person_id,r.expected_revision);}
   if(r.parent_id){guard+=' AND EXISTS(SELECT 1 FROM working_tree_people WHERE id=? AND active=1)';params.push(r.parent_id);}
   if(r.operation==='archive'){guard+=' AND NOT EXISTS(SELECT 1 FROM working_tree_people WHERE parent_id=? AND active=1)';params.push(r.person_id);writes.push(stmt('UPDATE working_tree_people SET active=0,revision=revision+1,updated_at=? WHERE id=?',now(),r.person_id));}
   if(r.operation==='edit'&&p)writes.push(stmt('UPDATE working_tree_people SET parent_id=?,name=?,gender=?,birth_year=?,death_year=?,education=?,city=?,profession=?,phone=?,email=?,position=?,source_note=?,review_status=?,revision=revision+1,updated_at=? WHERE id=?',r.parent_id,p.name,p.gender,String(p.birth_year??''),String(p.death_year??''),p.education,p.city,p.profession,p.phone,p.email,p.position,payload.sourceNote??map.get(r.person_id)?.source_note??'','بانتظار توثيق لجنة الأنساب',now(),r.person_id));
   if(r.operation==='add'&&p)writes.push(stmt('INSERT INTO working_tree_people(id,parent_id,name,gender,birth_year,death_year,education,city,profession,phone,email,position,source_note,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',r.person_id,r.parent_id,p.name,p.gender,String(p.birth_year??''),String(p.death_year??''),p.education,p.city,p.profession,p.phone,p.email,p.position,payload.sourceNote??map.get(r.person_id)?.source_note??'','بانتظار توثيق لجنة الأنساب',now(),now()));
   if(photo)writes.push(stmt('INSERT INTO lineage_work_photos(person_id,mime_type,base64_data,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET mime_type=excluded.mime_type,base64_data=excluded.base64_data,updated_at=excluded.updated_at,updated_by=excluded.updated_by',r.person_id,photo.mime,photo.base64,now(),a.userId));
  }
  writes.push(stmt('UPDATE lineage_work_requests SET status=?,reviewer_id=?,decision_note=?,reviewed_at=? WHERE id=?',decision,a.userId,note,now(),id),audit(a.userId,'lineage.request.'+decision,id));await atomic(guard,params,writes);return respond({ok:true,message:'سُجل قرار المراجعة في سجل العمل؛ لا يغير سجل النسب الرسمي'});
 }
 if(action==='task_assign'){
  if(!manager)return fail('إسناد المهام للإدارة فقط',403);const delegate=shortText(body.delegatePersonId,90),root=shortText(body.rootPersonId,90),title=shortText(body.title,160),due=shortText(body.dueAt,32)||null;if(!map.get(delegate)?.active||!map.get(root)?.active||!descendants(people,root).has(delegate)||!title)return fail('بيانات المهمة غير صالحة');if(due&&!/^\d{4}-\d\d-\d\d$/.test(due))return fail('موعد غير صالح');const id=uuid(),date=now();await db().batch([stmt('INSERT INTO lineage_work_tasks(id,delegate_person_id,root_person_id,title,due_at,status,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id,delegate,root,title,due,'assigned',a.userId,a.userId,date,date),audit(a.userId,'lineage.task.assign',id)]);return respond({ok:true});
 }
 if(action==='task_update'){
  const id=shortText(body.taskId,90),status=shortText(body.status,30);const task=await stmt('SELECT * FROM lineage_work_tasks WHERE id=?',id).first<Task>();if(!task)return fail('المهمة غير موجودة',404);if(!manager&&!reviewer&&!grants.some(g=>g.delegate_person_id===task.delegate_person_id&&descendants(people,g.root_person_id).has(task.root_person_id)))return fail('المهمة خارج صلاحياتك',403);if(!taskTransition(task.status,status,manager||reviewer))return fail('انتقال حالة غير مسموح',409);if(status==='approved'&&task.updated_by===a.userId)return fail('يلزم مراجع مستقل لتقريرك',403);const report=shortText(body.report,1200)||task.report;if(status==='submitted'&&!report)return fail('تقرير الإنجاز مطلوب');await atomic('EXISTS(SELECT 1 FROM lineage_work_tasks WHERE id=? AND status=? AND updated_by=?)',[id,task.status,task.updated_by],[stmt('UPDATE lineage_work_tasks SET status=?,report=?,updated_by=?,updated_at=? WHERE id=?',status,report,a.userId,now(),id),audit(a.userId,'lineage.task.'+status,id)]);return respond({ok:true});
 }
 if(action==='direct_add'){
  // A branch delegate holding an active
  // committee-issued "add" grant adds a person straight from the tree,
  // horizontally (sibling of an existing person) or downward (child).
  // Kinship and branch derive from the tree position; the person shows as
  // pending until the lineage committee approves.
  const base=map.get(shortText(body.basePersonId,90));
  const direction=shortText(body.direction,10);
  if(!base||!base.active)return fail('الشخص المرجعي غير موجود في سجل العمل',404);
  if(direction!=='sibling'&&direction!=='child')return fail('اتجاه الإضافة يجب أن يكون شقيقًا أو ابنًا');
  const parentId=direction==='child'?base.person_id:base.parent_id;
  if(!parentId)return fail('لا يمكن إضافة شقيق لأصل السلسلة من هذا المسار');
  let grant:Grant|undefined;
  if(!manager&&!reviewer){
   grant=grants.find(g=>g.id===shortText(body.grantId,90));
   if(!grant||!JSON.parse(grant.permissions_json).includes('add'))return fail('يلزم تفويض إضافة ساري من لجنة الأنساب',403);
   const ids=descendants(people,grant.root_person_id);
   if(!ids.has(base.person_id)||!ids.has(parentId))return fail('الإضافة خارج نطاق التفويض',403);
  }
  const name=shortText(body.name,180);if(!name)return fail('الاسم إلزامي');
  const genderRaw=shortText(body.gender,10);const gender=['male','female','unknown'].includes(genderRaw)?genderRaw:'unknown';
  // Every person added from the tree has an email -
  // either the delegate fills the data with it (full-data path) or the person
  // completes their own data (self-completion path). The activation link is
  // emailed to that address; the «قيد الاعتماد» committee gate is unchanged.
  const inviteEmail=shortText(body.inviteEmail,160).toLowerCase();
  if(!inviteEmail||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail))return fail('بريد الشخص إلزامي؛ تصله عليه دعوة تفعيل حسابه');
  const yr=(v:unknown)=>{const t=shortText(v,8);return /^\d{4}$/.test(t)?t:'';};
  const prof={birth_year:yr(body.birthYear),death_year:yr(body.deathYear),education:shortText(body.education,250),city:shortText(body.city,120),profession:shortText(body.profession,160),phone:shortText(body.phone,28),position:shortText(body.position,180)};
  const id='P-'+uuid();
  validateRelation(people,id,parentId,'add');
  const stamp=now();const requestId=uuid();const token=uuid()+uuid();
  const tokenHash=await sha256Hex(token);
  const note=direction==='child'?`أضافه مفوض الفرع من الشجرة (ابن/ابنة ${base.name})`:`أضافه مفوض الفرع من الشجرة (شقيق/شقيقة ${base.name})`;
  await atomic("NOT EXISTS(SELECT 1 FROM working_tree_people WHERE id=?) AND EXISTS(SELECT 1 FROM working_tree_people WHERE id=? AND active=1)",[id,parentId],[
   stmt('INSERT INTO working_tree_people(id,parent_id,name,gender,birth_year,death_year,education,city,profession,phone,email,position,source_note,review_status,reading_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,parentId,name,gender,prof.birth_year,prof.death_year,prof.education,prof.city,prof.profession,prof.phone,inviteEmail,prof.position,note,'قيد الاعتماد','',stamp,stamp),
   stmt("INSERT INTO member_data_invites(id,person_id,token_hash,email,status,created_by,created_at,expires_at) VALUES(?,?,?,?,'issued',?,?,?)",requestId,id,tokenHash,inviteEmail,a.userId,stamp,new Date(Date.now()+14*86400000).toISOString()),
   audit(a.userId,'lineage.direct_add',id,{parent:parentId,direction,grant:grant?.id??null,prefilled:Object.values(prof).some(Boolean)})]);
  const baseUrl=req.headers.get('origin')||`https://${req.headers.get('host')}`;
  const mail=await sendMail({to:inviteEmail,subject:'دعوة استكمال بياناتك في مشجرة الوايلي',text:`أُضيف اسمك إلى مشجرة أسرة الوايلي بحالة «قيد الاعتماد» حتى اعتماد اللجنة.\n\nافتح هذا الرابط الخاص خلال 14 يومًا لتعيين كلمة مرورك واستكمال بياناتك:\n${baseUrl}/join#${token}\n\nالرابط يعمل مرة واحدة. إن لم تتوقع هذه الدعوة فتجاهل هذه الرسالة.`});
  if(!mail.sent)return respond({ok:true,personId:id,mailSent:false,inviteToken:token,message:'أُضيف بحالة «قيد الاعتماد» ويظهر في الشجرة حتى تعتمده اللجنة. تعذر إرسال البريد؛ سلّم رمز الدعوة لصاحبه بصورة خاصة، والتسليم اليدوي لا يتحقق من ملكية البريد.'});
  return respond({ok:true,personId:id,mailSent:true,message:'أُضيف بحالة «قيد الاعتماد» ويظهر في الشجرة حتى تعتمده اللجنة، وأُرسلت دعوة التفعيل إلى بريده.'});
 }
 if(action==='review_person'){
  if(!reviewer)return fail('اعتماد الإضافة لمراجع الأنساب فقط',403);
  const personId=shortText(body.personId,90);const decision=shortText(body.decision,12);const note=shortText(body.note,600);
  const person=map.get(personId);
  if(!person||person.review_status!=='قيد الاعتماد'||!person.active)return fail('لا يوجد شخص بحالة قيد الاعتماد بهذا المعرف',409);
  const addedBy=await stmt("SELECT actor_id FROM lineage_work_audit WHERE event='lineage.direct_add' AND entity_id=? ORDER BY at DESC LIMIT 1",personId).first<{actor_id:string}>();
  if(addedBy&&addedBy.actor_id===a.userId)return fail('لا يجوز اعتماد إضافتك بنفسك',403);
  if(decision==='approve'){
   await atomic("EXISTS(SELECT 1 FROM working_tree_people WHERE id=? AND review_status='قيد الاعتماد' AND active=1)",[personId],[
    stmt("UPDATE working_tree_people SET review_status='تمت المطابقة',revision=revision+1,updated_at=? WHERE id=?",now(),personId),
    audit(a.userId,'lineage.direct_add.approved',personId,{note})]);
   return respond({ok:true,message:'اعتُمدت الإضافة في سجل العمل. الترحيل إلى سجل النسب الرسمي يبقى بقرار اللجنة عبر مساره المعتاد.'});
  }
  // No archive/reject shortcut here: removing a pending addition goes through
  // the existing committee review queue (lineage_work_requests), which already
  // has its own authorized path. Only approval is part of the recorded flow.
  return fail('قرار غير صالح؛ الاعتماد فقط متاح من هذا المسار');
 }
 return fail('إجراء غير معروف');
 }catch(e){console.error('lineage write failed',e);const msg=e instanceof Error?e.message:'';if(/CHECK|constraint|UNIQUE/i.test(msg))return fail('تعارض مع تعديل متزامن؛ أعد تحميل البيانات ثم راجع الطلب',409);return fail(/نسب|أرشفة|الأب|السجل|سنة|الاسم|الصورة|البريد|رقم|الوالد/.test(msg)?msg:'تعذر تنفيذ الطلب؛ لم تُعتمد العملية',400);}}
