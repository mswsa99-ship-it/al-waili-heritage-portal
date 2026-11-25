import { buildHeritageTree, resolveHeritageRootId, type HeritagePerson, type HeritageTreeNode } from "./heritage-tree-layout";
import type { BoughSegment } from "./heritage-boughs";
import { growLivingWood, livingWoodCurve } from "./living-wood";
import { softenGenealogicalCrossings } from "./living-routing";

export type LivingPerson = HeritageTreeNode & { artWidth: number; artHeight: number };
export type LivingLeaf = { x: number; y: number; angle: number; width: number; height: number; anchorX: number; anchorY: number; shade: number };
export type LivingCanopy = {
  nodes: LivingPerson[];
  boughs: BoughSegment[];
  foliage: LivingLeaf[];
  sourceCount: number;
  terminalCount: number;
  branches: { id: string; name: string; descendantCount: number }[];
};

const CENTER_X = 700;
const CENTER_Y = 681;
const RX = 652;
const RY = 510;
const ROOT_Y = 1290;
const hash = (id: string | number) => {
  const n = typeof id === "string" ? Array.from(id).reduce((v, c) => v * 31 + c.charCodeAt(0), 7) : id;
  const s = Math.sin(n * 127.13 + 31.4) * 43758.5453;
  return s - Math.floor(s);
};

export function livingSize(node: Pick<HeritageTreeNode, "childCount" | "descendantCount">) {
  if (node.childCount === 0) return { w: 44, h: 60 };
  if (node.descendantCount > 50) return { w: 89, h: 45 };
  if (node.descendantCount > 12) return { w: 78, h: 41 };
  return { w: 69, h: 37 };
}

function insideCrown(x: number, y: number, padding = 0) {
  const dx = (x - CENTER_X) / (RX - padding);
  const dy = (y - CENTER_Y) / (RY - padding);
  // A slightly squared oval has the broad shoulders of a mature tree, not a
  // rigid mathematical ellipse. The rim keeps names away from the poster.
  return Math.pow(Math.abs(dx), 3.1) + Math.pow(Math.abs(dy), 3.1) <= 1;
}

function intersects(a: {x:number;y:number;artWidth:number;artHeight:number},
  b: {x:number;y:number;artWidth:number;artHeight:number}, padding = 5) {
  return Math.abs(a.x - b.x) < (a.artWidth + b.artWidth) / 2 + padding
    && Math.abs(a.y - b.y) < (a.artHeight + b.artHeight) / 2 + padding;
}

/** Read-only constrained growth:
 *  1. Put all genealogically terminal names into non-overlapping botanical
 *     attraction sites in the crown, in their original family order.
 *  2. Recursively anchor real ancestors below the centers of their children.
 *  3. Grow a joined bough skeleton only along those genuine relationships.
 *  4. Attach optional unlabelled ornamental shoots to existing wood.
 *
 * No geometric point is ever written back to the actual family register.
 */
