/**
 * herm-stack — THE HERM'S CAP VOCABULARY: the seven holds, the opt-in waymark and the eight refusals, as ONE table, and the
 * stack a composed vessel holds derived from what it composed.
 *
 * ONE TABLE, ONE PLACE A NAME MOVES. `HERM_CAP_DATA` carries every word the herm's stack speaks: each hold's address, each
 * refusal's root, each cure line, the slot the table mirrors. A rename lands in that one constant and every reader follows,
 * since the inward refusal codes DERIVE from the roots (`refusalCodeOf`) and the data tiddler DERIVES from the table
 * (`hermStackTiddler`). Nothing else in the house spells a herm cap.
 *
 * A STACK THAT DERIVES NEVER DRIFTS. `hermHolds(facts)` reads which cap modules a vessel composed and answers the holds those
 * prove; no list of "a herm's caps" stands beside the composition. A hold whose proof no composition carries yet (the shelf,
 * the clear wiki) stays off every stack until its cap composes.
 *
 * THE HERM HOLDS NO STOLON: a stolon carries one house's joining pointers, and the herm never plays the invite. The table's
 * own read refuses a stolon row by name, so no stack this module derives can yield one.
 *
 * TAGS GATHER, OCAPS AUTHORIZE: a hold names what the herm carries and grants nothing; a refusal names what it never does.
 * Outward, every refusal draws the one closed door; these names answer INWARD alone, at the owner's socket, each with a cure.
 *
 * Platform-blind and pure: no door, no clock, no env. Ships into the wiki VM as the module tiddler
 * `lar:///ha.ka.ba/lararium/tw5/lib/herm-stack`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/herm-caps · plan: lar:///ha.ka.ba/kahua/memory/plan/herm-rungs
 */

import { CAP_ADDRESS } from "./cap-stack.js";

/** The stems a herm hold extends: four of the five caps, and the public-floor read. The fifth cap, the stolon, never rides a herm. */
export const HERM_STEMS = ["rhizome", "bulb", "corm", "tuber", "floor"] as const;
export type HermStem = (typeof HERM_STEMS)[number];

/** One row of the table as it rests: a hold, the stem it extends, and the composition facts that prove it stands. */
export interface HermHoldRow {
  /** The hold's address, a three-term root. */
  readonly cap: string;
  readonly gathers: string;
  readonly stem: string;
  /** The facts that prove the hold, every one needed: a cap module's id, or the opener's word for a face it mounts beside the composition. */
  readonly proof: readonly string[];
  /** The keeper's knob this hold waits on, where it rides opt-in. */
  readonly optIn?: string;
}

/** One refusal as it rests: the root, what the herm never does, and the cure the owner runs. */
export interface HermRefusalRow {
  readonly root: string;
  readonly never: string;
  readonly cure: string;
}

export interface HermCapData {
  /** The canon slot this table mirrors, and the title its data tiddler takes. */
  readonly slot: string;
  readonly holds: readonly HermHoldRow[];
  /** The refusals, each under the office a caller reads it by: the key stays put while a root, a cure or a wording moves. */
  readonly refusals: Readonly<Record<HermRefusalOffice, HermRefusalRow>>;
}

/** The eight offices a refusal answers under. A code-side handle alone: no wire, no door and no record carries one. */
export const HERM_REFUSAL_OFFICES = [
  "sealNeverOpens", "voiceNeverSignsPublic", "faceNeverSeats", "pronaosNeverLights",
  "doorNeverDescribes", "shelfNeverPosts", "titleNeverAnswers", "wikiNeverSaves",
] as const;
export type HermRefusalOffice = (typeof HERM_REFUSAL_OFFICES)[number];

/**
 * THE TABLE. Every name the herm's stack speaks stands here and nowhere else (Q6: the operator's notes may rename a hold or
 * a refusal; the rename moves this constant alone). Each cure names a command the CLI's own help carries.
 */
