/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/place-meme
type: application/javascript
module-type: library
\*/
/**
 * place-meme — a meme arrives as text and lands as its records.
 *
 * ONE FUNCTION, EVERY SKIN. The plain TW5 server route (`PUT /recipes/:recipe/memes/:uri`), the
 * island's INGEST verb, and any MCP or CLI door that carries meme text all call `placeMeme`. The
 * placement law lives here once:
 *
 *   1. the meme's current GROUP in the sink — root · `uri#slot` · `uri/path` (the carrier-group law),
 *   2. the Confluence gate (`decideIngest`) over the group's present render vs the new text,
 *   3. land every fresh record, tombstone every group member the new text no longer declares.
 *
 * A `MemeSink` is the only thing a skin supplies: four verbs over whatever holds tiddlers — a live
 * `$tw.wiki` (`wikiMemeSink`), a bag store behind BagAccess, a Map in a test. The split itself runs
 * through the deserializer, so it happens inside the engine on every skin (the in-VM parse law).
 *
 * THE BASE HASH. A writer that read the meme before editing hands back the canonical hash it read
 * (`baseHash`, the route's `If-Match`). The gate treats it as the merge base: records that moved
 * past it read as a CONFLICT, never a silent overwrite. No base = a fresh adoption — the gate lands
 * it unless the records already carry an equivalent render (a noop).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/place-meme
 */

import { decideIngest } from "./ingest-gate.js";
import type { MemeDiagnostic } from "./meme-ast/diagnostics.js";
import { gradeOf } from "./meme-ast/diagnostics.js";
import type { TiddlerFields } from "./deserializer.js";
import { expandMemeRefs } from "./deserializer.js";
import type { TW5Wiki } from "./types/tiddlywiki.js";

import { carrierMarkPattern, headUriOf } from "./carrier-head.js";
import { maskedExec } from "./meme-ast/fence-mask.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { sha256HexSync } from "@lararium/mesh/crypto";
import { tagDigest } from "@lararium/mesh/agile-digest";

type MaybePromise<T> = T | Promise<T>;

/** The four verbs a placement needs over whatever holds tiddlers. Every verb may answer sync or async. */
export interface MemeSink {
  /** Every live title the sink holds (the placement filters the meme's group out of it). */
  titles(): MaybePromise<readonly string[]>;
  /** The fields under one title, or undefined. */
  read(title: string): MaybePromise<TiddlerFields | undefined>;
  /** Land one record (create or replace under its title). */
  land(fields: TiddlerFields): MaybePromise<void>;
  /** Remove one title. */
  tombstone(title: string): MaybePromise<void>;
}

export interface PlaceMemeInput {
  /** The meme's root lar: URI — the title its parent record carries. */
  readonly uri: string;
  /** The whole meme text, framed. */
  readonly text: string;
  /** The canonical hash the writer last read (the merge base); null/absent = fresh adoption. */
  readonly baseHash?: string | null;
  /** The digest the gate compares by; defaults to the tagged sha256 every other shore uses. */
  readonly hash?: (text: string) => string;
}

export interface PlaceMemeReceipt {
  readonly uri: string;
  readonly decision: "ingest" | "noop" | "refuse" | "conflict";
  readonly grade: "clean" | MemeDiagnostic["severity"];
  /** The gate's reason on a noop. */
  readonly reason?: string;
  /** Titles landed (ingest only). */
  readonly landed: readonly string[];
  /** Group members removed because the new text no longer declares them (ingest only). */
  readonly tombstoned: readonly string[];
  /** Hash of the canonical render the records now carry — the next writer's base. */
  readonly canonicalHash?: string;
  readonly warnings: readonly string[];
  readonly diagnostics: readonly MemeDiagnostic[];
}

/**
 * THE WIRE PATH — the meme's URI projected onto an HTTP path, a sibling of the native
 * `/{recipes|bags}/:name/tiddlers/:title` collection: `<scheme>:///<path>` ⇄ `/memes/<scheme>/<path>`.
 * Groups: container kind · container name · scheme · uri-path.
 */
export const MEME_PATH = /^\/(recipes|bags)\/([^/]+)\/memes\/([a-z][a-z0-9+.-]*)\/(.+)$/;

