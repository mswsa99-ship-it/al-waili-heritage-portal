import {PublicShell,PublicPageHero} from '@/components/public-shell';
import ForgotForm from './forgot-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default function Forgot(){return <PublicShell><main><PublicPageHero kicker="بوابة أبناء الأسرة" title="استعادة كلمة المرور" intro="نرسل رابط تعيين كلمة مرور جديدة إلى بريدك المسجل."/><section className="public-section"><div className="family-login"><ForgotForm/><p><a href="/login">عودة لتسجيل الدخول</a></p></div></section></main></PublicShell>}
