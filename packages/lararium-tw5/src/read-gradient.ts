/**
 * read-gradient — A READ ANSWERS ON A GRADIENT, BY GRAIN, NEVER BY A CLIFF (lar:///ha.ka.ba/kahua/memory/road/leap-door-reads-gradient).
 *
 * A small thing answers whole; a large one answers its has-stack (the card: one `has` line for the thing and one per slot), and
 * unfolds one grain at a time. No answer cuts a slot in half: the whole carrier past a page pages on slot boundaries, and a single
 * slot larger than a page rides its own page whole. The grain words stay the hydration-grain's own, two vocabularies kept apart
 * (lar:///ha.ka.ba/lararium/api/hydration-grain #/the-three-grains):
 *
 *   tiddler grain   skinny (the fields, the text left home) · fat (the record with its text)
 *   body grain      handle (a pointer's fields: the name travels) · resolved (the bytes the handle names, from the local CAS by CID)
 *   the meme        slot (one slot of a carrier) · whole (the whole carrier, paged on slot boundaries)
 *
 * A grain outside that closed set refuses loudly (`grain-unknown`), and every answer echoes the grain it applied and why.
 *
 * THE `has` LINE, in the pono grammar: `<<~ has name=`…` params=`…`>>` (the spaced tilde, the operator's ruling for standards; the
 * memetic-wikitext plugin turns it into `<<~has …>>`). The entity default restates nothing; the params run provenance first, then
 * the record's own tags, then the wire's measure keys, then a `~` tagline quoting the description or role.
 *
 * Platform-blind pure functions: no store, no engine.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/read-gradient
 */

import { VerbRefusal } from "@lararium/mesh";
import { findTopLevelAhuBlocks, type AhuBlock } from "./meme-ast/ahu-scan.js";

/** THE ONE PAGE: the bytes a read answers whole within (the house page a filter page and a render hold too). */
export const READ_PAGE_BYTES = 65_536;

/** The closed grain set. Tiddler grain and body grain stay apart; `slot` and `whole` read a meme. */
export const READ_GRAINS = ["skinny", "fat", "handle", "resolved", "slot", "whole"] as const;
export type ReadGrain = typeof READ_GRAINS[number];

/** The grain a call named, or null where it named none. An unknown grain refuses by name, naming the set. */
export function grainOf(raw: unknown): ReadGrain | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "string" && (READ_GRAINS as readonly string[]).includes(raw.trim())) return raw.trim() as ReadGrain;
  throw new VerbRefusal("grain-unknown", `grain-unknown: "${String(raw)}" names no grain; a read unfolds at one of ${READ_GRAINS.join(" · ")} (skinny/fat the tiddler grain, handle/resolved the body grain, slot/whole the meme).`);
}

/** What an answer echoes of its grain: the one asked (null for none), the one applied, and why. */
export interface GrainEcho {
  readonly asked: ReadGrain | null;
  readonly applied: ReadGrain;
  readonly why: string;
}

const utf8 = new TextEncoder();
export const byteLength = (text: string): number => utf8.encode(text).length;

// ── the has line ─────────────────────────────────────────────────────────────────────────────────────

/** A value quoted for a sigil attribute: one backtick each side, or three where the value holds a backtick. */
function quoted(value: string): string {
  return value.includes("`") ? `\`\`\`${value}\`\`\`` : `\`${value}\``;
}

/** One param token: `key/value`, a value with whitespace bracketed as TiddlyWiki brackets a title. */
export function param(key: string, value: string | number | boolean): string {
  const text = String(value);
  return `${key}/${/\s/.test(text) ? `[[${text}]]` : text}`;
}

/** A tagline, one line and short: the description or role a reader meets first. */
function taglineOf(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const line = raw.replace(/\s+/g, " ").trim();
  if (line === "") return null;
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

/** THE `has` LINE: `<<~ has name=`…` params=`… ~ tagline`>>`. */
export function hasLine(name: string, params: readonly string[], tagline?: string | null): string {
  const tail = taglineOf(tagline);
  const body = [...params, ...(tail ? [`~ ${tail}`] : [])].join(" ");
  return `<<~ has name=${quoted(name)} params=${quoted(body)}>>`;
}

/** A record's own tags as stack tokens, in the order the record writes them (TiddlyWiki's bracketed list). */
export function tagTokens(tags: string | undefined): string[] {
  if (typeof tags !== "string" || tags.trim() === "") return [];
  const out: string[] = [];
  const re = /\[\[([^\]]*)\]\]|(\S+)/g;
  for (let m = re.exec(tags); m; m = re.exec(tags)) {
    const tag = m[1] ?? m[2] ?? "";
    if (tag !== "") out.push(/\s/.test(tag) ? `[[${tag}]]` : tag);
  }
  return out;
}

