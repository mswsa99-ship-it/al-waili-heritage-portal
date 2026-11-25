"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, Compass, Download, Focus, Leaf, Maximize2, MousePointer2, Printer, Search, Sprout, TreePine, ZoomIn, ZoomOut } from "lucide-react";
import { buildHeritageTree, heritageBranchThickness, resolveHeritageRootId, type HeritagePerson, type HeritageTreeNode } from "@/lib/heritage-tree-layout";
import { buildBotanicalBoughs, type BoughPoint, type BoughSegment } from "@/lib/heritage-boughs";

type ViewBox = { x: number; y: number; width: number; height: number };
const nameFor = (id: string, people: HeritagePerson[]) => people.find(person => person.id === id)?.name || "غير معروف";
const colors = ["#b4de16", "#84c62b", "#99d50c", "#c1e637", "#80b83a", "#8fcf21", "#a6d72c", "#78ba35"];
const round = (value: number) => Number(value.toFixed(2));
const variance = (number: number) => {
  const value = Math.sin(number * 127.1 + 9.62) * 43758.5453;
  return value - Math.floor(value);
};

function branchGeometry(parent: BoughPoint, child: BoughPoint, parentWidth: number, childWidth: number) {
  const dx = child.x - parent.x, dy = child.y - parent.y;
  const length = Math.hypot(dx, dy);
  // The limb grows upward first and only later turns toward a child. This
  // softer shape keeps separate family corridors without radial spokes.
  const wobble = (variance(Number(child.id.replace(/\D/g, "")) || 1) - .5) * Math.min(100, length * .19);
  const p1x = parent.x + dx * .16 + wobble;
  const p1y = parent.y - Math.min(125, length * .42);
  const p2x = child.x - dx * .13 + wobble * .28;
  const p2y = child.y + Math.min(145, length * .29);
  const centerline = `M ${round(parent.x)} ${round(parent.y)} C ${round(p1x)} ${round(p1y)} ${round(p2x)} ${round(p2y)} ${round(child.x)} ${round(child.y)}`;
  const perpendicular = (vx: number, vy: number) => {
    const magnitude = Math.hypot(vx, vy) || 1;
    return { x: -vy / magnitude, y: vx / magnitude };
  };
  const from = perpendicular(p1x - parent.x, p1y - parent.y);
  const to = perpendicular(child.x - p2x, child.y - p2y);
  // Retain substantial wood near its parent even when the child is a terminal
  // leaf; its twig must *taper into* a leaf, not begin as a hair-thin cable.
  const thick = Math.min(parentWidth * .94, Math.max(childWidth * 1.42, parentWidth * .38)) / 2;
  const thin = Math.max(2.1, childWidth * .35);
  const ribbon = `M ${round(parent.x + from.x * thick)} ${round(parent.y + from.y * thick)}
    C ${round(p1x + from.x * thick * .91)} ${round(p1y + from.y * thick * .91)} ${round(p2x + to.x * thin * 1.2)} ${round(p2y + to.y * thin * 1.2)} ${round(child.x + to.x * thin)} ${round(child.y + to.y * thin)}
    L ${round(child.x - to.x * thin)} ${round(child.y - to.y * thin)}
    C ${round(p2x - to.x * thin * 1.2)} ${round(p2y - to.y * thin * 1.2)} ${round(p1x - from.x * thick * .91)} ${round(p1y - from.y * thick * .91)} ${round(parent.x - from.x * thick)} ${round(parent.y - from.y * thick)} Z`;
  return { ribbon, centerline };
}

function organicLeafPath(width: number, height: number, skew: number) {
  const w = width / 2, h = height / 2;
  return `M 0 ${-h} C ${round(w * .55 + skew)} ${round(-h * .95)} ${round(w * .92)} ${round(-h * .46)} ${round(w * .89)} ${round(-h * .12)} C ${round(w * 1.1)} ${round(h * .24)} ${round(w * .58)} ${round(h * .64)} 0 ${round(h)} C ${round(-w * .28)} ${round(h * .72)} ${round(-w * .88)} ${round(h * .55)} ${round(-w * .98)} ${round(h * .11)} C ${round(-w * 1.04)} ${round(-h * .33)} ${round(-w * .53)} ${round(-h * .77)} 0 ${-h} Z`;
}

