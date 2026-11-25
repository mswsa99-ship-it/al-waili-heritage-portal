import {Fragment, type ReactNode} from 'react';

// A deliberately small text renderer: no raw HTML or executable URLs from sources.
export function historicalInline(text:string):ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|https?:\/\/[^\s<>]+)/g).filter(Boolean).map((part,i)=>{
    if(part.startsWith('**'))return <strong key={i}>{historicalInline(part.slice(2,-2))}</strong>;
    if(part.startsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    if(part.startsWith('*'))return <em key={i}>{historicalInline(part.slice(1,-1))}</em>;
    if(/^https?:\/\//.test(part))return null; // outbound source links are not published
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export function HistoricalMarkdown({text}:{text:string}) {
  const lines=text.split('\n'), nodes:ReactNode[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();if(!line)continue;
    if(/^---+$/.test(line)){nodes.push(<hr key={i}/>);continue;}
    if(line.startsWith('|')){
      const rows:string[][]=[];const start=i;
      while(i<lines.length&&lines[i].trim().startsWith('|')){const cells=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());if(!cells.every(c=>/^:?-+:?$/.test(c)))rows.push(cells);i++;}i--;
      nodes.push(<div className="record-table" role="region" aria-label="جدول مرجعي — يمكن تمريره أفقيًا" tabIndex={0} key={start}><table><thead><tr>{rows[0]?.map((c,j)=><th scope="col" key={j}>{historicalInline(c)}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{historicalInline(c)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    if(/^#{1,4} /.test(line)){nodes.push(<h3 key={i}>{historicalInline(line.replace(/^#+ /,''))}</h3>);continue;}
    if(/^>/.test(line)){const start=i,parts=[];while(i<lines.length&&/^>/.test(lines[i].trim())){parts.push(lines[i].trim().replace(/^> ?/,''));i++;}i--;nodes.push(<blockquote key={start}>{historicalInline(parts.join(' '))}</blockquote>);continue;}
    if(/^(?:- |\d+\. )/.test(line)){const start=i,ordered=/^\d/.test(line),items=[];while(i<lines.length&&/^(?:- |\d+\. )/.test(lines[i].trim())){items.push(lines[i].trim().replace(/^(?:- |\d+\. )/,''));i++;}i--;const list=items.map((s,j)=><li key={j}>{historicalInline(s)}</li>);nodes.push(ordered?<ol key={start}>{list}</ol>:<ul key={start}>{list}</ul>);continue;}
    const start=i,parts=[line];while(i+1<lines.length&&lines[i+1].trim()&&!/^(?:#|>|\||- |\d+\. |---)/.test(lines[i+1].trim())){parts.push(lines[++i].trim());}nodes.push(<p key={start}>{historicalInline(parts.join(' '))}</p>);
  }
  return <div className="record-prose">{nodes}</div>;
}