export const HERM_CAP_DATA: HermCapData = Object.freeze({
  slot: "lar:///ha.ka.ba/lararium/mesh/herm-caps#/the-stack",
  holds: Object.freeze([
    { cap: "lar:///herm.leyline.carries", gathers: "sealed carriage, the holder hints, the carriage log", stem: "rhizome", proof: ["carriage"] },
    { cap: "lar:///herm.coal.hands", gathers: "the genesis seed and its blobs, by a CID the traveler brings", stem: "bulb", proof: ["bulb"] },
    { cap: "lar:///herm.lease.renews", gathers: "the herm's own freshness against the Nexus epoch", stem: "corm", proof: ["lease"] },
    { cap: "lar:///herm.keel.wards", gathers: "the daemon immune core and the FLOW map", stem: "tuber", proof: ["daemon", "meshpalace"] },
    { cap: "lar:///herm.floor.presents", gathers: "a Nexus's release answer and the blobs its head names", stem: "floor", proof: ["floor-porch"] },
    { cap: "lar:///herm.shelf.rests", gathers: "whole CIDs signed or sealed elsewhere, kept at rest", stem: "rhizome", proof: ["shelf"] },
    { cap: "lar:///herm.wiki.renders", gathers: "the clear wiki: a read-only recipe over the floor, its top layer held in memory", stem: "floor", proof: ["clear-wiki"] },
    { cap: "lar:///herm.waymark.posts", gathers: "the waymark: the route shapes and the bulb CID, unsigned", stem: "bulb", proof: ["bulb"], optIn: "herm.waymark" },
  ]),
  refusals: Object.freeze({
    sealNeverOpens: { root: "lar:///herm.seal.never-opens", never: "unlocks, decrypts, or waits on an unlock",
      cure: "open the key at a lararium: `lares vault unlock`" },
    voiceNeverSignsPublic: { root: "lar:///herm.voice.never-signs-public", never: "signs a public claim under the place key",
      cure: "a house signs its own claim: `lares handle publish '<glamour>'` at a lararium" },
    faceNeverSeats: { root: "lar:///herm.face.never-seats", never: "seats a persona root",
      cure: "seat the face at a lararium: `lares persona new <index> --name <petname> --seat`" },
    pronaosNeverLights: { root: "lar:///herm.pronaos.never-lights", never: "lights an arrival page, a descriptor or a kindle",
      cure: "a lararium lights the Pronaos: `lares vessel stand` on a founded hearth, then `lares host invite`" },
    doorNeverDescribes: { root: "lar:///herm.door.never-describes", never: "lists, indexes or describes what rests",
      cure: "bring the name (a bulb CID, a Nexus AID, a blob CID); read what a house holds at home: `lares vessel floor status`" },
    shelfNeverPosts: { root: "lar:///herm.shelf.never-posts", never: "rests a stranger's write",
      cure: "publish through a house: `lares meme promote <file> --dest-bag lar:///ha.ka.ba/bags/crossroads --approval <file>`" },
    titleNeverAnswers: { root: "lar:///herm.title.never-answers", never: "answers a remote per-title ask",
      cure: "pull whole CIDs and read at home: `lares tiddler get <title> --recipe default`" },
    wikiNeverSaves: { root: "lar:///herm.wiki.never-saves", never: "persists a working layer or promotes anything",
      cure: "the clear wiki's top layer leaves with the composition; write in a lararium's own wiki: `lares vault unlock`, then `lares tiddler put <title> --recipe default`" },
  }),
});

// ── the table's own read ───────────────────────────────────────────────────────────────────────────────────────────

export interface HermHoldKind extends HermHoldRow { readonly stem: HermStem }
export interface HermRefusalKind extends HermRefusalRow { readonly office: HermRefusalOffice; readonly code: string }
export interface HermCapTable {
  readonly slot: string;
  readonly holds: readonly HermHoldKind[];
  readonly refusals: readonly HermRefusalKind[];
}
export type HermTableFault = { readonly code: "herm-cap-root-malformed" | "herm-cap-stem-unknown" | "herm-cap-stolon" | "herm-cap-twice"; readonly why: string };

/** A refusal's inward code: its root's three terms, hyphen-joined (`lar:///herm.wiki.never-saves` -> `herm-wiki-never-saves`). */
export const refusalCodeOf = (root: string): string => root.slice("lar:///".length).split(".").join("-");

const rootFault = (address: string): HermTableFault | null =>
  CAP_ADDRESS.test(address) ? null : { code: "herm-cap-root-malformed", why: `${JSON.stringify(address)} breaks the root segment law: a cap rides exactly three dot-joined terms and no path (\`lar:///a.b.c\`)` };

/**
 * A table read whole, or the first fault it carries: a root off the three-term law, a stem outside the herm's five, a
 * stolon row, or one address named twice. Every reader of the herm's caps reads through here, the house's own table included.
 */
