/**
 * pulama-keeper — THE KEEPER TALLY: the hearth-keeper's own succession, a tessera split across the gap between two pūlamas.
 *
 * The vessel crosses its down-and-up gap under a tessera (`rite-begun` · `rite-landed`); the keeper crosses its own the same
 * way, in the pūlama's admit family, signed under the pūlama's tessera key and resting in its own state:
 *
 *   keeper/<tessera>/guest   `keeper-begun`: the lit keeper, under the operator's route (`keeper-commit`), names ONE successor
 *                            code closure (`next = D′`), the closure it runs itself as the host reported it, the image, the lit
 *                            faces, the worn ordinal and the budget it spent. `v` and `prev` link the chain (a singly linked list,
 *                            like the lei `after` chain): `prev` names the last landing's cid, `v` counts from 1. A later commit at
 *                            the same link supersedes the one before it (`supersedes` names it), so the hand can change its mind.
 *   keeper/<tessera>/vest    `keeper-vested`: the lit keeper sealed the house's end of the bond (the node key and each open face
 *                            key) to ONE successor key, once per commit, inside a live kūkulu rite whose tessera it names. No key
 *                            rests in it. Or `keeper-lapsed`: the one rite attempt this commit allows refused, by name. Either way
 *                            the commit is spent: a second vest finds the row and refuses `vest-spent`, and no stale commit waits.
 *   keeper/<tessera>/host    `keeper-landed`: the successor names what it stands on (its own reported closure, image, lit faces)
 *                            and what it received (`vest`: the slot, the node key, each face key; null where the hand's light
 *                            lit it: the struck fire). `vestings` counts the handed links since the last struck one.
 *
 * A VEST RIDES A LIVE RITE, NEVER A BARE FRAME. The vest frame carries the kūkulu offer (`kukulu-offer.json`): each vouch the standing
 * vessel signed under the custody root's vouch child names this keeper move (the successor's one-handoff key it announced through
 * the same rite, the committed closure, the face's device count), its image equals the one the host reports, and the vest begins
 * the kūkulu rite itself over the pūlama's records, claiming one return of a lei the hand strung. The new vessel's hello then finds
 * that begun half and lands it, spending no second return. A frame with no such offer, or a lei with no return left, vests nothing.
 *
 * THE HOST STANDS TRUSTED, AND THE CLOSURE CHECK READS CONSISTENCY, NEVER ATTESTATION. The successor's closure comes from a label
 * the host shim read off its container; the vest checks it against what the hand committed. A host that controls the hand door
 * during a live rite reaches the node key and the open face keys, as it reaches the keeper's memory today.
 *
 * THE SLOT (`keeper-slot`) is the vest itself: the keys sealed to the successor's ephemeral X25519 key (`sealed-box`), bound to the
 * commit and to `D′` (both ride the seal's salt and the signed body), signed under the pūlama's key. It crosses the host's pipe once,
 * from the fire-holder's hand door to the successor's, and NEVER rests on disk; the successor's ephemeral secret zero-fills on its
 * first open, so the slot spends on landing.
 *
 * THE HUMAN'S END NEVER CROSSES. The passphrase root derives the slot tree and never rests in a holder; a vest carries only keys the
 * house minted at random and the human's slots wrap (the node key, the face custody keys). Ward keys never rest open to hand.
 *
 * PAR reads: the landing names the guest half's cid at the same `v`; the guest half links the chain (`prev` names the last landing,
 * `v` one past it); the successor's reported closure equals the committed `next`; every committed face stands lit; and a landing that
 * names a vest finds its spend mark. The chain walks par links alone: a red landing never becomes the tip and never resets the handed
 * count, and the next commit links past it. Every other pair reads red, by name: `begun-refused`, `landed-refused`, `begun-absent`,
 * `landed-names-another`, `version-skew`, `closure-differs`, `faces-short`, `vest-unwitnessed`, `fork` (two live commits, or two
 * landings, at one link). Red is loud and never auto-accepted, and it never locks: the hand's light stays under every red.
 *
 * THE BUDGET CARRIES ON A HANDED MOVE, AND A RESTART RESETS IT (operator ruling, 2026-11-23). The vest seals the unlock attempts the
 * old keeper spent beside the keys, and the successor seats that count (`seedSpent`) under the one bound every door shares
 * (`UNLOCK_ATTEMPTS_PER_BOOT`, the attempt budget). A forced move (a crash, a restart, no vest) starts a fresh count, by design: a
 * thief who can restart the keeper's container already holds host access, and with it the sealed state to try routes against
 * offline, so a count kept on disk would guard nothing that thief needs while it would brick the owner who mistyped their own route.
 *
 * THE CO-SIGN FAILS CLOSED (operator ruling, 2026-11-23). Each vouch the vest rides names its face's device count as the standing
 * vessel read the face's signed admission fold, and the commit carries the count the vessel read at commit time (so `status` and the
 * rite read it early). A count read nowhere refuses `vest-devices-unread`. Each per-face budget carries with the vest too.
 * PAST ONE DEVICE THE COMMIT CARRIES THE CO-SIGN: the vessel runs `ward-keeper-vest` through the ward co-sign gate over (D′, the chain
 * head, the commit's nonce, the face's roster) BEFORE the commit, another device of the roster approves it in its own ward, and the
 * commit carries the spent co-sign (`cosigns`, one per committed face: its roster, the issuer's ask, the approve, the outcome). The
 * keeper opens no document, so it reads that proof offline (`keeperCosignRefusal`) at the commit and again at the vest: each entry
 * verifies under its signer, the approve comes from ANOTHER atom of the carried roster under the ward key carried for it, and the
 * digest names this commit and this roster. The roster and that ward key ride in the proof as the vessel named them (blind read F2):
 * the proof shows the vessel's own roster approving, never second-device consent past what that roster holds. The rite's vouch must
 * count no device the co-signed roster lacks, and every face this keeper would seal must stand vouched. A commit with none refuses `vest-cosign-owed`; a proof that does not answer it refuses `vest-cosign-refused`. The
 * nonce rides the tessera, so one proof rides one commit: a second commit under it refuses `vest-cosign-spent`.
 *
 * THE SCHEDULED STRUCK FIRE: after `KEEPER_STRUCK_EVERY` handed links in a row, the vest refuses `struck-due` and the hand lights the
 * successor by passphrase, which keeps the human's route practiced. Count-based down the chain, no clock.
 *
 * THE KEEPER LEI (operator ruling, 2026-11-24: the kukulu lei licenses it, no count of its own). Where a standing kukulu lei on the
 * branch holds returns, the host may rest ONE keeper commit with no route (`keeperCommitByLei`), over a revision it read reachable
 * from origin, green in CI and built into an image whose closure label equals `next`; the commit names that license and testimony.
 * The live rite the vest rides spends the lei's return (the same return the rite spends for the lent face), and the vest names each
 * return. A lei never supersedes a hand's commit; faces of one device alone. THE RESIDUAL (blind read F4): the bounds bind honest
 * successor code only, and the host testifies them; the real gate stands at host access plus a standing kukulu lei, since a host can
 * send the commit itself. A signed CI attestation the keeper reads stays a beta course row.
 * Meme: lar:///ha.ka.ba/kahua/memory/research/keeper-tessera#/vesting · lar:///ha.ka.ba/kahua/memory/research/keeper-lei#/shape
 */