// Purely ornamental background leaves. These have no IDs, labels, click
// actions or person data; they only make the canopy resemble a natural tree.
function DecorativeCanopy({ nodes, boughs }: { nodes: HeritageTreeNode[]; boughs: BoughSegment[] }) {
  const leaves = useMemo(() => {
    const placed: { x: number; y: number; size: number; rotation: number; tone: number; anchorX: number; anchorY: number }[] = [];
    const terminals = nodes.filter(node => node.depth > 0 && node.childCount === 0);
    if (!terminals.length) return placed;
    const minX = Math.min(...terminals.map(node => node.x));
    const maxX = Math.max(...terminals.map(node => node.x));
    const minY = Math.min(...terminals.map(node => node.y));
    const maxY = Math.max(...terminals.map(node => node.y));
    const occupied = (leafSize: number, degrees: number) => {
      const radians = degrees * Math.PI / 180;
      return {
        w: leafSize * (Math.abs(Math.cos(radians)) + 1.4 * Math.abs(Math.sin(radians))),
        h: leafSize * (Math.abs(Math.sin(radians)) + 1.4 * Math.abs(Math.cos(radians))),
      };
    };
    const freeForSprig = (tx: number, ty: number, size: number, rotation: number) => {
      if (ty > -270) return false;
      const ownBox = occupied(size, rotation);
      if (nodes.some(node => {
        const halfWidth = node.childCount ? 85 : 66;
        const halfHeight = node.childCount ? 55 : 75;
        return Math.abs(tx - node.x) < halfWidth + ownBox.w / 2 + 6
          && Math.abs(ty - node.y) < halfHeight + ownBox.h / 2 + 6;
      })) return false;
      return !placed.some(node => {
        const box = occupied(node.size, node.rotation);
        return Math.abs(tx - node.x) < (ownBox.w + box.w) / 2 + 6
          && Math.abs(ty - node.y) < (ownBox.h + box.h) / 2 + 6;
      });
    };
    for (let row = 0, y = minY - 110; y <= maxY + 110; row++, y += 43) {
      for (let col = 0, x = minX - 140 + (row % 2 ? 21 : 0); x <= maxX + 140; col++, x += 45) {
        const seed = row * 71 + col * 17;
        if (variance(seed + 4) < .13) continue;
        const size = 28 + variance(seed + 3) * 24;
        const rotation = -28 + variance(seed + 5) * 56;
        const jitterX = (variance(seed + 1) - .5) * 22;
        const jitterY = (variance(seed + 2) - .5) * 22;
        const tx = x + jitterX, ty = y + jitterY;
        let nearest: HeritageTreeNode | null = null, nearestDistance = Infinity;
        for (const node of terminals) {
          const distance = Math.hypot(tx - node.x, ty - node.y);
          if (distance < nearestDistance) { nearest = node; nearestDistance = distance; }
        }
        // Every ornamental leaf must have its own free space: it cannot cover
        // a person's tip leaf, a named branch junction or another ornament.
        if (!nearest || nearestDistance > 205) continue;
        if (!freeForSprig(tx, ty, size, rotation)) continue;
        placed.push({ x: tx, y: ty, size, rotation, tone: Math.floor(variance(seed + 6) * colors.length),
          anchorX: nearest.x, anchorY: nearest.y });
      }
    }
    // Place extra foliage along long *existing* wooden boughs as botanical
    // decoration only. This fills the interior without adding fictitious
    // genealogy nodes, and every leaf is checked against all named labels.
    for (const bough of boughs) {
      const { from: parent, to: node } = bough;
      const dx = node.x - parent.x, dy = node.y - parent.y;
      const length = Math.hypot(dx, dy);
      if (length < 170 || Math.max(node.y, parent.y) > -200) continue;
      const count = Math.min(7, Math.max(3, Math.ceil(length / 125)));
      for (let index = 0; index < count; index++) {
        const seed = (Number(node.id.replace(/\D/g, "")) || 1) * 19 + index * 17 + (bough.kind === "tip" ? 27 : 0);
        const t = (index + 1) / (count + 1);
        const direction = variance(seed) > .5 ? 1 : -1;
        const normalX = (dy / length) * direction;
        const normalY = (-dx / length) * direction;
        const anchorX = parent.x + dx * t, anchorY = parent.y + dy * t;
        const reach = 42 + variance(seed + 1) * 49;
        const tx = anchorX + normalX * reach, ty = anchorY + normalY * reach;
        const size = 39 + variance(seed + 2) * 25;
        const rotation = (variance(seed + 3) - .5) * 44;
        if (!freeForSprig(tx, ty, size, rotation)) continue;
        placed.push({ x: tx, y: ty, size, rotation,
          tone: Math.floor(variance(seed + 4) * colors.length), anchorX, anchorY });
      }
    }
    return placed;
  }, [nodes, boughs]);
  return <g aria-hidden="true" className="art-tree-decoration">
    {leaves.map((leaf, index) => <path key={`twig-${index}`}
      d={`M ${round(leaf.anchorX)} ${round(leaf.anchorY)} Q ${round((leaf.anchorX + leaf.x) / 2 + (variance(index + 22) - .5) * 37)} ${round((leaf.anchorY + leaf.y) / 2 - 35)} ${round(leaf.x)} ${round(leaf.y)}`}
      stroke="#48311c" strokeWidth={1.7 + variance(index) * 1.9} strokeLinecap="round" fill="none" opacity=".63"/>)}
    {leaves.map((leaf, index) => <g key={index} transform={`translate(${round(leaf.x)} ${round(leaf.y)}) rotate(${round(leaf.rotation)})`} opacity={.81 + variance(index + 10) * .18}>
      <path d={organicLeafPath(leaf.size, leaf.size * 1.4, variance(index) * 9)} fill={colors[leaf.tone]} stroke="#78a444" strokeWidth="1.1"/>
      <path d={`M 0 ${round(leaf.size * .52)} Q 8 0 0 ${round(-leaf.size * .53)}`} stroke="#e8f6a9" strokeWidth="1.6" fill="none" opacity=".56"/>
    </g>)}
  </g>;
}

