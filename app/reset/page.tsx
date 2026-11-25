import {PublicShell,PublicPageHero} from '@/components/public-shell';
import ResetForm from './reset-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Reset({searchParams}:{searchParams:Promise<{token?:string}>}){
  const {token}=await searchParams;
  return <PublicShell><main><PublicPageHero kicker="بوابة أبناء الأسرة" title="تعيين كلمة مرور جديدة" intro="اختر كلمة مرور جديدة لحسابك."/><section className="public-section"><div className="family-login"><ResetForm token={token||''}/></div></section></main></PublicShell>;
}