export function readHermCapTable(data: HermCapData): HermCapTable | HermTableFault {
  const seen = new Set<string>();
  const once = (address: string): HermTableFault | null => {
    if (seen.has(address)) return { code: "herm-cap-twice", why: `${address} stands twice in the herm's table; one address names one row` };
    seen.add(address);
    return null;
  };
  const holds: HermHoldKind[] = [];
  for (const row of data.holds) {
    const fault = rootFault(row.cap) ?? once(row.cap);
    if (fault) return fault;
    if (row.stem === "stolon") return { code: "herm-cap-stolon", why: `${row.cap} names the stolon: a stolon carries one house's joining pointers, and a herm never plays the invite` };
    if (!(HERM_STEMS as readonly string[]).includes(row.stem)) return { code: "herm-cap-stem-unknown", why: `${row.cap} names the stem ${JSON.stringify(row.stem)}; a herm hold extends one of ${HERM_STEMS.join(" · ")}` };
    holds.push({ ...row, stem: row.stem as HermStem });
  }
  const refusals: HermRefusalKind[] = [];
  for (const office of HERM_REFUSAL_OFFICES) {
    const row = data.refusals[office];
    const fault = rootFault(row.root) ?? once(row.root);
    if (fault) return fault;
    refusals.push({ ...row, office, code: refusalCodeOf(row.root) });
  }
  return { slot: data.slot, holds, refusals };
}

const isFault = (read: HermCapTable | HermTableFault): read is HermTableFault => "code" in read;

/** The house's own table, read once; a fault in `HERM_CAP_DATA` refuses the module by name. */
export const HERM_CAP_TABLE: HermCapTable = (() => {
  const read = readHermCapTable(HERM_CAP_DATA);
  if (isFault(read)) throw new Error(`[herm-stack] ${read.code}: ${read.why}`);
  return read;
})();

// ── the refusals ───────────────────────────────────────────────────────────────────────────────────────────────────

/** An inward refusal: its code, the root it stands on, and one line naming what the herm never does and the cure. */
export interface HermRefusal { readonly code: string; readonly root: string; readonly cure: string; readonly why: string }

/** The refusal a root names, with its cure; null where the table holds no such root. A reader passes a root, never a spelled code. */
export function hermRefusal(root: string, table: HermCapTable = HERM_CAP_TABLE): HermRefusal | null {
  const row = table.refusals.find((r) => r.root === root);
  return row ? { code: row.code, root: row.root, cure: row.cure, why: `${row.root}: a herm never ${row.never}; ${row.cure}` } : null;
}

/**
 * The eight refusals by their office, so no caller spells a root or a code: a rename in `HERM_CAP_DATA` moves each answer.
 */
export const HERM_REFUSAL: Readonly<Record<HermRefusalOffice, HermRefusal>> = Object.freeze(
  Object.fromEntries(HERM_CAP_TABLE.refusals.map((r) => [r.office, hermRefusal(r.root)!])) as Record<HermRefusalOffice, HermRefusal>,
);

// ── the stack a composition holds ──────────────────────────────────────────────────────────────────────────────────

/** What a composition proves: the cap ids it wired (`ComposedVessel.order`) with the opener's words for what it mounted beside them, and the keeper's knobs. */
export interface HermFacts {
  readonly composed: Iterable<string>;
  /** The keeper's opt-in knobs that stand set (`herm.waymark`). Absent: none. */
  readonly knobs?: Iterable<string>;
}

/**
 * THE STACK A COMPOSED VESSEL HOLDS: each hold whose every proof the composition carries, an opt-in hold only where the
 * keeper set its knob too, in the table's order. Derived at each ask; nothing caches it.
 */
export function hermHolds(facts: HermFacts, table: HermCapTable = HERM_CAP_TABLE): HermHoldKind[] {
  const composed = new Set(facts.composed);
  const knobs = new Set(facts.knobs ?? []);
  return table.holds.filter((h) => h.proof.every((id) => composed.has(id)) && (h.optIn === undefined || knobs.has(h.optIn)));
}

/** A stack as a `#/has` slot's body: one cap per line, the grammar `capLine` reads. */
export const hermStackBody = (holds: readonly Pick<HermHoldKind, "cap">[]): string => holds.map((h) => h.cap).join("\n");

/** The table as one data tiddler under the canon slot it mirrors: every row, each refusal with its derived code. */
export function hermStackTiddler(table: HermCapTable = HERM_CAP_TABLE): { readonly title: string; readonly type: "application/json"; readonly text: string } {
  return { title: table.slot, type: "application/json", text: JSON.stringify({ holds: table.holds, refusals: table.refusals }, null, 2) };
}
