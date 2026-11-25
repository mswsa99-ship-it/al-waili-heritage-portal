import { descendants, type WorkEntry } from './lineage-workflow';
export type Actor = {userId:string;personId:string|null;role:string;isOwner:boolean};
export const manages = (a:Actor) => a.isOwner || a.role==='central';
export const reviews = (a:Actor) => a.role==='genealogy';
export const canReadPhoto=(a:Actor,id:string)=>manages(a)||reviews(a)||a.personId===id;
export function validateRelation(people:WorkEntry[], id:string, parent:string|null, operation:string){
 const map=new Map(people.map(p=>[p.person_id,p]));
 if(operation!=='add'&&!map.get(id)?.active)throw Error('السجل غير نشط');
 if(operation==='add'&&!parent)throw Error('يجب اختيار والد مسجل');
 if(parent&&!map.get(parent)?.active)throw Error('الأب غير نشط');
 if(parent&&descendants(people,id).has(parent))throw Error('حلقة في علاقات النسب');
 if(operation==='archive'&&people.some(p=>p.active&&p.parent_id===id))throw Error('لا يمكن أرشفة شخص له أبناء نشطون');
}
export function taskTransition(from:string,to:string,manager:boolean){
 const allowed:Record<string,string[]>={assigned:['in_progress','submitted'],in_progress:['submitted'],returned:['in_progress','submitted'],submitted:['approved','returned'],approved:[]};
 return (allowed[from]||[]).includes(to)&&(!['approved','returned'].includes(to)||manager);
}
