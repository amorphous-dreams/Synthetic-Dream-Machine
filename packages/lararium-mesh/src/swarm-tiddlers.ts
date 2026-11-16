/**
 * swarm-tiddlers — the swarm's live controls as signed records in the vessel's control document, under `$:/lares/swarm/`.
 *
 * Placement keeps them off disk: the control document has no mirror (`control-home`); this module holds the records. Each record rests as the JSON of
 * `{ body, signer, sig }` in a tiddler's text, the body naming the `swarm-act` domain, and a READ verifies it before it trusts a byte:
 * shape, domain, face group, signature, the title the body belongs at, and the role of the signer. Any failure reads as refused, and the
 * caller treats a refused record as absent, so a read fails closed.
 *
 *   lei/<rite>/<branch>/<lei cid>
 *                              a lei binds a rite (`push` · `kukulu` · `keep`, `swarm-lei-rite.ts`), a branch, a head and the lei it follows
 *                              there (`after`: that lei's cid, null for the first of its rite at the branch); each lei rests at its
 *                              own row; signed by the face's hand; read only beside its co-sign, asked under `ward-<rite>-lei`; a
 *                              rite's standing lei at a branch ends the longest co-signed `after` chain from its first lei (two tips
 *                              read as a fork, and neither stands); returned once (`lei-returned/<lei cid>`, the vessel's witness). One
 *                              rite's lei never reads, co-signs or spends as the other's
 *   lane/<lane>/state          a lead's lane state, signed under the lead's own seat name
 *   roster/<seat>              a seat's spend reading, signed by the VESSEL as witness, never by the measured lead
 *                              A lei's REACH: a `wide` lei (the default) names no head and carries `returns`, the count of spends
 *                              the hand wrote into it; a `head` lei pins one head and spends once. Every spend names the head's
 *                              tree and needs a passing receipt standing for it (`swarm-lei-testimony-absent`).
 *   lei-returned/<lei cid>/<n>      one spend of a lei, the vessel's witness: `n` counts from 1 to the lei's returns, each row claimed
 *                              atomically; any row under `lei-returned/<lei cid>/` counts against the lei, signed or not
 *   lei-narrowed/<lei cid>       a wide lei met a red receipt: the vessel's witness; any row here ends the lei's wide reach
 *   lei-unstrung/<lei cid>     the hand unstrung a lei that still held returns: signed by the face's hand; any row here ends
 *                              the lei, and the lei's own row rests on
 *   tessera/<tessera>/guest · tessera/<tessera>/host
 *                              the two halves of one rite across a restart (`swarm-tessera.ts`): `rite-begun` rests before the
 *                              vessel goes down, `rite-landed` after it stands again; each the VESSEL's witness
 *   receipt/<tree>             a check seat's verdict over a tree, signed by the VESSEL
 *   house-cap · lane/<lane>/share
 *                              ride the face-private board (`swarm-board.ts`) so a fleet folds one cap; their titles belong to this family
 *
 * Signing goes through `SwarmSignerPort`, so the ward's signer swaps in beside the face's root signer without touching a record.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { SWARM_ACT_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { SWARM_URI_PREFIX } from "./lar-uris.js";
import { SWARM_LEI_RITES, isSwarmLeiRite, leiRiteCosigns, wardLeiVerb, type SwarmLeiRite } from "./swarm-lei-rite.js";
import { wardActRefusal, type WardActRefusal, type WardActWitness } from "./ward-cosign.js";

export { SWARM_URI_PREFIX } from "./lar-uris.js";

/** The signing seat: a key and its signature over canonical bytes. The face's root signer fills it now; the ward's fills it at S2. */
export interface SwarmSignerPort { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** The wiki a swarm record rests in. `writeNew` lands a row only where none stands and answers whether it landed (an atomic claim). */
export interface SwarmWikiPort {
  read(title: string): Promise<string | null>;
  write(title: string, text: string): Promise<void>;
  writeNew(title: string, text: string): Promise<boolean>;
  /** Every title the wiki holds under a prefix: a branch's lei rest at their own rows, and its reader walks them all. */
  list(prefix: string): Promise<readonly string[]>;
}

/** Who may sign what: the face's hand, the vessel as witness, a lead under its own seat name. */
export interface SwarmTrust {
  readonly hand: (key: string) => boolean;
  readonly vessel: (key: string) => boolean;
  /** A lead signs one lane's state alone: the trust binds the seat, its lane and its key together. */
  readonly lead: (seat: string, lane: string, key: string) => boolean;
}

export class SwarmRefused extends Error {
  override name = "SwarmRefused";
  constructor(public code: string, detail: string) { super(`${code}: ${detail}`); }
}

const malformed = (detail: string): never => { throw new SwarmRefused("swarm-name-malformed", detail); };

/** The name, and the name as a reader decodes it (a percent escape it spells), each split on `/`. */
function spellings(name: string): string[] {
  const out = [name];
  try { out.push(decodeURIComponent(name)); } catch { /* a malformed escape keeps its bytes */ }
  return out;
}

/**
 * A name that rides title segments. Neither the name nor its decoded form may hold an empty, `.` or `..` segment, since
 * `resolvedTitlePath` decodes before it folds dots and a dot segment would carry the title out of the prefix. `slashes` names
 * the one family whose name spans segments (a branch); every other name rides one segment and refuses a `/` in either spelling.
 */
function segment(name: unknown, slashes = false): string {
  if (typeof name !== "string" || name.length === 0 || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) malformed("a swarm name is a non-empty name of at most 200 characters, with no control character");
  for (const spelling of spellings(name as string)) {
    if (!slashes && spelling.includes("/")) malformed("this swarm name rides one title segment and holds no slash, in any spelling");
    if (spelling.split("/").some((s) => s === "" || s === "." || s === "..")) malformed("a swarm name holds no empty, `.` or `..` segment, in any spelling");
  }
  return encodeURIComponent(name as string);
}

/**
 * A branch as git reads a ref name (`git check-ref-format`, the rules a branch name keeps): no `..`, no component that starts
 * with `.` or ends `.lock`, no trailing `.`, no `@{`, not `@` alone, none of space `~ ^ : ? * [ \\`, and no control character.
 */
function branchSegment(branch: unknown): string {
  const named = segment(branch, true);
  const b = branch as string;
  if (b.includes("..") || b.includes("@{") || b === "@" || b.endsWith(".") || /[\s~^:?*[\\]/.test(b)) malformed("a lei's branch is a git ref name (git check-ref-format)");
  if (b.split("/").some((c) => c.startsWith(".") || c.endsWith(".lock"))) malformed("a lei's branch is a git ref name: no component starts with `.` or ends `.lock`");
  return named;
}

export const swarmHouseCapTitle = (): string => `${SWARM_URI_PREFIX}house-cap`;
export const swarmShareTitle = (lane: string): string => `${SWARM_URI_PREFIX}lane/${segment(lane)}/share`;
export const swarmLaneStateTitle = (lane: string): string => `${SWARM_URI_PREFIX}lane/${segment(lane)}/state`;
/** A lei's rite as a title segment: one of the listed rites, or the name refuses. */
function riteSegment(rite: unknown): SwarmLeiRite {
  if (!isSwarmLeiRite(rite)) malformed(`a lei's rite names one listed power (${SWARM_LEI_RITES.join(", ")})`);
  return rite as SwarmLeiRite;
}
/** The family title one rite's lei at a branch rest under; each lei rests at its own row beneath it (`swarmLeiRecordTitle`). */
export const swarmLeiTitle = (rite: SwarmLeiRite, branch: string): string => `${SWARM_URI_PREFIX}lei/${riteSegment(rite)}/${branchSegment(branch)}`;
export const swarmLeiRecordTitle = (rite: SwarmLeiRite, branch: string, leiCid: string): string => `${swarmLeiTitle(rite, branch)}/${segment(leiCid)}`;
/** The prefix every spend of one lei rests under; a row here counts against the lei whatever it holds. */
export const swarmLeiReturnedPrefix = (leiCid: string): string => `${SWARM_URI_PREFIX}lei-returned/${segment(leiCid)}/`;
/** The `n`th spend of a lei, counted from 1. */
export const swarmLeiReturnedTitle = (leiCid: string, n: number): string => {
  if (!positive(n)) malformed("a spend counts from 1");
  return `${swarmLeiReturnedPrefix(leiCid)}${n}`;
};
export const swarmLeiNarrowedTitle = (leiCid: string): string => `${SWARM_URI_PREFIX}lei-narrowed/${segment(leiCid)}`;
/** The prefix every tessera half rests under. */
export const swarmTesseraPrefix = (): string => `${SWARM_URI_PREFIX}tessera/`;
/** One half of a tessera: the `guest` half (`rite-begun`) or the `host` half (`rite-landed`). */
export const swarmTesseraTitle = (tessera: string, half: "guest" | "host"): string => {
  if (half !== "guest" && half !== "host") malformed("a tessera holds a guest half and a host half");
  return `${swarmTesseraPrefix()}${segment(tessera)}/${half}`;
};
export const swarmLeiUnstrungTitle = (leiCid: string): string => `${SWARM_URI_PREFIX}lei-unstrung/${segment(leiCid)}`;
export const swarmRosterTitle = (seat: string): string => `${SWARM_URI_PREFIX}roster/${segment(seat)}`;
export const swarmReceiptTitle = (tree: string): string => `${SWARM_URI_PREFIX}receipt/${segment(tree)}`;

/** The fields a swarm record rests under: its text. The record rests in the control document, which no mirror names. */
export const swarmRecordFields = (text: string): Record<string, string> => ({ text });

/**
 * A lei's reach, and what each reach binds. `wide` (the default): the lei names no head; it names its testimony instead, and
 * `returns` holds the count of spends the hand wrote into it. `head`: the lei pins one head and spends once.
 */
export type SwarmLeiReach = "wide" | "head";
export type SwarmLeiTerms = { readonly reach: "wide"; readonly returns: number } | { readonly reach: "head"; readonly head: string };
/** `rite` names the one power the lei carries. `after` names the lei this one follows at its rite's title for the branch (its
 *  cid), or null for the first there: one issue, one lei. */
export type SwarmLeiBody = { readonly act: "lei"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly after: string | null } & SwarmLeiTerms;
/** One return: the lei, its count `n`, and the head and tree the vessel returned it at (the vessel testifies that the tree belongs to the head). */
export interface SwarmLeiReturnedBody { readonly act: "lei-returned"; readonly group: string; readonly branch: string; readonly head: string; readonly tree: string; readonly lei: string; readonly n: number }
/** A wide lei that met a red receipt: the lei, and the head and tree whose receipt read `fail`. */
export interface SwarmLeiNarrowedBody { readonly act: "lei-narrowed"; readonly group: string; readonly lei: string; readonly head: string; readonly tree: string }
export interface SwarmLaneStateBody { readonly act: "lane-state"; readonly group: string; readonly lane: string; readonly seat: string; readonly state: Readonly<Record<string, string | number | boolean | null>> }
export interface SwarmRosterBody { readonly act: "roster"; readonly group: string; readonly seat: string; readonly model: string; readonly mode: string; readonly reading: number; readonly ceiling: number; readonly outcome: string }
export interface SwarmReceiptBody { readonly act: "receipt"; readonly group: string; readonly tree: string; readonly checks: readonly string[]; readonly verdict: "pass" | "fail"; readonly definitions: string }
/** The hand unstrung a lei: the lei, and the rite and branch whose line it rests on. */
export interface SwarmLeiUnstrungBody { readonly act: "lei-unstrung"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly lei: string }
/** The guest half: the rite began. `lei` and `n` name the return that paid for it; `head` and `tree` name what the rite runs at. */
export interface SwarmRiteBegunBody { readonly act: "rite-begun"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly head: string; readonly tree: string; readonly lei: string; readonly n: number; readonly tessera: string }
/** The host half: the vessel stood again. `begun` names the guest half by its cid; `head` names the head the vessel stands at. */
export interface SwarmRiteLandedBody { readonly act: "rite-landed"; readonly group: string; readonly rite: SwarmLeiRite; readonly tessera: string; readonly begun: string; readonly head: string }
export type SwarmBodyParts = SwarmLeiBody | SwarmLeiReturnedBody | SwarmLeiNarrowedBody | SwarmLeiUnstrungBody | SwarmRiteBegunBody | SwarmRiteLandedBody | SwarmLaneStateBody | SwarmRosterBody | SwarmReceiptBody;
export type SwarmBody = SwarmBodyParts & { readonly kind: typeof SWARM_ACT_DOMAIN };
export interface SignedSwarmAct { readonly body: SwarmBody; readonly signer: string; readonly sig: string }
export type SwarmReadRefusal = "absent" | "shape" | "domain" | "group" | "signature" | "title" | "role";

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const count = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
function positive(x: unknown): x is number { return typeof x === "number" && Number.isSafeInteger(x) && x >= 1; }
const hex = (x: unknown, n: number): boolean => typeof x === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(x);

function shape(b: Record<string, unknown>): boolean {
  if (!str(b["group"])) return false;
  switch (b["act"]) {
    // A lei holds one reach whole: a wide lei carries its returns and no head, a head lei its head and no returns.
    case "lei": return isSwarmLeiRite(b["rite"]) && str(b["branch"]) && (b["after"] === null || hex(b["after"], 64))
      && (b["reach"] === "wide" ? positive(b["returns"]) && !("head" in b) : b["reach"] === "head" ? str(b["head"]) && !("returns" in b) : false);
    case "lei-returned": return str(b["branch"]) && str(b["head"]) && str(b["tree"]) && hex(b["lei"], 64) && positive(b["n"]);
    case "lei-narrowed": return hex(b["lei"], 64) && str(b["head"]) && str(b["tree"]);
    case "lei-unstrung": return hex(b["lei"], 64) && isSwarmLeiRite(b["rite"]) && str(b["branch"]);
    case "rite-begun": return isSwarmLeiRite(b["rite"]) && str(b["branch"]) && str(b["head"]) && str(b["tree"]) && hex(b["lei"], 64) && positive(b["n"]) && hex(b["tessera"], 64);
    case "rite-landed": return isSwarmLeiRite(b["rite"]) && hex(b["tessera"], 64) && hex(b["begun"], 64) && str(b["head"]);
    case "lane-state": return str(b["lane"]) && str(b["seat"]) && object(b["state"]) && Object.values(b["state"]).every((v) => v === null || ["string", "number", "boolean"].includes(typeof v));
    case "roster": return str(b["seat"]) && str(b["model"]) && str(b["mode"]) && count(b["reading"]) && count(b["ceiling"]) && str(b["outcome"]);
    case "receipt": return str(b["tree"]) && Array.isArray(b["checks"]) && b["checks"].every(str) && (b["verdict"] === "pass" || b["verdict"] === "fail") && hex(b["definitions"], 64);
    default: return false;
  }
}

/** The title a body belongs at, or null where its names do not form a title. */
function titleOf(b: SwarmBody): string | null {
  try {
    switch (b.act) {
      case "lei": return swarmLeiTitle(b.rite, b.branch);
      case "lei-returned": return swarmLeiReturnedTitle(b.lei, b.n);
      case "lei-narrowed": return swarmLeiNarrowedTitle(b.lei);
      case "lei-unstrung": return swarmLeiUnstrungTitle(b.lei);
      case "rite-begun": return swarmTesseraTitle(b.tessera, "guest");
      case "rite-landed": return swarmTesseraTitle(b.tessera, "host");
      case "lane-state": return swarmLaneStateTitle(b.lane);
      case "roster": return swarmRosterTitle(b.seat);
      case "receipt": return swarmReceiptTitle(b.tree);
    }
  } catch { return null; }
}

export const swarmActCid = (act: { readonly body: SwarmBody; readonly signer: string }): string => sha256HexBytesSync(canonicalJsonBytes({ body: act.body, signer: act.signer }));

export async function signSwarmAct(parts: SwarmBodyParts, signer: SwarmSignerPort): Promise<SignedSwarmAct> {
  const body = { ...parts, kind: SWARM_ACT_DOMAIN } as SwarmBody;
  if (!shape(body as unknown as Record<string, unknown>) || titleOf(body) === null) throw new SwarmRefused("swarm-shape", "the record's body does not form a swarm control");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}

const allowed = (b: SwarmBody, key: string, trust: SwarmTrust): boolean => {
  switch (b.act) {
    case "lei": case "lei-unstrung": return trust.hand(key);
    case "lane-state": return trust.lead(b.seat, b.lane, key);
    case "lei-returned": case "lei-narrowed": case "rite-begun": case "rite-landed": case "roster": case "receipt": return trust.vessel(key);
  }
};

/** Verify one record's JSON at the title it came from. Every check runs before the role, and a record that fails any one is refused. */
export function verifySwarmRecord(text: string | null, title: string, trust: SwarmTrust, group: string): { ok: true; act: SignedSwarmAct; cid: string } | { ok: false; refusal: SwarmReadRefusal } {
  if (text === null) return { ok: false, refusal: "absent" };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, refusal: "shape" }; }
  if (!object(raw) || !object(raw["body"]) || !hex(raw["signer"], 64) || typeof raw["sig"] !== "string" || !shape(raw["body"])) return { ok: false, refusal: "shape" };
  const body = raw["body"] as unknown as SwarmBody;
  if (body.kind !== SWARM_ACT_DOMAIN) return { ok: false, refusal: "domain" };
  if (body.group !== group) return { ok: false, refusal: "group" };
  try { if (!verifyEd25519(raw["sig"], canonicalJsonBytes(body), raw["signer"] as string)) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
  const act = raw as unknown as SignedSwarmAct, cid = swarmActCid(act);
  let at: string | null;
  try { at = body.act === "lei" ? swarmLeiRecordTitle(body.rite, body.branch, cid) : titleOf(body); } catch { at = null; }
  if (at !== title) return { ok: false, refusal: "title" };
  if (!allowed(body, raw["signer"] as string, trust)) return { ok: false, refusal: "role" };
  return { ok: true, act, cid };
}

export async function putSwarmAct(wiki: SwarmWikiPort, title: string, act: SignedSwarmAct): Promise<void> { await wiki.write(title, JSON.stringify(act)); }
export async function readSwarmRecord(wiki: SwarmWikiPort, title: string, trust: SwarmTrust, group: string) { return verifySwarmRecord(await wiki.read(title), title, trust, group); }

/** The head a lei's co-sign names: its rite, its branch, its reach with what that reach binds (a wide lei's returns, a head lei's
 *  head) and the lei it follows. A second device answers the reach it read, so a wide lei never rides a head lei's answer. */
export const swarmLeiHead = (lei: { readonly rite: SwarmLeiRite; readonly branch: string; readonly after: string | null } & SwarmLeiTerms): string =>
  sha256HexBytesSync(canonicalJsonBytes(lei.reach === "wide"
    ? { rite: lei.rite, branch: lei.branch, reach: lei.reach, returns: lei.returns, after: lei.after }
    : { rite: lei.rite, branch: lei.branch, reach: lei.reach, head: lei.head, after: lei.after }));

/** Which lei a reader asks for: one rite's, at one branch. */
export interface SwarmLeiLine { readonly rite: SwarmLeiRite; readonly branch: string }

type LeiRecord = { readonly act: SignedSwarmAct; readonly cid: string; readonly body: SwarmLeiBody };

/**
 * One rite's lei at a branch as their reader holds them. `resting`: every row under the rite's title for the branch that verifies
 * as the hand's lei for it, co-signed or not. `cosigned`: those that stand beside their co-sign (`ward`, asked under the rite's own
 * verb). `tips`: the ends of the LONGEST co-signed `after` chain from the first lei there (`after: null`); a lei whose `after` no
 * chain lei carries (an orphan) stands on no chain, and an older lei written again changes nothing, since the chain it ends stays
 * shorter. `refusal`: the first refusal a row read, where no lei rests. A lei of the other rite rests under another title and
 * never enters this read.
 */
export async function readLeiChain(wiki: SwarmWikiPort, line: SwarmLeiLine, trust: SwarmTrust, group: string, ward: WardActWitness): Promise<{
  readonly resting: readonly LeiRecord[]; readonly cosigned: readonly LeiRecord[]; readonly tips: readonly LeiRecord[]; readonly refusal: SwarmReadRefusal | WardActRefusal | null;
}> {
  const resting: LeiRecord[] = [], refusals: SwarmReadRefusal[] = [];
  const { rite, branch } = line;
  for (const title of [...await wiki.list(`${swarmLeiTitle(rite, branch)}/`)].sort()) {
    const read = verifySwarmRecord(await wiki.read(title), title, trust, group);
    if (!read.ok) { refusals.push(read.refusal); continue; }
    const body = read.act.body;
    if (body.act === "lei" && body.rite === rite && body.branch === branch) resting.push({ act: read.act, cid: read.cid, body });
  }
  // A rite that stays on the device asks no co-sign: its lei stands on the hand's signature alone.
  const wardReads = resting.map((g) => (leiRiteCosigns(g.body.rite) ? wardActRefusal(ward, { verb: wardLeiVerb(g.body.rite), wiki: "daemon", head: swarmLeiHead(g.body) }) : null));
  const cosigned = resting.filter((_, i) => wardReads[i] === null);
  const children = new Map<string | null, LeiRecord[]>();
  for (const g of cosigned) children.set(g.body.after, [...(children.get(g.body.after) ?? []), g]);
  // Walk the chain level by level from the branch's first lei: the deepest level holds the tips.
  let level = children.get(null) ?? [], tips: LeiRecord[] = [];
  const seen = new Set<string>();
  while (level.length > 0) {
    tips = level;
    for (const g of level) seen.add(g.cid);
    level = level.flatMap((g) => children.get(g.cid) ?? []).filter((g) => !seen.has(g.cid));
  }
  const refusal = resting.length > cosigned.length && cosigned.length === 0 ? wardReads.find((r) => r !== null) ?? "ward-act-uncosigned" : resting.length === 0 ? refusals[0] ?? null : null;
  return { resting, cosigned, tips: [...tips].sort((a, b) => a.cid.localeCompare(b.cid)), refusal };
}

/**
 * The lei of one rite standing for one branch at one head: the one lei that ends that rite's longest co-signed `after` chain at the
 * branch (`readLeiChain`). A HEAD lei stands for the head it names alone (`head-mismatch`) and for one return (`returned`). A WIDE lei
 * stands for any head while returns stay (`returns-spent` once the rows under its return prefix reach its count) and until a
 * narrowing rests for it (`narrowed`). A lei the hand unstrung stands for nothing (`unstrung`). A newer lei on the chain replaces the tip, so a fresh lei restrings a returned or narrowed
 * line. Two tips read as a fork (`forked`) and neither stands until a fresh lei names one. Testimony belongs to the spend
 * (`returnLei`): this read names the lei, never the receipt.
 * On a face of two devices a lei the root signed outside the door stands on no chain (`ward-act-uncosigned` where nothing else rests).
 */
export async function readLei(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head?: string }, trust: SwarmTrust, group: string, ward: WardActWitness):
  Promise<{ ok: true; act: SignedSwarmAct; cid: string; reach: SwarmLeiReach; returnsLeft: number; head?: string } | { ok: false; refusal: SwarmReadRefusal | "head-mismatch" | WardActRefusal | "unstrung" | "returned" | "returns-spent" | "narrowed" | "forked" }> {
  const chain = await readLeiChain(wiki, at, trust, group, ward);
  if (chain.tips.length > 1) return { ok: false, refusal: "forked" };
  const tip = chain.tips[0];
  if (!tip) return { ok: false, refusal: chain.refusal ?? "absent" };
  const body = tip.body;
  // A read that names no head asks after the line alone: a head lei then answers with the head it pins.
  if (body.reach === "head" && at.head !== undefined && body.head !== at.head) return { ok: false, refusal: "head-mismatch" };
  // Any row at the narrowing title narrows the lei, signed or not: a forged narrowing fails closed.
  // Any row at the unstrung title ends the lei, signed or not: a forged unstringing fails closed.
  if ((await wiki.read(swarmLeiUnstrungTitle(tip.cid))) !== null) return { ok: false, refusal: "unstrung" };
  if (body.reach === "wide" && (await wiki.read(swarmLeiNarrowedTitle(tip.cid))) !== null) return { ok: false, refusal: "narrowed" };
  // Every row under the spend prefix counts, signed or not: a forged spend fails closed.
  const returns = body.reach === "wide" ? body.returns : 1;
  const taken = (await wiki.list(swarmLeiReturnedPrefix(tip.cid))).length;
  if (taken >= returns) return { ok: false, refusal: body.reach === "wide" ? "returns-spent" : "returned" };
  return { ok: true, act: tip.act, cid: tip.cid, reach: body.reach, returnsLeft: returns - taken, ...(body.reach === "head" ? { head: body.head } : {}) };
}

