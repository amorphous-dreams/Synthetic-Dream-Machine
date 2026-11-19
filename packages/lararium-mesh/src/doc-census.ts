/**
 * doc-census — EVERY DOCUMENT A STORE HOLDS, AND WHO NAMES IT.
 *
 * A store keeps every document its Repo ever saved, and no door removes one. Before any sweep, a census reads each
 * document in each store of the vessel and names what names it: the live composition (a pointer it reads back, a
 * derived address, a cap's mint, a handle its Repo holds open) or another document whose content carries its id (a
 * catalog row, a slot pointer, a binding mint, a keyhive bag-doc row, a control row). A document nothing names reads
 * `unnamed`. A narrow reading proves nothing: the binding-mint instrument read zero over 79 orphan maps, so this
 * census reads every reference kind it can see, and names the documents it could not open rather than guessing.
 *
 * ── THE CLASSES (stable-house#/crud) ────────────────────────────────────────────────────────────
 *   current        a live name reaches it: named by the composition, or by a document a live name reaches
 *   duplicate      an island store's copy of a document the root store also holds
 *   orphan         no live name reaches it (unnamed, or named only by documents no live name reaches)
 *   last-version   a shape the house no longer reads: a document holding no chunk (sync state or a stranded temp
 *                  alone), or one the composition marks by name
 *   sealed-unread  a sealed document this vessel could not open, which no live name reaches: never guessed an orphan
 *
 * Read-only and platform-blind: the store walk, the open and the composition's names ride the input. It names a
 * document by id and never a byte of its body; a reference names the tiddler title that carries it.
 *
 * Canon: lar:///ha.ka.ba/kahua/memory/research/stable-house#/crud
 */
import * as A from "@automerge/automerge";

/** One document as one store rests it: counts and bytes, never a body. */
export interface StoreDocRow {
  readonly id: string;
  /** The store's name: `(root)` for the vessel's own store, an island's folder name otherwise. */
  readonly store: string;
  readonly bytes: number;
  /** Chunks that rest as Automerge bytes (snapshot or incremental). */
  readonly clearChunks: number;
  /** Chunks that rest as anything else (a sealed pointer or a sealed value). */
  readonly sealedChunks: number;
  readonly syncStates: number;
  /** Staged temps a writer left before its rename. */
  readonly temps: number;
}

/** The kinds of name the census reads. */
export const DOC_REF_KINDS = [
  "catalog",       // the catalog pointer, or a row of the catalog document
  "slot",          // a slot pointer row (`…/wikis/<slug>/<kind>`, `daemon-slot/…`)
  "binding-mint",  // a binding-mint row of the daemon document (`…-minted/…`)
  "binding",       // a personal or draft binding row
  "keyhive-bag",   // a keyhive bag-doc row (`lar:///ha.ka.ba/keyhive/bag-doc/…`)
  "derived",       // a derived address the composition computed (`deterministicDocUrl`)
  "control",       // the control home, or a row of the vessel's control document
  "pointer",       // a pointer the composition reads back (the bootstrap's daemon document, and kin)
  "cap-mint",      // a document a cap created while the live composition built
  "live-handle",   // a document the live Repo holds open
  "doc",           // any other document whose content carries its id
] as const;
export type DocRefKind = (typeof DOC_REF_KINDS)[number];

/** One name: its kind, and what names it (a referrer id and tiddler title, a derived label, a cap). */
export interface DocRef {
  readonly kind: DocRefKind;
  readonly by: string;
  /** The naming document's id, where a document names it. */
  readonly from?: string;
}

export const DOC_CLASSES = ["current", "duplicate", "orphan", "last-version", "sealed-unread"] as const;
export type DocClass = (typeof DOC_CLASSES)[number];

/** How the census read a document's content. */
export type DocRead = "clear" | "opened" | "sealed-unread" | "no-chunk" | "unreadable";

export interface DocCensusRow extends StoreDocRow {
  readonly class: DocClass;
  readonly read: DocRead;
  readonly names: readonly DocRef[];
  /** Why the row reads its class, where the class alone does not say. */
  readonly why?: string;
}

