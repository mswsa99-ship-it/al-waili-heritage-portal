import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const retired=()=>NextResponse.json({error:'انتقل إلى مساحة عائلتي؛ دُمج سجل العمل والتفويضات في المسار الموحد.'},{status:410,headers:{'Cache-Control':'private, no-store'}});
export const GET=retired;
export const POST=retired;