import { randomUUID } from "node:crypto";
import { KEEPER_NONCE, keeperCosignRefusal, type KeeperCosign } from "@lararium/mesh/keeper-cosign";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { mintSealedBoxRecipient, openFromSender, sealToRecipient } from "@lararium/mesh/sealed-box";
import { type SwarmWikiPort } from "@lararium/mesh/swarm-tiddlers";
import type { KukuluSigner } from "./kukulu-gate.js";
import {
  pulamaRecordCid, signPulamaRecord, verifiedPulamaRecord,
  type AdmittedFace, type KeeperBegunBody, type KeeperLicense, type KeeperLandedBody, type KeeperSlotBody, type KeeperVest, type KeeperVestedBody, type SignedPulamaAdmit,
} from "./pulama-admit.js";

/** Why a commit's carried co-signs do not cover its faces, or null where they do (or where none is owed and none rides). */
function cosignsRefusal(at: { readonly next: string; readonly prev: string | null; readonly nonce: string; readonly faces: readonly AdmittedFace[]; readonly devices: number | null }, cosigns: readonly KeeperCosign[] | null | undefined): KeeperRefusal | null {
  if (cosigns === null || cosigns === undefined) return null;
  const cure = "ask the co-sign again from the vessel and commit with it: lares pulama keeper-commit (a second device of the face approves in its ward dialog)";
  if (!Array.isArray(cosigns)) return refuse("vest-cosign-refused", `the carried co-sign reads malformed; ${cure}`);
  for (const face of at.faces) {
    const mine = cosigns.filter((c) => c !== null && typeof c === "object" && c.ordinal === face.ordinal);
    if (mine.length !== 1) return refuse("vest-cosign-refused", `committed face h${face.ordinal} carries ${mine.length} co-signs, and it takes one; ${cure}`);
    const why = keeperCosignRefusal(mine[0], { next: at.next, prev: at.prev, nonce: at.nonce });
    if (why !== null) return refuse("vest-cosign-refused", `the co-sign of face h${face.ordinal} refuses (${why}); ${cure}`);
  }
  const most = Math.max(0, ...cosigns.map((c) => (Array.isArray(c?.devices) ? c.devices.length : 0)));
  if (at.devices !== null && most !== at.devices) return refuse("vest-cosign-refused", `the co-signs name at most ${most} device(s), and the commit counts ${at.devices}; ${cure}`);
  return null;
}

/** Handed links in a row before the vest refuses and the hand strikes the fire anew (the lei's explicit-confirm threshold). */
export const KEEPER_STRUCK_EVERY = 12;
/**
 * THE KEEPER LEI'S FLOOR (alpha: on). A code constant inside the pūlama closure, never an env var and never a tiddler: the pūlama
 * opens no document, and a flag the familiar could write would gate nothing. Turning it off moves D′, so the OFF switch itself lands
 * through one keeper handoff; from then every commit the kukulu lei would license refuses `keeper-lei-floor-off`, and `status` reads
 * `floor: false`.
 */
export const KEEPER_LEI_STANDS: boolean = true;
const PREFIX = "$:/lares/pulama/keeper/";
export const pulamaKeeperPrefix = (): string => PREFIX;
export const pulamaKeeperTitle = (tessera: string, half: "guest" | "host" | "vest"): string => `${PREFIX}${tessera}/${half}`;
/** A closure as `tools/pulama-closure.mjs` prints it. */
export const CLOSURE = /^sha256:[0-9a-f]{64}$/;
const VEST_INFO = new TextEncoder().encode("lares/pulama/keeper-vest");
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const unhex = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, "hex"));

export type KeeperRed = "begun-refused" | "landed-refused" | "begun-absent" | "landed-names-another" | "version-skew" | "closure-differs" | "faces-short" | "vest-unwitnessed" | "fork";
export interface KeeperPair { readonly tessera: string; readonly v: number | null; readonly begun: string | null; readonly landed: string | null; readonly par: boolean; readonly red?: KeeperRed; readonly vest: boolean }
/** The chain as the status fold reads it: its tip, each landed pair, the live commit, the handed run and the struck fire due. */
export interface KeeperFold {
  readonly v: number;
  readonly tip: string | null;
  readonly pairs: readonly KeeperPair[];
  readonly pending: { readonly tessera: string; readonly v: number; readonly next: string; readonly begun: string; readonly devices: number | null; readonly body: KeeperBegunBody } | null;
  readonly vestings: number;
  readonly struckDue: boolean;
  readonly fork: boolean;
  /** Where the fork stands between live commits alone (no two landings at a link): their cids, which a fresh commit settles. */
  readonly forkCommits: readonly string[];
  /** The commit at the next link a vest spent and no landing names yet: the one a vested successor lands. */
  readonly vested: { readonly tessera: string; readonly v: number; readonly next: string; readonly begun: string } | null;
}

type Begun = { readonly cid: string; readonly body: KeeperBegunBody };
type Landed = { readonly cid: string; readonly body: KeeperLandedBody };
interface Rows { begun: Map<string, Begun | "refused">; landed: Map<string, Landed | "refused">; vested: Map<string, KeeperVestedBody>; marked: Set<string> }

async function rowsOf(records: SwarmWikiPort, by: KukuluSigner): Promise<Rows> {
  const out: Rows = { begun: new Map(), landed: new Map(), vested: new Map(), marked: new Set() };
  for (const title of await records.list(PREFIX)) {
    const [tessera, half, ...rest] = title.slice(PREFIX.length).split("/");
    if (!tessera || rest.length > 0) continue;
    const row = verifiedPulamaRecord(await records.read(title), by.key);
    const body = row?.body;
    if (half === "guest") out.begun.set(tessera, row !== null && body?.act === "keeper-begun" && body.tessera === tessera ? { cid: pulamaRecordCid(row), body } : "refused");
    else if (half === "host") out.landed.set(tessera, row !== null && body?.act === "keeper-landed" && body.tessera === tessera ? { cid: pulamaRecordCid(row), body } : "refused");
    else if (half === "vest") {
      // ANY ROW AT THE MARK SPENDS THE COMMIT (a vest, a lapse, or one no key signed): the commit never vests again.
      out.marked.add(tessera);
      if (body?.act === "keeper-vested" && body.tessera === tessera) out.vested.set(tessera, body);
    }
  }
  return out;
}

