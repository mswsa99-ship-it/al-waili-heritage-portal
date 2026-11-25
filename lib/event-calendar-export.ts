export type CalendarEvent = {id:string;title:string;eventDate:string;place:string};

const escapeText=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
// RFC 5545 limits physical lines to 75 UTF-8 octets, not 75 characters.
function foldLine(value:string){const encoder=new TextEncoder();const lines:string[]=[];let line='',bytes=0;for(const char of value){const size=encoder.encode(char).length;if(bytes+size>75){lines.push(line);line=' ';bytes=1;}line+=char;bytes+=size;}lines.push(line);return lines.join('\r\n');}

export function eventCalendarFile(event:CalendarEvent,generatedAt=new Date()){
 if(!event.id.trim()||!event.title.trim())throw new Error('المناسبة غير مكتملة.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(event.eventDate))throw new Error('تاريخ المناسبة غير صالح للتصدير.');
 const start=new Date(event.eventDate+'T00:00:00Z');
 if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==event.eventDate||!Number.isFinite(generatedAt.getTime()))throw new Error('تاريخ المناسبة غير صالح للتصدير.');
 const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
 const date=(value:Date)=>value.toISOString().slice(0,10).replace(/-/g,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Al Wayli Portal//Family Events//AR','CALSCALE:GREGORIAN','BEGIN:VEVENT',
  'UID:'+encodeURIComponent(event.id)+'@al-wayli-family-portal',
  'DTSTAMP:'+generatedAt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),
  'DTSTART;VALUE=DATE:'+date(start),'DTEND;VALUE=DATE:'+date(end),'SUMMARY:'+escapeText(event.title),
  ...(event.place?['LOCATION:'+escapeText(event.place)]:[]),'CLASS:PRIVATE','TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'];
 return lines.map(foldLine).join('\r\n')+'\r\n';
}
