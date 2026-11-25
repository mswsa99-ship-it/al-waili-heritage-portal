/**
 * مخطط الأجيال: مصفوفة مستقلة لكل عمق، ومسار أفقي محجوز لكل شجرة فرعية.
 * لا تمثل أرقام الخلايا أو مناطق الصورة عمرًا؛ ترتيب الإخوة الموثق اختياري.
 */
export function computeGenerationLayout(records, options = {}) {
  const pitch = options.pitch ?? 144;
  const branchGap = options.branchGap ?? 46;
  const rowGap = options.rowGap ?? 150;
  const top = options.top ?? 145;
  const margin = options.margin ?? 220;
  const originalIndex = new Map(records.map((node, i) => [node.id, i]));
  const byId = new Map(records.map(node => [node.id, node]));
  const children = new Map(records.map(node => [node.id, []]));

  for (const node of records) {
    if (node.parent && children.has(node.parent)) children.get(node.parent).push(node);
  }

  const declaredOrder = node => {
    const value = Number(node.birthOrder);
    return Number.isInteger(value) && value > 0 ? value : Infinity;
  };
  const orderSiblings = (a, b) =>
    declaredOrder(a) - declaredOrder(b) ||
    originalIndex.get(a.id) - originalIndex.get(b.id);
  for (const siblings of children.values()) siblings.sort(orderSiblings);

  const roots = records.filter(node => !node.parent || !byId.has(node.parent)).sort(orderSiblings);
  const levels = [], generationById = {}, visited = new Set();
  function visit(node, depth) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    generationById[node.id] = depth;
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    for (const child of children.get(node.id) || []) visit(child, depth + 1);
  }
  roots.forEach(root => visit(root, 0));
  // Defensive fallback for imported, partially disconnected drafts.
  records.forEach(node => { if (!visited.has(node.id)) visit(node, 0); });

  // Bottom-up width reservation: a branch owns enough horizontal space for
  // every descendant. Cousin branches never reuse each other's columns even
  // when their leaf generations are uneven. This prevents connectors from
  // crossing unrelated cards in the same generation.
  const sizes = new Map(), measuring = new Set();
  function widthFor(node) {
    if (sizes.has(node.id)) return sizes.get(node.id);
    if (measuring.has(node.id)) return pitch;
    measuring.add(node.id);
    const siblings = (children.get(node.id) || []).filter(child => generationById[child.id] === generationById[node.id] + 1);
    const childWidth = siblings.reduce((total, child) => total + widthFor(child), 0) +
      Math.max(0, siblings.length - 1) * branchGap;
    const ownWidth = !node.parent ? Math.max(pitch, 310) : pitch;
    const size = Math.max(ownWidth, childWidth);
    sizes.set(node.id, size);
    measuring.delete(node.id);
    return size;
  }
  const forest = [...roots, ...records.filter(node => generationById[node.id] === 0 && !roots.includes(node))];
  const rootGap = 320;
  const forestSpan = forest.reduce((total, node) => total + widthFor(node), 0) +
    Math.max(0, forest.length - 1) * rootGap;
  const width = Math.ceil(Math.max(2600, forestSpan + margin * 2));
  const height = Math.ceil(top * 2 + (levels.length - 1) * rowGap);
  const positions = {};
  function place(node, left) {
    const span = widthFor(node);
    positions[node.id] = { x: Math.round(left + span / 2), y: top + generationById[node.id] * rowGap };
    const kids = (children.get(node.id) || []).filter(child => generationById[child.id] === generationById[node.id] + 1);
    if (!kids.length) return;
    const childSpan = kids.reduce((total, child) => total + widthFor(child), 0) +
      Math.max(0, kids.length - 1) * branchGap;
    let right = left + (span + childSpan) / 2;
    for (const child of kids) {
      right -= widthFor(child);
      place(child, right);
      right -= branchGap;
    }
  }
  let right = (width + forestSpan) / 2;
  for (const root of forest) {
    right -= widthFor(root);
    place(root, right);
    right -= rootGap;
  }
  const rows = levels.map((nodes, depth) => ({
    depth, y: top + depth * rowGap, ids: nodes.map(node => node.id), label: `الجيل ${depth + 1}`,
  }));

  return { positions, generationById, rows, width, height };
}
