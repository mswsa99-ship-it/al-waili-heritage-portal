import type { LivingPerson } from "./living-canopy";

type Point={x:number;y:number};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersect(a:Point,b:Point,c:Point,d:Point){
  return cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0;
}

/**
 * Reduce incidental link intersections without changing one genealogical edge.
 * Only bounded geometric adjustments are permitted; all name boxes stay clear
 * and a recorded child remains higher than their recorded father.
 */
export function softenGenealogicalCrossings(nodes:LivingPerson[]) {
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const edges=nodes.filter(n=>n.parentId&&byId.has(n.parentId)).map(n=>({a:byId.get(n.parentId!)!,b:n}));
  const children=new Map<string,LivingPerson[]>();
  for(const node of nodes){
    if(!node.parentId)continue;
    const group=children.get(node.parentId)||[];
    group.push(node);children.set(node.parentId,group);
  }
  function affectedCrossings(node:LivingPerson){
    let total=0;
    const moving=edges.filter(e=>e.a===node||e.b===node);
    for(const segment of moving){
      for(const other of edges){
        if(segment===other||segment.a===other.a||segment.a===other.b
          ||segment.b===other.a||segment.b===other.b)continue;
        if(intersect(segment.a,segment.b,other.a,other.b))total++;
      }
    }
    return total;
  }
  const order=nodes.filter(n=>n.depth>0)
    .sort((a,b)=>a.childCount===0&&b.childCount>0?1:b.childCount===0&&a.childCount>0?-1:b.depth-a.depth);
  const movementsX=[-86,-68,-52,-37,-24,-12,0,12,24,37,52,68,86];
  const movementsY=[-60,-43,-28,-14,0,14,28,43,60];
  let improved=0;
  for(let pass=0;pass<3;pass++){
    let improvedThisPass=0;
    for(const node of order){
      const origin={x:node.x,y:node.y};
      let score=affectedCrossings(node)*1000,best=origin;
      const father=node.parentId?byId.get(node.parentId):undefined;
      const descendants=children.get(node.id)||[];
      for(const dx of movementsX){
        for(const dy of movementsY){
          if(!dx&&!dy)continue;
          const x=origin.x+dx,y=origin.y+dy;
          if(x-node.artWidth/2<62||x+node.artWidth/2>1338||y-node.artHeight/2<210||y>1240)continue;
          if(father&&y>=father.y-42)continue;
          if(descendants.some(child=>y<=child.y+42))continue;
          // The terminal has a bounded local corridor, never a different
          // family's half of the crown.
          if(node.childCount===0 && Math.abs(x-origin.x)>68)continue;
          if(nodes.some(other=>other!==node&&Math.abs(x-other.x)<(node.artWidth+other.artWidth)/2+3
             &&Math.abs(y-other.y)<(node.artHeight+other.artHeight)/2+3))continue;
          node.x=x;node.y=y;
          const candidate=affectedCrossings(node)*1000+Math.hypot(dx,dy)*.45;
          if(candidate<score-.1){score=candidate;best={x,y};}
        }
      }
      node.x=best.x;node.y=best.y;
      if(best.x!==origin.x||best.y!==origin.y){improvedThisPass++;improved++;}
    }
    if(!improvedThisPass)break;
  }
  return improved;
}
