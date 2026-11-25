export type HeritagePerson = { id: string; name: string; parentId: string | null };

export type HeritageTreeNode = HeritagePerson & {
  x: number;
  y: number;
  angle: number;
  radius: number;
  depth: number;
  generation: number;
  branchId: string;
  childCount: number;
  descendantCount: number;
  terminalCount: number;
};

export type HeritageTreeBranch = {
  id: string;
  name: string;
  descendantCount: number;
};

export type HeritageTreeLayout = {
  rootId: string;
  nodes: HeritageTreeNode[];
  branches: HeritageTreeBranch[];
  bounds: { x: number; y: number; width: number; height: number };
};

// The outgoing branch's cross-section is proportional to *all* recorded
// descendants, not merely its immediate number of children. It contracts
// gradually as a major trunk becomes a small family branch, then a twig.
export function heritageBranchThickness(descendants: number, totalPeople: number) {
  return 5 + 94 * Math.pow((Math.max(0, descendants) + 1) / Math.max(1, totalPeople), .64);
}

// An independent, read-only presentation of the existing lineage links.
// Read-only botanical genealogy. Every child receives a contiguous angular
// sector *within its parent's sector*. Sibling branches cannot exchange places
// or wander through another family's subtree. Only recorded terminal people
// are leaves; anyone with descendants is a labelled wooden junction.
// The family-root person (Hamad, father of Mani', Abdullah and Sulaiman) is found by
// identity, not by a bare number: the register was renumbered after the 24 side-branch
// records were removed (old N020 became N007). A candidate id counts only when that
// record is named Hamad and has a child named Mani'.
export const HERITAGE_ROOT_CANDIDATES = ["N007", "N020"] as const;
export function resolveHeritageRootId(people: ReadonlyArray<{ id: string; name: string; parentId?: string | null }>): string {
  const byId = new Map(people.map(person => [person.id, person]));
  for (const id of HERITAGE_ROOT_CANDIDATES) {
    const person = byId.get(id);
    if (!person || person.name.trim() !== "حمد") continue;
    if (people.some(child => child.parentId === id && child.name.trim() === "منيع")) return id;
  }
  throw new Error("The heritage-tree root is missing");
}