/**
 * Spend a lei of the named rite at one head. The spend names the lei by its cid, which binds the rite and the reach.
 *
 * THE TESTIMONY: the spender names the head's `tree`, and a passing `receipt/<tree>` the vessel signed must stand for it, else the
 * spend refuses `swarm-lei-testimony-absent` and claims nothing. This core reads no repository, so THE SPENDER DERIVES THE TREE
 * (the vessel reads it off the head) and the spend record carries head and tree together under the vessel's signature: the
 * vessel testifies the pairing, and a reader holds the record to it.
 *
 * A RED NARROWS: a receipt standing `fail` for the tree refuses `swarm-lei-testimony-red`. For a wide lei the vessel first rests a
 * signed narrowing at `lei-narrowed/<lei cid>`, and from then the lei spends nothing (`swarm-lei-narrowed`): the line reads
 * head-only until a fresh lei follows it (a head lei pins one head; a wide lei restrings the reach). A head lei already reads
 * narrow, so its red writes nothing.
 *
 * THE COUNT: a wide lei spends `returns` times and a head lei once. Each spend claims the lowest free row under
 * `lei-returned/<lei cid>/` atomically, so racing spends land no more than the count; past it a wide lei refuses
 * `swarm-lei-returns-spent` and a head lei `swarm-lei-returned`. No clock reads anywhere: the lei ends by count, by narrowing or by a
 * newer lei.
 */
