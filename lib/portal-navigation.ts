export type PortalTab='home'|'lineage'|'treeWorkspace'|'registry'|'archive'|'profile'|'news'|'events'|'services'|'communication'|'tasks'|'branch'|'committee'|'membership'|'enrollment'|'office'|'inbox'|'governance';
export const memberGroups:Record<string,PortalTab[]>={dashboard:['home'],family:['lineage','profile','archive'],community:['news','events','communication','services'],tasks:['tasks']};
export const adminGroups:{title:string;tabs:PortalTab[]}[]=[{title:'ملخص الإدارة',tabs:['home']},{title:'النسب والمراجعة',tabs:['treeWorkspace','registry','committee']},{title:'الأعضاء والفروع',tabs:['membership','enrollment','branch']},{title:'الطلبات والرسائل',tabs:['services','inbox','committee']},{title:'المحتوى والأنشطة',tabs:['news','events','archive','communication']},{title:'المجلس والمهام',tabs:['office','tasks']},{title:'الإعدادات والتقارير',tabs:['governance']}];
export function portalDestination(tab:PortalTab,mode:'beneficiary'|'administration',section:string){
 const group=adminGroups.findIndex(g=>g.tabs.includes(tab));
 if(mode==='administration'&&group>=0)return {path:'/admin',group};
 const target=Object.keys(memberGroups).find(k=>memberGroups[k].includes(tab));
 return {path:target?'/member/'+target:'/admin',group:Math.max(group,0)};
}
