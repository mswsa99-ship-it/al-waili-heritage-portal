import {PublicShell,PublicPageHero} from '@/components/public-shell';
import {historyArticles,editorialNews} from '@/lib/editorial-content';
import {record,recordSections} from '@/lib/historical-record';
import {getFamilyActor} from '@/lib/family-access';
import EasyHistory from '@/components/easy-history';
import './record/record.css';
export const dynamic='force-dynamic';
export const metadata={title:'تاريخ الأسرة | أسرة الوايلي'};
export default async function HeritagePage({searchParams}:{searchParams?:Promise<{chapter?:string;article?:string}>}){
 const [actor,params]=await Promise.all([getFamilyActor(),searchParams||Promise.resolve({} as {chapter?:string;article?:string})]);
 const privateAccess=!!actor&&(actor.isOwner||['central','genealogy'].includes(actor.role));
 const sections=recordSections(privateAccess);
 const group=(id:string)=>['1','3','6','14'].includes(id)?'الجذور والأجداد':['4','5','11'].includes(id)?'الأماكن والأعلام':['8','9','10','12'].includes(id)?'الأحداث والشعر':['7','16','19'].includes(id)?'ذاكرة الأسرة':'الوثائق والمراجع';
 const articleChips:Record<string,string>={roots:'تاريخ الأسرة',ibrahim:'تاريخ الأسرة',journey:'تاريخ الأسرة',scholar:'أعلام الأسرة',name:'وثيقة تاريخية'};
 const newsMemory=[
  {id:'memory-hurmah-ouda',cover:'/news/2113619537882951692-1.jpg',chip:'لقاء أسري',title:'لقاء أبناء العمومة في حرمة بضيافة أسرة العودة',summary:'وثّقت الأسرة لقاء ذرية حسين بن مدلج في حرمة بسدير، مع صور متعددة للحضور.'},
  {id:'memory-hurmah-almadi',cover:'/news/1981710996634062963-1.jpg',chip:'لقاء أسري',title:'من الذاكرة: لقاء حرمة بضيافة أسرة الماضي',summary:'لقاء سابق لأبناء العمومة في حرمة، وثقته سلسلة نصوص أسرية نشرت في نوفمبر ٢٠٢٥.'},
  {id:'memory-qari',cover:'/news/1620647288149540864-1.jpg',chip:'إنجازات الأسرة',title:'تكريم القارئ عبدالسلام بن سليمان بن راشد الوايلي',summary:'تكريم القارئ عبدالسلام الوايلي في مناسبة ضمن مسابقة فيصل بن مشعل للقرآن.'},
  {id:'memory-captain',cover:'/news/1998858239325384869-1.jpg',chip:'إنجازات الأسرة',title:'ترقية عبدالله بن علي بن راشد الوايلي إلى قائد طائرة',summary:'تهنئة أسرية للكابتن عبدالله الوايلي بمناسبة ترقيته إلى قائد طائرة إيرباص A320.'},
  {id:'memory-eid',cover:'/news/2036449257675264143-1.jpg',chip:'لقاء أسري',title:'من لقاءات عيد الفطر في بريدة',summary:'لقاء عيد الفطر في ضيافة محمد بن عبدالله بن راشد الوايلي في بريدة.'},
  {id:'memory-majalla',cover:'/news/2038571925845225980-1.jpg',chip:'إصدارات ومراجع',title:'من الأرشيف: أسرة الوايلي في مجلة آل لعبون',summary:'عدد خاص يعكس اهتمام الإصدارات الأسرية بأخبار أبناء العمومة وصور لقاءاتهم.'}
 ];
 const stories=[...historyArticles.map(a=>({id:'article-'+a.id,title:a.title,summary:a.summary,chip:articleChips[a.id]||'تاريخ الأسرة',group:'ابدأ هنا',body:a.sections.map(s=>'### '+s.title+'\n\n'+s.text).join('\n\n')+'\n\n### المصادر\n'+a.sources.map(s=>'- '+s).join('\n'),images:a.images})),...newsMemory.map(n=>({id:n.id,title:n.title,summary:n.summary,chip:n.chip,group:'أخبار الأسرة',static:true,body:'',cover:n.cover})),...sections.map(s=>({id:'chapter-'+s.id,title:s.label,summary:s.private?'معلومات داخلية للمخولين':(s.body.split('\n').find(line=>line.trim()&&!/^[#>|*-]|https?:/.test(line.trim()))||'اقرأ النص ومصادره').replace(/[*`]/g,'').slice(0,150),body:s.body,chip:s.private?'الإدارة':group(s.id),group:s.private?'الإدارة':group(s.id)}))];
 return <PublicShell><main><PublicPageHero kicker="تاريخ الأسرة" title="تاريخ الأسرة وذاكرتها" intro="سيرة الأجداد، وأثر الأعلام، ومحطات الاستقرار؛ إرث نعتز به ونصونه برواياته ووثائقه وشواهده."/><section className="public-section"><EasyHistory stories={stories} initial={params.chapter?'chapter-'+params.chapter:params.article?'article-'+params.article:''}/>{privateAccess&&<p><a href="/api/heritage-record" download>تنزيل نسخة كاملة للمراجعة</a></p>}</section></main></PublicShell>;
}
