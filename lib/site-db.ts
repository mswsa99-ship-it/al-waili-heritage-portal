import {env} from 'cloudflare:workers';
export function siteDb(){if(!env.DB)throw Error('Database unavailable');return env.DB;}
export const query=(sql:string,...values:(string|number|null)[])=>siteDb().prepare(sql).bind(...values);
export function sameOrigin(req:Request){const origin=req.headers.get('origin');try{return !origin||new URL(origin).host===req.headers.get('host');}catch{return false;}}
export async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
