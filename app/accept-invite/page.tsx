import { PublicShell, PublicPageHero } from '@/components/public-shell';
import { Suspense } from 'react';
import AcceptForm from './accept-form';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function AcceptInvitePage() {
  return (
    <PublicShell>
      <main>
        <PublicPageHero
          kicker="بوابة أبناء الأسرة"
          title="تفعيل حسابك في بوابة العائلة"
          intro="وصلتك دعوة لتفعيل عضويتك في بوابة أسرة الوايلي. الرابط الخاص يتحقق من ملكيتك لبريدك، وفي أول دخول تعيّن كلمة مرورك بنفسك."
        />
        <section className="public-section">
          <div className="family-login">
            <Suspense fallback={<p>جاري التحميل…</p>}><AcceptForm /></Suspense>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
