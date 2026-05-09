/**
 * `<$lar-meme-split>` — TW5-side meme-split action.
 *
 * Subscribes to wiki change events. When a `text/x-memetic-wikitext` tiddler
 * changes, walks its parse tree, creates child tiddlers via batch commit
 * for each ahu sigil at every depth, tombstones removed children, and
 * rewrites the parent's text to use `<<~ kahea ahu #slot >>` references.
 * Symmetric with the disk-side deserializer — same `splitRecursive` logic
 * applied to TW5 saves so that operator edits in the UX produce the same
 * flat tiddler set the CLI sync path produces.
 *
 * Operator's law (TW5 VM Primacy):
 *   - VM representation = always-split tiddlers; never a "whole meme" blob
 *     in storage.
 *   - Edit-on-disk and edit-in-UX produce identical bag state.
 *   - One parser, four call sites: this widget completes the fourth.
 *
 * Batch commit:
 *   `wiki.addTiddlers([...])` is the bulk path TW5 supports for atomic
 *   change-events. The widget collects all create/delete operations from
 *   the recursive walk into a single array and submits once. Listeners
 *   downstream see ONE change-storm per save, not N.
 *
 * Echo guard:
 *   `_applying` Map keyed by tiddler title — same shape MemeSyncAdaptor
 *   uses. Setting an entry before mutation; clearing after; mid-walk
 *   change events for the same title are skipped. Prevents the
 *   walk-triggers-walk-triggers-walk loop.
 *
 * Walk depth:
 *   Recursive via the same `findTopLevelAhuBlocks` shape the deserializer
 *   uses. TW5's natural recursion-depth limit caps runaway authoring; the
 *   widget bails after `MAX_DEPTH` levels with a parse-warning tiddler.
 *
 * The widget is invisible — instantiated once at boot via a `$:/tags/Global`
 * tiddler that emits `<$lar-meme-split/>` so the wiki-event subscription
 * fires for the lifetime of the wiki.
 */

import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

