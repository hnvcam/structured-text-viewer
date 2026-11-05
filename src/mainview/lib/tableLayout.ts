export interface TableLayoutOptions {
  /** Narrowest a column is made (unless its content is narrower). */
  minCol: number;
  /** One long unbreakable word (a URL) can't force a column wider than this; it breaks instead. */
  maxFloor: number;
  /** Columns whose one-line width is at most this are "short": they're kept unwrapped when possible. */
  shortCol: number;
  /** Long-text columns get at least this much before short columns are unwrapped. */
  longMin: number;
}

/**
 * Column widths (px) for a table that has `avail` px to fit in.
 *
 * - maxW: each column's width with every cell on one line (max-content)
 * - minW: each column's width at its longest unbreakable word (min-content)
 *
 * Browser auto layout hands out space in proportion to content length, so a
 * couple of long-text columns squeeze short ones ("53% / 43%", "Time") into
 * wrapping. Here instead:
 *   1. every column starts at its floor (longest word, at least minCol);
 *   2. short columns are given their full one-line width, cheapest first;
 *   3. long-text columns are raised to longMin, so they stay readable;
 *   4. what's left goes to the long-text columns, in proportion to how much
 *      text each still has to show.
 * If even the floors don't fit, the table is wider than `avail` and scrolls.
 */
export function distributeWidths(
  maxW: number[],
  minW: number[],
  avail: number,
  opts: TableLayoutOptions,
): number[] {
  const n = maxW.length;
  const max = maxW.map((m, i) => Math.max(m, minW[i]));
  const totalMax = sum(max);

  // Everything fits on one line: stretch to fill the width, keeping proportions.
  if (totalMax <= avail) {
    const k = totalMax > 0 ? avail / totalMax : 1;
    return max.map((m) => m * k);
  }

  // 1. Floors.
  const w = max.map((m, i) => Math.min(m, opts.maxFloor, Math.max(minW[i], opts.minCol)));
  let remaining = avail - sum(w);

  const indices = Array.from({ length: n }, (_, i) => i);
  const isShort = (i: number) => max[i] <= opts.shortCol;

  // Not even the floors fit, so the table scrolls sideways anyway: a little
  // more scrolling beats wrapping the short columns.
  if (remaining <= 0) return w.map((x, i) => (isShort(i) ? max[i] : x));

  const long = indices.filter((i) => !isShort(i) && max[i] > w[i]);

  // 2. Short columns to their full width, cheapest first.
  const short = indices
    .filter((i) => isShort(i) && max[i] > w[i])
    .sort((a, b) => max[a] - w[a] - (max[b] - w[b]));
  for (const i of short) {
    if (remaining <= 0) break;
    const add = Math.min(max[i] - w[i], remaining);
    w[i] += add;
    remaining -= add;
  }

  // 3. Long-text columns up to longMin (scaled down together if there isn't room).
  const lift = long.map((i) => Math.max(0, Math.min(max[i], opts.longMin) - w[i]));
  const liftTotal = sum(lift);
  if (liftTotal > 0) {
    const k = Math.min(1, remaining / liftTotal);
    long.forEach((i, j) => (w[i] += lift[j] * k));
    remaining -= liftTotal * k;
  }

  // 4. The rest to the long-text columns, by how much text each still has.
  const need = sum(long.map((i) => max[i] - w[i]));
  if (remaining > 0 && need > 0) {
    const k = Math.min(1, remaining / need);
    for (const i of long) w[i] += (max[i] - w[i]) * k;
  }
  return w;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
