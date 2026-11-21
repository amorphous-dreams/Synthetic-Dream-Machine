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
 *                              rite's lei never reads, co-signs or spends as the other's. An `exec` lei carries a `scope` (its
 *                              wiki, writer, and a title set or one executable class, `exec-lei-scope.ts`) and rests at its wiki's
 *                              branch; no other rite carries one
 *   lane/<lane>/state          a lead's lane state, signed under the lead's own seat name
 *   roster/<seat>              a seat's spend reading, signed by the VESSEL as witness, never by the measured lead
 *                              A lei's REACH: a `wide` lei (the default) names no head and carries `returns`, the count of spends
 *                              the hand wrote into it; a `head` lei pins one head and spends once. The signed lei stands as the
 *                              operator's consent, and a `push` lei adds its ward co-sign; no receipt weighs a spend.
 *   lei-returned/<lei cid>/<n>      one spend of a lei, the vessel's witness: `n` counts from 1 to the lei's returns, each row claimed
 *                              atomically; any row under `lei-returned/<lei cid>/` counts against the lei, signed or not
 *   lei-unstrung/<lei cid>     the hand unstrung a lei that still held returns: signed by the face's hand; any row here ends
 *                              the lei, and the lei's own row rests on
 *   tessera/<tessera>/guest · tessera/<tessera>/host
 *                              the two halves of one rite across a restart (`swarm-tessera.ts`): `rite-begun` rests before the
 *                              vessel goes down, `rite-landed` after it stands again; each the VESSEL's witness
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
import { execLeiBranch, execLeiScopeRefusal, type ExecLeiScope } from "./exec-lei-scope.js";
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
/** The prefix every tessera half rests under. */
export const swarmTesseraPrefix = (): string => `${SWARM_URI_PREFIX}tessera/`;
/** One half of a tessera: the `guest` half (`rite-begun`), the `host` half (`rite-landed`), or the hand's `abandoned` mark (`rite-abandoned`). */
export const swarmTesseraTitle = (tessera: string, half: "guest" | "host" | "abandoned"): string => {
  if (half !== "guest" && half !== "host" && half !== "abandoned") malformed("a tessera holds a guest half, a host half, and the hand's abandoned mark");
  return `${swarmTesseraPrefix()}${segment(tessera)}/${half}`;
};
export const swarmLeiUnstrungTitle = (leiCid: string): string => `${SWARM_URI_PREFIX}lei-unstrung/${segment(leiCid)}`;
export const swarmRosterTitle = (seat: string): string => `${SWARM_URI_PREFIX}roster/${segment(seat)}`;

/** The fields a swarm record rests under: its text. The record rests in the control document, which no mirror names. */
export const swarmRecordFields = (text: string): Record<string, string> => ({ text });

/**
 * A lei's reach, and what each reach binds. `wide` (the default): the lei names no head, and
 * `returns` holds the count of spends the hand wrote into it. `head`: the lei pins one head and spends once.
 */
export type SwarmLeiReach = "wide" | "head";
export type SwarmLeiTerms = { readonly reach: "wide"; readonly returns: number } | { readonly reach: "head"; readonly head: string };
/** `rite` names the one power the lei carries. `after` names the lei this one follows at its rite's title for the branch (its
 *  cid), or null for the first there: one issue, one lei. */
export type SwarmLeiBody = { readonly act: "lei"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly after: string | null; readonly scope?: ExecLeiScope } & SwarmLeiTerms;
/** One return: the lei, its count `n`, and the head and tree the vessel returned it at (the vessel testifies that the tree belongs to the head). */
export interface SwarmLeiReturnedBody { readonly act: "lei-returned"; readonly group: string; readonly branch: string; readonly head: string; readonly tree: string; readonly lei: string; readonly n: number }
export interface SwarmLaneStateBody { readonly act: "lane-state"; readonly group: string; readonly lane: string; readonly seat: string; readonly state: Readonly<Record<string, string | number | boolean | null>> }
export interface SwarmRosterBody { readonly act: "roster"; readonly group: string; readonly seat: string; readonly model: string; readonly mode: string; readonly reading: number; readonly ceiling: number; readonly outcome: string }
/** The hand unstrung a lei: the lei, and the rite and branch whose line it rests on. */
export interface SwarmLeiUnstrungBody { readonly act: "lei-unstrung"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly lei: string }
/** The guest half: the rite began. `lei` and `n` name the return that paid for it; `head` and `tree` name what the rite runs at. */
export interface SwarmRiteBegunBody { readonly act: "rite-begun"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly head: string; readonly tree: string; readonly lei: string; readonly n: number; readonly tessera: string;
  /** The image the rite raises, by its digest, where the begin names one (a kūkulu): the landing reads par only over the same image. */
  readonly image?: string }