// ── the carrier's slots ──────────────────────────────────────────────────────────────────────────────

/** One top-level slot of a carrier: its name, its bytes, and its first line (the tagline a has line quotes). */
export interface CarrierSlot {
  readonly slot: string;
  readonly bytes: number;
  readonly first: string | null;
}

/**
 * THE CARRIER CUT AT ITS SLOT BOUNDARIES: segments whose join reads the carrier byte for byte. The cut reads the decomposer's own
 * ahu scan (`scanAhu`: the fence and inline-code mask, the line law, one pairing stack), so the slots a read names ARE the slots
 * the family stores, and a quoted opener or closer moves nothing. The first segment holds the frame and meta before the first
 * top-level slot; each other segment opens on one and runs to the next. The trailer rides the last segment.
 */
export function carrierSegments(text: string): { readonly segments: string[]; readonly slots: (string | null)[]; readonly blocks: readonly AhuBlock[] } {
  const blocks = findTopLevelAhuBlocks(text);
  const segments: string[] = [];
  const slots: (string | null)[] = [];
  let from = 0;
  let slot: string | null = null;
  for (const block of blocks) {
    segments.push(text.slice(from, block.openStart));
    slots.push(slot);
    from = block.openStart;
    slot = block.slot;
  }
  segments.push(text.slice(from));
  slots.push(slot);
  return { segments, slots, blocks };
}

/** The first prose line of a slot's body: its heading, the `!` marks dropped. */
function firstLineOf(body: string): string | null {
  for (const line of body.split("\n")) {
    const bare = line.trim();
    if (bare === "" || bare.startsWith("<<~") || bare.startsWith("<<^")) continue;
    return bare.replace(/^!+\s*/, "");
  }
  return null;
}

/** The span a block owns: its opener through its closer, and the line end that follows. */
function blockSpan(text: string, block: AhuBlock): string {
  const end = text.startsWith("\r\n", block.closeEnd) ? block.closeEnd + 2 : text[block.closeEnd] === "\n" ? block.closeEnd + 1 : block.closeEnd;
  return text.slice(block.openStart, end);
}

/** Every top-level slot of a carrier, in order, with its bytes and first line. */
export function carrierSlots(text: string): CarrierSlot[] {
  return findTopLevelAhuBlocks(text).map((block) => ({
    slot: block.slot, bytes: byteLength(blockSpan(text, block)), first: firstLineOf(text.slice(block.bodyStart, block.bodyEnd)),
  }));
}

/** One slot's own span of the carrier (its opening line through its close), or null where the carrier holds no such slot. */
export function carrierSlotText(text: string, slot: string): string | null {
  const name = slot.startsWith("#") ? slot : `#/${slot.replace(/^\/+/, "")}`;
  const block = findTopLevelAhuBlocks(text).find((b) => b.slot === name);
  return block ? blockSpan(text, block) : null;
}

// ── the whole carrier, paged on slot boundaries ──────────────────────────────────────────────────────

/** One page of a whole carrier: the text, which page of how many, and the cursor of the page behind (null on the last). */
export interface CarrierPage {
  readonly text: string;
  readonly page: number;
  readonly pages: number;
  readonly next: string | null;
}

/** The pages a carrier reads in: whole segments gathered up to a page each; a segment past a page rides its own page whole. */
function pagesOf(text: string, pageBytes: number): string[] {
  const { segments } = carrierSegments(text);
  const pages: string[] = [];
  let current = "";
  let size = 0;
  for (const segment of segments) {
    const bytes = byteLength(segment);
    if (current !== "" && size + bytes > pageBytes) { pages.push(current); current = ""; size = 0; }
    current += segment;
    size += bytes;
  }
  pages.push(current);
  return pages;
}

/**
 * THE WHOLE CARRIER, ONE PAGE AT A TIME, ON SLOT BOUNDARIES. A carrier within a page answers in one; a longer one answers its first
 * page with `next`, a cursor `<page>.<tail of the canonical hash>` the caller hands back as `after`. The pages join to the carrier
 * byte for byte. The cursor names the carrier it continues: a carrier that moved refuses `read-cursor-stale`.
 */