export async function returnLei(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head: string; readonly tree: string }, trust: SwarmTrust, group: string, spender: SwarmSignerPort, ward: WardActWitness): Promise<{ lei: string; reach: SwarmLeiReach; n: number }> {
  const lei = await readLei(wiki, at, trust, group, ward);
  if (!lei.ok) throw new SwarmRefused(`swarm-lei-${lei.refusal}`, `the ${at.rite} lei for "${at.branch}" at ${at.head} does not stand (${lei.refusal})`);
  if (!trust.vessel(spender.key.toLowerCase())) throw new SwarmRefused("swarm-return-role", "the vessel alone spends a lei");
  const absent = (): never => { throw new SwarmRefused("swarm-lei-testimony-absent", `no passing receipt stands for the tree of ${at.head}; a spend names the head's tree and rests on its receipt`); };
  if (!str(at.tree)) absent();
  const receiptTitle = swarmReceiptTitle(at.tree);
  const receipt = verifySwarmRecord(await wiki.read(receiptTitle), receiptTitle, trust, group);
  if (!receipt.ok || receipt.act.body.act !== "receipt") return absent();
  if (receipt.act.body.verdict !== "pass") {
    if (lei.reach === "wide") {
      const narrowed = await signSwarmAct({ act: "lei-narrowed", group, lei: lei.cid, head: at.head, tree: at.tree }, spender);
      // The first red rests; a second one finds the lei narrowed already.
      await wiki.writeNew(swarmLeiNarrowedTitle(lei.cid), JSON.stringify(narrowed));
    }
    throw new SwarmRefused("swarm-lei-testimony-red", `the receipt for the tree of ${at.head} reads fail${lei.reach === "wide" ? "; the lei narrows to head-only until a fresh lei follows it" : ""}`);
  }
  const returns = lei.reach === "wide" ? (lei.act.body as Extract<SwarmLeiBody, { reach: "wide" }>).returns : 1;
  for (let n = 1; n <= returns; n++) {
    const spent = await signSwarmAct({ act: "lei-returned", group, branch: at.branch, head: at.head, tree: at.tree, lei: lei.cid, n }, spender);
    if (await wiki.writeNew(swarmLeiReturnedTitle(lei.cid, n), JSON.stringify(spent))) return { lei: lei.cid, reach: lei.reach, n };
  }
  throw lei.reach === "wide"
    ? new SwarmRefused("swarm-lei-returns-spent", "this lei's returns ran out; a fresh lei restrings it")
    : new SwarmRefused("swarm-lei-returned", "this lei was already returned");
}