export function buildHeritageTree(
  people: HeritagePerson[],
  rootIdArg?: string,
  focusedBranchId: string | null = null,
): HeritageTreeLayout {
  const rootId = rootIdArg ?? resolveHeritageRootId(people);
  const byId = new Map(people.map(person => [person.id, person]));
  const root = byId.get(rootId);
  if (!root) throw new Error("The heritage-tree root is missing");
  const children = new Map<string, HeritagePerson[]>();
  for (const person of people) {
    if (!person.parentId || person.id === person.parentId || !byId.has(person.parentId)) continue;
    const group = children.get(person.parentId) || [];
    group.push(person);
    children.set(person.parentId, group);
  }

  const rootChildren = children.get(rootId) || [];
  const branchIds = new Set(rootChildren.map(child => child.id));
  const visibleBranches = focusedBranchId && branchIds.has(focusedBranchId)
    ? rootChildren.filter(child => child.id === focusedBranchId)
    : rootChildren;
  const visible: { person: HeritagePerson; depth: number; branchId: string }[] = [];
  const visited = new Set<string>();
  const walk = (person: HeritagePerson, depth: number, branchId: string) => {
    if (depth > 32 || visited.has(person.id)) return;
    visited.add(person.id);
    visible.push({ person, depth, branchId });
    if (person.id !== rootId) {
      for (const child of children.get(person.id) || []) walk(child, depth + 1, branchId);
    }
  };
  walk(root, 0, rootId);
  for (const child of visibleBranches) walk(child, 1, child.id);

  const ancestorIds = new Set<string>();
  let parent = root.parentId;
  while (parent && byId.has(parent) && !ancestorIds.has(parent)) {
    ancestorIds.add(parent);
    parent = byId.get(parent)?.parentId || null;
  }
  const rootGeneration = ancestorIds.size + 1;
  const visibleIds = new Set(visible.map(record => record.person.id));
  const descendants = new Map<string, number>();
  for (const record of [...visible].reverse()) {
    const count = (children.get(record.person.id) || [])
      .filter(child => visibleIds.has(child.id))
      .reduce((sum, child) => sum + 1 + (descendants.get(child.id) || 0), 0);
    descendants.set(record.person.id, count);
  }
  const branches = rootChildren.map(child => ({
    id: child.id,
    name: child.name,
    descendantCount: collectDescendants(child.id, children) + 1,
  }));

  const visibleChildren = (id: string) =>
    (children.get(id) || []).filter(child => visibleIds.has(child.id));
  const terminalCounts = new Map<string, number>();
  const countTips = (id: string, stack = new Set<string>()): number => {
    if (terminalCounts.has(id)) return terminalCounts.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const own = visibleChildren(id);
    const count = own.length ? own.reduce((sum, child) => sum + countTips(child.id, stack), 0) : 1;
    stack.delete(id);
    terminalCounts.set(id, count);
    return count;
  };
  countTips(rootId);

  // The dominant descendant-rich branch occupies the generous central area.
  // The other two roots sit beside it, each retaining its entire subtree.
  const orderedBranches = [...visibleBranches];
  if (orderedBranches.length === 3) {
    const dominant = [...orderedBranches].sort((a, b) =>
      (terminalCounts.get(b.id) || 0) - (terminalCounts.get(a.id) || 0))[0];
    const others = orderedBranches.filter(child => child.id !== dominant.id);
    orderedBranches.splice(0, 3, others[0], dominant, others[1]);
  }
  const angles = new Map<string, number>();
  const sectorById = new Map<string, { left: number; right: number }>();
  const sectors = (parents: HeritagePerson[], left: number, right: number, gap = 0) => {
    const available = right - left - gap * Math.max(0, parents.length - 1);
    const sum = parents.reduce((total, parent) => total + (terminalCounts.get(parent.id) || 1), 0);
    let start = left;
    return parents.map(parent => {
      const width = available * (terminalCounts.get(parent.id) || 1) / (sum || 1);
      const result = { parent, left: start, right: start + width };
      start += width + gap;
      return result;
    });
  };
  const placeSectors = (id: string, left: number, right: number) => {
    sectorById.set(id, { left, right });
    const own = visibleChildren(id);
    if (!own.length) {
      angles.set(id, (left + right) / 2);
      return;
    }
    const slices = sectors(own, left, right);
    for (const slice of slices) placeSectors(slice.parent.id, slice.left, slice.right);
    // The parent is rooted over its actual children's centers, not over a
    // neighbouring branch or over an arbitrary generation row.
    const balanceExponent = focusedBranchId ? 0 : .2;
    const totalWeight = own.reduce((sum, child) => sum + Math.pow(terminalCounts.get(child.id) || 1, balanceExponent), 0);
    angles.set(id, own.reduce((sum, child) => sum + (angles.get(child.id) || 0) * Math.pow(terminalCounts.get(child.id) || 1, balanceExponent), 0)
      / Math.max(1, totalWeight));
  };
  const rootGap = orderedBranches.length > 1 ? (4 * Math.PI / 180) : 0;
  for (const slice of sectors(orderedBranches, -84 * Math.PI / 180, 84 * Math.PI / 180, rootGap))
    placeSectors(slice.parent.id, slice.left, slice.right);
  angles.set(rootId, 0);

  type Point = { x: number; y: number; angle: number; radius: number };
  const positions = new Map<string, Point>();
  positions.set(rootId, { x: 0, y: 0, angle: 0, radius: 0 });
  const makePoint = (angle: number, radius: number): Point => ({
    x: Math.sin(angle) * radius * .88,
    y: -Math.cos(angle) * radius * 1.64,
    angle, radius,
  });
  const labelSize = (id: string) => {
    const childCount = visibleChildren(id).length;
    if (!childCount) return { w: 120, h: 154 };
    if (id === rootId) return { w: 280, h: 138 };
    const descendants = descendantsCount(id);
    return { w: descendants > 55 ? 158 : descendants > 12 ? 142 : 118,
      h: descendants > 55 ? 92 : 76 };
  };
  function descendantsCount(id: string) { return descendants.get(id) || 0; }

  // A name occupies a full label-sized rectangle, never merely a point.
  // Reserve this entire footprint before positioning the next person.
  const clearOfNames = (id: string, candidate: Point) =>
    [...positions.entries()].every(([otherId, point]) => {
      const own = labelSize(id), other = labelSize(otherId);
      return Math.abs(candidate.x - point.x) >= (own.w + other.w) / 2 + 12
        || Math.abs(candidate.y - point.y) >= (own.h + other.h) / 2 + 13;
    });
  const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point) => {
    const cross = (p: Point, q: Point, r: Point) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(a, b, c) * cross(a, b, d) < 0
      && cross(c, d, a) * cross(c, d, b) < 0;
  };
  const crossingCount = (id: string, parentId: string | null, candidate: Point, parentPoint: Point) =>
    visible.reduce((crossings, record) => {
      if (record.person.id === id || record.person.id === parentId || record.person.parentId === parentId) return crossings;
      if (record.person.parentId === id) return crossings;
      const end = positions.get(record.person.id);
      const start = positions.get(record.person.parentId || "");
      if (!end || !start) return crossings;
      return crossings + Number(segmentsIntersect(parentPoint, candidate, start, end));
    }, 0);

  // Place parents first, strictly ahead of their children in the trunk.
  // Each tip is free to occupy a different outward foliage row, yet it
  // cannot leave its inherited angular sector or collide with another name.
  const levels = new Map<number, typeof visible>();
  for (const record of visible.filter(item => item.depth > 0)) {
    const group = levels.get(record.depth) || [];
    group.push(record);
    levels.set(record.depth, group);
  }
  for (const [depth, group] of [...levels].sort((a, b) => a[0] - b[0])) {
    group.sort((a, b) => (angles.get(a.person.id) || 0) - (angles.get(b.person.id) || 0));
    group.forEach((record, index) => {
      const id = record.person.id;
      const parent = positions.get(record.person.parentId || "") || positions.get(rootId)!;
      const bands = [
        [0], [260], [415], [570, 655, 730], [720, 830, 940, 1050],
        [855, 975, 1095, 1215, 1335, 1455],
        [1020, 1150, 1280, 1410, 1540, 1670],
      ];
      const radii = bands[depth] || Array.from({ length: 9 }, (_, row) => 1300 + (depth - 6) * 200 + row * 130);
      const angle = angles.get(id) || 0;
      const corridor = sectorById.get(id) || { left: angle, right: angle };
      const span = corridor.right - corridor.left;
      const offsets = [0, -.18, .18, -.33, .33, -.45, .45];
      let chosen: Point | null = null;
      let bestScore = Infinity;
      // The parent must remain below each child. Branch envelopes may use
      // several staggered leaf rows, yet never bleed into a different family.
      for (const offset of offsets) {
        const candidateAngle = Math.max(corridor.left + .0001, Math.min(corridor.right - .0001, angle + offset * span));
        for (const row of radii) {
          for (const stagger of [0, -45, 45, -85, 85]) {
            const radius = Math.max(row + stagger, parent.radius + 120);
            if (radius < 0) continue;
            const point = makePoint(candidateAngle, radius);
            if (point.y > parent.y - 48 || !clearOfNames(id, point)) continue;
            const score = Math.abs(offset) * 40 + Math.abs(stagger) * .10
              + Math.max(0, radius - radii[0]) * .23
              + Math.hypot(point.x - parent.x, point.y - parent.y) * .65
              + Math.abs(index % radii.length - radii.indexOf(row))
              + crossingCount(id, record.person.parentId, point, parent) * 5000;
            if (score < bestScore) { chosen = point; bestScore = score; }
          }
        }
      }
      if (!chosen) {
        // Extremely deep trees may require an extra outer tier. Keep the
        // guarantee of visible non-overlapping person labels.
        for (let step = 1; !chosen && step < 60; step++) {
          const radius = radii.at(-1)! + step * 75;
          for (const offset of offsets) {
            const candidateAngle = Math.max(corridor.left + .0001, Math.min(corridor.right - .0001, angle + offset * span));
          const point = makePoint(candidateAngle, radius);
            if (point.y < parent.y - 48 && clearOfNames(id, point)) { chosen = point; break; }
          }
        }
      }
      if (!chosen) throw new Error(`Unable to place person ${id} without covering another name`);
      positions.set(id, chosen);
    });
  }

  const nodes = visible.map(({ person, depth, branchId }) => {
    const point = positions.get(person.id) || { x: 0, y: 0, angle: 0, radius: 0 };
    return {
      ...person, ...point, depth, branchId,
      generation: rootGeneration + depth,
      childCount: visibleChildren(person.id).length,
      descendantCount: descendants.get(person.id) || 0,
      terminalCount: terminalCounts.get(person.id) || 1,
    };
  });
  const minX = Math.min(-280, ...nodes.map(node => node.x));
  const maxX = Math.max(280, ...nodes.map(node => node.x));
  const minY = Math.min(-650, ...nodes.map(node => node.y));
  const maxY = Math.max(370, ...nodes.map(node => node.y));
  return {
    rootId, nodes, branches,
    // Extra upper breathing room includes decorative foliage around the top
    // named leaves, so no watercolor leaf is clipped by the poster viewBox.
    bounds: { x: minX - 190, y: minY - 390, width: maxX - minX + 380, height: maxY - minY + 590 },
  };
}

function collectDescendants(id: string, children: Map<string, HeritagePerson[]>): number {
  const queue = [id], seen = new Set<string>(), descendants = new Set<string>();
  while (queue.length) {
    const next = queue.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    if (next !== id) descendants.add(next);
    for (const child of children.get(next) || []) queue.push(child.id);
  }
  return descendants.size;
}
