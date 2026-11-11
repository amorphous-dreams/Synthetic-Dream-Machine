/**
 * share-config — WHO MAY READ AND WRITE A BAG, in one place (the share config, sealed-store#/the-share-config).
 *
 * Faces do not know each other: no face's hive or catalog names another face. The operator alone shares a bag, by
 * TW5-native rows `$:/config/lares/share/<slug>` whose fields `read` and `write` name faces by PET-NAME (a title list: bare
 * words, `[[a name with spaces]]`, or `*` for every face; empty for none) and whose `note` says why. The rows rest
 * authoritative in the vessel's control document (the vessel's key; no face reads it) and write through to
 * `$LAR_ROOT/config/share.tid`, which survives a re-founding and a person edits by hand; each boot reconciles the file into
 * the control document, and the file wins.
 *
 * ONE RESOLVER answers "who may read or write this bag" (`resolveShare`), as MultiWikiServer keeps one ACL place: no second
 * policy surface. A house canon bag takes no row: it rests in the Kahu realm, every face reads its floor snapshot, and the Kahu
 * steward alone writes it live (`requireKahuReach`), so no share row ever lifts a write into it. A custom bag stays private to the face
 * that owns it until a row shares it; a name matching no face waits by name. Sharing rides by REFERENCE and DELEGATION, never
 * a copy: a face that lights reads each row naming it, lifts the bag's catalog row into its own catalog half, and the owner's
 * hive delegates the bag to it while both stand lit (`owedGrants`); a grant whose owner stands shut waits behind an opaque
 * flag (`sharePendingTitle`), naming no face.
 *
 * A WIKI'S ROW RIDES A PRIVATE CABAL (cabal-realm#/the-workbench). A `kind: "wiki"` row shares the wiki's WORKING layer: the
 * share door founds (once) a glamour-less, announce-less cabal realm whose Keyhive Document holds the faces the row names, and
 * the wiki's workbench (one CRDT at the realm's address) syncs to every member face. The row stays this TW5 surface; the realm
 * carries who reads. A row may name a `workspace`: the operator-configured directory (`/lar/workspaces/<name>`) the workbench's
 * plaintext mirror rests in, else `<projections>/wikis/<slug>`. The daemon wiki holds one face's memory and takes no row at
 * all (`share-face-private`), whatever its kind.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";
import { bagUri } from "./lar-uris.js";
import { isFacePrivateSlug, WORKSPACE_NAME_RE } from "./workbench.js";

/** The prefix every share row titles under. */
export const SHARE_CONFIG_PREFIX = "$:/config/lares/share/";
/** The prefix of the control document's opaque flags: a grant owed behind a shut owner, naming no face. */
export const SHARE_PENDING_PREFIX = "$:/config/lares/share-pending/";
/** The file each row writes through to, under `$LAR_ROOT/config`. */
export const SHARE_CONFIG_FILE = "share.tid";

/** One share row: the slug it shares (a bag's or a wiki's), the read and write title lists, and its note. */
export interface ShareRow {
  readonly slug: string;
  readonly kind: "bag" | "wiki";
  /** A title list of face pet-names, `*`, or empty. */
  readonly read: string;
  readonly write: string;
  readonly note?: string;
  /** A wiki row's workspace name: its workbench mirror rests at `/lar/workspaces/<name>` (else `<projections>/wikis/<slug>`). */
  readonly workspace?: string;
}

/** A face as the resolver reads it: its handle index and its pet-name (null where none reads). */
export interface ShareFace { readonly handleIndex: number; readonly petname: string | null }

/** A share row whose filter reads outside the title-list subset refuses by name, never a guess. */
export class ShareConfigRefusal extends Error {
  override readonly name = "ShareConfigRefusal";
  constructor(readonly reason: "share-filter-unsupported" | "share-slug-malformed" | "share-file-malformed" | "share-face-private" | "share-workspace-malformed", detail: string) { super(`${reason}: ${detail}`); }
}

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;

/** The row title for a slug. The daemon wiki (and each face's `daemon-<F>`) refuses `share-face-private`: it never shares. */
export function shareRowTitle(slug: string): string {
  if (!SLUG.test(slug)) throw new ShareConfigRefusal("share-slug-malformed", `"${slug}" names no bag or wiki slug`);
  if (isFacePrivateSlug(slug)) throw new ShareConfigRefusal("share-face-private", `"${slug}" holds one face's memory (the daemon wiki), a named exception: it takes no share row`);
  return `${SHARE_CONFIG_PREFIX}${slug}`;
}

/** A row's workspace name, checked: empty or absent reads none; a name outside the grammar refuses `share-workspace-malformed`. */
export function shareRowWorkspace(row: Pick<ShareRow, "workspace">): string | null {
  const name = (row.workspace ?? "").trim();
  if (name === "") return null;
  if (!WORKSPACE_NAME_RE.test(name)) throw new ShareConfigRefusal("share-workspace-malformed", `"${name}" names no workspace (lower-case letters, digits, '.', '_' and '-')`);
  return name;
}