/** The host half: the vessel stood again. `begun` names the guest half by its cid; `head` names the head the vessel stands at. */
export interface SwarmRiteLandedBody { readonly act: "rite-landed"; readonly group: string; readonly rite: SwarmLeiRite; readonly tessera: string; readonly begun: string; readonly head: string;
  /** The image the vessel stands from, where the landing names one. */
  readonly image?: string }
/** The hand ended a begun half that never landed: the half rests, its return stays spent, and no landing takes it after. */
export interface SwarmRiteAbandonedBody { readonly act: "rite-abandoned"; readonly group: string; readonly rite: SwarmLeiRite; readonly branch: string; readonly tessera: string }
export type SwarmBodyParts = SwarmLeiBody | SwarmLeiReturnedBody | SwarmLeiUnstrungBody | SwarmRiteBegunBody | SwarmRiteLandedBody | SwarmRiteAbandonedBody | SwarmLaneStateBody | SwarmRosterBody;
export type SwarmBody = SwarmBodyParts & { readonly kind: typeof SWARM_ACT_DOMAIN };
export interface SignedSwarmAct { readonly body: SwarmBody; readonly signer: string; readonly sig: string }
export type SwarmReadRefusal = "absent" | "shape" | "domain" | "group" | "signature" | "title" | "role";

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const count = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
function positive(x: unknown): x is number { return typeof x === "number" && Number.isSafeInteger(x) && x >= 1; }
const hex = (x: unknown, n: number): boolean => typeof x === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(x);

/** A tessera half's image, where it names one: a digest, `<algorithm>:<hex>`. */
const imageOrNone = (b: Record<string, unknown>): boolean => !("image" in b) || (typeof b["image"] === "string" && /^[a-z0-9]+:[0-9a-f]{32,128}$/.test(b["image"]));

function shape(b: Record<string, unknown>): boolean {
  if (!str(b["group"])) return false;
  switch (b["act"]) {
    // A lei holds one reach whole: a wide lei carries its returns and no head, a head lei its head and no returns.
    case "lei": return isSwarmLeiRite(b["rite"]) && str(b["branch"]) && (b["after"] === null || hex(b["after"], 64))
      && (b["reach"] === "wide" ? positive(b["returns"]) && !("head" in b) : b["reach"] === "head" ? str(b["head"]) && !("returns" in b) : false)
      // An exec lei carries its scope and rests at its wiki's branch; every other rite carries none.
      && (b["rite"] === "exec" ? execLeiScopeRefusal(b["scope"]) === null && b["branch"] === execLeiBranch((b["scope"] as ExecLeiScope).wiki) : !("scope" in b));
    case "lei-returned": return str(b["branch"]) && str(b["head"]) && str(b["tree"]) && hex(b["lei"], 64) && positive(b["n"]);
    case "lei-unstrung": return hex(b["lei"], 64) && isSwarmLeiRite(b["rite"]) && str(b["branch"]);
    case "rite-begun": return isSwarmLeiRite(b["rite"]) && str(b["branch"]) && str(b["head"]) && str(b["tree"]) && hex(b["lei"], 64) && positive(b["n"]) && hex(b["tessera"], 64) && imageOrNone(b);
    case "rite-landed": return isSwarmLeiRite(b["rite"]) && hex(b["tessera"], 64) && hex(b["begun"], 64) && str(b["head"]) && imageOrNone(b);
    case "rite-abandoned": return isSwarmLeiRite(b["rite"]) && str(b["branch"]) && hex(b["tessera"], 64);
    case "lane-state": return str(b["lane"]) && str(b["seat"]) && object(b["state"]) && Object.values(b["state"]).every((v) => v === null || ["string", "number", "boolean"].includes(typeof v));
    case "roster": return str(b["seat"]) && str(b["model"]) && str(b["mode"]) && count(b["reading"]) && count(b["ceiling"]) && str(b["outcome"]);
    default: return false;
  }
}

