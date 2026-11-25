// Each individual Cloudflare D1 statement accepts no more than 100 bindings.
// A batch is atomic, but its statements still have this individual limit.
export function d1InsertBatches<T extends Record<string, unknown>>(
  rows: T[],
  maxBoundParameters = 100,
): T[][] {
  if (!rows.length) return [];
  const columnCount = Object.keys(rows[0]).length;
  if (!columnCount || columnCount > maxBoundParameters) {
    throw new RangeError("D1 insert row exceeds the bound-parameter limit");
  }
  if (rows.some(row => Object.keys(row).length !== columnCount)) {
    throw new Error("D1 insert rows must have the same column count");
  }
  const rowsPerStatement = Math.floor(maxBoundParameters / columnCount);
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerStatement) {
    batches.push(rows.slice(i, i + rowsPerStatement));
  }
  return batches;
}