/**
 * Rest a receipt over a tree: the vessel signs the verdict the host's battery handed it and rests it at `receipt/<tree>`, where
 * a later receipt for the same tree replaces it.
 *
 * THE RECEIPT NOTARISES TESTIMONY. The vessel re-runs nothing: it vouches that it heard this verdict, for this tree, over these
 * checks and these definitions, never that the tree passes. Every return rests on a receipt, so a return rests on that
 * testimony until the vessel samples a check itself.
 */
export async function restReceipt(wiki: SwarmWikiPort, receipt: { readonly tree: string; readonly checks: readonly string[]; readonly verdict: "pass" | "fail"; readonly definitions: string }, trust: SwarmTrust, group: string, vessel: SwarmSignerPort):
  Promise<{ tree: string; verdict: "pass" | "fail"; checks: readonly string[]; receipt: string }> {
  const malformed = (detail: string): never => { throw new SwarmRefused("swarm-receipt-malformed", detail); };
  if (!str(receipt.tree)) malformed("a receipt names its tree");
  if (receipt.verdict !== "pass" && receipt.verdict !== "fail") malformed("a receipt's verdict reads pass or fail");
  if (!Array.isArray(receipt.checks) || receipt.checks.length === 0 || !receipt.checks.every(str)) malformed("a receipt names the checks its verdict covers, at least one");
  if (!hex(receipt.definitions, 64)) malformed("a receipt names the hash of the definitions its checks ran under");
  let title: string;
  try { title = swarmReceiptTitle(receipt.tree); } catch { return malformed("a receipt's tree rides one title segment"); }
  if (!trust.vessel(vessel.key.toLowerCase())) throw new SwarmRefused("swarm-receipt-role", "the vessel alone signs a receipt");
  const act = await signSwarmAct({ act: "receipt", group, tree: receipt.tree, checks: [...receipt.checks], verdict: receipt.verdict, definitions: receipt.definitions }, vessel);
  await wiki.write(title, JSON.stringify(act));
  return { tree: receipt.tree, verdict: receipt.verdict, checks: [...receipt.checks], receipt: swarmActCid(act) };
}

/** The sum law, share side: shares never sum past the house cap. `null` stands where the law holds. */
export function swarmShareRefusal(cap: number | null, shares: ReadonlyMap<string, number>, lane: string, share: unknown): "swarm-cap-unset" | "swarm-share-malformed" | "swarm-share-over-cap" | null {
  if (!count(share)) return "swarm-share-malformed";
  if (cap === null) return "swarm-cap-unset";
  const others = [...shares].filter(([l]) => l !== lane).reduce((sum, [, v]) => sum + v, 0);
  return others + share > cap ? "swarm-share-over-cap" : null;
}

/** The sum law, cap side: the cap never drops under the shares it holds. */
export function swarmCapRefusal(cap: unknown, shares: ReadonlyMap<string, number>): "swarm-cap-malformed" | "swarm-cap-under-shares" | null {
  if (!count(cap)) return "swarm-cap-malformed";
  return [...shares.values()].reduce((sum, v) => sum + v, 0) > cap ? "swarm-cap-under-shares" : null;
}
