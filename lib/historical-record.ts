import record from './content/historical-record.json';
export {record};
export function normalizeHistoricalSearch(value:string){return value.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).toLowerCase().trim();}
export function recordSections(privateAccess=false,query='') {const q=normalizeHistoricalSearch(query);return record.sections.filter(s=>(privateAccess||!s.private)&&(!q||normalizeHistoricalSearch(s.title+' '+s.body).includes(q)));}
export function originalRecord(){return record.preamble+record.sections.map(s=>'## '+s.title+'\n'+s.body).join('');}
