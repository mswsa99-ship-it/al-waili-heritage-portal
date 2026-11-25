import type { HeritageTreeNode } from "./heritage-tree-layout";

export type BoughPoint = { id: string; x: number; y: number };
export type BoughSegment = {
  id: string;
  from: BoughPoint;
  to: BoughPoint;
  descendantCount: number;
  parentDescendants: number;
  throughIds: string[];
  kind: "continuation" | "shared" | "fork" | "tip";
};

/**
 * A botanical skeleton for a genealogical tree.
 *
 * Several children do not sprout as independent straight sticks from the
 * parent's name plate. They first travel together up a common wooden bough,
 * then separate through smaller forks into the true child positions.
 *
 * Artificial fork points are purely geometric: only HeritageTreeNode records
 * are people, and each original parent-to-child route is preserved exactly.
 */
export function buildBotanicalBoughs(nodes: HeritageTreeNode[]): BoughSegment[] {
  const visible = new Map(nodes.map(node => [node.id, node]));
  const children = new Map<string, HeritageTreeNode[]>();
  for (const node of nodes) {
    if (!node.parentId || !visible.has(node.parentId)) continue;
    const siblings = children.get(node.parentId) || [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  const segments: BoughSegment[] = [];
  const add = (parent: BoughPoint, child: BoughPoint, weight: number,
    parentWeight: number, descendants: string[], kind: BoughSegment["kind"]) => {
    segments.push({
      id: `${parent.id}--${child.id}`,
      from: parent, to: child,
      descendantCount: weight, parentDescendants: parentWeight,
      throughIds: descendants, kind,
    });
  };
  for (const parent of nodes) {
    const own = (children.get(parent.id) || []).sort((a, b) => a.x - b.x);
    if (!own.length) continue;
    if (own.length === 1) {
      const child = own[0];
      add(parent, child, child.descendantCount, parent.descendantCount, [child.id], "continuation");
      continue;
    }
    const closest = Math.max(1, Math.min(...own.map(child => parent.y - child.y)));
    const centroidX = own.reduce((sum, child) => sum + child.x, 0) / own.length;
    const shared: BoughPoint = {
      id: `fork:${parent.id}`,
      x: parent.x + (centroidX - parent.x) * .16,
      // Keep the gathered wood thick well above the named parent, then fan
      // into progressively lighter daughter limbs inside the crown.
      y: parent.y - Math.min(310, closest * .46),
    };
    add(parent, shared, parent.descendantCount, parent.descendantCount,
      own.map(child => child.id), "shared");

    // Every group is a contiguous sibling interval; no left/right family
    // intervals are interleaved to make an artificial fork.
    const groupCount = own.length <= 3 ? own.length : Math.ceil(own.length / 2.7);
    const groups: HeritageTreeNode[][] = [];
    for (let index = 0; index < groupCount; index++) {
      const from = Math.floor(index * own.length / groupCount);
      const to = Math.floor((index + 1) * own.length / groupCount);
      groups.push(own.slice(from, to));
    }
    for (const [groupIndex, group] of groups.entries()) {
      if (!group.length) continue;
      if (group.length === 1) {
        const child = group[0];
        add(shared, child, child.descendantCount, parent.descendantCount,
          [child.id], "tip");
        continue;
      }
      const groupCentroidX = group.reduce((sum, child) => sum + child.x, 0) / group.length;
      const groupClosest = Math.max(1, Math.min(...group.map(child => shared.y - child.y)));
      const branchFork: BoughPoint = {
        id: `fork:${parent.id}:${groupIndex}`,
        x: shared.x + (groupCentroidX - shared.x) * .52,
        y: shared.y - Math.min(385, groupClosest * .64),
      };
      const weight = group.reduce((sum, child) => sum + child.descendantCount + 1, 0) - 1;
      add(shared, branchFork, weight, parent.descendantCount,
        group.map(child => child.id), "fork");
      for (const child of group) {
        add(branchFork, child, child.descendantCount, weight,
          [child.id], "tip");
      }
    }
  }
  return segments;
}
