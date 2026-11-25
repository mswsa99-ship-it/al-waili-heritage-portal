import {requireSessionUser} from '@/app/session-auth';
import ActivateForm from './activate-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Activate(){await requireSessionUser('/activate');return <main className="public-section"><h1>تفعيل دعوة الأسرة</h1><p>أدخل الرمز الذي وصل إليك بصورة خاصة، بعد الدخول بحساب البريد المحدد في الدعوة.</p><ActivateForm/></main>}
