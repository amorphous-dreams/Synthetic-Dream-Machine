/**
 * swarm-tiddlers — the swarm's live controls as signed records in the daemon wiki, under `$:/lares/swarm/`.
 *
 * The title law (control plane, never projected) lives in `lar-uris.ts`; this module holds the records. Each record rests as the JSON of
 * `{ body, signer, sig }` in a tiddler's text, the body naming the `swarm-act` domain, and a READ verifies it before it trusts a byte:
 * shape, domain, face group, signature, the title the body belongs at, and the role of the signer. Any failure reads as refused, and the
 * caller treats a refused record as absent, so a read fails closed.
 *
 *   go/<branch>/<go cid>       a go binds a branch, a head and the go it follows there (`after`: that go's cid, null for the branch's
 *                              first); each go rests at its own row; signed by the face's hand; read only beside its co-sign; the
 *                              branch's standing go ends the longest co-signed `after` chain from its first go (two tips read as a
 *                              fork, and neither stands); spent once (`go-spent/<go cid>`, the vessel's witness)
 *   lane/<lane>/state          a lead's lane state, signed under the lead's own seat name
 *   roster/<seat>              a seat's spend reading, signed by the VESSEL as witness, never by the measured lead
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
import { wardActRefusal, type WardActRefusal, type WardActWitness } from "./ward-cosign.js";

export { SWARM_URI_PREFIX } from "./lar-uris.js";

/** The signing seat: a key and its signature over canonical bytes. The face's root signer fills it now; the ward's fills it at S2. */
export interface SwarmSignerPort { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** The wiki a swarm record rests in. `writeNew` lands a row only where none stands and answers whether it landed (an atomic claim). */
export interface SwarmWikiPort {
  read(title: string): Promise<string | null>;
  write(title: string, text: string): Promise<void>;
  writeNew(title: string, text: string): Promise<boolean>;
  /** Every title the wiki holds under a prefix: a branch's gos rest at their own rows, and its reader walks them all. */
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
  if (b.includes("..") || b.includes("@{") || b === "@" || b.endsWith(".") || /[\s~^:?*[\\]/.test(b)) malformed("a go's branch is a git ref name (git check-ref-format)");
  if (b.split("/").some((c) => c.startsWith(".") || c.endsWith(".lock"))) malformed("a go's branch is a git ref name: no component starts with `.` or ends `.lock`");
  return named;
}

export const swarmHouseCapTitle = (): string => `${SWARM_URI_PREFIX}house-cap`;
export const swarmShareTitle = (lane: string): string => `${SWARM_URI_PREFIX}lane/${segment(lane)}/share`;
export const swarmLaneStateTitle = (lane: string): string => `${SWARM_URI_PREFIX}lane/${segment(lane)}/state`;
/** The family title a branch's gos rest under; each go rests at its own row beneath it (`swarmGoRowTitle`). */
export const swarmGoTitle = (branch: string): string => `${SWARM_URI_PREFIX}go/${branchSegment(branch)}`;
export const swarmGoRowTitle = (branch: string, goCid: string): string => `${swarmGoTitle(branch)}/${segment(goCid)}`;
export const swarmGoSpentTitle = (goCid: string): string => `${SWARM_URI_PREFIX}go-spent/${segment(goCid)}`;
export const swarmRosterTitle = (seat: string): string => `${SWARM_URI_PREFIX}roster/${segment(seat)}`;
export const swarmReceiptTitle = (tree: string): string => `${SWARM_URI_PREFIX}receipt/${segment(tree)}`;

/** The fields a swarm record rests under: its text, and the mark that no mirror projects it. */
export const swarmRecordFields = (text: string): Record<string, string> => ({ text, "disk-projection": "no" });

/** `after` names the go this one follows at the branch's title (its cid), or null for the branch's first: one issue, one go. */
export interface SwarmGoBody { readonly act: "go"; readonly group: string; readonly branch: string; readonly head: string; readonly after: string | null }
export interface SwarmGoSpentBody { readonly act: "go-spent"; readonly group: string; readonly branch: string; readonly head: string; readonly go: string }
export interface SwarmLaneStateBody { readonly act: "lane-state"; readonly group: string; readonly lane: string; readonly seat: string; readonly state: Readonly<Record<string, string | number | boolean | null>> }
export interface SwarmRosterBody { readonly act: "roster"; readonly group: string; readonly seat: string; readonly model: string; readonly mode: string; readonly reading: number; readonly ceiling: number; readonly outcome: string }
export interface SwarmReceiptBody { readonly act: "receipt"; readonly group: string; readonly tree: string; readonly checks: readonly string[]; readonly verdict: "pass" | "fail"; readonly definitions: string }
export type SwarmBodyParts = SwarmGoBody | SwarmGoSpentBody | SwarmLaneStateBody | SwarmRosterBody | SwarmReceiptBody;
export type SwarmBody = SwarmBodyParts & { readonly kind: typeof SWARM_ACT_DOMAIN };
export interface SignedSwarmAct { readonly body: SwarmBody; readonly signer: string; readonly sig: string }
export type SwarmReadRefusal = "absent" | "shape" | "domain" | "group" | "signature" | "title" | "role";

const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const count = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const hex = (x: unknown, n: number): boolean => typeof x === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(x);

function shape(b: Record<string, unknown>): boolean {
  if (!str(b["group"])) return false;
  switch (b["act"]) {
    case "go": return str(b["branch"]) && str(b["head"]) && (b["after"] === null || hex(b["after"], 64));
    case "go-spent": return str(b["branch"]) && str(b["head"]) && hex(b["go"], 64);
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
      case "go": return swarmGoTitle(b.branch);
      case "go-spent": return swarmGoSpentTitle(b.go);
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
    case "go": return trust.hand(key);
    case "lane-state": return trust.lead(b.seat, b.lane, key);
    case "go-spent": case "roster": case "receipt": return trust.vessel(key);
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
  try { at = body.act === "go" ? swarmGoRowTitle(body.branch, cid) : titleOf(body); } catch { at = null; }
  if (at !== title) return { ok: false, refusal: "title" };
  if (!allowed(body, raw["signer"] as string, trust)) return { ok: false, refusal: "role" };
  return { ok: true, act, cid };
}

export async function putSwarmAct(wiki: SwarmWikiPort, title: string, act: SignedSwarmAct): Promise<void> { await wiki.write(title, JSON.stringify(act)); }
export async function readSwarmRecord(wiki: SwarmWikiPort, title: string, trust: SwarmTrust, group: string) { return verifySwarmRecord(await wiki.read(title), title, trust, group); }

/** The head a go's co-sign names: its branch, its head and the go it follows. */
export const swarmGoHead = (go: { readonly branch: string; readonly head: string; readonly after: string | null }): string =>
  sha256HexBytesSync(canonicalJsonBytes({ branch: go.branch, head: go.head, after: go.after }));

type GoRow = { readonly act: SignedSwarmAct; readonly cid: string; readonly body: SwarmGoBody };

/**
 * A branch's gos as its reader holds them. `resting`: every row under the branch that verifies as the hand's go for it, co-signed
 * or not. `cosigned`: those that stand beside their co-sign (`ward`). `tips`: the ends of the LONGEST co-signed `after` chain from
 * the branch's first go (`after: null`); a go whose `after` no chain go carries (an orphan) stands on no chain, and an older go
 * written again changes nothing, since the chain it ends stays shorter. `refusal`: the first refusal a row read, where no go rests.
 */
export async function readGoChain(wiki: SwarmWikiPort, branch: string, trust: SwarmTrust, group: string, ward: WardActWitness): Promise<{
  readonly resting: readonly GoRow[]; readonly cosigned: readonly GoRow[]; readonly tips: readonly GoRow[]; readonly refusal: SwarmReadRefusal | WardActRefusal | null;
}> {
  const resting: GoRow[] = [], refusals: SwarmReadRefusal[] = [];
  for (const title of [...await wiki.list(`${swarmGoTitle(branch)}/`)].sort()) {
    const read = verifySwarmRecord(await wiki.read(title), title, trust, group);
    if (!read.ok) { refusals.push(read.refusal); continue; }
    const body = read.act.body;
    if (body.act === "go" && body.branch === branch) resting.push({ act: read.act, cid: read.cid, body });
  }
  const wardReads = resting.map((g) => wardActRefusal(ward, { verb: "ward-push-go", wiki: "daemon", head: swarmGoHead(g.body) }));
  const cosigned = resting.filter((_, i) => wardReads[i] === null);
  const children = new Map<string | null, GoRow[]>();
  for (const g of cosigned) children.set(g.body.after, [...(children.get(g.body.after) ?? []), g]);
  // Walk the chain level by level from the branch's first go: the deepest level holds the tips.
  let level = children.get(null) ?? [], tips: GoRow[] = [];
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
 * The go standing for one branch at one head: the one go that ends the branch's longest co-signed `after` chain (`readGoChain`),
 * naming that head, with no spend of it resting. Two tips read as a fork (`forked`) and neither stands until a fresh go names one.
 * On a face of two devices a go the root signed outside the door stands on no chain (`ward-act-uncosigned` where nothing else rests).
 */
export async function readGo(wiki: SwarmWikiPort, at: { readonly branch: string; readonly head: string }, trust: SwarmTrust, group: string, ward: WardActWitness):
  Promise<{ ok: true; act: SignedSwarmAct; cid: string } | { ok: false; refusal: SwarmReadRefusal | "head-mismatch" | WardActRefusal | "spent" | "forked" }> {
  const chain = await readGoChain(wiki, at.branch, trust, group, ward);
  if (chain.tips.length > 1) return { ok: false, refusal: "forked" };
  const tip = chain.tips[0];
  if (!tip) return { ok: false, refusal: chain.refusal ?? "absent" };
  if (tip.body.head !== at.head) return { ok: false, refusal: "head-mismatch" };
  // Any row at the spend title blocks the go, signed or not: a forged spend fails closed.
  if ((await wiki.read(swarmGoSpentTitle(tip.cid))) !== null) return { ok: false, refusal: "spent" };
  return { ok: true, act: tip.act, cid: tip.cid };
}

/** Spend a go: the vessel writes one spend record, claimed atomically, so a second spend of the same go refuses `swarm-go-spent`. */
export async function spendGo(wiki: SwarmWikiPort, at: { readonly branch: string; readonly head: string }, trust: SwarmTrust, group: string, spender: SwarmSignerPort, ward: WardActWitness): Promise<{ go: string }> {
  const go = await readGo(wiki, at, trust, group, ward);
  if (!go.ok) throw new SwarmRefused(`swarm-go-${go.refusal}`, `the go for "${at.branch}" at ${at.head} does not stand (${go.refusal})`);
  if (!trust.vessel(spender.key.toLowerCase())) throw new SwarmRefused("swarm-spend-role", "the vessel alone spends a go");
  const spent = await signSwarmAct({ act: "go-spent", group, branch: at.branch, head: at.head, go: go.cid }, spender);
  if (!(await wiki.writeNew(swarmGoSpentTitle(go.cid), JSON.stringify(spent)))) throw new SwarmRefused("swarm-go-spent", "this go was already spent");
  return { go: go.cid };
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