export function pageCarrier(text: string, canonicalHash: string, after: string | null, pageBytes = READ_PAGE_BYTES): CarrierPage {
  const tail = canonicalHash.slice(-16);
  const pages = pagesOf(text, pageBytes);
  let index = 0;
  if (after) {
    const cursor = /^([0-9]{1,6})\.(.{1,16})$/.exec(after);
    if (!cursor) throw new VerbRefusal("read-cursor-malformed", `read-cursor-malformed: "${after}" reads as no cursor; hand back a page's own \`next\`, or drop \`after\` to read from the first page.`);
    if (cursor[2] !== tail) throw new VerbRefusal("read-cursor-stale", "read-cursor-stale: the carrier moved and reads another text now; drop `after` and read again from the first page.");
    index = Math.min(Number(cursor[1]), pages.length - 1);
  }
  return { text: pages[index]!, page: index + 1, pages: pages.length, next: index + 1 < pages.length ? `${index + 1}.${tail}` : null };
}

// ── a meme's gradient ────────────────────────────────────────────────────────────────────────────────

/** A meme read at a grain: the echo, the text where the grain carries one, the slots, and the next unfold. */
export interface MemeGradient {
  readonly grain: GrainEcho;
  readonly bytes: number;
  readonly slots: CarrierSlot[];
  /** The carrier text (whole), one page of it (whole, paged), or one slot's span (slot); absent at skinny. */
  readonly text?: string;
  readonly page?: { readonly page: number; readonly pages: number };
  /** The next unfold: the grain to ask and the cursor to hand back, or null where this answer reads the end. */
  readonly next: { readonly grain: ReadGrain; readonly after?: string } | null;
}

/**
 * A MEME ON THE GRADIENT. No grain named: the whole carrier where it fits one page, else skinny (the slots alone) with `next`
 * naming the whole. `skinny` answers the slots; `whole` pages the carrier on slot boundaries; `slot` answers one slot's span.
 * A slot the carrier does not hold refuses `slot-missing`; a tiddler or body grain names no meme reading and refuses by name.
 */
export function memeGradient(
  meme: { readonly text: string; readonly canonicalHash: string },
  ask: { readonly grain: ReadGrain | null; readonly after?: string | null; readonly slot?: string | null; readonly pageBytes?: number },
): MemeGradient {
  const pageBytes = ask.pageBytes ?? READ_PAGE_BYTES;
  const bytes = byteLength(meme.text);
  const slots = carrierSlots(meme.text);
  const asked = ask.grain;
  const grain = asked ?? (ask.slot ? "slot" : ask.after ? "whole" : null);
  if (grain === "slot") {
    if (!ask.slot) throw new VerbRefusal("slot-unnamed", "slot-unnamed: the slot grain reads one slot; name it (`slot: \"#/name\"`).");
    const text = carrierSlotText(meme.text, ask.slot);
    if (text === null) throw new VerbRefusal("slot-missing", `slot-missing: the carrier holds no top-level slot ${ask.slot}; its slots: ${slots.map((s) => s.slot).join(" · ") || "none"}.`);
    return { grain: { asked, applied: "slot", why: `the slot ${ask.slot} as carrier text` }, bytes, slots, text, next: null };
  }
  if (grain === "skinny") return { grain: { asked, applied: "skinny", why: "asked: the meme's has-stack, the carrier left home" }, bytes, slots, next: { grain: "whole" } };
  if (grain === "whole") {
    const page = pageCarrier(meme.text, meme.canonicalHash, ask.after ?? null, pageBytes);
    const why = page.pages === 1 ? "the whole carrier, byte for byte" : `the whole carrier, page ${page.page} of ${page.pages}, cut on slot boundaries`;
    return { grain: { asked, applied: "whole", why }, bytes, slots, text: page.text, ...(page.pages > 1 ? { page: { page: page.page, pages: page.pages } } : {}), next: page.next ? { grain: "whole", after: page.next } : null };
  }
  if (grain !== null) throw new VerbRefusal("grain-not-meme", `grain-not-meme: "${grain}" reads a record or a body, never a meme's carrier; the meme lens unfolds at skinny · slot · whole.`);
  if (bytes <= pageBytes) return { grain: { asked, applied: "whole", why: `fits one page (${bytes} of ${pageBytes} bytes): the whole carrier` }, bytes, slots, text: meme.text, next: null };
  return { grain: { asked, applied: "skinny", why: `runs past one page (${bytes} of ${pageBytes} bytes): the has-stack first` }, bytes, slots, next: { grain: "whole" } };
}

/** The slot lines a meme's has-stack carries: one `has` line per top-level slot, its bytes and first line. */
export function slotHasLines(slots: readonly CarrierSlot[]): string[] {
  return slots.map((s) => hasLine(s.slot, [param("bytes", s.bytes)], s.first));
}