/** The URI a matched `MEME_PATH` names, or null when a segment carries a malformed escape. */
export function memeUriOfParams(params: readonly string[]): string | null {
  const scheme = params[2];
  const rest = params[3];
  if (!scheme || !rest) return null;
  try { return `${scheme}:///${rest.split("/").map(decodeURIComponent).join("/")}`; } catch { return null; }
}

/** The path a meme's URI projects to, under one container. Null for a URI with an authority. */
export function memePathOf(uri: string, container: { kind: "bags" | "recipes"; name: string }): string | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/\/(.+)$/.exec(uri);
  if (!m) return null;
  return `/${container.kind}/${container.name}/memes/${m[1]}/${m[2]!.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * A FRAMED ROOT — a record whose `type` reads the carrier type and whose text still opens with a SOH
 * head (masked: a head shown inside a fence opens nothing). The whole meme sits in one record, unsplit;
 * the placement law never ran over it. A split root carries a `<<~ kahea …>>` body and no head; a slot
 * child carries its own text and no head — neither reads as framed. Answers the URI the head names
 * (else the title), or null.
 */
export function framedRootOf(fields: Record<string, unknown>): string | null {
  if (fields["type"] !== CARRIER_TYPE) return null;
  const text = typeof fields["text"] === "string" ? fields["text"] : "";
  if (!maskedExec(text, carrierMarkPattern("head", "g"))) return null;
  const title = typeof fields["title"] === "string" ? fields["title"] : "";
  return headUriOf(text) ?? (title || null);
}

/** The carrier-group law: the root, its `#slot` fragments, its `/path` children. */
export function groupOfMeme(titles: readonly string[], uri: string): string[] {
  return titles.filter((t) => t === uri || t.startsWith(`${uri}#`) || t.startsWith(`${uri}/`));
}

const defaultHash = (text: string): string => tagDigest(sha256HexSync(text));

/** The meme's group in the sink and its present render — the text the records carry now. */
async function currentRender(
  uri: string, sink: Pick<MemeSink, "titles" | "read">,
): Promise<{ group: string[]; text: string }> {
  const group = groupOfMeme(await sink.titles(), uri);
  const current = new Map<string, TiddlerFields>();
  for (const title of group) {
    const fields = await sink.read(title);
    if (fields) current.set(title, fields);
  }
  return { group, text: expandMemeRefs((t) => current.get(t), uri) ?? "" };
}

/**
 * Place one meme into a sink through the Confluence gate. Never throws on a bad meme — the receipt
 * carries the refusal; a sink verb that throws propagates.
 */
export async function placeMeme(input: PlaceMemeInput, sink: MemeSink): Promise<PlaceMemeReceipt> {
  const { uri, text } = input;
  const hash = input.hash ?? defaultHash;
  const baseHash = input.baseHash ?? null;

  const { group, text: currentText } = await currentRender(uri, sink);
  const currentRenderHash = hash(currentText);

  const decision = decideIngest({
    uri,
    diskText: text,
    diskHash: hash(text),
    syncedHash: baseHash,
    currentRenderHash,
    hash,
  });

  if (decision.kind === "noop") {
    return { uri, decision: "noop", grade: "clean", reason: decision.reason, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: [], diagnostics: [] };
  }
  const grade = gradeOf(decision.diagnostics);
  if (decision.kind === "refuse") {
    return { uri, decision: "refuse", grade, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: decision.warnings, diagnostics: decision.diagnostics };
  }
  if (decision.kind === "conflict") {
    return { uri, decision: "conflict", grade, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: [`${uri}: records moved past the base the writer read`], diagnostics: decision.diagnostics };
  }

  const landed: string[] = [];
  for (const fields of decision.records) {
    const title = typeof fields.title === "string" ? fields.title : "";
    if (!title) throw new Error(`placeMeme: ${uri} produced a record without a title`);
    await sink.land(fields);
    landed.push(title);
  }
  const fresh = new Set(landed);
  const tombstoned: string[] = [];
  for (const title of group) {
    if (fresh.has(title)) continue;
    await sink.tombstone(title);
    tombstoned.push(title);
  }
  return { uri, decision: "ingest", grade, landed, tombstoned, canonicalHash: hash(decision.canonicalText), warnings: [], diagnostics: decision.diagnostics };
}

/** The read half: the whole meme as text (children recomposed inline) and the canonical hash a
 *  writer hands back as its base. `null` when the sink holds no record under the URI. */