/** The bag a row shares: a wiki's row shares its canon bag. */
export function shareRowBag(row: Pick<ShareRow, "slug">): string { return bagUri(row.slug); }

/**
 * Read a share filter as the title list a TW5 filter of bare titles reads as: bare words, `[[bracketed names]]`, and `*` for
 * every face. Any filter operator (`[tag[x]]`, a run prefix) refuses `share-filter-unsupported`: the share config names faces,
 * and a filter that computes them lands no second policy surface.
 */
export function parseShareFilter(filter: string): { readonly all: boolean; readonly names: readonly string[] } {
  const names: string[] = [];
  let all = false;
  const text = filter.trim();
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i]!)) { i++; continue; }
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i + 2);
      if (end < 0) throw new ShareConfigRefusal("share-filter-unsupported", `"${filter}" opens [[ and never closes it`);
      const name = text.slice(i + 2, end).trim();
      if (name) names.push(name);
      i = end + 2;
      continue;
    }
    let j = i;
    while (j < text.length && !/\s/.test(text[j]!)) j++;
    const word = text.slice(i, j);
    if (/[[\]{}<>|+~:=]/.test(word) || word.startsWith("-")) throw new ShareConfigRefusal("share-filter-unsupported", `"${word}" in "${filter}" reads as a filter operator; the share config names faces by pet-name, \`*\`, or none`);
    if (word === "*") all = true; else names.push(word);
    i = j;
  }
  return { all, names: [...new Set(names)] };
}

/** The answer the one resolver gives for a bag: the faces that read and write it, and each name that matches no face. */
export interface ShareAnswer {
  readonly bag: string;
  readonly read: readonly number[];
  readonly write: readonly number[];
  /** Pet-names a row names that no face here carries: each waits, named, until a face carries it. */
  readonly waiting: readonly string[];
  /** Why the answer reads as it does: `house-canon` (every face reads the floor, no face writes by a row: the Kahu steward's
   *  reach decides), `row` (the row decides), `private` (no row: the owner alone). */
  readonly source: "house-canon" | "row" | "private";
}

/**
 * THE ONE RESOLVER. A house canon bag reads for every face (its floor snapshot) and writes for none by a row, whatever a row
 * names: the Kahu steward's reach alone writes it. A bag with a row reads and writes for the faces its filters name, the owner always among them;
 * a bag with no row stays the owner's alone. A face that writes also reads.
 */
export function resolveShare(input: {
  readonly bag: string;
  readonly rows: readonly ShareRow[];
  readonly faces: readonly ShareFace[];
  readonly owner?: number | null;
  readonly houseCanon?: boolean;
}): ShareAnswer {
  const row = input.rows.find((r) => shareRowBag(r) === input.bag) ?? null;
  const every = input.faces.map((f) => f.handleIndex);
  const owner = input.owner ?? null;
  const pick = (filter: string, waiting: Set<string>): number[] => {
    const parsed = parseShareFilter(filter);
    if (parsed.all) return every;
    const out: number[] = [];
    for (const name of parsed.names) {
      const face = input.faces.find((f) => f.petname === name);
      if (face) out.push(face.handleIndex); else waiting.add(name);
    }
    return out;
  };
  const sorted = (xs: Iterable<number>): number[] => [...new Set(xs)].sort((a, b) => a - b);
  if (input.houseCanon === true) return { bag: input.bag, read: every, write: [], waiting: [], source: "house-canon" };
  if (row === null) {
    const own = owner !== null ? [owner] : [];
    return { bag: input.bag, read: own, write: own, waiting: [], source: "private" };
  }
  const waiting = new Set<string>();
  const write = sorted([...pick(row.write, waiting), ...(owner !== null ? [owner] : [])]);
  const read = sorted([...pick(row.read, waiting), ...write]);
  return { bag: input.bag, read, write, waiting: [...waiting].sort(), source: "row" };
}

/** One grant the owner's hive owes a face: the bag, the face it delegates to, and the access. */
export interface OwedGrant { readonly bag: string; readonly owner: number; readonly grantee: number; readonly access: "read" | "edit" }

/**
 * THE GRANTS A ROW OWES: for each custom bag a row shares, every face its answer names other than the owner takes a
 * delegation from the owner's hive (`edit` for a writer, else `read`). A house canon bag owes none: it rests in the Kahu realm.
 */
export function owedGrants(input: { readonly rows: readonly ShareRow[]; readonly faces: readonly ShareFace[]; readonly ownerOf: (bag: string) => number | null; readonly houseCanon: (bag: string) => boolean }): OwedGrant[] {
  const out: OwedGrant[] = [];
  for (const row of input.rows) {
    const bag = shareRowBag(row);
    if (input.houseCanon(bag)) continue;
    const owner = input.ownerOf(bag);
    if (owner === null) continue;
    const answer = resolveShare({ bag, rows: input.rows, faces: input.faces, owner });
    for (const grantee of answer.read) {
      if (grantee === owner) continue;
      out.push({ bag, owner, grantee, access: answer.write.includes(grantee) ? "edit" : "read" });
    }
  }
  return out;
}

