import { eq } from "drizzle-orm";
import { getSessionUser, sessionSignInPath } from "@/app/session-auth";
import { getDb } from "@/db";
import { members } from "@/db/schema";
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) return <main style={{padding:40}}><a href={sessionSignInPath("/review")} target="_top">الدخول مطلوب</a></main>;
  let allowed = user.email.toLowerCase() === "msw.sa99@gmail.com";
  if (!allowed) {
    const record=(await getDb().select({role:members.role,status:members.status}).from(members).where(eq(members.userId,user.userId)).limit(1))[0];
    allowed=record?.status==="active"&&record.role==="genealogy";
  }
  if (!allowed) return <main style={{padding:50,textAlign:"center"}}><h1>مسودة النسب محمية</h1><p>هذه الصفحة مخصصة للمراجعين المخولين فقط.</p><a href="/portal" target="_top">العودة للبوابة</a></main>;
  return <main style={{background:"#f1eee4",minHeight:"100vh"}}><div style={{padding:"12px 22px",background:"#173f35",color:"#fff",display:"flex",gap:18,justifyContent:"space-between",alignItems:"center",fontSize:12}}><span>محرر مطابقة المشجرة التاريخية · نسخة عمل غير معتمدة</span><a href="/portal" target="_top" style={{color:"#f3d8a9"}}>عودة للبوابة</a></div><div style={{height:"calc(100vh - 48px)"}}><iframe src="/tree/index.html" title="محرر شجرة الوايلي" style={{border:0,width:"100%",height:"100%"}}/></div></main>;
}