export async function readMeme(
  uri: string, sink: Pick<MemeSink, "titles" | "read">, hash: (text: string) => string = defaultHash,
): Promise<{ text: string; canonicalHash: string } | null> {
  const { group, text } = await currentRender(uri, sink);
  if (!group.includes(uri)) return null;
  return { text, canonicalHash: hash(text) };
}

/**
 * THE REMOVAL — the meme's whole group (root · `#slot` fragments · `/path` children) tombstones
 * through the sink. The same base law as a placement: a `baseHash` that fails to match the standing
 * render answers `conflict` and removes nothing. `absent` when no root stands under the URI.
 */
export async function removeMeme(
  input: { readonly uri: string; readonly baseHash?: string | null; readonly hash?: (text: string) => string },
  sink: MemeSink,
): Promise<{ decision: "removed" | "absent" | "conflict"; tombstoned: readonly string[]; canonicalHash?: string }> {
  const hash = input.hash ?? defaultHash;
  const { group, text } = await currentRender(input.uri, sink);
  if (!group.includes(input.uri)) return { decision: "absent", tombstoned: [] };
  const canonicalHash = hash(text);
  if (input.baseHash && input.baseHash !== canonicalHash) return { decision: "conflict", tombstoned: [], canonicalHash };
  for (const title of group) await sink.tombstone(title);
  return { decision: "removed", tombstoned: group, canonicalHash };
}

/** One slot of a listed meme's tree: the slot name, the record's title, the slots it holds. */
export interface MemeSlotNode {
  readonly slot: string;
  readonly uri: string;
  readonly slots: readonly MemeSlotNode[];
}

/** One listed meme: its root URI, the hash a writer hands back as its base, the slot tree on request. */
export interface MemeListing {
  readonly uri: string;
  readonly canonicalHash: string;
  readonly slots?: readonly MemeSlotNode[];
}

/**
 * THE LISTING — every meme ROOT the sink holds, with the canonical hash a writer hands back as its base;
 * `tree` nests each root's `uri#/slot` children beneath it, at their own depth.
 *
 * A root reads as a record of the carrier type with no `$fragment-parent` and no `#` in its title. A
 * slot child carries `$fragment-parent`; a carriage part (`$preamble` · `$postamble`) carries a `$slot`
 * that opens with `$`; a plain tiddler carries neither the type nor the parent. None of those lists as a
 * root, and a slot nests under the parent its own record names — never under a neighbour whose title it
 * merely extends. Roots answer in title order.
 */
export async function listMemes(
  sink: Pick<MemeSink, "titles" | "read">, opts: { readonly tree?: boolean } = {}, hash: (text: string) => string = defaultHash,
): Promise<MemeListing[]> {
  const titles = [...await sink.titles()].sort();
  const fields = new Map<string, TiddlerFields>();
  for (const title of titles) {
    const f = await sink.read(title);
    if (f && f["type"] === CARRIER_TYPE) fields.set(title, f);
  }
  const roots = [...fields.keys()].filter((t) => !t.includes("#") && fields.get(t)!["$fragment-parent"] === undefined);
  const childrenOf = (parent: string): MemeSlotNode[] =>
    [...fields.entries()]
      .filter(([, f]) => f["$fragment-parent"] === parent && typeof f["$slot"] === "string" && !String(f["$slot"]).startsWith("$"))
      .map(([title, f]) => ({ slot: String(f["$slot"]), uri: title, slots: childrenOf(title) }));
  const out: MemeListing[] = [];
  for (const uri of roots) {
    const meme = await readMeme(uri, sink, hash);
    if (!meme) continue;
    out.push({ uri, canonicalHash: meme.canonicalHash, ...(opts.tree ? { slots: childrenOf(uri) } : {}) });
  }
  return out;
}

/** The `$tw.wiki` skin — a live wiki, on the plain server or inside the island. */
export function wikiMemeSink(wiki: Pick<TW5Wiki, "allTitles" | "getTiddler" | "addTiddler" | "deleteTiddler">): MemeSink {
  return {
    titles: () => wiki.allTitles(),
    read: (title) => (wiki.getTiddler(title) as { fields?: TiddlerFields } | undefined)?.fields,
    land: (fields) => { wiki.addTiddler(fields as Record<string, unknown>); },
    tombstone: (title) => { wiki.deleteTiddler(title); },
  };
}