/** THE STATUS FOLD: walk the chain's par links from the founding keeper to the tip, and read each pair par or red by name. */
export async function keeperFold(records: SwarmWikiPort, by: KukuluSigner): Promise<KeeperFold> {
  const rows = await rowsOf(records, by);
  const landedAt = new Map<number, Landed[]>();
  for (const l of rows.landed.values()) if (l !== "refused") landedAt.set(l.body.v, [...(landedAt.get(l.body.v) ?? []), l]);
  const beginOf = (l: Landed): Begun | null => { const b = rows.begun.get(l.body.tessera); return b === undefined || b === "refused" ? null : b; };
  // THE CHAIN WALKS PAR LINKS ALONE: at each link the landings that read par over the link before; one extends the chain, two read a
  // fork, none ends it. A red landing (closure-differs, faces-short, …) never becomes the tip and never resets the handed count.
  const chain = new Map<number, Landed>();
  let tip: Landed | null = null, fork = false, landingFork = false;
  for (let v = 1; landedAt.has(v); v++) {
    const par = landedAt.get(v)!.filter((l) => { const b = beginOf(l); return b !== null && keeperRed(b, l, rows, tip?.cid ?? null) === null; });
    if (par.length > 1) { fork = true; landingFork = true; break; }
    if (par.length === 0) break;
    tip = par[0]!;
    chain.set(v, tip);
  }
  const pairs: KeeperPair[] = [];
  for (const [tessera, landed] of rows.landed) {
    const begun = rows.begun.get(tessera);
    const v = landed !== "refused" ? landed.body.v : begun !== undefined && begun !== "refused" ? begun.body.v : null;
    let red: KeeperRed | null;
    if (landed === "refused") red = "landed-refused";
    else if (begun === undefined) red = "begun-absent";
    else if (begun === "refused") red = "begun-refused";
    else if (chain.get(landed.body.v)?.cid === landed.cid) red = null;
    else {
      const before = landed.body.v === 1 ? null : chain.get(landed.body.v - 1)?.cid;
      red = before === undefined ? "version-skew" : keeperRed(begun, landed, rows, before) ?? "fork";
    }
    pairs.push({ tessera, v, begun: begun !== undefined && begun !== "refused" ? begun.cid : null, landed: landed !== "refused" ? landed.cid : null, par: red === null, ...(red === null ? {} : { red }), vest: landed !== "refused" && landed.body.vest !== null });
  }
  pairs.sort((a, b) => (a.v ?? 0) - (b.v ?? 0) || a.tessera.localeCompare(b.tessera));
  // THE LIVE COMMIT: a guest half at the next link, unlanded, unspent (no vest and no lapse names it), that no later commit
  // supersedes. Two live ones read a fork.
  const linked = (b: Begun): boolean => b.body.v === (tip?.body.v ?? 0) + 1 && b.body.prev === (tip?.cid ?? null);
  const open = [...rows.begun].flatMap(([t, b]) => (b !== "refused" && !rows.landed.has(t) && !rows.marked.has(t) && linked(b) ? [b] : []));
  // A commit supersedes the one live commit it read, or SETTLES every live commit of a fork it read (`settles`).
  const superseded = new Set([...rows.begun.values()].flatMap((b) => (b !== "refused" ? [...(b.body.supersedes !== null ? [b.body.supersedes] : []), ...(Array.isArray(b.body.settles) ? b.body.settles : [])] : [])));
  const live = open.filter((b) => !superseded.has(b.cid));
  if (live.length > 1) fork = true;
  const pending = live.length === 1 ? { tessera: live[0]!.body.tessera, v: live[0]!.body.v, next: live[0]!.body.next, begun: live[0]!.cid, devices: typeof live[0]!.body.devices === "number" ? live[0]!.body.devices : null, body: live[0]!.body } : null;
  const vestings = tip?.body.vestings ?? 0;
  const spentBy = [...rows.begun].flatMap(([t, b]) => (b !== "refused" && !rows.landed.has(t) && linked(b) && rows.vested.get(t)?.begun === b.cid ? [b] : []));
  const vested = spentBy.length === 1 ? { tessera: spentBy[0]!.body.tessera, v: spentBy[0]!.body.v, next: spentBy[0]!.body.next, begun: spentBy[0]!.cid } : null;
  const forkCommits = fork && !landingFork ? live.map((b) => b.cid).sort() : [];
  return { v: tip?.body.v ?? 0, tip: tip?.cid ?? null, pairs, pending: fork ? null : pending, vestings, struckDue: vestings >= KEEPER_STRUCK_EVERY, fork, forkCommits, vested: fork ? null : vested };
}

/** One pair's red reading over the link before it (`prev`: that link's cid, null at the first link), or null for par. */
function keeperRed(begun: Begun, landed: Landed, rows: Rows, prev: string | null): KeeperRed | null {
  const g = begun.body, h = landed.body;
  if (h.begun !== begun.cid || h.prev !== begun.cid) return "landed-names-another";
  if (h.v !== g.v || g.prev !== prev) return "version-skew";
  if (h.closure !== g.next) return "closure-differs";
  if (g.faces.some((f) => !h.faces.some((x) => x.fcid === f.fcid))) return "faces-short";
  if (h.vest !== null && (rows.vested.get(g.tessera)?.begun !== begun.cid)) return "vest-unwitnessed";
  return null;
}

export type KeeperRefusal = { readonly refusal: string; readonly detail: string };
const refuse = (refusal: string, detail: string): KeeperRefusal => ({ refusal, detail });

/** What a lit keeper stands on, read off its own holder and the host's reports. */
export interface KeeperStanding { readonly closure: string | null; readonly image: string | null; readonly faces: readonly AdmittedFace[]; readonly worn: number | null; readonly spent: number }

/**
 * KEEPER-COMMIT (the caller proved the operator's route first): rest the guest half naming `next` at the chain's next link. A live
 * commit there is superseded by this one. The keeper's own closure must stand reported, and `next` must read as a closure.
 */
