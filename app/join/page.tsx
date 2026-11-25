import { PublicShell, PublicPageHero } from '@/components/public-shell';
import { Suspense } from 'react';
import JoinForm from './join-form';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function JoinPage() {
  return (
    <PublicShell>
      <main>
        <PublicPageHero
          kicker="بوابة أبناء الأسرة"
          title="استكمال بياناتك في شجرة العائلة"
          intro="وصلتك دعوة لاستكمال بياناتك في شجرة آل الوائلي. الاسم فقط إلزامي وكل حقل آخر اختياري، وتظهر إضافتك بحالة «قيد الاعتماد» حتى تعتمدها لجنة الأنساب."
        />
        <section className="public-section">
          <div className="family-login">
            <Suspense fallback={<p>جاري التحميل…</p>}><JoinForm /></Suspense>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