function PersonMark({ node, active, muted, onPick }: {
  node: HeritageTreeNode;
  active: boolean;
  muted: boolean;
  onPick: (id: string) => void;
}) {
  const serial = Number(node.id.replace(/\D/g, "")) || 1;
  const isWood = node.childCount > 0;
  const largeBough = node.descendantCount > 55;
  const mediumBough = node.descendantCount > 12;
  const width = isWood ? (largeBough ? 154 : mediumBough ? 138 : 116)
    : 92 + (variance(serial) - .5) * 10;
  const height = isWood ? (largeBough ? 93 : mediumBough ? 83 : 73)
    : 124 + (variance(serial + 5) - .5) * 8;
  const fill = isWood
    ? (largeBough ? "#d7ad47" : mediumBough ? "#edc971" : "#f6e7be")
    : colors[serial % colors.length];
  const parts = node.name.trim().split(/\s+/);
  const twoLines = node.name.length > 9 && parts.length > 1;
  const cut = Math.ceil(parts.length / 2);
  const display = twoLines ? [parts.slice(0, cut).join(" "), parts.slice(cut).join(" ")] : [node.name];
  const longest = Math.max(...display.map(part => part.length));
  const baseSize = isWood ? (largeBough ? 26 : 23) : 24;
  const fontSize = Math.max(11, Math.min(baseSize, (width - 12) / (longest * .62)));
  return <g
    className={`art-svg-person ${active ? "selected" : ""} ${muted ? "muted" : ""}`}
    transform={`translate(${round(node.x)} ${round(node.y)})`}
    role="button" tabIndex={0}
    aria-label={`${node.name}، الجيل ${node.generation}، ${node.childCount} أبناء مسجلين`}
    onClick={() => onPick(node.id)}
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(node.id); } }}
  >
    <title>{`${node.name} — الجيل ${node.generation} — ${node.descendantCount} من الذرية المسجلة بعده`}</title>
    {isWood
      ? <>
          {/* A wooden family junction has a gold name plate directly on the
              growing branch. Only an actual recorded terminal gets a leaf. */}
          <path d={`M ${-width / 2 + 11} ${-height / 2} Q 0 ${-height / 2 - 9} ${width / 2 - 11} ${-height / 2} Q ${width / 2 + 8} ${-height / 4} ${width / 2} 0 Q ${width / 2 + 7} ${height / 4} ${width / 2 - 11} ${height / 2} Q 0 ${height / 2 + 9} ${-width / 2 + 11} ${height / 2} Q ${-width / 2 - 7} 0 ${-width / 2 + 11} ${-height / 2} Z`}
            fill={fill} stroke={active ? "#254c38" : "#6f4d23"} strokeWidth={active ? 6 : 4}/>
          <ellipse rx={width / 2 - 8} ry={height / 2 - 7} fill="none" stroke="#fff4ca" strokeWidth="2.2" opacity=".85"/>
        </>
      : <g transform={`rotate(${round((variance(serial + 2) - .5) * 34)})`}>
          <path d={organicLeafPath(width, height, (variance(serial + 13) - .5) * 11)}
            fill={fill} stroke={active ? "#234d35" : "#5b962b"} strokeWidth={active ? 5 : 1.9}/>
          <path d={`M 0 ${round(height * .39)} Q ${round(width * .08)} ${round(height * .08)} 0 ${round(-height * .40)}`} fill="none" stroke="#2d6a318a" strokeWidth="2.5"/>
          <path d={`M 0 ${round(-height * .18)} Q ${round(width * .21)} ${round(-height * .3)} ${round(width * .35)} ${round(-height * .28)} M 0 ${round(height * .03)} Q ${round(-width * .19)} ${round(-height * .10)} ${round(-width * .35)} ${round(-height * .04)} M 0 ${round(height * .23)} Q ${round(width * .18)} ${round(height * .1)} ${round(width * .33)} ${round(height * .11)}`} stroke="#f5f8bf82" strokeWidth="1.9" fill="none"/>
        </g>}
    <text direction="rtl" textAnchor="middle" dominantBaseline="middle" fill={isWood ? "#382b1a" : "#1d3727"}
      fontFamily="'Noto Kufi Arabic',sans-serif" fontWeight="800" fontSize={fontSize} stroke="#f9f4e2" strokeWidth=".65" paintOrder="stroke">
      {display.map((part, index) => <tspan key={index} x="0" dy={index === 0 ? (display.length === 2 ? -fontSize * .50 : 1) : fontSize * 1.12}>{part}</tspan>)}
    </text>
  </g>;
}