export async function keeperCommit(records: SwarmWikiPort, by: KukuluSigner, at: KeeperStanding & { readonly next: string; readonly devices: number | null; readonly cosign?: unknown; readonly licensed?: KeeperLicense; readonly noSupersede?: boolean }): Promise<{ readonly tessera: string; readonly v: number; readonly next: string; readonly supersedes: string | null } | KeeperRefusal> {
  if (!CLOSURE.test(at.next)) return refuse("next-malformed", "the successor's closure reads `sha256:<64 hex>`, as tools/pulama-closure.mjs prints it");
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so the chain cannot name what it hands from");
  const fold = await keeperFold(records, by);
  // A FORK OF LIVE COMMITS SETTLES HERE (blind read F6): this commit settles every live commit at the link and stands alone. Two
  // landings at one link settle nowhere on the chain: the struck fire keeps the house lit.
  // A COMMIT THAT MUST NOT SUPERSEDE (the kukulu lei's, blind read F5) refuses on this very fold, so no check-then-write gap lets it
  // replace a hand's commit that rested in between.
  // A STALE live commit (`keeperPendingStale`: a self-commit, or one a keeper of another closure rested) binds nothing the hand still
  // stands behind, so a lei commit supersedes it on this same fold; a live, current commit still refuses.
  if (at.noSupersede === true && ((fold.pending !== null && keeperPendingStale(fold.pending, at.closure) === null) || fold.forkCommits.length > 0)) return refuse("keeper-lei-hand-pending", `a live keeper commit already names ${fold.pending?.next ?? "a closure"}, and a lei never supersedes a commit: the next lares rite kukulu that raises that closure vests it, or name the successor by hand: lares pulama keeper-commit on a terminal (it supersedes)`);
  if (fold.fork && fold.forkCommits.length === 0) return refuse("fork", "the keeper chain reads two landings at one link, which no commit settles; read them with `lares pulama status`, and light the successor by hand (the struck fire): lares rite kukulu on a terminal");
  // THE CARRIED CO-SIGN names the commit's nonce (the co-sign's digest binds it), so the nonce comes with it; else the keeper mints one.
  const carried = at.cosign === undefined || at.cosign === null ? null : at.cosign as { readonly nonce?: unknown; readonly faces?: unknown };
  if (carried !== null && (typeof carried !== "object" || typeof carried.nonce !== "string" || !KEEPER_NONCE.test(carried.nonce) || !Array.isArray(carried.faces)))
    return refuse("vest-cosign-refused", "the carried co-sign reads `{nonce: <64 hex>, faces: [...]}` as `lares intent keeper-cosign` prints it; ask it again: lares pulama keeper-commit");
  const v = fold.v + 1, nonce = carried !== null ? carried.nonce as string : randomUUID();
  const cosigns = carried !== null ? carried.faces as KeeperCosign[] : null;
  // The carried rosters count the devices where the shim passed no count: the co-sign read each face's fold already.
  const devices = at.devices ?? (cosigns !== null ? Math.max(0, ...cosigns.map((c) => (Array.isArray(c?.devices) ? c.devices.length : 0))) || null : null);
  const wrong = cosignsRefusal({ next: at.next, prev: fold.tip, nonce, faces: at.faces, devices }, cosigns);
  if (wrong !== null) return wrong;
  const tessera = sha256HexBytesSync(canonicalJsonBytes({ v, prev: fold.tip, next: at.next, nonce }));
  const supersedes = fold.pending?.begun ?? null, settles = fold.forkCommits;
  const act = await signPulamaRecord<"keeper-begun">({ act: "keeper-begun", tessera, v, prev: fold.tip, closure: at.closure, next: at.next, image: at.image, faces: at.faces, worn: at.worn, budget: { spent: at.spent }, supersedes, ...(settles.length > 0 ? { settles: [...settles] } : {}), nonce, devices, cosigns, ...(at.licensed ? { licensed: at.licensed } : {}) }, by);
  if (!(await records.writeNew(pulamaKeeperTitle(tessera, "guest"), JSON.stringify(act)))) return cosigns !== null
    ? refuse("vest-cosign-spent", "this co-sign rode a commit already (its nonce names that commit's tessera), and a co-sign spends once; ask a fresh one: lares pulama keeper-commit")
    : refuse("keeper-begun-stands", `a guest half already rests for tessera ${tessera}`);
  return { tessera, v, next: at.next, supersedes };
}

/**
 * What the vest seals: the house's end of the bond and the budget (the keeper's and each face's), nothing of the human's. THE KEYS
 * RIDE AS BYTES (blind read F8): the plaintext packs them raw and the open hands back fresh Uint8Arrays, so no key ever stands as an
 * immutable hex string a receiver cannot zero; the receiver zero-fills `node` and each `fck` when it settles (`keeperPayloadDrop`).
 */
export interface VestPayload {
  readonly node: Uint8Array;
  readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: Uint8Array; readonly spent: number }>;
  readonly spent: number; readonly worn: number | null;
}
/** THE WIRE VERSION THIS IMAGE WRITES. THE READER RULE: a reader accepts every version an older image could write (each frozen as
 *  a golden slot in `pulama-keeper.test.ts`), so a successor never locks on a slot its elder sealed; a new version adds its golden. */
const PAYLOAD_V = 1, KEY = 32;
/** Pack a payload: v1 · node(32) · spent u32 · worn i32 (-1 null) · faces u16 · each [fcid u16+utf8 · ordinal u32 · fck(32) · spent u32]. */
function packPayload(p: { readonly node: Uint8Array; readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: Uint8Array; readonly spent: number }>; readonly spent: number; readonly worn: number | null }): Uint8Array {
  const ids = p.faces.map((f) => new TextEncoder().encode(f.fcid));
  const out = new Uint8Array(1 + KEY + 4 + 4 + 2 + ids.reduce((n, id) => n + 2 + id.length + 4 + KEY + 4, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  out[at++] = PAYLOAD_V; out.set(p.node, at); at += KEY;
  view.setUint32(at, p.spent); at += 4; view.setInt32(at, p.worn ?? -1); at += 4; view.setUint16(at, p.faces.length); at += 2;
  p.faces.forEach((f, i) => {
    view.setUint16(at, ids[i]!.length); at += 2; out.set(ids[i]!, at); at += ids[i]!.length;
    view.setUint32(at, f.ordinal); at += 4; out.set(f.fck, at); at += KEY; view.setUint32(at, f.spent); at += 4;
  });
  return out;
}
/** Read a packed payload into fresh key buffers; null where it reads short or under another version. */
function unpackPayload(b: Uint8Array): VestPayload | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 0;
  const need = (n: number): boolean => at + n <= b.length;
  if (!need(1 + KEY + 10) || b[at++] !== PAYLOAD_V) return null;
  const node = b.slice(at, at + KEY); at += KEY;
  const spent = view.getUint32(at); at += 4; const wornRaw = view.getInt32(at); at += 4; const n = view.getUint16(at); at += 2;
  const faces: { fcid: string; ordinal: number; fck: Uint8Array; spent: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!need(2)) { node.fill(0); for (const f of faces) f.fck.fill(0); return null; }
    const len = view.getUint16(at); at += 2;
    if (!need(len + 4 + KEY + 4)) { node.fill(0); for (const f of faces) f.fck.fill(0); return null; }
    const fcid = new TextDecoder().decode(b.subarray(at, at + len)); at += len;
    const ordinal = view.getUint32(at); at += 4; const fck = b.slice(at, at + KEY); at += KEY; const fspent = view.getUint32(at); at += 4;
    faces.push({ fcid, ordinal, fck, spent: fspent });
  }
  if (at !== b.length) { node.fill(0); for (const f of faces) f.fck.fill(0); return null; }
  return { node, faces, spent, worn: wornRaw < 0 ? null : wornRaw };
}
/** Zero every key a payload carries. */
export function keeperPayloadDrop(p: VestPayload): void { p.node.fill(0); for (const f of p.faces) f.fck.fill(0); }

