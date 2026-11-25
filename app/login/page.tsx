import {PublicShell,PublicPageHero} from '@/components/public-shell';
import {getSessionUser} from '@/app/session-auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{return_to?:string}>}){
  const user=await getSessionUser();
  const {return_to}=await searchParams;
  const returnTo=return_to&&return_to.startsWith('/')&&!return_to.startsWith('//')?return_to:'/member/dashboard';
  return <PublicShell><main><PublicPageHero kicker="بوابة أبناء الأسرة" title="الدخول إلى حسابك" intro="مساحتك لصلة الأسرة والمشاركة في خدمتها: المشجرة والأخبار والمهام في مكان واحد."/><section className="public-section"><div className="family-login"><h2>{user?'حسابك متصل':'تسجيل الدخول'}</h2>{user?<><p>انتقل إلى خدمات الأسرة بحسابك الحالي.</p><a target="_top" className="site-primary-action" href="/member/dashboard">دخول بوابة الأسرة</a></>:<LoginForm returnTo={returnTo}/>}<p>الدخول بالبريد الإلكتروني وكلمة المرور. تظهر الخدمات بعد تفعيل العضوية من الإدارة.</p></div></section></main></PublicShell>;
}