export function TreeArtClient({ people, sourceLabel }: { people: HeritagePerson[]; sourceLabel: string }) {
  const [branch, setBranch] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [manualView, setManualView] = useState<ViewBox | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const draggedAt = useRef(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const all = useMemo(() => buildHeritageTree(people), [people]);
  const rootId = useMemo(() => resolveHeritageRootId(people), [people]);
  const layout = useMemo(() => buildHeritageTree(people, rootId, branch === "all" ? null : branch), [people, rootId, branch]);
  const boughs = useMemo(() => buildBotanicalBoughs(layout.nodes), [layout]);
  const byId = useMemo(() => new Map(all.nodes.map(node => [node.id, node])), [all]);
  const visibleById = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout]);
  const view = manualView ?? layout.bounds;
  const selected = selectedId ? byId.get(selectedId) || null : null;

  const lineage = useMemo(() => {
    if (!selected) return [];
    const path: HeritageTreeNode[] = [], seen = new Set<string>();
    let current: HeritageTreeNode | undefined = selected;
    while (current && !seen.has(current.id)) {
      path.push(current);
      seen.add(current.id);
      if (current.id === rootId) break;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path.reverse();
  }, [selected, byId, rootId]);
  const selectedPath = useMemo(() => new Set(lineage.map(node => node.id)), [lineage]);
  const results = useMemo(() => {
    const search = query.trim().replaceAll("أ", "ا").replaceAll("إ", "ا");
    if (search.length < 2) return [];
    return all.nodes.filter(node => node.name.replaceAll("أ", "ا").replaceAll("إ", "ا").includes(search)).slice(0, 10);
  }, [all, query]);

  useEffect(() => {
    if (!focusRequest) return;
    const node = visibleById.get(focusRequest);
    if (!node) return;
    setManualView({ x: node.x - 440, y: node.y - 330, width: 880, height: 660 });
    setFocusRequest(null);
  }, [focusRequest, visibleById]);

  function changeBranch(next: string) {
    setBranch(next);
    setSelectedId(null);
    setManualView(null);
    setFocusRequest(null);
    setQuery("");
  }
  function zoom(factor: number) {
    const box = view;
    const newWidth = Math.max(260, Math.min(layout.bounds.width * 2, box.width * factor));
    const newHeight = Math.max(210, Math.min(layout.bounds.height * 2, box.height * factor));
    setManualView({ x: box.x + (box.width - newWidth) / 2, y: box.y + (box.height - newHeight) / 2, width: newWidth, height: newHeight });
  }
  function downloadTreeSvg() {
    if (!svgRef.current) return;
    const copy = svgRef.current.cloneNode(true) as SVGSVGElement;
    const { x, y, width, height } = layout.bounds;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const exportX = x - 85, exportY = y - 360;
    const exportWidth = width + 170, exportHeight = height + 510;
    copy.setAttribute("viewBox", `${exportX} ${exportY} ${exportWidth} ${exportHeight}`);
    copy.setAttribute("width", "2800");
    copy.setAttribute("height", String(Math.round(2800 * exportHeight / exportWidth)));
    const ns = "http://www.w3.org/2000/svg";
    const addText = (content: string, atY: number, fontSize: number, color: string, bold = false) => {
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(x + width / 2));
      label.setAttribute("y", String(atY));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-family", "Amiri, serif");
      label.setAttribute("font-size", String(fontSize));
      label.setAttribute("font-weight", bold ? "700" : "500");
      label.setAttribute("fill", color);
      label.textContent = content;
      copy.appendChild(label);
    };
    const frame = document.createElementNS(ns, "rect");
    for (const [key, value] of Object.entries({ x: exportX + 17, y: exportY + 17,
      width: exportWidth - 34, height: exportHeight - 34,
      fill: "none", stroke: "#153c35", "stroke-width": "23" })) frame.setAttribute(key, String(value));
    copy.appendChild(frame);
    addText("بِسْمِ اللّٰهِ الرَّحْمَٰنِ الرَّحِيمِ", y - 245, 51, "#485744");
    addText("شجرة ذرية حمد بن محمد", y - 143, 84, "#153c35", true);
    addText("الجد حمد وأبناؤه منيع وسليمان وعبد الله", y - 72, 37, "#967c48", true);
    addText("الجذور التي تجمعنا", y - 8, 33, "#95a36c");
    addText(`${layout.nodes.length} اسمًا من الهيكل القائم • الزوائد النباتية زخرفية وليست أسماء`, y + height + 94, 24, "#726c50");
    const xml = new XMLSerializer().serializeToString(copy);
    const url = URL.createObjectURL(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "shajarat-hamad-al-waili.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function printPoster() {
    setManualView(null);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  }
  function pick(id: string) {
    if (Date.now() - draggedAt.current < 180) return;
    setSelectedId(id);
  }
  function chooseSearch(id: string) {
    const person = byId.get(id);
    if (!person) return;
    setBranch(person.branchId === rootId ? "all" : person.branchId);
    setSelectedId(id);
    setFocusRequest(id);
    setQuery("");
  }
  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x, dy = event.clientY - pointer.current.y;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    pointer.current = { x: event.clientX, y: event.clientY, moved: true };
    draggedAt.current = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(rect.width / view.width, rect.height / view.height);
    if (ratio <= 0) return;
    setManualView(box => {
      const prior = box ?? layout.bounds;
      return { ...prior, x: prior.x - dx / ratio, y: prior.y - dy / ratio };
    });
  }
  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const zoomRatio = Math.round(100 * layout.bounds.width / view.width);

  return <main className="art-tree-page">
    <section className="art-tree-hero">
      <div className="art-tree-hero-copy">
        <span className="art-tree-kicker"><Sprout size={17}/> المشجرة الفنية التفاعلية</span>
        <h1>من جذور <em>حمد</em>،<br/>تمتدّ أغصان الأسرة.</h1>
        <p>مشجرة إلكترونية تتفرع من حمد بن محمد، عبر أبنائه <strong>منيع وسليمان وعبد الله</strong>، وتعرض الأسماء بالاتصال الأبوي نفسه المسجل في الهيكل.</p>
        <div className="art-tree-hero-stats">
          <span><strong>{all.nodes.length}</strong> اسمًا في الرسم</span>
          <span><strong>{new Set(all.nodes.map(node => node.generation)).size}</strong> أجيال</span>
          <span><strong>{all.branches.length}</strong> فروع رئيسية</span>
        </div>
      </div>
      <div className="art-tree-hero-badge"><img src="/waili-seal.png" alt="ختم أسرة الوايلي"/><span>الجذور التي تجمعنا</span></div>
    </section>

    <section className="art-tree-controls" aria-label="أدوات المشجرة">
      <div className="art-tree-controls-head"><div><span>01 / استكشاف الذرية</span><h2>لوحة الأنساب الحية</h2></div><p>انقر على لوحة اسم أحد الآباء أو على ورقة أحد أطراف الشجرة لتتبّع النسب. سمك كل غصن يعكس حجم الذرية المسجلة فيه.</p></div>
      <div className="art-tree-control-grid">
        <div className="art-tree-branch-tabs" aria-label="اختيار فرع">
          <button type="button" className={branch === "all" ? "on" : ""} onClick={() => changeBranch("all")}><TreePine size={17}/> كامل المشجرة <small>{all.nodes.length}</small></button>
          {all.branches.map(item => <button type="button" key={item.id} className={branch === item.id ? "on" : ""} onClick={() => changeBranch(item.id)}>
            {item.name} <small>{item.descendantCount}</small>
          </button>)}
        </div>
        <div className="art-tree-search">
          <Search size={20}/>
          <input aria-label="ابحث عن شخص مسجل في المشجرة" placeholder="ابحث عن اسم في الأجيال…" value={query} onChange={event => setQuery(event.target.value)}/>
          {query.trim().length > 1 && <div className="art-tree-results" role="listbox">
            {results.length ? results.map(node => <button key={node.id} type="button" onClick={() => chooseSearch(node.id)}>
              <strong>{node.name}</strong><span>الجيل {node.generation} · فرع {nameFor(node.branchId, people)}</span><ArrowLeft size={14}/>
            </button>) : <p>لم يُعثر على اسم مطابق.</p>}
          </div>}
        </div>
      </div>
    </section>

    <section className="art-tree-workspace">
      <div className="art-tree-canvas">
        <div className="art-tree-canvas-top">
          <div><Leaf size={19}/><strong>{branch === "all" ? "ذرية حمد كاملة" : `ذرية ${nameFor(branch, people)} من حمد`}</strong><span>{layout.nodes.length} اسمًا ظاهرًا</span></div>
          <div className="art-tree-zoom">
            <button type="button" aria-label="تقريب الرسم" title="تقريب" onClick={() => zoom(.72)}><ZoomIn size={19}/></button>
            <output aria-label="نسبة التكبير">{zoomRatio}%</output>
            <button type="button" aria-label="إبعاد الرسم" title="إبعاد" onClick={() => zoom(1.4)}><ZoomOut size={19}/></button>
            <button type="button" aria-label="إظهار المشجرة كاملة" title="إعادة احتواء الرسم" onClick={() => setManualView(null)}><Maximize2 size={18}/></button>
            <button type="button" aria-label="تنزيل المشجرة بصيغة SVG" title="تنزيل الرسم بجودة عالية" onClick={downloadTreeSvg}><Download size={18}/></button>
            <button type="button" aria-label="طباعة المشجرة" title="طباعة الملصق" onClick={printPoster}><Printer size={18}/></button>
          </div>
        </div>

        <div className="art-tree-poster">
          <div className="art-tree-poster-border" aria-hidden="true">✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦</div>
          <div className="art-tree-poster-heading">
            <span>بِسْمِ اللّٰهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
            <h3>شجرة ذرية حمد بن محمد</h3>
            <p>الجد حمد وأبناؤه منيع وسليمان وعبد الله</p>
            <div className="art-tree-poster-flourish">❧ <span>الجذور التي تجمعنا</span> ❧</div>
          </div>
        <svg className="art-tree-svg" ref={svgRef} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid meet" aria-label="رسم إلكتروني تفاعلي لتفريعات ذرية حمد" role="img"
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <defs>
            <radialGradient id="heritagePaper"><stop offset="0" stopColor="#fffef5"/><stop offset=".82" stopColor="#fbf9ed"/><stop offset="1" stopColor="#f2ecd8"/></radialGradient>
            <radialGradient id="heritageCanopy"><stop offset="0" stopColor="#cadb9a" stopOpacity=".13"/><stop offset=".70" stopColor="#bdd48b" stopOpacity=".06"/><stop offset="1" stopColor="#bdd48b" stopOpacity="0"/></radialGradient>
            <linearGradient id="heritageBark" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#28160e"/><stop offset=".19" stopColor="#50301c"/><stop offset=".43" stopColor="#805235"/><stop offset=".62" stopColor="#593621"/><stop offset=".83" stopColor="#382117"/><stop offset="1" stopColor="#28160d"/></linearGradient>
            <filter id="leafShadow"><feDropShadow dx="1.5" dy="4" stdDeviation="2.1" floodColor="#273d25" floodOpacity=".19"/></filter>
            <pattern id="paperGrain" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="9" cy="28" r="1" fill="#bda874" opacity=".18"/><circle cx="33" cy="12" r="1" fill="#bda874" opacity=".12"/><path d="M48 52 l6 -2" stroke="#bda874" opacity=".14"/></pattern>
          </defs>
          <rect x={layout.bounds.x - 1200} y={layout.bounds.y - 900} width={layout.bounds.width + 2400} height={layout.bounds.height + 1800} fill="url(#heritagePaper)"/>
          <rect x={layout.bounds.x - 1200} y={layout.bounds.y - 900} width={layout.bounds.width + 2400} height={layout.bounds.height + 1800} fill="url(#paperGrain)"/>
          <ellipse cx={layout.bounds.x + layout.bounds.width / 2} cy={layout.bounds.y + layout.bounds.height * .44}
            rx={layout.bounds.width * .49} ry={layout.bounds.height * .42} fill="url(#heritageCanopy)"/>
          <DecorativeCanopy nodes={layout.nodes} boughs={boughs}/>
          {/* A hand-shaped trunk, not a geometric post. Dark outer edges and
              fine broken grain give the engraving some organic character. */}
          <path d="M -202 480 C -154 340 -112 207 -92 61 C -84 -13 -66 -98 -23 -188 Q -5 -216 0 -217 Q 12 -200 35 -177 C 87 -120 93 -22 102 55 C 125 210 167 352 206 480 Q 51 505 -202 480 Z" fill="url(#heritageBark)" stroke="#28150e" strokeWidth="7"/>
          <path d="M -145 454 C -119 293 -83 161 -50 -20 M -93 410 Q -68 181 -17 -78 M 114 450 Q 80 262 60 66 M 158 459 Q 112 270 83 131 M -18 413 Q -8 218 5 59 M 35 402 Q 35 225 26 104" fill="none" stroke="#c69e67" strokeWidth="5.2" opacity=".28"/>
          <path d="M -178 470 Q -125 277 -104 119 M 175 477 Q 107 307 105 148 M -65 400 Q -44 174 -14 -14 M 57 437 Q 40 245 37 92" stroke="#1e120e" strokeWidth="8" opacity=".3" fill="none"/>
          {boughs.map(segment => {
            const related = !selected || segment.throughIds.some(id => selectedPath.has(id));
            const parentWidth = heritageBranchThickness(segment.parentDescendants, layout.nodes.length);
            const childWidth = heritageBranchThickness(segment.descendantCount, layout.nodes.length);
            const geometry = branchGeometry(segment.from, segment.to, parentWidth, childWidth);
            return <g key={segment.id} opacity={related ? 1 : .16}>
              <path d={geometry.ribbon} fill={selected && related ? "#9e782f" : "#2c1b12"} stroke="#28180f" strokeWidth="1.1" strokeLinejoin="round"/>
              <path d={geometry.centerline} stroke={selected && related ? "#ecd28c" : "#765036"} strokeWidth={Math.max(.8, childWidth * .09)} strokeLinecap="round" fill="none" opacity=".54"/>
            </g>;
          })}
          {layout.nodes.filter(node => node.depth > 0).map(node => <PersonMark key={node.id} node={node}
            active={node.id === selectedId} muted={!!selected && !selectedPath.has(node.id)} onPick={pick}/>)}
          <g className="art-svg-root" onClick={() => pick(rootId)} role="button" tabIndex={0}
            onKeyDown={event => { if (event.key === "Enter") pick(rootId); }}>
            <title>حمد بن محمد، الأصل الذي تبدأ منه المشجرة التفاعلية</title>
            <path d="M -131 -63 Q -151 -64 -148 -41 Q -162 -25 -153 -1 Q -165 21 -146 37 Q -147 58 -124 62 Q 0 98 127 62 Q 153 62 148 38 Q 164 16 152 -4 Q 164 -27 147 -43 Q 152 -68 131 -63 Q 0 -100 -131 -63 Z" fill="#fff7de" stroke="#88683a" strokeWidth="10"/>
            <path d="M -122 -54 Q -145 -54 -137 -34 Q -150 -10 -138 0 Q -149 22 -134 32 Q -135 50 -118 54 Q 0 82 117 54 Q 141 51 135 32 Q 147 12 137 -4 Q 149 -27 137 -39 Q 141 -55 119 -54 Q 0 -83 -122 -54 Z" fill="none" stroke="#dabf82" strokeWidth="3.5"/>
            <text x="0" y="18" textAnchor="middle" fontSize="63" fontFamily="'Amiri',serif" fontWeight="bold" fill="#201f17">حمد</text>
          </g>
          <g transform="translate(0 430)" aria-hidden="true">
            <path d="M -250 55 Q -140 0 -25 40 Q 95 -20 260 45" stroke="#497e41" strokeWidth="26" strokeLinecap="round" fill="none"/>
            <path d="M -258 60 Q 5 92 267 57" stroke="#8db955" strokeWidth="24" fill="none" strokeLinecap="round"/>
            {Array.from({length:35},(_,i) => {
              const x = -250 + i * 15;
              const rise = 30 + (i * 29) % 58;
              return <path key={i} d={`M ${x} 64 q ${i%2 ? -11 : 12} ${-rise*.5} ${i%2 ? -18 : 12} ${-rise}`} fill="none" stroke={i%3===0?"#6b9d43":"#92b85c"} strokeWidth={i%2 ? 6 : 4.5} strokeLinecap="round"/>;
            })}
          </g>
        </svg>
          <div className="art-tree-poster-legend"><span><i className="gold"/> لوحة ذهبية: صاحب ذرية على غصن</span><span><i className="leaf"/> ورقة خضراء: آخر فرع مسجل</span><span>{layout.nodes.filter(node => node.childCount === 0).length} ورقة نهائية · الأوراق الصغيرة زخرفية فقط</span></div>
          <div className="art-tree-poster-border" aria-hidden="true">✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦ الوايلي ✦</div>
        </div>
        <div className="art-tree-canvas-foot"><span><MousePointer2 size={16}/> اسحب الرسم للتحريك، واختر أي اسم للتفاصيل.</span><span><Compass size={16}/> {sourceLabel} · قراءة فقط</span></div>
      </div>

      <aside className="art-tree-inspector">
        {selected ? <>
          <div className="art-tree-inspector-label"><Focus size={18}/> بطاقة الاسم المختار</div>
          <div className="art-tree-inspector-emblem"><Leaf size={28}/></div>
          <h3>{selected.name}</h3>
          <p className="art-tree-inspector-sub">الجيل {selected.generation} من الهيكل · فرع {nameFor(selected.branchId, people)}</p>
          <div className="art-tree-inspector-stats">
            <div><strong>{selected.childCount}</strong><span>أبناء مسجلون مباشرة</span></div>
            <div><strong>{selected.descendantCount}</strong><span>أسماء في ذريته</span></div>
          </div>
          <p className="art-tree-inspector-disclaimer">
            {selected.childCount > 0
              ? `هذا الاسم موضع غصن خشبي، وسمكه مرتبط بامتداد ذريته المسجلة البالغة ${selected.descendantCount} اسمًا.`
              : "هذه ورقة نهائية لأن هذا الاسم ليس له أبناء مسجلون حاليًا في الهيكل؛ ولا يعني ذلك الجزم بعدم وجود ذرية."}
          </p>
          <div className="art-tree-lineage-title">سلسلة النسب من حمد</div>
          <ol className="art-tree-lineage">
            {lineage.map(person => <li key={person.id}><span>{person.name}</span><small>الجيل {person.generation}</small></li>)}
          </ol>
          <button type="button" className="art-tree-inspector-focus" onClick={() => setFocusRequest(selected.id)}><Focus size={17}/> تقريب على موقع الاسم</button>
          <p className="art-tree-inspector-disclaimer">هذه بطاقة استعراض للهيكل المسجل، وليست تصريحًا بنشر معلومات شخصية أو اعتمادًا مستقلًا للنسب.</p>
        </> : <>
          <div className="art-tree-inspector-label"><TreePine size={18}/> دليل التصفح</div>
          <div className="art-tree-inspector-art"><TreePine size={74} strokeWidth={.85}/><span>شجرة تمتدّ بجذورها</span></div>
          <h3>لكل غصن امتداد، ولكل ورقة اسم.</h3>
          <p className="art-tree-inspector-sub">ابدأ من الجد حمد. أصحاب الذرية يظهرون بلوحات على الأغصان، ويزيد سمك الغصن بحسب كثرة ذريتهم. الورقة الخضراء تظهر فقط عند آخر اسم مسجل في تفريعها.</p>
          <div className="art-tree-inspector-branches">
            {all.branches.map(item => <button type="button" onClick={() => changeBranch(item.id)} key={item.id}><span className="art-tree-branch-mark"/><span>فرع {item.name}</span><strong>{item.descendantCount}</strong><ArrowLeft size={14}/></button>)}
          </div>
          <p className="art-tree-inspector-disclaimer">اختيار أحد الفروع يكبره للقراءة، ولا يغيّر أصل المشجرة أو بياناتها.</p>
        </>}
      </aside>
    </section>
    <div className="art-tree-bottom-note"><Leaf size={17}/><span>تصميم مستقل للعرض والتفاعل؛ لا يكتب في قاعدة البيانات ولا يغيّر تصنيف الأسماء أو إجراءات مراجعة لجنة النسب.</span></div>
  </main>;
}