/** The title a body belongs at, or null where its names do not form a title. */
function titleOf(b: SwarmBody): string | null {
  try {
    switch (b.act) {
      case "lei": return swarmLeiTitle(b.rite, b.branch);
      case "lei-returned": return swarmLeiReturnedTitle(b.lei, b.n);
      case "lei-unstrung": return swarmLeiUnstrungTitle(b.lei);
      case "rite-begun": return swarmTesseraTitle(b.tessera, "guest");
      case "rite-landed": return swarmTesseraTitle(b.tessera, "host");
      case "rite-abandoned": return swarmTesseraTitle(b.tessera, "abandoned");
      case "lane-state": return swarmLaneStateTitle(b.lane);
      case "roster": return swarmRosterTitle(b.seat);
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
    case "lei-returned": case "rite-begun": case "rite-landed": case "rite-abandoned": case "roster": return trust.vessel(key);
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
export const swarmLeiHead = (lei: { readonly rite: SwarmLeiRite; readonly branch: string; readonly after: string | null; readonly scope?: ExecLeiScope } & SwarmLeiTerms): string =>
  sha256HexBytesSync(canonicalJsonBytes({ ...(lei.reach === "wide"
    ? { rite: lei.rite, branch: lei.branch, reach: lei.reach, returns: lei.returns, after: lei.after }
    : { rite: lei.rite, branch: lei.branch, reach: lei.reach, head: lei.head, after: lei.after }), ...(lei.scope !== undefined ? { scope: lei.scope } : {}) }));

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
 * stands for any head while returns stay (`returns-spent` once the rows under its return prefix reach its count). A lei the hand
 * unstrung stands for nothing (`unstrung`). A newer lei on the chain replaces the tip, so a fresh lei restrings a returned or spent
 * line. Two tips read as a fork (`forked`) and neither stands until a fresh lei names one.
 * On a face of two devices a lei the root signed outside the door stands on no chain (`ward-act-uncosigned` where nothing else rests).
 */
export async function readLei(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head?: string }, trust: SwarmTrust, group: string, ward: WardActWitness):
  Promise<{ ok: true; act: SignedSwarmAct; cid: string; reach: SwarmLeiReach; returnsLeft: number; head?: string } | { ok: false; refusal: SwarmReadRefusal | "head-mismatch" | WardActRefusal | "unstrung" | "returned" | "returns-spent" | "forked" }> {
  const chain = await readLeiChain(wiki, at, trust, group, ward);
  if (chain.tips.length > 1) return { ok: false, refusal: "forked" };
  const tip = chain.tips[0];
  if (!tip) return { ok: false, refusal: chain.refusal ?? "absent" };
  const body = tip.body;
  // A read that names no head asks after the line alone: a head lei then answers with the head it pins.
  if (body.reach === "head" && at.head !== undefined && body.head !== at.head) return { ok: false, refusal: "head-mismatch" };
  // Any row at the unstrung title ends the lei, signed or not: a forged unstringing fails closed.
  if ((await wiki.read(swarmLeiUnstrungTitle(tip.cid))) !== null) return { ok: false, refusal: "unstrung" };
  // Every row under the spend prefix counts, signed or not: a forged spend fails closed.
  const returns = body.reach === "wide" ? body.returns : 1;
  const taken = (await wiki.list(swarmLeiReturnedPrefix(tip.cid))).length;
  if (taken >= returns) return { ok: false, refusal: body.reach === "wide" ? "returns-spent" : "returned" };
  return { ok: true, act: tip.act, cid: tip.cid, reach: body.reach, returnsLeft: returns - taken, ...(body.reach === "head" ? { head: body.head } : {}) };
}

/**
 * Spend a lei of the named rite at one head. The spend names the lei by its cid, which binds the rite and the reach.
 *
 * THE CONSENT: the hand's signed lei, with a `push` lei's ward co-sign, stands as the operator's consent; no receipt weighs the spend.
 * The spender still names the head's `tree` (the vessel reads it off the head, this core reads no repository), and the spend record
 * carries head and tree together under the vessel's signature: the vessel testifies the pairing, and a reader holds the record to it.
 *
 * THE COUNT: a wide lei spends `returns` times and a head lei once. Each spend claims the lowest free row under
 * `lei-returned/<lei cid>/` atomically, so racing spends land no more than the count; past it a wide lei refuses
 * `swarm-lei-returns-spent` and a head lei `swarm-lei-returned`. No clock reads anywhere: the lei ends by count, by unstringing or by a
 * newer lei.
 */
export async function returnLei(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head: string; readonly tree: string }, trust: SwarmTrust, group: string, spender: SwarmSignerPort, ward: WardActWitness,
  /** The scope check an `exec` spend runs over the standing lei (`spendExecLei`): a refusal it names ends the spend unclaimed. */
  admits?: (lei: SwarmLeiBody) => SwarmRefused | null): Promise<{ lei: string; reach: SwarmLeiReach; n: number }> {
  return claimReturn(wiki, await checkReturn(wiki, at, trust, group, spender, ward, admits));
}

/** A return a spend may claim: the standing lei, the line and head it spends at, and the vessel that spends it. */
export interface SwarmReturnable {
  readonly at: SwarmLeiLine & { readonly head: string; readonly tree: string; readonly image?: string };
  readonly lei: { readonly act: SignedSwarmAct; readonly cid: string; readonly reach: SwarmLeiReach; readonly returnsLeft: number };
  readonly group: string;
  readonly spender: SwarmSignerPort;
}

/**
 * JUDGE A SPEND AND CLAIM NOTHING: the lei stands with a return left (`readLei`), the vessel spends it, an `exec` lei passes its
 * scope check. Each refusal reads as `returnLei` names it. A spend over many lines (a kūkulu's lent faces) checks every line first
 * and claims (`claimReturn`) only once every check answers.
 */
export async function checkReturn(wiki: SwarmWikiPort, at: SwarmLeiLine & { readonly head: string; readonly tree: string; readonly image?: string }, trust: SwarmTrust, group: string, spender: SwarmSignerPort, ward: WardActWitness,
  admits?: (lei: SwarmLeiBody) => SwarmRefused | null): Promise<SwarmReturnable> {
  const lei = await readLei(wiki, at, trust, group, ward);
  if (!lei.ok) throw new SwarmRefused(`swarm-lei-${lei.refusal}`, `the ${at.rite} lei for "${at.branch}" at ${at.head} does not stand (${lei.refusal})`);
  if (!trust.vessel(spender.key.toLowerCase())) throw new SwarmRefused("swarm-return-role", "the vessel alone spends a lei");
  // An exec lei spends only through its scope check; a restart rite's road (which names no scope) never takes it.
  if (at.rite === "exec" && admits === undefined) throw new SwarmRefused("swarm-lei-exec-unscoped", "an exec lei spends only through its scope check (spendExecLei)");
  const outside = admits?.(lei.act.body as SwarmLeiBody) ?? null;
  if (outside) throw outside;
  return { at, lei: { act: lei.act, cid: lei.cid, reach: lei.reach, returnsLeft: lei.returnsLeft }, group, spender };
}

/** Claim the lowest free return row of a checked lei, atomically; past its count it refuses spent. */
export async function claimReturn(wiki: SwarmWikiPort, { at, lei, group, spender }: SwarmReturnable): Promise<{ lei: string; reach: SwarmLeiReach; n: number }> {
  const returns = lei.reach === "wide" ? (lei.act.body as Extract<SwarmLeiBody, { reach: "wide" }>).returns : 1;
  for (let n = 1; n <= returns; n++) {
    const spent = await signSwarmAct({ act: "lei-returned", group, branch: at.branch, head: at.head, tree: at.tree, lei: lei.cid, n }, spender);
    if (await wiki.writeNew(swarmLeiReturnedTitle(lei.cid, n), JSON.stringify(spent))) return { lei: lei.cid, reach: lei.reach, n };
  }
  throw lei.reach === "wide"
    ? new SwarmRefused("swarm-lei-returns-spent", "this lei's returns ran out; a fresh lei restrings it")
    : new SwarmRefused("swarm-lei-returned", "this lei was already returned");
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
