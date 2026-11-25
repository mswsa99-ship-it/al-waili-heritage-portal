import {PublicShell,PublicPageHero} from '@/components/public-shell';
import ContactForm from '@/components/contact-form';
export const metadata={title:'تواصل معنا | أسرة الوايلي'};
export default function ContactPage(){return <PublicShell><main><PublicPageHero kicker="تواصل معنا" title="تواصل معنا" intro="نعتز بتواصلك، ونرحب بما يُثري إرث الأسرة ويقوّي صلتها ويخدم أبناءها وبناتها."/><section className="public-section"><ContactForm/></section></main></PublicShell>}
