export type CorrectedEntry={id:string;name:string;parent:string|null;review:string;reading:string;note?:string;zone?:string};
export type WorkEntry = {person_id:string;parent_id:string|null;name:string;active:number;revision:number;gender:string;birth_year:number|null;death_year:number|null;education:string;city:string;profession:string;phone:string;email:string;position:string;review_status:string;reading_status:string};
export type Operation='add'|'edit'|'archive';
export const fields=['name','gender','birth_year','death_year','education','city','profession','phone','email','position'] as const;
export const shortText=(v:unknown,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateTree(entries:CorrectedEntry[]){
 const map=new Map(entries.map(r=>[r.id,r]));
 if(map.size!==entries.length)throw Error('تكرار أرقام السجلات');
 for(const r of entries){if(!r.id || !r.name || (r.parent&&!map.has(r.parent)))throw Error('اسم أو أب غير صحيح: '+r.id);let at:string|null=r.id;const seen=new Set<string>();while(at){if(seen.has(at))throw Error('حلقة في النسب: '+r.id);seen.add(at);at=map.get(at)?.parent??null;}}
 return true;
}
export function descendants(people:Pick<WorkEntry,'person_id'|'parent_id'|'active'>[],root:string){
 const adjacency=new Map<string,string[]>();for(const p of people){if(!p.active||!p.parent_id)continue;const a=adjacency.get(p.parent_id)||[];a.push(p.person_id);adjacency.set(p.parent_id,a);}const seen=new Set([root]);const stack=[root];while(stack.length){for(const id of adjacency.get(stack.pop()!)||[]){if(seen.has(id))continue;seen.add(id);stack.push(id);}}return seen;
}
export const normalizeDigits=(value:string)=>value.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?0x660:0x6f0)));
export function safeProfile(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('بيانات غير صحيحة');const v=input as Record<string,unknown>;
 const name=shortText(v.name,150),gender=shortText(v.gender,12);
 if(!name || !['male','female','unknown'].includes(gender))throw Error('الاسم والجنس مطلوبان');
 const parseYear=(raw:unknown)=>{if(raw===null||raw===undefined)return null;const text=typeof raw==='number'?String(raw):typeof raw==='string'?normalizeDigits(raw.trim()):'invalid';if(!text)return null;const y=Number(text);if(!/^\d{4}$/.test(text)||!Number.isInteger(y)||y<1250||y>2200)throw Error('يجب إدخال سنة ميلاد أو وفاة صحيحة');return y;};
 const birth_year=parseYear(v.birth_year),death_year=parseYear(v.death_year);
 if(birth_year&&death_year&&death_year<birth_year)throw Error('سنة الوفاة قبل الميلاد');
 const email=shortText(v.email,180);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('البريد غير صالح');
 const phone=normalizeDigits(shortText(v.phone,30));if(phone&&!/^\+?[0-9\s()-]{6,30}$/.test(phone))throw Error('رقم التواصل غير صالح');
 return {name,gender,birth_year,death_year,education:shortText(v.education,180),city:shortText(v.city,120),profession:shortText(v.profession,180),phone,email,position:shortText(v.position,180)};
}
export function parsePrivatePhoto(data:unknown){
 if(data===undefined || data===null || data==='')return null;
 if(typeof data!=='string')throw Error('الصورة غير صالحة');
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)throw Error('الصورة يجب أن تكون PNG أو JPEG أو WebP');
 const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
 if(bytes.length>180_000||bytes.length<30)throw Error('الحد الأقصى للصورة بعد الضغط 180 كيلوبايت');
 const mime=match[1],jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!((mime==='image/jpeg'&&jpeg)||(mime==='image/png'&&png)||(mime==='image/webp'&&webp)))throw Error('امتداد الصورة لا يطابق محتواها');
 return {mime,base64:match[2]};
}
export function basicSummary(people:Pick<WorkEntry,'person_id'|'parent_id'|'active'|'birth_year'|'gender'>[]){
 return {total:people.filter(x=>x.active).length,withoutBirthYear:people.filter(x=>x.active&&x.birth_year===null).length,withFemale:people.filter(x=>x.active&&x.gender==='female').length};
}