export function buildLivingCanopy(people: HeritagePerson[], focus: string | null = null): LivingCanopy {
  const rootId = resolveHeritageRootId(people);
  const genealogy = buildHeritageTree(people, rootId, focus);
  const root = genealogy.nodes.find(node => node.id === rootId)!;
  const orderedTips = genealogy.nodes.filter(node => node.id !== root.id && node.childCount === 0)
    // Inherited angular sectors keep each entire family contiguous. This
    // order is never exchanged to fill decorative gaps.
    .sort((a, b) => a.angle - b.angle);
  const tips=[...orderedTips].sort((a,b)=>b.depth-a.depth||a.x-b.x);
  const assigned=new Map<string,LivingPerson>();
  const crownPoint=(angle:number,radius:number)=>({
    x:CENTER_X+635*radius*Math.sin(angle),
    y:ROOT_Y-radius*(545+520*Math.cos(angle)),
  });
  for(const tip of tips){
    const angle=tip.angle*1.018;
    const target=Math.min(.97,.68+tip.depth*.041+(hash(tip.id)-.5)*.20);
    const shape=livingSize(tip);
    let chosen:{x:number;y:number}|null=null,minScore=Infinity;
    for(const da of [0,-.018,.018,-.042,.042,-.072,.072,-.108,.108,-.145,.145,-.195,.195,-.25,.25]){
      for(let radius=.38;radius<=1.101;radius+=.014){
        const {x,y}=crownPoint(angle+da,radius);
        if(y<240||y>1160||!insideCrown(x,y,25))continue;
        const candidate={x,y,artWidth:shape.w,artHeight:shape.h};
        if([...assigned.values()].some(n=>intersects(candidate,n,7)))continue;
        const score=Math.pow((radius-target)*600,2)+Math.pow(da*640,2)
          +hash(tip.id+":"+Math.round(radius*1000))*125;
        if(score<minScore){minScore=score;chosen={x,y};}
      }
    }
    if(!chosen)throw new Error(`No spacious crown site for ${tip.id}`);
    assigned.set(tip.id,{...tip,...chosen,artWidth:shape.w,artHeight:shape.h});
  }

  const children=new Map<string,HeritageTreeNode[]>();
  for(const node of genealogy.nodes){
    if(!node.parentId)continue;
    const own=children.get(node.parentId)||[];
    own.push(node);
    children.set(node.parentId,own);
  }
  const envelopes=new Map<string,{min:number;max:number}>();
  for(const tip of tips){const point=assigned.get(tip.id)!;envelopes.set(tip.id,{min:point.x,max:point.x});}
  for(const parent of genealogy.nodes.filter(n=>n.childCount&&n.id!==root.id)
      .sort((a,b)=>b.depth-a.depth)){
    const own=(children.get(parent.id)||[]).map(child=>assigned.get(child.id)!);
    const total=own.reduce((sum,n)=>sum+Math.pow(n.terminalCount,.42),0)||1;
    const childCenter=own.reduce((sum,n)=>sum+n.x*Math.pow(n.terminalCount,.42),0)/total;
    const baseX=CENTER_X+(childCenter-CENTER_X)*.85;
    const minimumY=Math.max(...own.map(n=>n.y))+48;
    const baseY=Math.max(minimumY,1260-parent.depth*117);
    const shape=livingSize(parent);
    const range=own.reduce((r,n)=>{
      const item=envelopes.get(n.id)!;
      return {min:Math.min(r.min,item.min),max:Math.max(r.max,item.max)};
    },{min:Infinity,max:-Infinity});
    envelopes.set(parent.id,range);
    const minX=Math.max(72+shape.w/2,Math.min(baseX,range.min)-76);
    const maxX=Math.min(1328-shape.w/2,Math.max(baseX,range.max)+76);
    let chosen:{x:number;y:number}|null=null,minScore=Infinity;
    for(const dx of [0,-14,14,-29,29,-47,47,-67,67,-94,94,-123,123]){
      for(const dy of [0,18,-18,36,-36,56,-56,78,-78,108]){
        const x=baseX+dx,y=baseY+dy;
        if(y<minimumY||y>=ROOT_Y-38||x<minX||x>maxX)continue;
        const candidate={x,y,artWidth:shape.w,artHeight:shape.h};
        if([...assigned.values()].some(other=>intersects(candidate,other,3)))continue;
        const score=Math.abs(dx)*1.25+Math.abs(dy)+Math.max(0,y-1080)*.2;
        if(score<minScore){minScore=score;chosen={x,y};}
      }
    }
    if(!chosen){
      for(let y=minimumY;!chosen&&y<ROOT_Y-25;y+=15){
        for(let dx=-180;dx<=180;dx+=15){
          const candidate={x:baseX+dx,y,artWidth:shape.w,artHeight:shape.h};
          if(candidate.x<minX||candidate.x>maxX)continue;
          if([...assigned.values()].every(other=>!intersects(candidate,other,2))){chosen={x:candidate.x,y};break;}
        }
      }
    }
    if(!chosen)throw new Error(`No wooden junction for ${parent.id}`);
    assigned.set(parent.id,{...parent,...chosen,artWidth:shape.w,artHeight:shape.h});
  }
  assigned.set(root.id,{...root,x:CENTER_X,y:ROOT_Y,artWidth:112,artHeight:66});
  const nodes = genealogy.nodes.map(node => assigned.get(node.id)!);
  softenGenealogicalCrossings(nodes);
  const boughs = growLivingWood(nodes);

  // Optional nature-inspired leaf attraction points. Every leaf sprouts from
  // a *real drawn bough*; a decorative leaf has no person ID and no label.
  const foliage: LivingLeaf[] = [];
  const sampled: {x:number;y:number}[] = [];
  for (const segment of boughs) {
    const curve=livingWoodCurve(segment.from,segment.to);
    for (let t = .08; t < 1; t += .08) sampled.push(curve.point(t));
  }
  function addOrnament(px:number,py:number,seed:number) {
      if (!insideCrown(px, py, 26)) return;
      const width = 15 + hash(seed + 7) * 13;
      const height = width * (1.15 + hash(seed + 11) * .30);
      const candidate = {x:px,y:py,artWidth:width,artHeight:height};
      if (nodes.some(node => intersects(candidate, node, 5))) return;
      if (foliage.some(leaf => intersects(candidate, {x:leaf.x,y:leaf.y,artWidth:leaf.width,artHeight:leaf.height}, 3))) return;
      let nearest: {x:number;y:number} | null = null, nearestDist = Infinity;
      for (const anchor of sampled) {
        const distance = Math.hypot(px - anchor.x, py - anchor.y);
        if (distance < nearestDist) { nearest = anchor; nearestDist = distance; }
      }
      // A foliage shoot must remain close to the actual wood: long dangling
      // threads in the middle of the poster look like schematic connectors.
      if (!nearest || nearestDist > 69 || nearestDist < 11) return;
      foliage.push({
        x:px, y:py, width, height,
        angle:(hash(seed + 19)-.5)*65,
        shade: Math.floor(hash(seed + 29)*7),
        anchorX:nearest.x, anchorY:nearest.y,
      });
  }
  // Grow smaller leaves around genuine terminal leaves, producing rounded
  // clusters rather than leaving broad empty wedges between long sticks.
  for(const tip of tips){
    const place=assigned.get(tip.id)!;
    for(let index=0;index<8;index++){
      const seed=serialNumber(tip.id)*113+index*71;
      const phase=index*2.3999632+hash(seed)*.32;
      const spread=34+Math.floor(index/2)*17+hash(seed+6)*8;
      addOrnament(place.x+Math.cos(phase)*spread,
        place.y+Math.sin(phase)*spread,seed);
    }
  }
  // Small secondary sprigs also inhabit the inner boughs, but cannot cover
  // any real name or make up another member of the family.
  for (let row = 0, y = 250; y < 1125; row++, y += 31) {
    for (let col = 0, x = 82 + (row % 2) * 17; x < 1315; col++, x += 35) {
      const seed = row * 181 + col * 197;
      if(hash(seed)<.27)continue;
      addOrnament(x+(hash(seed+2)-.5)*18,y+(hash(seed+3)-.5)*19,seed);
    }
  }
  return { nodes, boughs, foliage, sourceCount:nodes.length,
    terminalCount:tips.length, branches:genealogy.branches };
}

function serialNumber(id:string){return Number(id.replace(/\D/g,""))||1;}