/** The live rite a vest rides, as the pūlama reads the offer: each lent face's rite tessera it began, and the faces' device count. */
/** One face a rite's vouch names, as the keeper maps it: its ordinal (off this keeper's own holder), the group the vessel signed,
 *  and the device count the vouch carries. */
export interface KeeperVouchedFace { readonly ordinal: number; readonly group: string; readonly devices: number; readonly branch?: string; readonly head?: string; readonly tree?: string }
/** What a begun rite answers: the tesserae it rested, or why it began nothing. */
export type KeeperRiteBegun = { readonly ok: true; readonly rite: readonly string[]; readonly leis?: readonly { readonly lei: string; readonly n: number }[] } | { readonly ok: false; readonly refusal: string; readonly detail: string; readonly begun?: readonly string[] };
/** The live rite as the vest reads it: every vouch verified, each face it names, and a `begin` the vest calls only after every
 *  check passes, so a refusal spends no lei return and rests no begun half. */
export type KeeperRiteReading = { readonly ok: true; readonly devices: number; readonly faces: readonly KeeperVouchedFace[]; readonly begin: () => Promise<KeeperRiteBegun> } | { readonly ok: false; readonly refusal: string; readonly detail: string };
/** The keys a vest seals, copied out of the lit holder for one seal (the caller's copies zero-fill after). */
export type KeeperKeys = { readonly treeKey: Uint8Array; readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: Uint8Array; readonly spent?: number }> };

/**
 * THE VOUCH MAPS EACH ORDINAL TO ITS GROUP (coordinator ruling, 2026-11-23): a carried co-sign answers its face only where the rite's
 * vessel-signed vouch names a face at that ordinal under the same group and the same device count the co-signed roster binds. So a
 * co-sign spent on another of the operator's faces never answers this one.
 */
function vouchedCosignRefusal(faces: readonly KeeperVouchedFace[], body: KeeperBegunBody): KeeperRefusal | null {
  const cure = "commit again with each face's own co-sign: lares pulama keeper-commit, or light the successor by hand: lares rite kukulu on a terminal";
  if (!Array.isArray(body.cosigns)) {
    const owed = faces.find((f) => f.devices > 1);
    return owed ? refuse("vest-cosign-owed", `the rite's vouch names h${owed.ordinal} with ${owed.devices} devices, and the commit carries no co-sign; ${cure}`) : null;
  }
  for (const c of body.cosigns) {
    const vouched = faces.filter((f) => f.ordinal === c.ordinal);
    if (vouched.length !== 1) return refuse("vest-cosign-refused", `the rite's vouch names ${vouched.length === 0 ? "no face" : "two faces"} at h${c.ordinal}, which a co-sign answers; ${cure}`);
    if (vouched[0]!.group !== c.group) return refuse("vest-cosign-refused", `the co-sign of h${c.ordinal} answers another group than the face the rite's vouch names there; ${cure}`);
    if (vouched[0]!.devices !== c.devices.length) return refuse("vest-cosign-refused", `the rite's vouch counts ${vouched[0]!.devices} device(s) at h${c.ordinal}, and its co-sign's roster binds ${c.devices.length}; ${cure}`);
  }
  for (const f of faces) if (f.devices > 1 && !body.cosigns.some((c) => c.ordinal === f.ordinal)) return refuse("vest-cosign-owed", `the rite's vouch names h${f.ordinal} with ${f.devices} devices, and the commit carries no co-sign for it; ${cure}`);
  return null;
}

/**
 * EVERY FACE THE VEST WOULD SEAL STANDS VOUCHED (blind read F1): the keeper seals each face it holds open, so each such face, and each
 * face the commit names, must stand in the rite's vouches with a count of its own; a face the vessel never vouched (its device count
 * read nowhere) lapses `vest-devices-unread` before any key leaves.
 */
function sealedFacesRefusal(faces: readonly KeeperVouchedFace[], sealed: readonly number[], committed: readonly AdmittedFace[]): KeeperRefusal | null {
  const vouched = new Map(faces.map((f) => [f.ordinal, f.devices] as const));
  const short = [...new Set([...sealed, ...committed.map((f) => f.ordinal)])].sort((x, y) => x - y).filter((o) => !((vouched.get(o) ?? 0) >= 1));
  if (short.length === 0) return null;
  return refuse("vest-devices-unread", `this keeper holds ${short.map((o) => `h${o}`).join(", ")} open (or the commit names it), and the rite's vouches count no devices there, so the vest cannot tell whether it owes a co-sign; raise the rite with every lit face lent: lares rite kukulu, or commit again with the vessel standing: lares pulama keeper-commit`);
}

/** Past one device the commit owes its carried co-sign, read offline against the commit it rides and the count `where` names. */
const coSignRefusal = (devices: number | null, where: string, body: KeeperBegunBody): KeeperRefusal | null => {
  if (devices === null || devices < 1) return refuse("vest-devices-unread", `${where} carries no device count, so the vest cannot tell whether it owes a co-sign; commit again with the vessel standing: lares pulama keeper-commit, or light the successor by hand (the struck fire): lares rite kukulu on a terminal`);
  if (devices < 2) return null;
  if (body.cosigns === null || body.cosigns === undefined) return refuse("vest-cosign-owed", `${where} names a face of ${devices} devices, and the commit carries no co-sign; commit again while a second device of the face approves the ask in its ward dialog: lares pulama keeper-commit, or light the successor by hand (the struck fire): lares rite kukulu on a terminal`);
  return cosignsRefusal({ next: body.next, prev: body.prev, nonce: body.nonce, faces: body.faces, devices }, body.cosigns);
};

/**
 * THE VEST, OUTGOING (the lit keeper, no route: the human's consent rode the commit). It proceeds only inside a live kūkulu rite
 * (`rite`: the offer's vouches name this keeper move and the vest's own begin claims a lei return), only where the successor's
 * host-reported closure equals the committed `next`, only for faces of one device, and never past the scheduled struck fire.
 *
 * ONE RITE ATTEMPT PER COMMIT: once the live commit stands, any refusal rests `keeper-lapsed` at the commit's mark, and a vest rests
 * `keeper-vested` there, so the commit spends either way and no stale commit waits for a later frame. A crash after the mark leaves
 * the lit fire burning; the next try refuses `vest-spent`, and the hand relights struck (`lares rite kukulu` on a terminal).
 */
