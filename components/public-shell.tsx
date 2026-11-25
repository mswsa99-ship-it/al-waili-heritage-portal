import { ArrowUpLeft, BookOpenText, ShieldCheck } from "lucide-react";
import "./public-visitor.css";
import "./family-design.css";

const links = [["/", "الرئيسية"], ["/about", "عن الأسرة"], ["/heritage", "تاريخ الأسرة"], ["/news", "الأخبار"]] as const;

export function PublicHeader() {
  return <>
    <a className="visitor-skip" href="#public-content">انتقل إلى المحتوى</a>
    <header className="site-header visitor-header">
      <a href="/" target="_top" className="site-brand" aria-label="الوايلي — الرئيسية"><img src="/waili-seal.png" alt="ختم الوائلي" className="site-seal"/><span><strong>الوايلي</strong><small>تاريخٌ وذاكرة</small></span></a>
      <nav className="site-nav" aria-label="أقسام الموقع">{links.map(([href, label]) => <a href={href} target="_top" key={href}>{label}</a>)}</nav><details className="family-mobile-menu"><summary>القائمة <span aria-hidden="true">☰</span></summary><nav aria-label="القائمة المختصرة">{links.map(([href,label])=><a href={href} key={href}>{label}</a>)}<a href="/contact">تواصل معنا</a></nav></details><a className="easy-family-entry" href="/login" target="_top">دخول أبناء الأسرة</a>
    </header>
  </>;
}

export function PublicFooter() {
  return <footer className="site-footer visitor-footer">
    <a href="/" target="_top" className="site-brand"><img src="/waili-seal.png" alt="ختم الوائلي" className="site-seal"/><span><strong>الوايلي</strong><small>تاريخٌ وذاكرة</small></span></a>
    <nav className="site-footer-links" aria-label="روابط أسفل الصفحة">{links.map(([href, label]) => <a href={href} target="_top" key={href}>{label}</a>)}<a href="/contact" target="_top">تواصل مع الإدارة</a><a href="/privacy" target="_top">الخصوصية</a><a href="/terms" target="_top">شروط الاستخدام</a><a href="https://x.com/MoarrkWaily" target="_blank" rel="noopener noreferrer" dir="ltr">X: @MoarrkWaily</a></nav>
    <span>إرثٌ نصونه، وصلةٌ تبقى.</span>
  </footer>;
}

export function PublicShell({children,home=false}: {children: React.ReactNode;home?:boolean}) {
  return <div className={"site-home visitor-site family-design"+(home?" family-home":"")}><PublicHeader/><div id="public-content" tabIndex={-1}>{children}</div><PublicFooter/></div>;
}

export function PublicPageHero({kicker, title, intro}: {kicker: string; title: string; intro: string}) {
  return <section className="public-page-hero"><div className="family-page-title"><nav aria-label="مسار الصفحة"><a href="/">الرئيسية</a><span aria-hidden="true"> / </span><span>{kicker}</span></nav><h1>{title}</h1><p>{intro}</p></div></section>;
}

export function EditorialNotice({children}: {children: React.ReactNode}) {
  return <div className="public-notice"><ShieldCheck size={21}/><p>{children}</p></div>;
}

export function EmptyPublished({label, href = "/contact"}: {label: string; href?: string}) {
  return <div className="public-empty"><BookOpenText size={29}/><h3>لا توجد مواد منشورة حاليًا</h3><p>{label}</p><a className="site-primary-action" href={href} target="_top">تواصل معنا <ArrowUpLeft size={16}/></a></div>;
}