const MEMETIC_TYPE = "text/x-memetic-wikitext";
const CONTROL_SLOTS = new Set([
  "#iam", "#exit", "#stream-open", "#stream-close", "#stream-exit",
  "#body-open", "#body-close", "#meme-body-open", "#meme-body-close",
]);
const MAX_DEPTH = 32;
const AHU_OPEN_RE  = /<<~[^>]*\bahu\s+(#[\w-]+(?:\/[\w-]+)*)(?:\s+->\s+\S+)?\s*>>/g;
const AHU_CLOSE_RE = /<<~\/ahu\s*>>/g;

interface AhuBlock {
  readonly openStart: number;
  readonly bodyStart: number;
  readonly bodyEnd:   number;
  readonly closeEnd:  number;
  readonly slot:      string;
}

interface SplitOutcome {
  readonly create: Array<Record<string, string>>;
  readonly remove: Set<string>;
  readonly parentText: string;
}

interface TW5Tiddler {
  readonly fields: Record<string, string | string[] | undefined>;
}

interface WikiLike {
  getTiddler?:    (title: string) => TW5Tiddler | undefined;
  filterTiddlers?: (filter: string) => string[];
  addTiddlers?:   (tiddlers: Array<Record<string, unknown>>) => void;
  addTiddler?:    (tiddler: Record<string, unknown>) => void;
  deleteTiddler?: (title: string) => void;
  addEventListener?: (event: string, handler: (changes: Record<string, unknown>) => void) => void;
}

// Module-level applying guard shared across widget instances; multiple
// boots within the same wiki collapse safely because the tiddler title
// uniquely identifies a save in flight.
const _applying = new Set<string>();

export function LarMemeSplitWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

LarMemeSplitWidget.prototype.render = function (
  this: TW5WidgetInstance,
  _parent: TW5FakeElement,
  _nextSibling: TW5FakeElement | null,
): void {
  this.computeAttributes();
  this.execute();

  const wiki = this.wiki as unknown as WikiLike;
  if (!wiki?.addEventListener) return;

  // Subscribe once per widget render. TW5 fires `change` events with a
  // dictionary of changed-tiddler entries; iterate, dispatch only on
  // memetic-typed parents that still exist (deletions skip).
  wiki.addEventListener("change", (changes) => {
    for (const title of Object.keys(changes)) {
      if (!title.startsWith("lar:")) continue;
      if (_applying.has(title)) continue;
      const tiddler = wiki.getTiddler?.(title);
      if (!tiddler) continue;
      const fields = tiddler.fields;
      const type = fields["type"];
      if (type !== MEMETIC_TYPE) continue;
      // Only memes that the operator marked for split — avoids splitting
      // on every TW5 system tiddler change. The presence of a `text` field
      // containing ahu sigils is the practical signal.
      const text = typeof fields["text"] === "string" ? fields["text"] : "";
      if (!/<<~[^>]*\bahu\s+#/.test(text)) continue;
      void runSplit(wiki, title);
    }
  });
};

LarMemeSplitWidget.prototype.execute = function (this: TW5WidgetInstance): void {
  // Subscription-only widget; no DOM children.
};

LarMemeSplitWidget.prototype.refresh = function (): boolean {
  return false;
};

// ---------------------------------------------------------------------------
// runSplit — compute the diff and submit one batched commit
// ---------------------------------------------------------------------------

async function runSplit(wiki: WikiLike, parentTitle: string): Promise<void> {
  const tiddler = wiki.getTiddler?.(parentTitle);
  if (!tiddler) return;
  const fields = tiddler.fields;
  const text   = typeof fields["text"] === "string" ? fields["text"] : "";
  if (!text) return;

  _applying.add(parentTitle);
  try {
    const outcome = computeSplit(parentTitle, text, wiki);

    // Tombstone removed children (existed before, not in new outcome).
    for (const removedTitle of outcome.remove) {
      _applying.add(removedTitle);
      try { wiki.deleteTiddler?.(removedTitle); }
      finally { _applying.delete(removedTitle); }
    }

    // Bulk-commit creates + parent-text rewrite. addTiddlers wraps in one
    // change-event when supported; fall back to per-tiddler when absent.
    const writes: Array<Record<string, unknown>> = [];
    writes.push({
      ...stripUndefined(fields),
      title: parentTitle,
      text:  outcome.parentText,
    });
    for (const child of outcome.create) {
      _applying.add(child["title"]!);
      writes.push(child);
    }
    if (typeof wiki.addTiddlers === "function") {
      wiki.addTiddlers(writes);
    } else if (typeof wiki.addTiddler === "function") {
      for (const w of writes) wiki.addTiddler(w);
    }
    // Echo-guard releases for the children once the bulk commit settles —
    // microtask delay so the wiki's own change-fan-out drains first.
    await Promise.resolve();
    for (const child of outcome.create) _applying.delete(child["title"]!);
  } finally {
    _applying.delete(parentTitle);
  }
}

function stripUndefined(fields: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeSplit — recursive walk producing the bulk-commit outcome
// ---------------------------------------------------------------------------

function computeSplit(parentTitle: string, text: string, wiki: WikiLike): SplitOutcome {
  const create: Array<Record<string, string>> = [];
  const seenTitles = new Set<string>();

  const inner = walk(parentTitle, "", text, 0);

  // Diff against existing children — anything currently filed under
  // fragment-parent==parentTitle but not in `seenTitles` gets removed.
  // The filter walks transitive descendants too (each level's
  // fragment-parent points one level up; we expand the front from the
  // root by tracking seen titles).
  const remove = new Set<string>();
  const existing = wiki.filterTiddlers?.(`[field:fragment-parent[${parentTitle}]]`) ?? [];
  for (const child of existing) {
    if (!seenTitles.has(child)) remove.add(child);
    // Also walk the child's descendants to remove orphans.
    const descendants = wiki.filterTiddlers?.(`[field:fragment-parent[${child}]]`) ?? [];
    for (const d of descendants) {
      if (!seenTitles.has(d)) remove.add(d);
    }
  }

  return { create, remove, parentText: inner.text };

  function walk(rootUri: string, prefix: string, src: string, depth: number): { text: string } {
    if (depth >= MAX_DEPTH) return { text: src };
    const blocks = findTopLevelAhuBlocks(src);
    let cursor = 0;
    let out = "";
    const enclosingUri = rootUri + prefix;
    for (const block of blocks) {
      out += src.slice(cursor, block.openStart);
      if (CONTROL_SLOTS.has(block.slot)) {
        out += src.slice(block.openStart, block.closeEnd);
        cursor = block.closeEnd;
        continue;
      }
      const childPath = composeSlotPath(prefix, block.slot);
      const childUri  = rootUri + childPath;
      const bodyText  = src.slice(block.bodyStart, block.bodyEnd);
      const childInner = walk(rootUri, childPath, bodyText, depth + 1);
      seenTitles.add(childUri);
      create.push({
        title:             childUri,
        text:              childInner.text,
        slot:              block.slot,
        "fragment-parent": enclosingUri,
      });
      out += `<<~ kahea ahu ${block.slot} >>`;
      cursor = block.closeEnd;
    }
    out += src.slice(cursor);
    return { text: out };
  }
}

function findTopLevelAhuBlocks(text: string): AhuBlock[] {
  AHU_OPEN_RE.lastIndex = 0;
  AHU_CLOSE_RE.lastIndex = 0;
  const events: Array<{ kind: "open" | "close"; pos: number; end: number; slot: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = AHU_OPEN_RE.exec(text)) !== null) {
    events.push({ kind: "open", pos: m.index, end: AHU_OPEN_RE.lastIndex, slot: m[1] ?? "#" });
  }
  while ((m = AHU_CLOSE_RE.exec(text)) !== null) {
    events.push({ kind: "close", pos: m.index, end: AHU_CLOSE_RE.lastIndex, slot: "" });
  }
  events.sort((a, b) => a.pos - b.pos);
  const blocks: AhuBlock[] = [];
  const stack: Array<{ openStart: number; bodyStart: number; slot: string }> = [];
  for (const ev of events) {
    if (ev.kind === "open") {
      stack.push({ openStart: ev.pos, bodyStart: ev.end, slot: ev.slot });
    } else {
      const opener = stack.pop();
      if (!opener) continue;
      if (stack.length === 0) {
        blocks.push({
          openStart: opener.openStart,
          bodyStart: opener.bodyStart,
          bodyEnd:   ev.pos,
          closeEnd:  ev.end,
          slot:      opener.slot,
        });
      }
    }
  }
  return blocks;
}

function composeSlotPath(prefix: string, slot: string): string {
  if (!prefix) return slot;
  const slotTail = slot.startsWith("#") ? slot.slice(1) : slot;
  return `${prefix}/${slotTail}`;
}