export async function keeperVest(records: SwarmWikiPort, by: KukuluSigner, at: {
  readonly to: string; readonly closure: string;
  readonly rite: (keeper: { readonly to: string; readonly next: string }) => Promise<KeeperRiteReading>;
  readonly keys: () => KeeperKeys | null;
  readonly spent: number; readonly worn: number | null;
  /** THE KEEPER LEI'S FLOOR at the vest (blind read F6): off, a commit the kukulu lei licensed lapses. Absent: `KEEPER_LEI_STANDS`. */
  readonly leiFloor?: boolean;
}): Promise<{ readonly slot: SignedPulamaAdmit; readonly tessera: string; readonly faces: readonly number[]; readonly rite: readonly string[] } | KeeperRefusal> {
  if (!/^[0-9a-f]{64}$/.test(at.to)) return refuse("vest-key-malformed", "the successor's key reads 64 hex (an X25519 public key)");
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", fold.forkCommits.length > 0
    ? "the keeper chain reads two live commits at one link; nothing vests: a fresh commit settles both (`lares pulama keeper-commit` on a terminal), or light the successor by hand: lares rite kukulu"
    : "the keeper chain reads two landings at one link; nothing vests: read them with `lares pulama status`, and light the successor by hand (the struck fire): lares rite kukulu on a terminal");
  if (fold.pending === null) return refuse("commit-absent", "no live keeper commit names a successor closure, so no key vests: commit one on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
  const { tessera, begun, next } = fold.pending;
  // FROM HERE THE ATTEMPT SPENDS THE COMMIT: a refusal lapses it by name.
  const lapse = async (why: KeeperRefusal, halves: readonly string[] = []): Promise<KeeperRefusal> => {
    const mark = await signPulamaRecord<"keeper-lapsed">({ act: "keeper-lapsed", tessera, begun, reason: why.refusal, ...(halves.length > 0 ? { halves: [...halves] } : {}), nonce: randomUUID() }, by);
    return (await records.writeNew(pulamaKeeperTitle(tessera, "vest"), JSON.stringify(mark))) ? why : refuse("vest-spent", "this commit already spent its one rite attempt; commit again on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
  };
  if (fold.struckDue) return lapse(refuse("struck-due", `${fold.vestings} handed links stand in a row; light this successor by passphrase (the struck fire): lares rite kukulu on a terminal, and the run starts over`));
  // A COMMIT THE KUKULU LEI LICENSED vests only under a standing floor (F6) and over vouches naming its own branch, revision and tree (F3).
  const license = fold.pending.body.licensed;
  if (license !== undefined && !(at.leiFloor ?? KEEPER_LEI_STANDS)) return lapse(refuse("keeper-lei-floor-off", "the keeper lei's floor stands off in this keeper's code (KEEPER_LEI_STANDS), so the commit the kukulu lei licensed vests nothing; name the successor by hand: lares pulama keeper-commit on a terminal, or light it by hand: lares rite kukulu on a terminal"));
  const early = coSignRefusal(fold.pending.devices, "the commit", fold.pending.body);
  if (early !== null) return lapse(early);
  if (at.closure !== next) return lapse(refuse("closure-differs", `the successor reports closure ${at.closure}, and the commit names ${next}; nothing vests and the old fire still burns: commit the closure you mean (\`lares pulama keeper-commit\`), or light the successor by hand: lares rite kukulu`));
  const rite = await at.rite({ to: at.to, next });
  if (!rite.ok) return lapse(refuse(rite.refusal, rite.detail));
  const late = coSignRefusal(rite.devices, "the rite's vouch", fold.pending.body);
  if (late !== null) return lapse(late);
  if (license !== undefined) {
    const off = rite.faces.find((f) => f.branch !== license.branch || f.head !== license.rev || f.tree !== license.tree);
    if (off !== undefined) return lapse(refuse("keeper-lei-vouch-differs", `the rite's vouch for h${off.ordinal} names ${off.branch ?? "no branch"} at ${off.head ?? "no head"}, and the kukulu lei licensed ${license.branch} at ${license.rev}; nothing vests: run lares rite kukulu again over that revision, or name the successor by hand: lares pulama keeper-commit on a terminal`));
  }
  const mapped = vouchedCosignRefusal(rite.faces, fold.pending.body);
  if (mapped !== null) return lapse(mapped);
  const keys = at.keys();
  if (keys === null) return lapse(refuse("pulama-locked", "this keeper holds no key to vest; light the successor by hand: lares rite kukulu on a terminal"));
  try {
    const unvouched = sealedFacesRefusal(rite.faces, keys.faces.map((f) => f.ordinal), fold.pending.body.faces);
    if (unvouched !== null) return lapse(unvouched);
    // EVERY CHECK PASSED: only now does the rite begin (it claims a lei return and rests its begun half), and only then does a key leave.
    const started = await rite.begin();
    if (!started.ok) return lapse(refuse(started.refusal, started.detail), started.begun ?? []);
    const mark = await signPulamaRecord<"keeper-vested">({ act: "keeper-vested", tessera, begun, next, to: sha256HexBytesSync(unhex(at.to)), node: true, faces: keys.faces.map((f) => f.fcid), nonce: randomUUID(), rite: [...started.rite], ...(started.leis && started.leis.length > 0 ? { leis: started.leis.map((l) => ({ lei: l.lei, n: l.n })) } : {}) }, by);
    if (!(await records.writeNew(pulamaKeeperTitle(tessera, "vest"), JSON.stringify(mark)))) return refuse("vest-spent", "this commit already spent its one rite attempt; commit again on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
    const plain = packPayload({ node: keys.treeKey, faces: keys.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal, fck: f.fck, spent: f.spent ?? 0 })), spent: at.spent, worn: at.worn });
    let box;
    try { box = sealToRecipient({ recipientPub: unhex(at.to), plaintext: plain, info: VEST_INFO, extraSalt: [unhex(begun), new TextEncoder().encode(next)] }); } finally { plain.fill(0); }
    const slot = await signPulamaRecord<"keeper-slot">({ act: "keeper-slot", tessera, begun, next, to: at.to, box: { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) } }, by);
    return { slot, tessera, faces: keys.faces.map((f) => f.ordinal).sort((x, y) => x - y), rite: started.rite };
  } finally {
    keys.treeKey.fill(0);
    for (const f of keys.faces) f.fck.fill(0);
  }
}

/** Open one slot under a one-handoff secret and read its payload; null where it opens under no key or reads no version this image
 *  accepts. The caller owns the secret's zeroing. */
export function keeperSlotOpen(secret: Uint8Array, slot: KeeperSlotBody): VestPayload | null {
  const plain = openFromSender({ recipientSecret: secret, senderEphemeralPub: unhex(slot.box.e), aeadNonce: unhex(slot.box.n), ciphertext: unhex(slot.box.c), info: VEST_INFO, extraSalt: [unhex(slot.begun), new TextEncoder().encode(slot.next)] });
  if (plain === null) return null;
  try { return unpackPayload(plain); } finally { plain.fill(0); }
}

/** The successor's one-handoff key: minted at its offer, zero-filled at its first open, so a slot spends once. */
export interface KeeperEphemeral { readonly pub: string; open(slot: KeeperSlotBody): VestPayload | null; spent(): boolean; drop(): void }
export function keeperEphemeral(): KeeperEphemeral {
  const minted = mintSealedBoxRecipient();
  const secret = minted.secret, pub = hex(minted.pub);
  let used = false;
  return {
    pub,
    open(slot) {
      if (used) return null;
      used = true;
      try { return keeperSlotOpen(secret, slot); } finally { secret.fill(0); }
    },
    spent: () => used,
    drop() { used = true; secret.fill(0); },
  };
}