export interface DocCensusReading {
  readonly stores: ReadonlyArray<{ readonly name: string; readonly documents: number; readonly bytes: number }>;
  readonly rows: readonly DocCensusRow[];
  readonly counts: Readonly<Record<DocClass, number>>;
  /** Sealed documents left unread: an orphan may be named inside one, so no orphan reads proven while any stands. */
  readonly unreadSealed: number;
}

/** What the census reads of a document's content: a decoded document, or the reason none decodes. */
export type DocContent = { readonly doc: unknown; readonly read: "clear" | "opened" } | { readonly read: "sealed-unread" | "unreadable" };

export interface DocCensusInput {
  readonly rows: readonly StoreDocRow[];
  /** The root store's name among `rows` (`(root)`). */
  readonly rootStore: string;
  /** Every store the walk found, an empty one among them (absent: the stores `rows` name). */
  readonly stores?: readonly string[];
  /** The live composition's own names, by document id. */
  readonly named: ReadonlyArray<{ readonly id: string } & DocRef>;
  /** The role the composition knows a document by (`catalog`, `control`, `daemon`): it labels the names that document carries. */
  readonly roles?: ReadonlyMap<string, string>;
  /** Shapes the house no longer reads, by document id and why (the composition's own marks). */
  readonly lastVersion?: ReadonlyMap<string, string>;
  /** Read one document's content (clear chunks, a live handle, or the sealed rest under the worn session). */
  readonly read: (row: StoreDocRow) => Promise<DocContent>;
}

/** The census of `input`: each row classed, the counts per class, and the stores it walked. */
export async function censusDocuments(input: DocCensusInput): Promise<DocCensusReading> {
  const { rows, rootStore } = input;
  const known = new Set(rows.map((r) => r.id));
  const rootIds = new Set(rows.filter((r) => r.store === rootStore).map((r) => r.id));
  const names = new Map<string, DocRef[]>();
  const add = (id: string, ref: DocRef): void => {
    const list = names.get(id) ?? [];
    if (!list.some((n) => n.kind === ref.kind && n.by === ref.by && n.from === ref.from)) list.push(ref);
    names.set(id, list);
  };
  const live = new Set<string>();
  for (const n of input.named) {
    const { id, ...ref } = n;
    add(id, ref);
    live.add(id);
  }
  // ONE READ PER DOCUMENT: the root's copy where it rests one, else the first island copy.
  const readOf = new Map<string, DocRead>();
  const edges = new Map<string, Set<string>>();
  const firstCopy = new Map<string, StoreDocRow>();
  for (const r of rows) if (!firstCopy.has(r.id) || r.store === rootStore) firstCopy.set(r.id, r);
  for (const [id, row] of firstCopy) {
    if (row.clearChunks + row.sealedChunks === 0 && !live.has(id)) { readOf.set(id, "no-chunk"); continue; }
    let content: DocContent;
    try { content = await input.read(row); } catch { content = { read: "unreadable" }; }
    readOf.set(id, content.read);
    if (!("doc" in content)) continue;
    const role = input.roles?.get(id);
    for (const ref of refsInDocument(content.doc, id, known, role)) {
      add(ref.target, { kind: ref.kind, by: ref.by, from: id });
      const out = edges.get(id) ?? new Set<string>();
      out.add(ref.target);
      edges.set(id, out);
    }
  }
  // A LIVE NAME REACHES: the composition's names, then every document a reached document names.
  const reached = new Set<string>(live);
  const todo = [...live];
  while (todo.length > 0) {
    const id = todo.pop()!;
    for (const next of edges.get(id) ?? []) if (!reached.has(next)) { reached.add(next); todo.push(next); }
  }
  const out: DocCensusRow[] = [];
  for (const r of rows) {
    const read = readOf.get(r.id) ?? "no-chunk";
    const named = names.get(r.id) ?? [];
    const row = (cls: DocClass, why?: string): DocCensusRow => ({ ...r, class: cls, read, names: named, ...(why !== undefined ? { why } : {}) });
    if (r.store !== rootStore && rootIds.has(r.id)) { out.push(row("duplicate", `the root store holds ${r.id} too`)); continue; }
    if (reached.has(r.id)) { out.push(row("current")); continue; }
    const mark = input.lastVersion?.get(r.id);
    if (mark !== undefined) { out.push(row("last-version", mark)); continue; }
    if (r.clearChunks + r.sealedChunks === 0) {
      out.push(row("last-version", r.syncStates > 0 ? "sync state alone, no chunk" : r.temps > 0 ? "a stranded temp alone, no chunk" : "no chunk"));
      continue;
    }
    if (read === "sealed-unread") { out.push(row("sealed-unread", "sealed, and this vessel could not open it")); continue; }
    out.push(row("orphan", named.length > 0 ? "named only by documents no live name reaches" : "unnamed"));
  }
  const counts = Object.fromEntries(DOC_CLASSES.map((c) => [c, out.filter((r) => r.class === c).length])) as Record<DocClass, number>;
  const stores = [...new Set([...(input.stores ?? []), ...rows.map((r) => r.store)])].map((name) => {
    const of = rows.filter((r) => r.store === name);
    return { name, documents: of.length, bytes: of.reduce((s, r) => s + r.bytes, 0) };
  });
  const unreadSealed = [...readOf.values()].filter((r) => r === "sealed-unread").length;
  return { stores, rows: out, counts, unreadSealed };
}

