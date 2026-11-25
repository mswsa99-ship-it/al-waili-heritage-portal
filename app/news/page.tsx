import {EditorialNews} from "@/components/editorial-news";
import {editorialNews} from "@/lib/editorial-content";
import Link from "@/components/portal-link";
import { CalendarDays, Megaphone, ArrowUpLeft } from "lucide-react";
import { EmptyPublished, PublicPageHero, PublicShell } from "@/components/public-shell";
import { publicNews, readableDate } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export default async function NewsPage({searchParams}:{searchParams:Promise<{category?:string}>}) {
  const category=(await searchParams).category||"all";
  const articles = (await publicNews(60)).filter(a=>category==="all"||a.category===category);
  return <PublicShell><main>
    <PublicPageHero kicker="الأخبار" title="أخبار وإصدارات" intro="صلة تتجدد في لقاءاتنا، واعتزاز تحمله إنجازاتنا، وذاكرة تحفظها إصداراتنا."/>
    <section className="public-section"><nav className="content-tabs" aria-label="تصفية الأخبار">{[["all","الجميع"],["news","أخبار"],["events","مناسبات"],["achievements","إنجازات"],["publications","إصدارات"]].map(([key,label])=><Link key={key} href={"/news?category="+key} aria-current={category===key?"page":undefined}>{label}</Link>)}</nav><div className="public-news-layout"><div>
      <EditorialNews category={category}/>{articles.length?articles.map(article=><article className="public-news-item" key={article.id} id={"news-"+article.id}><div className="public-news-icon"><Megaphone size={22}/></div><div><span className="public-date"><CalendarDays size={14}/> {readableDate(article.createdAt)}</span><h2>{article.title}</h2><Link className="public-underlined-link" href={"/news#news-"+encodeURIComponent(article.id)}>الرابط المباشر للخبر</Link><p style={{whiteSpace:"pre-line"}}>{article.body}</p></div></article>):editorialNews.some(a=>category==="all"||a.category===category)?null:<EmptyPublished label="لا توجد أخبار منشورة في هذا القسم حاليًا."/>}
    </div></div></section>
  </main></PublicShell>;
}
