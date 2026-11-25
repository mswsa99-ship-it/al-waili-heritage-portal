import {NextRequest,NextResponse} from 'next/server';
import {getFamilyActor} from '@/lib/family-access';
import {query} from '@/lib/site-db';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('id')||'';
 const row=await query('SELECT h.visibility,h.contributor_id,h.reviewed_by,f.mime,f.data FROM heritage_items h JOIN private_attachments f ON f.id=h.attachment_id WHERE h.id=?',id).first<{visibility:string;contributor_id:string;reviewed_by:string|null;mime:string;data:string}>();
 if(!row||!['image/png','image/jpeg'].includes(row.mime))return new NextResponse('Not found',{status:404});
 if(row.visibility!=='public'||!row.reviewed_by){const actor=await getFamilyActor();if(!actor||!(actor.userId===row.contributor_id||['central','council'].includes(actor.role)||row.visibility==='members'))return new NextResponse('Forbidden',{status:403});}
 return new NextResponse(Uint8Array.from(atob(row.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':row.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
