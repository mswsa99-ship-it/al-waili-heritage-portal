// Normalize spelling for search only; never change stored names or identifiers.
export function normalizeLineageSearch(value:string){return value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase()}
export function matchesLineageSearch(person:{name:string;personId:string;branch:string},query:string){const haystack=normalizeLineageSearch([person.name,person.personId,person.branch].join(' '));return normalizeLineageSearch(query).split(' ').every(word=>haystack.includes(word))}
