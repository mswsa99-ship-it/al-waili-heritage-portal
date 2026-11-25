import {getFamilyActor} from '@/lib/family-access';
import {originalRecord} from '@/lib/historical-record';
export const dynamic='force-dynamic';
export async function GET(){const actor=await getFamilyActor();if(!actor||(!actor.isOwner&&!['central','genealogy'].includes(actor.role)))return Response.json({error:'هذا الأصل يتضمن سجلًا إداريًا؛ يلزم حساب مخوّل.'},{status:403,headers:{'Cache-Control':'private, no-store'}});return new Response(originalRecord(),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="al-wayli-historical-record-2026-11-01.md"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
