import { env } from 'cloudflare:workers';
import { NextRequest,NextResponse } from 'next/server';
import { getFamilyActor } from '@/lib/family-access';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!env.DB)return new NextResponse('Unavailable',{status:503});
 const actor=await getFamilyActor();if(!actor)return new NextResponse('Forbidden',{status:403});
 const requestId=req.nextUrl.searchParams.get('requestId');
 if(requestId){
  const row=await env.DB.prepare('SELECT author_id,proposal_json FROM lineage_work_requests WHERE id=?').bind(requestId).first<{author_id:string;proposal_json:string}>();
  if(!row||!(actor.isOwner||actor.role==='central'||actor.role==='genealogy'||row.author_id===actor.userId))return new NextResponse('Forbidden',{status:403});
  const photo=JSON.parse(row.proposal_json).photo;
  if(!photo)return new NextResponse('Not found',{status:404});
  return new NextResponse(Uint8Array.from(atob(photo.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':photo.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }
 const id=req.nextUrl.searchParams.get('personId')||'';
 if(!/^(N\d{3}|P-[a-z0-9-]{36})$/i.test(id))return new NextResponse('Invalid',{status:400});
 const privileged=actor.isOwner||actor.role==='central'||actor.role==='genealogy';
 const self=await env.DB.prepare("SELECT 1 FROM members WHERE user_id=? AND person_ref=? AND status='active' AND minor=0").bind(actor.userId,id).first();
 if(!privileged&&!self)return new NextResponse('Forbidden',{status:403});
 const active=await env.DB.prepare('SELECT 1 FROM working_tree_people WHERE id=? AND active=1').bind(id).first();if(!active)return new NextResponse('Not found',{status:404});
 const photo=await env.DB.prepare('SELECT mime_type,base64_data FROM lineage_work_photos WHERE person_id=?').bind(id).first<{mime_type:string;base64_data:string}>();
 if(!photo)return new NextResponse('Not found',{status:404});
 const bytes=Uint8Array.from(atob(photo.base64_data),c=>c.charCodeAt(0));
 return new NextResponse(bytes,{status:200,headers:{'Content-Type':photo.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