/** The slot's shape, read before anything opens. */
export function keeperSlotOf(raw: unknown): SignedPulamaAdmit & { readonly body: KeeperSlotBody } | null {
  const s = raw as { body?: Partial<KeeperSlotBody>; signer?: unknown; sig?: unknown } | null;
  const b = s?.body, box = b?.box;
  if (typeof s !== "object" || s === null || typeof s.signer !== "string" || typeof s.sig !== "string" || typeof b !== "object" || b === null) return null;
  if (b.act !== "keeper-slot" || typeof b.tessera !== "string" || typeof b.begun !== "string" || typeof b.next !== "string" || typeof b.to !== "string") return null;
  if (typeof box !== "object" || box === null || typeof box.e !== "string" || typeof box.n !== "string" || typeof box.c !== "string") return null;
  return s as SignedPulamaAdmit & { readonly body: KeeperSlotBody };
}

/**
 * KEEPER-LAND: rest the host half over the live commit and read the pair. The successor's own reported closure, image, lit faces and
 * worn ordinal ride it, and `vest` names what a vest handed (null where the hand's light lit it). A landing writes once.
 */
export async function keeperLand(records: SwarmWikiPort, by: KukuluSigner, at: KeeperStanding & { readonly vest: KeeperVest | null; readonly tessera?: string }): Promise<{ readonly pair: KeeperPair; readonly fold: KeeperFold } | KeeperRefusal> {
  const before = await keeperFold(records, by);
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so it cannot say what it stands on");
  // A VESTED SUCCESSOR lands the commit its slot names, which the vest spent; the hand's struck light lands the live, unspent one.
  const pending = at.vest !== null ? (before.vested !== null && before.vested.tessera === at.tessera ? before.vested : null) : before.pending;
  if (pending === null || (at.tessera !== undefined && pending.tessera !== at.tessera)) {
    const landed = at.tessera !== undefined && (await records.read(pulamaKeeperTitle(at.tessera, "host"))) !== null;
    return landed ? refuse("keeper-already-landed", `a host half already rests for tessera ${at.tessera}; a landing writes once`)
      : refuse(before.fork ? "fork" : "begun-absent", before.fork ? (before.forkCommits.length > 0 ? "the keeper chain reads two live commits at one link; nothing lands: a fresh commit settles both (`lares pulama keeper-commit` on a terminal)" : "the keeper chain reads two landings at one link; nothing lands: read them with `lares pulama status`, and keep the struck fire lit: lares rite kukulu on a terminal") : "no live keeper commit stands to land; commit one on a terminal: lares pulama keeper-commit");
  }
  const vestings = at.vest === null ? 0 : before.vestings + 1;
  const act = await signPulamaRecord<"keeper-landed">({ act: "keeper-landed", tessera: pending.tessera, v: pending.v, prev: pending.begun, begun: pending.begun, closure: at.closure, image: at.image, faces: at.faces, worn: at.worn, budget: { spent: at.spent }, vestings, vest: at.vest, nonce: randomUUID() }, by);
  if (!(await records.writeNew(pulamaKeeperTitle(pending.tessera, "host"), JSON.stringify(act)))) return refuse("keeper-already-landed", `a host half already rests for tessera ${pending.tessera}; a landing writes once`);
  const fold = await keeperFold(records, by);
  return { pair: fold.pairs.find((p) => p.tessera === pending.tessera)!, fold };
}

/** The slot's binding, read once the node key the vest carried opens the pūlama's key: who signed, to whom, over which commit. */
export async function keeperSlotBinds(records: SwarmWikiPort, by: KukuluSigner, slot: SignedPulamaAdmit & { readonly body: KeeperSlotBody }, at: { readonly to: string; readonly closure: string | null }): Promise<KeeperRefusal | null> {
  // THE SLOT VERIFIES UNDER THE KEY THE VEST'S OWN NODE KEY DERIVES: only a holder of this house's custody root signed it.
  if (verifiedPulamaRecord(JSON.stringify(slot), by.key) === null) return refuse("slot-refused", "the slot verifies under no key this house's custody root derives");
  if (slot.body.to !== at.to) return refuse("slot-names-another", "the slot names another successor key than this keeper's offer");
  if (at.closure === null || slot.body.next !== at.closure) return refuse("closure-differs", `the slot binds ${slot.body.next}, and this keeper's host reports ${at.closure ?? "no closure"}`);
  const begun = verifiedPulamaRecord(await records.read(pulamaKeeperTitle(slot.body.tessera, "guest")), by.key);
  if (begun === null || begun.body.act !== "keeper-begun" || pulamaRecordCid(begun) !== slot.body.begun || begun.body.next !== slot.body.next) return refuse("begun-absent", "no guest half under this house's key names the commit the slot binds");
  const mark = verifiedPulamaRecord(await records.read(pulamaKeeperTitle(slot.body.tessera, "vest")), by.key);
  if (mark === null || mark.body.act !== "keeper-vested" || mark.body.begun !== slot.body.begun || mark.body.to !== sha256HexBytesSync(unhex(at.to))) return refuse("vest-unwitnessed", "no spend mark names this vest to this keeper's key");
  return null;
}

// ── THE KEEPER LEI: the kukulu lei licenses the handed fire ─────────────────────────────────────────
// Operator ruling, 2026-11-24: //"A keeper-lei should not have its own count (that's friction), it should just consume the kukulu
// lei if that has uses available."// No record family and no tally of its own: a commit with no route rests where the host testifies
// a standing kukulu lei on the branch holds returns, and the live rite the vest rides spends that lei's return (the SAME return the rite
// spends for the lent face; the keeper commit takes no extra one). The vest names each lei return that licensed it.
// Meme: lar:///ha.ka.ba/kahua/memory/research/keeper-lei#/shape
const REV = /^[0-9a-f]{40}$/, CI_GREEN = /^[0-9]+:success$/;

/** What the host testifies beside a commit the kukulu lei licenses: it read the revision, the closure tool twice and the CI run;
 *  the pūlama reads none of them. */
export interface KeeperLeiTestimony { readonly branch: string; readonly rev: string; readonly tree: string; readonly recheck: string; readonly image: string; readonly ci: string }

/** One keeper commit the kukulu lei licensed, as `status` names it: its link, its closure, the host's testimony, and (once vested)
 *  each kukulu lei return the vest's live rite spent on it. */
export interface KeeperLicensedCommit {
  readonly tessera: string; readonly v: number; readonly next: string; readonly branch: string; readonly rev: string; readonly ci: string;
  readonly vested: boolean; readonly leis: readonly { readonly lei: string; readonly n: number }[];
}