/** The opaque flag a grant owed behind a shut owner rests under: a digest that names no face, no bag and no access. */
export function sharePendingTitle(grant: OwedGrant, vesselSalt: string): string {
  const digest = sha256(utf8Bytes(`share-pending\n${vesselSalt}\n${grant.bag}\n${grant.owner}\n${grant.grantee}\n${grant.access}`));
  return `${SHARE_PENDING_PREFIX}${hex(digest).slice(0, 32)}`;
}

/** A row as its control-document record's fields. */
export function shareRowFields(row: ShareRow): Record<string, string> {
  return {
    title: shareRowTitle(row.slug), kind: row.kind, read: row.read, write: row.write,
    ...(shareRowWorkspace(row) !== null ? { workspace: shareRowWorkspace(row)! } : {}),
    ...(row.note ? { text: row.note } : {}), type: "text/vnd.tiddlywiki",
  };
}

/** Read a row back off its record's fields; null for a title outside the share prefix. */
export function shareRowOf(fields: Readonly<Record<string, unknown>>): ShareRow | null {
  const title = typeof fields["title"] === "string" ? fields["title"] : "";
  if (!title.startsWith(SHARE_CONFIG_PREFIX)) return null;
  const slug = title.slice(SHARE_CONFIG_PREFIX.length);
  if (!SLUG.test(slug)) return null;
  // A face-private slug reads as no row: whatever a hand wrote under its title shares nothing.
  if (isFacePrivateSlug(slug)) return null;
  const str = (k: string): string => (typeof fields[k] === "string" ? fields[k] as string : "");
  const note = str("text");
  const workspace = str("workspace").trim();
  return { slug, kind: str("kind") === "wiki" ? "wiki" : "bag", read: str("read"), write: str("write"), ...(workspace ? { workspace } : {}), ...(note ? { note } : {}) };
}

/**
 * THE FILE (`$LAR_ROOT/config/share.tid`): each row as a TW5 `.tid` record (field lines, a blank line, the note), records
 * apart by a line of three dashes. A person edits it by hand; the boot reads it whole and the file wins.
 */
export function serializeShareFile(rows: readonly ShareRow[]): string {
  const sorted = [...rows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return sorted.map((r) => {
    const f = shareRowFields(r);
    const head = ["title", "kind", "read", "write", ...(f["workspace"] ? ["workspace"] : []), "type"].map((k) => `${k}: ${f[k] ?? ""}`).join("\n");
    return `${head}\n\n${r.note ?? ""}\n`;
  }).join("---\n");
}

/** Parse the file; a record that names no share title refuses `share-file-malformed` by its place. */
export function parseShareFile(text: string): ShareRow[] {
  const rows: ShareRow[] = [];
  const records = text.split(/^---\s*$/m).map((r) => r.replace(/^\n+/, "")).filter((r) => r.trim().length > 0);
  records.forEach((record, n) => {
    const blank = record.search(/\n\s*\n/);
    const head = blank < 0 ? record : record.slice(0, blank);
    const body = blank < 0 ? "" : record.slice(blank).replace(/^\n\s*\n/, "").replace(/\n+$/, "");
    const fields: Record<string, string> = {};
    for (const line of head.split("\n")) {
      const at = line.indexOf(":");
      if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    if (body) fields["text"] = body;
    const title = fields["title"] ?? "";
    if (title.startsWith(SHARE_CONFIG_PREFIX) && isFacePrivateSlug(title.slice(SHARE_CONFIG_PREFIX.length))) {
      throw new ShareConfigRefusal("share-face-private", `record ${n + 1} shares "${title.slice(SHARE_CONFIG_PREFIX.length)}", the daemon wiki: it holds one face's memory and takes no share row`);
    }
    const row = shareRowOf(fields);
    if (row === null) throw new ShareConfigRefusal("share-file-malformed", `record ${n + 1} names no share row (a title under ${SHARE_CONFIG_PREFIX})`);
    parseShareFilter(row.read);
    parseShareFilter(row.write);
    shareRowWorkspace(row);
    rows.push(row);
  });
  return rows;
}

/**
 * THE BOOT'S RECONCILE: the file wins. Answers the rows the control document must hold and each title to remove (a row the
 * control document holds that the file does not name). With no file standing, the control document's rows stand.
 */
export function reconcileShareRows(file: readonly ShareRow[] | null, control: readonly ShareRow[]): { readonly put: readonly ShareRow[]; readonly remove: readonly string[] } {
  if (file === null) return { put: [], remove: [] };
  const named = new Set(file.map((r) => shareRowTitle(r.slug)));
  const same = (a: ShareRow, b: ShareRow): boolean => a.kind === b.kind && a.read === b.read && a.write === b.write && (a.note ?? "") === (b.note ?? "") && (a.workspace ?? "") === (b.workspace ?? "");
  const put = file.filter((r) => { const held = control.find((c) => c.slug === r.slug); return held === undefined || !same(held, r); });
  const remove = control.map((c) => shareRowTitle(c.slug)).filter((t) => !named.has(t));
  return { put, remove };
}
