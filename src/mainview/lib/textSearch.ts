// In-document text search over a rendered DOM subtree.
//
// Matches are returned as DOM Ranges and highlighted with the CSS Custom
// Highlight API, so the React-owned DOM is never mutated (wrapping matches in
// <mark> elements would break React's reconciliation on the next re-render).

const BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, pre, td, th, tr, blockquote, dt, dd, div, table, figure, foreignObject, text';

// Text that is never visible as-is: styles/scripts, and KaTeX's MathML copy
// (KaTeX renders an accessible MathML twin next to the visible HTML).
const SKIP_SELECTOR = 'script, style, noscript, .katex-mathml';

interface TextSegment {
  node: Text;
  start: number; // offset of node's text within the concatenated string
}

// Search `root` for `query` (case-insensitive) and return a Range per match.
// Matches may span inline formatting (e.g. "foo **bar**") but never cross a
// block boundary, because a separator is inserted between blocks.
export function findTextRanges(root: HTMLElement, query: string): Range[] {
  if (!query) return [];

  const segments: TextSegment[] = [];
  let text = '';
  let prevBlock: Element | null = null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (prevBlock && block !== prevBlock) text += '\n';
    prevBlock = block;
    segments.push({ node, start: text.length });
    text += node.nodeValue ?? '';
  }

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges: Range[] = [];

  // Map a string offset back to (text node, offset) by binary search over the
  // segment start offsets. For an end offset that falls exactly on a node
  // boundary, prefer the earlier node so the range doesn't spill into the next.
  const locate = (offset: number, isEnd: boolean): [Text, number] => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const s = segments[mid].start;
      if (isEnd ? s < offset : s <= offset) lo = mid;
      else hi = mid - 1;
    }
    return [segments[lo].node, offset - segments[lo].start];
  };

  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) {
    // Skip matches straddling the synthetic block separator.
    if (text.slice(i, i + needle.length).includes('\n') && !needle.includes('\n')) continue;

    const [startNode, startOffset] = locate(i, false);
    const [endNode, endOffset] = locate(i + needle.length, true);
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    ranges.push(range);
  }

  return ranges;
}

const ALL_HIGHLIGHT = 'search-results';
const CURRENT_HIGHLIGHT = 'search-current';

export function supportsHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

// WebKit (macOS/Linux webviews) only repaints the ranges of the highlight that
// is currently registered: replacing or deleting a registry entry leaves the
// old highlight's pixels on screen until something else repaints them. So we
// register one pair of Highlight objects for the page's lifetime and mutate
// them in place, and additionally force a repaint of the searched content.
let highlights: { all: Highlight; current: Highlight } | null = null;

function getHighlights(): { all: Highlight; current: Highlight } | null {
  if (!supportsHighlights()) return null;
  if (!highlights) {
    const current = new Highlight();
    current.priority = 1; // paint the current match over the others
    highlights = { all: new Highlight(), current };
  }
  if (CSS.highlights.get(ALL_HIGHLIGHT) !== highlights.all) {
    CSS.highlights.set(ALL_HIGHLIGHT, highlights.all);
  }
  if (CSS.highlights.get(CURRENT_HIGHLIGHT) !== highlights.current) {
    CSS.highlights.set(CURRENT_HIGHLIGHT, highlights.current);
  }
  return highlights;
}

// Invalidate the painted pixels of `el` without touching layout: an opacity
// change repaints the element's whole layer, then is reverted next frame.
const repaintFrames = new WeakMap<HTMLElement, number>();
function forceRepaint(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const pending = repaintFrames.get(el);
  if (pending !== undefined) cancelAnimationFrame(pending);
  el.style.opacity = '0.999';
  repaintFrames.set(
    el,
    requestAnimationFrame(() => {
      repaintFrames.delete(el);
      el.style.opacity = '';
    })
  );
}

// Fallback (no Highlight API): the current match is shown as the selection.
let fallbackSelection: Range | null = null;

function clearFallbackSelection(): void {
  const sel = window.getSelection();
  const fb = fallbackSelection;
  if (sel && fb && sel.rangeCount) {
    // Only drop the selection if it's still ours (the user may have selected
    // something else since). getRangeAt() can return a copy, so compare ends.
    try {
      const r = sel.getRangeAt(0);
      if (
        r.compareBoundaryPoints(Range.START_TO_START, fb) === 0 &&
        r.compareBoundaryPoints(Range.END_TO_END, fb) === 0
      ) {
        sel.removeAllRanges();
      }
    } catch {
      // Ranges in different documents/trees: not ours.
    }
  }
  fallbackSelection = null;
}

// Paint all matches inside `root`, with `current` emphasized.
export function paintHighlights(ranges: Range[], current: number, root?: HTMLElement | null): void {
  const cur = ranges[current];
  const hl = getHighlights();
  if (hl) {
    hl.all.clear();
    hl.current.clear();
    for (const r of ranges) hl.all.add(r);
    if (cur) hl.current.add(cur);
    forceRepaint(root);
    return;
  }

  clearFallbackSelection();
  const sel = window.getSelection();
  if (sel && cur) {
    sel.removeAllRanges();
    sel.addRange(cur);
    fallbackSelection = cur;
  }
}

export function clearHighlights(root?: HTMLElement | null): void {
  paintHighlights([], 0, root);
}

// Bring `range` into view inside the scroll `container`: nested horizontally
// scrollable blocks (wide code blocks, tables) are scrolled first, then the
// container is scrolled so the match sits in the vertical middle.
export function scrollRangeIntoView(range: Range, container: HTMLElement): void {
  const margin = 24;
  let el: Element | null =
    range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;

  while (el && el !== container) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth) {
      const r = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (r.left < box.left + margin) el.scrollLeft -= box.left + margin - r.left;
      else if (r.right > box.right - margin) el.scrollLeft += r.right - (box.right - margin);
    }
    el = el.parentElement;
  }

  const r = range.getBoundingClientRect();
  const box = container.getBoundingClientRect();
  const top = container.scrollTop + (r.top - box.top) - container.clientHeight / 2 + r.height / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

  if (r.left < box.left || r.right > box.right) {
    container.scrollLeft += r.left - box.left - margin;
  }
}
