/* مشجرة الوايلي — مسودة مراجعة محمية، بمصفوفة مستقلة لكل جيل. */
import { computeGenerationLayout } from './generation-layout.mjs';
(() => {
  'use strict';
  let W = 2600, H = 2500;
  const CELL_W = 112, CELL_H = 43;
  const KEY = 'al-waili-tree-review-v2';
  let levelRows = [], generationById = {}, viewZones = [];
  const $ = id => document.getElementById(id);
  const el = (tag, className, textValue) => { const n = document.createElement(tag); if(className)n.className=className;if(textValue!==undefined)n.textContent=textValue;return n; };
  const svgEl = name => document.createElementNS('http://www.w3.org/2000/svg',name);
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const fmt=n=>Math.round(n).toLocaleString('ar-SA');
  let initialRecords = [], records = [], positions = {}, selectedId = null;
  let scale=1, panX=0, panY=0, saveTimer=null, toastTimer=null;
  let serverRevision=0,serverSaving=false,serverDirty=false,serverConflict=false;
  let undoStack=[], redoStack=[], activeEditTime=0, activeEditId=null;
  let currentZone='gen:0', drag=null, hits=new Set(), photo=2, photoZoom=1;
  const nodeEls = new Map();
  const embeddedPhotos = document.getElementById('embeddedPhotos');
  const photoUrls = embeddedPhotos ? JSON.parse(embeddedPhotos.textContent) : null;
  const photoUrl = id => photoUrls?.[id] || `/api/review-media/${id}`;

  function normalized(t){return String(t||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();}
  function index(){return new Map(records.map(r=>[r.id,r]));}
  function childrenOf(parentId){return records.filter(n=>n.parent===parentId);}
  function cloneState(){return {records:structuredClone(records),positions:structuredClone(positions)};}
  function snapshot(){undoStack.push(cloneState());if(undoStack.length>70)undoStack.shift();redoStack.length=0;updateHistoryButtons();}
  function restore(s){records=structuredClone(s.records);positions=initialLayout(records);if(!records.some(n=>n.id===selectedId))selectedId=null;renderAll();scheduleSave();}
  function undo(){if(!undoStack.length)return;redoStack.push(cloneState());restore(undoStack.pop());updateHistoryButtons();notify('تم التراجع عن آخر تعديل');}
  function redo(){if(!redoStack.length)return;undoStack.push(cloneState());restore(redoStack.pop());updateHistoryButtons();notify('تمت إعادة التعديل');}
  function updateHistoryButtons(){$('undoBtn').disabled=!undoStack.length;$('redoBtn').disabled=!redoStack.length;}
  function scheduleSave(){clearTimeout(saveTimer);$('saveState').textContent='جارٍ حفظ التعديلات…';saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify({version:3,layout:'generation-grid',records,positions,savedAt:new Date().toISOString()}));$('saveState').textContent='حُفظت نسخة محلية، جارٍ مزامنتها…';syncDraft();}catch(e){$('saveState').textContent='تعذّر الحفظ المحلي — صدّر نسخة JSON';notify('تعذّر الحفظ على المتصفح؛ يُرجى تصدير نسخة');}},700);}
  async function syncDraft(){if(serverConflict)return;if(serverSaving){serverDirty=true;return;}serverSaving=true;try{const response=await fetch('/api/review-draft',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({expectedRevision:serverRevision,records,positions})});const result=await response.json();if(response.status===409){serverConflict=true;$('saveState').textContent='تعارض نسخ — صدّر JSON قبل تحديث الصفحة';notify('هناك نسخة أحدث لدى مراجع آخر. احتفظ بنسخة JSON من عملك.');return;}if(!response.ok)throw Error(result.error||'تعذّرت المزامنة');serverRevision=result.revision;$('saveState').textContent='تم حفظ مسودة المراجعة في البوابة';}catch(error){$('saveState').textContent='حفظ محلي فقط — لم تكتمل المزامنة';}finally{serverSaving=false;if(serverDirty&&!serverConflict){serverDirty=false;syncDraft();}}}
  function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3100);}
  function initialLayout(data){
    const layout=computeGenerationLayout(data);
    W=layout.width;H=layout.height;
    levelRows=layout.rows;generationById=layout.generationById;
    const stage=$('boardStage'),svg=$('edgeLayer');
    stage.style.width=W+'px';stage.style.height=H+'px';
    svg.setAttribute('width',W);svg.setAttribute('height',H);
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    $('coordX').max=W;$('coordY').max=H;
    viewZones=[];
    for(let start=0;start<levelRows.length;start+=3){
      const rows=levelRows.slice(start,start+3),points=rows.flatMap(row=>row.ids.map(id=>layout.positions[id]));
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
      const minY=rows[0].y,maxY=rows[rows.length-1].y;
      viewZones.push({id:'gen:'+start,label:`الأجيال ${fmt(start+1)}–${fmt(start+rows.length)}`,
        x:Math.max(0,minX-190),y:Math.max(0,minY-95),
        w:Math.max(500,maxX-minX+380),h:Math.max(360,maxY-minY+190)});
    }
    const select=$('zoneSelect');
    const chosen=viewZones.some(v=>v.id===currentZone)?currentZone:'gen:0';
    select.replaceChildren();
    const all=el('option','', 'كامل المشجرة');all.value='الكل';select.append(all);
    for(const zone of viewZones){const option=el('option','',zone.label);option.value=zone.id;select.append(option);}
    currentZone=chosen;select.value=chosen;
    return layout.positions;
  }
  function preservePreviousPositions(old){
    if(!old||typeof old!=='object'||!Object.keys(old).length)return;
    try{const backupKey=KEY+'-before-generation-grid';if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify({savedAt:new Date().toISOString(),positions:old}));}catch{}
  }
  function validateDataset(candidate){
    if(!Array.isArray(candidate)||!candidate.length||candidate.length>1200)throw Error('بيانات غير صالحة');
    const ids=new Set();for(const n of candidate){if(!n||typeof n.id!=='string'||typeof n.name!=='string'||!n.id.trim()||ids.has(n.id))throw Error('معرفات مكررة أو خانات ناقصة');ids.add(n.id);}
    const map=new Map(candidate.map(n=>[n.id,n]));
    for(const n of candidate){if(n.parent&&!ids.has(n.parent))throw Error(`الأب ${n.parent} غير موجود`);let seen=new Set([n.id]),parent=n.parent;while(parent){if(seen.has(parent))throw Error('يوجد دوران في روابط النسب');seen.add(parent);parent=map.get(parent)?.parent;}}
    return true;
  }
  function loadSaved(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.records)){validateDataset(s.records);preservePreviousPositions(s.positions);records=s.records.map(n=>({...n}));positions=initialLayout(records);return true;}}catch(e){console.warn('Stored review could not load',e);}return false;}
  function updateMetrics(){const reviewed=records.filter(n=>n.review==='تمت المطابقة').length;$('totalCount').textContent=fmt(records.length);$('reviewedCount').textContent=fmt(reviewed);$('pendingCount').textContent=fmt(records.length-reviewed);}
  function createZones(){const layer=$('zoneBackdrop');layer.replaceChildren();for(const row of levelRows){const r=svgEl('rect');r.setAttribute('class','generation-band');r.setAttribute('x',35);r.setAttribute('y',row.y-61);r.setAttribute('width',W-70);r.setAttribute('height',122);layer.append(r);const tx=svgEl('text');tx.setAttribute('class','generation-label');tx.setAttribute('x',W-75);tx.setAttribute('y',row.y-38);tx.setAttribute('text-anchor','end');tx.textContent=`الجيل ${fmt(row.depth+1)}`;layer.append(tx);}}
  function familyPath(parent,kids){
    const p=positions[parent.id],children=kids.map(n=>positions[n.id]).filter(Boolean);
    if(!p||!children.length)return '';
    const y1=p.y+(parent.parent?CELL_H:52)/2,y2=children[0].y-CELL_H/2;
    if(children.length===1&&p.x===children[0].x)return `M${p.x},${y1} V${y2}`;
    const bus=y1+(y2-y1)*.48;
    const xs=[p.x,...children.map(c=>c.x)];
    return [`M${p.x},${y1} V${bus}`,`M${Math.min(...xs)},${bus} H${Math.max(...xs)}`,
      ...children.map(c=>`M${c.x},${bus} V${c.y-CELL_H/2}`)].join(' ');
  }
  function redrawEdges(){const layer=$('edgePaths');layer.replaceChildren();for(const p of records){const kids=childrenOf(p.id);if(!kids.length)continue;const path=svgEl('path');path.setAttribute('class','connector'+(p.id===selectedId||kids.some(n=>n.id===selectedId)?' active':''));path.setAttribute('d',familyPath(p,kids));layer.append(path);}}
  function redrawNodes(){const layer=$('nodeLayer');layer.replaceChildren();nodeEls.clear();for(const n of records){const card=el('div','node');card.dataset.id=n.id;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`${n.name}، رقم ${n.id}`);const name=el('div','node-name',n.name||'خانة بلا اسم');const id=el('div','node-code',n.id);card.append(name,id);layer.append(card);nodeEls.set(n.id,card);positionCard(n.id);card.addEventListener('pointerdown',startNodeDrag);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id,true);}});}refreshNodeStyles();}
  function positionCard(id){const p=positions[id],card=nodeEls.get(id);if(card&&p){card.style.left=p.x+'px';card.style.top=p.y+'px';}}
  function refreshNodeStyles(){for(const n of records){const c=nodeEls.get(n.id);if(!c)continue;c.className='node'+(!n.parent?' root':'')+(n.review==='تمت المطابقة'?' reviewed':n.review==='يحتاج تصحيحًا'||n.reading==='تحتاج مراجعة'?' uncertain':'')+(n.id===selectedId?' selected':'')+(hits.has(n.id)?' search-hit':'');const name=c.querySelector('.node-name');if(name.textContent!==n.name)name.textContent=n.name||'خانة بلا اسم';}}
  function renderAll(){updateMetrics();createZones();redrawNodes();redrawEdges();updateInspector();updateHistoryButtons();updateZoneLabel();}

  function setTransform(){scale=clamp(scale,.02,2.5);$('boardStage').style.transform=`translate(${panX}px,${panY}px) scale(${scale})`;$('zoomLabel').textContent=fmt(scale*100)+'٪';}
  function fitRect(rect,margin=28){const surface=$('boardSurface');const w=surface.clientWidth,h=surface.clientHeight;if(!w||!h)return;scale=clamp(Math.min((w-2*margin)/rect.w,(h-2*margin)/rect.h),.02,1.65);panX=w/2-(rect.x+rect.w/2)*scale;panY=h/2-(rect.y+rect.h/2)*scale;setTransform();}
  function fitZone(zone){currentZone=zone;$('zoneSelect').value=zone;const rect=zone==='الكل'?{x:0,y:0,w:W,h:H}:viewZones.find(z=>z.id===zone)||viewZones[0];if(rect)fitRect(rect,30);updateZoneLabel();}
  function fitBranch(id){if(!id||!positions[id])return;const ids=[id,...descendantsOf(id)].filter(key=>positions[key]);const xs=ids.map(key=>positions[key].x),ys=ids.map(key=>positions[key].y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);fitRect({x:Math.max(0,minX-180),y:Math.max(0,minY-88),w:Math.max(480,maxX-minX+360),h:Math.max(300,maxY-minY+176)},28);$('currentZone').textContent='فرع '+(records.find(n=>n.id===id)?.name||id);}
  function updateZoneLabel(){$('currentZone').textContent=currentZone==='الكل'?'المشجرة كاملة':viewZones.find(v=>v.id===currentZone)?.label||'مستويات الأجيال';}
  function focusNode(id){const p=positions[id];if(!p)return;const surface=$('boardSurface');scale=Math.max(scale,.9);panX=surface.clientWidth/2-p.x*scale;panY=surface.clientHeight/2-p.y*scale;setTransform();}
  function zoomBy(factor,clientX,clientY){const surface=$('boardSurface');const r=surface.getBoundingClientRect(),x=clientX===undefined?r.width/2:clientX-r.left,y=clientY===undefined?r.height/2:clientY-r.top;const wx=(x-panX)/scale,wy=(y-panY)/scale;scale=clamp(scale*factor,.16,2.5);panX=x-wx*scale;panY=y-wy*scale;setTransform();}
  function selectNode(id,focus=false){if(!records.some(n=>n.id===id))return;selectedId=id;refreshNodeStyles();redrawEdges();updateInspector();if(focus)focusNode(id);}
  function startNodeDrag(e){if(e.button!==0)return;selectNode(e.currentTarget.dataset.id);e.stopPropagation();}
  function onPointerMove(e){if(!drag)return;panX=drag.startPanX+e.clientX-drag.clientX;panY=drag.startPanY+e.clientY-drag.clientY;setTransform();}
  function onPointerUp(){if(!drag)return;$('boardSurface').classList.remove('panning');drag=null;}
  function startPan(e){if(e.target!==$('boardSurface')&&e.target!==$('boardStage'))return;if(e.button!==0)return;drag={type:'pan',clientX:e.clientX,clientY:e.clientY,startPanX:panX,startPanY:panY};$('boardSurface').classList.add('panning');$('boardSurface').setPointerCapture(e.pointerId);}

  function lineage(id){const map=index(),out=[],seen=new Set();let n=map.get(id);while(n&&!seen.has(n.id)){out.push(n.name);seen.add(n.id);n=map.get(n.parent);}return out.join(' ← ');}
  function descendantsOf(id){const result=new Set(),stack=[id];while(stack.length){const at=stack.pop();for(const n of childrenOf(at)){if(!result.has(n.id)){result.add(n.id);stack.push(n.id);}}}return result;}
  function updateInspector(){const n=records.find(x=>x.id===selectedId);$('emptyInspector').hidden=!!n;$('editForm').hidden=!n;$('selectedId').textContent=n?.id||'—';if(!n)return;$('personName').value=n.name;$('reviewField').value=n.review||'لم يراجع المستخدم';$('readingField').value=n.reading||'تحتاج مراجعة';$('personZone').value=n.zone||'الأعلى';$('personNote').value=n.note||'';$('siblingOrder').value=n.birthOrder??'';$('coordX').value=positions[n.id]?.x??0;$('coordY').value=positions[n.id]?.y??0;
    const field=$('parentField');field.replaceChildren();const rootOpt=el('option','', 'لا يوجد أب (جذر مستقل)');rootOpt.value='';field.append(rootOpt);const disallowed=descendantsOf(n.id);for(const other of records){if(other.id===n.id||disallowed.has(other.id))continue;const option=el('option','',`${other.id} — ${other.name}`);option.value=other.id;field.append(option);}field.value=n.parent||'';
    $('ancestryText').textContent=lineage(n.id);const children=childrenOf(n.id);$('childrenCount').textContent=`${fmt(children.length)} أبناء مباشرين في هذه المسودة`;
  }
  function markFormHistory(){const now=Date.now();if(activeEditId!==selectedId||now-activeEditTime>900){snapshot();}activeEditId=selectedId;activeEditTime=now;}
  function applyForm(){const n=records.find(x=>x.id===selectedId);if(!n)return;const name=$('personName').value.trim()||'[خانة بلا اسم مقروء]';const parent=$('parentField').value||null;const disallowed=descendantsOf(n.id);if(parent&&(parent===n.id||disallowed.has(parent))){notify('لا يمكن ربط الشخص بنفسه أو بأحد ذريته');updateInspector();return;}
    const previousParent=n.parent,previousOrder=n.birthOrder;
    n.name=name;n.parent=parent;n.review=$('reviewField').value;n.reading=$('readingField').value;n.note=$('personNote').value;n.zone=$('personZone').value;
    const order=Number($('siblingOrder').value);if(Number.isInteger(order)&&order>0&&$('siblingOrder').value.trim())n.birthOrder=order;else delete n.birthOrder;
    if(previousParent!==n.parent||previousOrder!==n.birthOrder){positions=initialLayout(records);renderAll();fitZone(currentZone);}
    else{positionCard(n.id);refreshNodeStyles();redrawEdges();updateMetrics();}
    $('ancestryText').textContent=lineage(n.id);$('childrenCount').textContent=`${fmt(childrenOf(n.id).length)} أبناء مباشرين في هذه المسودة`;scheduleSave();
  }
  function nextId(){let num=1;const taken=new Set(records.map(n=>n.id));while(taken.has('N'+String(num).padStart(3,'0')))num++;return 'N'+String(num).padStart(3,'0');}
  function newCell(parentId){snapshot();const p=records.find(n=>n.id===parentId);const id=nextId();const node={id,name:'اسم جديد',parent:parentId||null,zone:p?.zone||'الأعلى',reading:'تحتاج مراجعة',review:'لم يراجع المستخدم',note:''};records.push(node);
    positions=initialLayout(records);renderAll();selectNode(id,true);$('personName').focus();$('personName').select();scheduleSave();notify('أُضيفت خلية في جيل مستقل أسفل أبيها؛ حدّد ترتيبها بين الإخوة إذا كان موثقًا');}
  function removeSelected(){const n=records.find(x=>x.id===selectedId);if(!n)return;const children=childrenOf(n.id);const msg=children.length?`حذف «${n.name}»؟\nسيُربط أبناؤه الـ${children.length} بأبيه «${records.find(x=>x.id===n.parent)?.name||'جذر مستقل'}» حتى لا تضيع فروعهم.`:`حذف الخلية «${n.name}» نهائيًا من نسخة العمل؟`;if(!confirm(msg))return;snapshot();records=records.filter(x=>x.id!==n.id);records.forEach(x=>{if(x.parent===n.id)x.parent=n.parent||null;});selectedId=n.parent||null;positions=initialLayout(records);renderAll();scheduleSave();notify('حُذفت الخلية وأعيد توزيع الأجيال مع الاحتفاظ ببقية الفروع');}
  function setSearch(value){const q=normalized(value);hits=new Set(q?records.filter(n=>normalized(n.name).includes(q)||normalized(n.id).includes(q)).map(n=>n.id):[]);refreshNodeStyles();if(q){$('search').title=`${hits.size} نتيجة`;}}
  function download(filename,type,data){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function exportJSON(){let previousLayout=null;try{previousLayout=JSON.parse(localStorage.getItem(KEY+'-before-generation-grid')||'null');}catch{}const bundle={format:'al-waili-tree-review',version:3,layout:'generation-grid',exportedAt:new Date().toISOString(),records,positions,previousLayout};download(`al-waili-family-tree-${new Date().toISOString().slice(0,10)}.json`,'application/json;charset=utf-8',JSON.stringify(bundle,null,2));notify('تم تنزيل نسخة الأجيال مع الاحتفاظ بالمواضع السابقة إن وُجدت');}
  function xmlSafe(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
  function exportSVG(){const parts=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fafbf8"/>`];
    for(const row of levelRows){parts.push(`<rect x="35" y="${row.y-61}" width="${W-70}" height="122" rx="12" fill="#f2f6f0" stroke="#d8e4d9"/><text x="${W-75}" y="${row.y-38}" text-anchor="end" direction="rtl" font-family="Tahoma,Arial" font-size="19" fill="#87998c">الجيل ${fmt(row.depth+1)}</text>`);}
    for(const n of records){const kids=childrenOf(n.id);if(kids.length)parts.push(`<path d="${familyPath(n,kids)}" fill="none" stroke="#799084" stroke-width="2"/>`);}
    for(const n of records){const p=positions[n.id];if(!p)continue;const root=!n.parent,w=root?290:CELL_W,h=root?52:CELL_H;const fill=root?'#18493e':n.review==='تمت المطابقة'?'#eaf8ef':n.review==='يحتاج تصحيحًا'?'#fff2db':'#fffef9';const color=root?'#ffffff':'#24473a';parts.push(`<g><rect x="${p.x-w/2}" y="${p.y-h/2}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="#82988c"/><text x="${p.x}" y="${p.y-1}" text-anchor="middle" direction="rtl" font-family="Tahoma,Arial" font-weight="bold" font-size="${root?14:12}" fill="${color}">${xmlSafe(n.name)}</text><text x="${p.x}" y="${p.y+13}" text-anchor="middle" font-family="Arial" font-size="8" fill="${root?'#c0dfd3':'#9cae9f'}">${xmlSafe(n.id)}</text></g>`);}
    parts.push('</svg>');download('al-waili-family-tree.svg','image/svg+xml;charset=utf-8',parts.join(''));notify('تم تنزيل الرسم بصيغة SVG قابلة للتكبير والطباعة');}
  async function importJSON(file){if(!file)return;try{const raw=JSON.parse(await file.text());const incoming=raw.records||raw;validateDataset(incoming);if(!confirm(`استيراد ${incoming.length} خلية؟ سيُستبدل العمل الحالي في الصفحة. يُفضّل تصدير نسخة منه أولًا.`))return;snapshot();preservePreviousPositions(raw.positions);records=structuredClone(incoming);positions=initialLayout(records);selectedId=null;renderAll();fitZone('الكل');scheduleSave();notify('استُوردت البيانات وأعيد توزيعها على مستويات الأجيال');}catch(e){alert('تعذّر استيراد الملف: '+e.message);}finally{$('fileImport').value='';}}
  function resetOriginal(){if(!confirm('هل تريد استعادة الأسماء والروابط الأصلية؟ سيُحذف العمل المحفوظ محليًا ما لم تكن قد صدّرت نسخة JSON.'))return;snapshot();records=structuredClone(initialRecords);positions=initialLayout(records);selectedId='N001';renderAll();fitZone('gen:0');scheduleSave();notify('استُعيدت المسودة الأصلية في صفوف الأجيال الجديدة');}
  function setPhotoZoom(value){photoZoom=clamp(value,1,4);$('referenceImage').style.width=(100*photoZoom)+'%';$('photoZoomLabel').textContent=fmt(100*photoZoom)+'٪';}
  function toggleReference(){const panel=$('referencePanel');if(window.innerWidth<=1180){if(panel.classList.contains('visible'))panel.classList.remove('visible');else {panel.classList.remove('collapsed');panel.classList.add('visible');}}else{panel.classList.toggle('collapsed');$('workspace').classList.toggle('hide-reference',panel.classList.contains('collapsed'));fitZone(currentZone);}}

  function wireEvents(){
    $('boardSurface').addEventListener('pointerdown',startPan);window.addEventListener('pointermove',onPointerMove);window.addEventListener('pointerup',onPointerUp);window.addEventListener('pointercancel',onPointerUp);
    $('boardSurface').addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY<0?1.14:1/1.14,e.clientX,e.clientY);},{passive:false});
    $('zoomIn').onclick=()=>zoomBy(1.22);$('zoomOut').onclick=()=>zoomBy(1/1.22);$('fitBtn').onclick=()=>fitZone(currentZone);$('fitBranchBtn').onclick=()=>fitBranch(selectedId);$('nudgeFit').onclick=()=>fitZone('الكل');$('zoneSelect').onchange=e=>fitZone(e.target.value);
    $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('addRoot').onclick=()=>newCell(null);$('emptyAdd').onclick=()=>newCell(null);
    $('editForm').addEventListener('input',e=>{if(!e.target.matches('input,textarea,select'))return;markFormHistory();applyForm();});
    $('editForm').addEventListener('change',e=>{if(!e.target.matches('input,textarea,select'))return;markFormHistory();applyForm();});
    $('editForm').addEventListener('submit',e=>{e.preventDefault();applyForm();notify('حُفظت تغييرات هذه الخلية');});
    $('addChild').onclick=()=>newCell(selectedId);$('addSibling').onclick=()=>newCell(records.find(n=>n.id===selectedId)?.parent||null);$('deleteNode').onclick=removeSelected;
    $('search').addEventListener('input',e=>setSearch(e.target.value));$('search').addEventListener('keydown',e=>{if(e.key==='Enter'&&hits.size){const id=hits.values().next().value;selectNode(id,true);notify(`تم الانتقال إلى ${id}`);}});
    $('exportBtn').onclick=exportJSON;$('svgExport').onclick=exportSVG;$('importBtn').onclick=()=>$('fileImport').click();$('fileImport').onchange=e=>importJSON(e.target.files?.[0]);$('resetBtn').onclick=resetOriginal;
    $('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('gotIt').onclick=()=>$('helpDialog').close();
    for(const b of document.querySelectorAll('[data-photo]'))b.onclick=()=>{photo=Number(b.dataset.photo);const url=photoUrl(photo);$('referenceImage').src=url;$('fullPhoto').href=url;document.querySelectorAll('[data-photo]').forEach(n=>n.classList.toggle('active',n===b));};
    $('photoZoomIn').onclick=()=>setPhotoZoom(photoZoom+.5);$('photoZoomOut').onclick=()=>setPhotoZoom(photoZoom-.5);
    $('toggleRef').onclick=toggleReference;$('closeRef').onclick=()=>{const p=$('referencePanel');p.classList.remove('visible');p.classList.add('collapsed');$('workspace').classList.add('hide-reference');fitZone(currentZone);};
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){if(e.target.matches('input,textarea'))return;e.preventDefault();e.shiftKey?redo():undo();}if(e.key==='Escape'&&$('referencePanel').classList.contains('visible'))$('referencePanel').classList.remove('visible');});
    let lastSize=0;new ResizeObserver(()=>{const w=$('boardSurface').clientWidth;if(Math.abs(w-lastSize)>30){lastSize=w;if(!drag)fitZone(currentZone);}}).observe($('boardSurface'));
  }

  async function init(){try{const embedded=document.getElementById('embeddedData');if(embedded){initialRecords=JSON.parse(embedded.textContent);}else{const response=await fetch('/api/review-tree',{credentials:'same-origin'});if(!response.ok)throw Error('الدخول إلى مسودة النسب مقتصر على المراجعين المخولين');initialRecords=await response.json();}validateDataset(initialRecords);let loadedShared=false;try{const response=await fetch('/api/review-draft',{credentials:'same-origin'});if(response.ok){const shared=await response.json();serverRevision=shared.revision||0;if(shared.draft&&Array.isArray(shared.draft.records)){validateDataset(shared.draft.records);preservePreviousPositions(shared.draft.positions);records=shared.draft.records;positions=initialLayout(records);loadedShared=true;}}}catch(e){console.warn('تعذّر قراءة المسودة المشتركة',e);}if(!loadedShared&&!loadSaved()){records=structuredClone(initialRecords);positions=initialLayout(records);}wireEvents();selectedId=records.some(n=>n.id==='N001')?'N001':records[0]?.id||null;renderAll();$('boardLoading').remove();fitZone('gen:0');scheduleSave();}catch(e){$('boardLoading').textContent='تعذّر تشغيل محرر الشجرة: '+e.message;console.error(e);}}
  init();
})();
