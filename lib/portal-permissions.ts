import type {PortalTab} from './portal-navigation';
export const administrativeRoles=['central','branch','council','secretary','genealogy','social','oversight'];
// This map determines navigation; every write is also authorized by its API.
export const administrationTools:Record<string,PortalTab[]>={
 central:['membership','enrollment','branch','treeWorkspace','registry','committee','news','events','archive','communication','services','inbox','office','tasks','governance'],
 genealogy:['treeWorkspace','registry','committee'],
 branch:['branch','committee','services','office','tasks'],
 council:['branch','news','events','archive','communication','office','tasks'],
 secretary:['committee','office','tasks'],
 social:['services'],oversight:['services'],member:[]
};
export function allowedAdminTools(role:string,canEditTree=false):PortalTab[]{return [...new Set([...(administrationTools[role]||[]),...(canEditTree?['treeWorkspace' as PortalTab]:[])])];}
export const permissionsMatrix=[
 ['قراءة المشجرة والأخبار','الأعضاء النشطون','البيانات المعتمدة والمسموح بمشاركتها فقط'],
 ['تعديل الملف الشخصي','صاحب الملف','بياناته وخيارات المشاركة'],
 ['اقتراح تعديل المشجرة','المفوض أو الإدارة أو لجنة الأنساب','داخل التفريع المصرح؛ لا يعتمد اقتراحه بنفسه'],
 ['اعتماد النسب','لجنة الأنساب','قرار موثق وفق النصاب؛ مع التنحي عند التعارض'],
 ['نشر الأخبار والمناسبات','الإدارة المركزية أو المجلس','المراجعة قبل النشر العام'],
 ['إسناد مهام الأفراد','الإدارة المركزية أو أمين السر أو ممثل الفرع','ممثل الفرع ضمن فرعه فقط'],
 ['إدارة تكليفات المجلس','الإدارة المركزية أو أمين السر','وفق دور المكلف ونطاقه'],
 ['رفع تقرير إنجاز','صاحب المهمة','مهامه المسموح بها فقط'],
 ['إصدار الدعوات وربط العضويات','الإدارة المركزية','لأشخاص مؤهلين من السجل المعتمد'],
 ['تغيير الأدوار والنسخة الاحتياطية','مالك البوابة','تفويض صريح وسجل تدقيق'],
];
