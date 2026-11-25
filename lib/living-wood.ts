import type { HeritageTreeNode } from "./heritage-tree-layout";
import type { BoughPoint, BoughSegment } from "./heritage-boughs";

const round=(v:number)=>Number(v.toFixed(2));
const number=(id:string)=>Number(id.replace(/\D/g,""))||1;
const natural=(n:number)=>{const v=Math.sin(n*14.45+6.38)*72843.23;return v-Math.floor(v);};

/** Exactly the same centreline is used for the wood and its leaf attachments. */
export function livingWoodCurve(from:BoughPoint,to:BoughPoint){
  const dx=to.x-from.x,dy=to.y-from.y;
  const seed=natural(number(to.id)*23+number(from.id)*37);
  const sway=(seed-.5)*Math.min(54,Math.max(9,Math.abs(dy)*.32));
  const arch=Math.max(0,Math.abs(dx)*.30-Math.abs(dy)*.22);
  const p1x=from.x+dx*.24+sway,p1y=from.y+dy*.37-arch*.78;
  const p2x=to.x-dx*.24+sway*.72,p2y=to.y-dy*.33-arch*.68;
  const point=(t:number)=>{
    const v=1-t;
    return {x:v*v*v*from.x+3*v*v*t*p1x+3*v*t*t*p2x+t*t*t*to.x,
      y:v*v*v*from.y+3*v*v*t*p1y+3*v*t*t*p2y+t*t*t*to.y};
  };
  return {point,path:`M ${round(from.x)} ${round(from.y)} C ${round(p1x)} ${round(p1y)} ${round(p2x)} ${round(p2y)} ${round(to.x)} ${round(to.y)}`};
}

/**
 * Read-only natural branching for the experimental poster. Original parentage
 * is never modified. Every generated point has a `fork:` ID and is wood only.
 *
 * The old approved /tree-art rendering deliberately keeps its own algorithm.
 */
export function growLivingWood(nodes: HeritageTreeNode[]): BoughSegment[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map<string, HeritageTreeNode[]>();
  for (const child of nodes) {
    if (!child.parentId || !byId.has(child.parentId)) continue;
    const siblings = children.get(child.parentId) || [];
    siblings.push(child);
    children.set(child.parentId, siblings);
  }

  const result: BoughSegment[] = [];
  function add(from: BoughPoint, to: BoughPoint, descendants: number,
    parentDescendants: number, throughIds: string[], kind: BoughSegment["kind"]) {
    result.push({
      id: `${from.id}--${to.id}`,
      from, to, descendantCount: descendants,
      parentDescendants, throughIds, kind,
    });
  }
  function weight(node: HeritageTreeNode) { return Math.pow(1 + node.descendantCount, .46); }
  function centroid(group: HeritageTreeNode[]) {
    const total = group.reduce((value, node) => value + weight(node), 0);
    return group.reduce((value, node) => value + node.x * weight(node), 0) / total;
  }
  function mass(group: HeritageTreeNode[]) {
    return group.reduce((sum, node) => sum + node.descendantCount + 1, 0) - 1;
  }
  // Return contiguous child groups; two subfamilies are never interleaved.
  function split(group: HeritageTreeNode[]) {
    const total = group.reduce((sum, node) => sum + weight(node), 0);
    let leftMass = 0, boundary = 1, best = Infinity;
    for (let index = 1; index < group.length; index++) {
      leftMass += weight(group[index - 1]);
      const score = Math.abs(total - 2 * leftMass);
      if (score < best) { best = score; boundary = index; }
    }
    return [group.slice(0,boundary),group.slice(boundary)] as const;
  }
  let forkCounter = 0;
  function grow(from: BoughPoint, group: HeritageTreeNode[], availableMass: number,
    depth: number): void {
    if (group.length === 1) {
      const child = group[0];
      add(from,child,child.descendantCount,availableMass,[child.id],"tip");
      return;
    }
    const closest = Math.min(...group.map(node => from.y - node.y));
    // Staged, softly staggered forks eliminate the rigid all-at-one-height
    // candelabra structure. Every division inherits its parent's direction.
    const progress = Math.max(16,Math.min(125,closest * (depth===0?.36:.48)));
    const toward = centroid(group);
    const fork: BoughPoint = {
      id: `fork:living:${forkCounter++}`,
      x: from.x + (toward-from.x) * (depth===0?.29:.51),
      y: from.y - Math.min(closest-8,progress),
    };
    add(from,fork,mass(group),availableMass,group.map(node=>node.id),depth===0?"shared":"fork");
    const [left,right] = split(group);
    grow(fork,left,mass(left),depth+1);
    grow(fork,right,mass(right),depth+1);
  }
  for (const parent of nodes) {
    const group = (children.get(parent.id)||[]).sort((a,b)=>a.x-b.x);
    if (!group.length) continue;
    if (group.length===1) {
      add(parent,group[0],group[0].descendantCount,parent.descendantCount,[group[0].id],"continuation");
    } else {
      grow(parent,group,parent.descendantCount,0);
    }
  }
  return result;
}
