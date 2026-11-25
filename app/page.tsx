import {ChevronLeft,BookOpenText,Users,Landmark,Newspaper,LibraryBig,Mail} from 'lucide-react';
import {PublicShell} from '@/components/public-shell';
import {EditorialNews} from '@/components/editorial-news';
import {publicNews,readableDate} from '@/lib/public-content';
export const dynamic='force-dynamic';
const destinationIcons=[Landmark,BookOpenText,Newspaper,LibraryBig,Mail];
const destinations=[['/about','أسرتنا وإرثنا','تعريف بالأسرة ورسالة البوابة'],['/heritage','تاريخ الأسرة ووثائقها','الجذور والأجداد، الأعلام، ومحطات الاستقرار'],['/news','أخبار الأسرة','اللقاءات والمناسبات وإنجازات الأبناء'],['/news?category=publications','الإصدارات والمراجع','المطبوعات والشواهد المحفوظة'],['/contact','تواصل معنا','التواصل مع إدارة البوابة']];
export default async function Home(){
 const news=await publicNews(3);
 return <PublicShell home><main className="family-arrival">
  <section className="family-welcome" aria-labelledby="arrival-title">
   <img src="/waili-seal.png" alt="ختم الوائلي" className="arrival-seal" width="144" height="144"/>
   <h1 id="arrival-title">بوابة أسرة الوايلي</h1>
   <p className="arrival-tagline">جذورٌ نعتز بها، وصلةٌ نصونها، وإرثٌ نورثه</p>
   <div className="arrival-actions"><a className="arrival-button primary" href="/login"><Users size={19} aria-hidden="true"/>دخول أبناء الأسرة</a><a className="arrival-button" href="/heritage"><BookOpenText size={19} aria-hidden="true"/>تاريخ الأسرة</a></div>
  </section>
  <nav className="arrival-directory" aria-label="دليل أقسام البوابة">{destinations.map(([href,title,description],index)=>{const Icon=destinationIcons[index];return <a key={href} href={href}><Icon size={26} className="destination-icon" aria-hidden="true"/><div><strong>{title}</strong><span>{description}</span></div><ChevronLeft size={21} aria-hidden="true"/></a>})}</nav>
  <section className="arrival-introduction" aria-labelledby="arrival-about"><span className="arrival-label">جذورنا وامتدادنا</span><h2 id="arrival-about">إرث الأسرة، أمانة الأجيال</h2><p>نعتز بجذور أسرة الوايلي، ونصون سيرة أجدادها ووثائقها، ونحتفي بأعلامها وإنجازات أبنائها وبناتها. تجمعنا صلة الرحم، وتصل أجيالنا ذاكرة حاضرة بالعلم والعمل والتكافل وتبادل الخبرة.</p><a className="arrival-text-link" href="/heritage?article=roots">اقرأ عن الجذور والنسب <ChevronLeft size={17} aria-hidden="true"/></a></section>
  <section className="arrival-news" aria-labelledby="arrival-news-title"><div className="arrival-section-heading"><h2 id="arrival-news-title">من أخبار الأسرة</h2><a href="/news">جميع الأخبار <ChevronLeft size={16} aria-hidden="true"/></a></div><EditorialNews limit={6}/>{news.map(n=><article className="arrival-published" key={n.id}><time dateTime={n.createdAt}>{readableDate(n.createdAt)}</time><h3><a href={'/news#news-'+encodeURIComponent(n.id)}>{n.title}</a></h3><p>{n.body.slice(0,160)}</p></article>)}</section>
 </main></PublicShell>;
}