/** A token that may spell a document id (base58). */
const ID_TOKEN = /[1-9A-HJ-NP-Za-km-z]{16,40}/g;
const KEYHIVE_BAG_DOC = "lar:///ha.ka.ba/keyhive/bag-doc/";
const SLOT_TITLE = /\/wikis\/[^/]+\/[^/]+$|daemon-slot\//;

/** The kind a reference reads as, from the row that carries it and the role of the document that holds the row. */
export function refKindOf(role: string | undefined, title: string, fields: Readonly<Record<string, unknown>>): DocRefKind {
  const kind = typeof fields["kind"] === "string" ? fields["kind"] : "";
  if (kind === "binding-mint" || title.includes("-minted/")) return "binding-mint";
  if (kind === "personal-binding" || kind === "draft-binding") return "binding";
  if (title.startsWith(KEYHIVE_BAG_DOC)) return "keyhive-bag";
  if (SLOT_TITLE.test(title) || kind.endsWith("slot")) return "slot";
  if (role === "catalog") return "catalog";
  if (role === "control") return "control";
  return "doc";
}

function strings(v: unknown, out: string[], depth = 0): void {
  if (depth > 64 || v === null || v === undefined) return;
  if (typeof v === "string") { out.push(v); return; }
  if (v instanceof Uint8Array) return;
  if (Array.isArray(v)) { for (const x of v) strings(x, out, depth + 1); return; }
  if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) { out.push(k); strings(x, out, depth + 1); }
}

/**
 * Each document id among `known` that `doc`'s content names, beside the row that names it: a LarDoc's tiddlers by
 * title (their fields label the kind), every other top-level key by its own name. A document never names itself.
 */
export function refsInDocument(
  doc: unknown, selfId: string, known: ReadonlySet<string>, role?: string,
): Array<{ readonly target: string; readonly kind: DocRefKind; readonly by: string }> {
  const out: Array<{ target: string; kind: DocRefKind; by: string }> = [];
  const seen = new Set<string>();
  const scan = (v: unknown, title: string, fields: Readonly<Record<string, unknown>>): void => {
    const found: string[] = [];
    strings(v, found);
    for (const s of found) for (const m of s.matchAll(ID_TOKEN)) {
      const id = m[0];
      if (id === selfId || !known.has(id)) continue;
      const key = `${id}\u0000${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ target: id, kind: refKindOf(role, title, fields), by: title });
    }
  };
  if (doc === null || typeof doc !== "object") return out;
  for (const [top, value] of Object.entries(doc as Record<string, unknown>)) {
    if (top === "tiddlers" && value !== null && typeof value === "object") {
      for (const [title, record] of Object.entries(value as Record<string, unknown>)) {
        const r = (record ?? {}) as Record<string, unknown>;
        const fields = (r["tiddler"] !== null && typeof r["tiddler"] === "object" ? r["tiddler"] : r) as Record<string, unknown>;
        scan(record, title, fields);
      }
    } else {
      scan(value, top, {});
    }
  }
  return out;
}

/** Decode a document's chunks (snapshots and incrementals, in any order the store lists them). */
export function decodeChunks(chunks: readonly Uint8Array[]): unknown {
  let doc = A.init<Record<string, unknown>>();
  for (const c of chunks) doc = A.loadIncremental(doc, c);
  return A.toJS(doc);
}