/** Every keeper commit the kukulu lei licensed, by link (status reads it; a routed commit names none). */
export async function keeperLicensed(records: SwarmWikiPort, by: KukuluSigner): Promise<readonly KeeperLicensedCommit[]> {
  const rows = await rowsOf(records, by);
  const out: KeeperLicensedCommit[] = [];
  for (const [tessera, b] of rows.begun) {
    if (b === "refused" || b.body.licensed === undefined) continue;
    const l = b.body.licensed, vest = rows.vested.get(tessera);
    out.push({ tessera, v: b.body.v, next: b.body.next, branch: l.branch, rev: l.rev, ci: l.ci, vested: vest?.begun === b.cid, leis: vest?.begun === b.cid ? [...(vest.leis ?? [])] : [] });
  }
  return out.sort((x, y) => x.v - y.v || x.tessera.localeCompare(y.tessera));
}

/**
 * THE COMMIT THE KUKULU LEI LICENSES (no route): rest ONE keeper commit naming `next`, as the routed path rests one, its body naming
 * the license and the host's testimony. It refuses, before anything rests, on the floor off, a face of more than one device,
 * testimony that does not hold (the image label must equal `next`, the recheck read the same, the CI run green), a fork, a live hand
 * commit (a lei never supersedes a commit), a vested commit not yet landed, a red last pair, or the struck fire due. The kukulu lei's
 * return binds at the vest: the vest rides a live rite whose begin claims that lei's return, and with none the commit lapses.
 */
export async function keeperCommitByLei(records: SwarmWikiPort, by: KukuluSigner, at: KeeperStanding & KeeperLeiTestimony & { readonly next: string; readonly devices: number | null; readonly floor?: boolean }): Promise<{ readonly tessera: string; readonly v: number; readonly next: string; readonly branch: string } | KeeperRefusal> {
  const routed = "name the successor by hand: lares pulama keeper-commit on a terminal";
  if (!(at.floor ?? KEEPER_LEI_STANDS)) return refuse("keeper-lei-floor-off", `the keeper lei's floor stands off in this keeper's code (KEEPER_LEI_STANDS), so no kukulu lei licenses a commit; ${routed}`);
  if (!CLOSURE.test(at.next)) return refuse("next-malformed", "the successor's closure reads `sha256:<64 hex>`, as tools/pulama-closure.mjs prints it");
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so the chain cannot name what it hands from; tools/lares-container.sh up reports it");
  if (at.devices === null) return refuse("keeper-lei-devices-unread", `the host read no device count for the lit faces, so the commit cannot tell whether it owes a co-sign; stand the vessel and run lares rite kukulu again, or ${routed}`);
  if (at.devices !== 1) return refuse("keeper-lei-cosign-owed", `a lit face holds ${at.devices} devices, and the kukulu lei licenses the handed fire for one-device faces alone (a two-device face owes a co-sign over each D′); ${routed} (it asks the co-sign)`);
  if (at.branch === "" || /\s/.test(at.branch)) return refuse("keeper-lei-testimony-malformed", `the host names the branch whose kukulu lei licenses the commit; run lares rite kukulu again, or ${routed}`);
  if (!REV.test(at.rev) || !REV.test(at.tree)) return refuse("keeper-lei-testimony-malformed", `the host names the revision and its source tree as 40 hex each; run lares rite kukulu again, or ${routed}`);
  if (at.recheck !== "same") return refuse("keeper-lei-recheck-differs", `the second fresh-archive closure of ${at.rev} did not read the same; ${routed}`);
  if (at.image !== at.next) return refuse("keeper-lei-image-differs", `the built image's closure label reads ${at.image}, and the revision's archive reads ${at.next}; rebuild the image from that revision (lares rite kukulu), or ${routed}`);
  if (!CI_GREEN.test(at.ci)) return refuse("keeper-lei-ci-red", `the CI push run on ${at.rev} reads ${at.ci || "none"}, never success; wait for it to land green (gh run list --commit ${at.rev} --workflow CI), or ${routed}`);
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", `the keeper chain reads a fork; read it with lares pulama status, and ${routed}`);
  if (fold.pending !== null && keeperPendingStale(fold.pending, at.closure) === null) return refuse("keeper-lei-hand-pending", `a live keeper commit already names ${fold.pending.next} from the closure this keeper runs, and a lei never supersedes a current commit: the next lares rite kukulu that raises that closure vests it, or ${routed} (it supersedes)`);
  if (fold.vested !== null) return refuse("keeper-lei-vested-unlanded", `the commit naming ${fold.vested.next} vested and no landing names it yet; finish the handoff: lares rite kukulu (or relight one keeper by passphrase on a terminal)`);
  const last = fold.pairs.at(-1);
  if (last !== undefined && !last.par) return refuse("keeper-lei-red", `the last keeper pair reads red (${last.red ?? "red"}); read it with lares pulama status, and light the successor by passphrase: lares rite kukulu on a terminal`);
  if (fold.struckDue) return refuse("struck-due", `${fold.vestings} handed links stand in a row; light this successor by passphrase (the struck fire): lares rite kukulu on a terminal`);
  const out = await keeperCommit(records, by, { ...at, cosign: null, noSupersede: true, licensed: { by: "kukulu-lei", branch: at.branch, rev: at.rev, tree: at.tree, recheck: "same", image: at.image, ci: at.ci } });
  if ("refusal" in out) return out;
  return { tessera: out.tessera, v: out.v, next: out.next, branch: at.branch };
}

/**
 * WHY A LIVE COMMIT READS STALE (closures and rows alone; no clock decides), or null where it still binds:
 * - `self-commit`: its `next` equals the closure it handed from, so it moves nothing;
 * - `keeper-moved`: the keeper now runs (`closure`) another closure than the one it handed from, and not the one it names (a
 *   keeper that runs the named closure arrived there, and the commit waits for its landing).
 * A lei commit supersedes a stale commit; a live, current hand commit (handed from the running closure, naming another) stays
 * sovereign. An unreported running closure reads `self-commit` alone.
 */
export type KeeperStale = "self-commit" | "keeper-moved";
export function keeperPendingStale(pending: KeeperFold["pending"], closure: string | null): KeeperStale | null {
  if (pending === null) return null;
  const from = pending.body.closure;
  if (pending.next === from) return "self-commit";
  if (closure !== null && closure !== from && closure !== pending.next) return "keeper-moved";
  return null;
}

/** Whether the kukulu lei could license a commit now (the `status` hint the host's stand reading follows): every pūlama-side bound
 *  but the testimony and the lei itself, which the host reads (`lares lei show`) and the vest's rite spends. A stale live commit
 *  (`keeperPendingStale` over the running `closure`) reads as none, since the lei's commit supersedes it. */
export function keeperLeiReady(fold: KeeperFold, floor: boolean = KEEPER_LEI_STANDS, closure: string | null = null): boolean {
  const last = fold.pairs.at(-1);
  return floor && !fold.fork && (fold.pending === null || keeperPendingStale(fold.pending, closure) !== null) && fold.vested === null && !fold.struckDue && (last === undefined || last.par);
}
