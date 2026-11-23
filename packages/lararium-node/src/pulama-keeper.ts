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
 * from the old keeper's hand door to the successor's, and NEVER rests on disk; the successor's ephemeral secret zero-fills on its
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
 * rite read it early). Past one device a vest owes a co-sign that no path carries yet, so it refuses `vest-cosign-owed`; a count read
 * nowhere refuses `vest-devices-unread`. Both name the struck fire as the cure. Each per-face budget carries with the vest too.
 *
 * THE SCHEDULED STRUCK FIRE: after `KEEPER_STRUCK_EVERY` handed links in a row, the vest refuses `struck-due` and the hand lights the
 * successor by passphrase, which keeps the human's route practiced. Count-based down the chain, no clock.
 * Meme: lar:///ha.ka.ba/kahua/memory/research/keeper-tessera#/vesting
 */
import { randomUUID } from "node:crypto";
import { canonicalJsonBytes, mintSealedBoxRecipient, openFromSender, sealToRecipient, sha256HexBytesSync, type SwarmWikiPort } from "@lararium/mesh";
import type { KukuluSigner } from "./kukulu-gate.js";
import {
  pulamaRecordCid, signPulamaRecord, verifiedPulamaRecord,
  type AdmittedFace, type KeeperBegunBody, type KeeperLandedBody, type KeeperSlotBody, type KeeperVest, type KeeperVestedBody, type SignedPulamaAdmit,
} from "./pulama-admit.js";

/** Handed links in a row before the vest refuses and the hand strikes the fire anew (the lei's explicit-confirm threshold). */
export const KEEPER_STRUCK_EVERY = 12;
const PREFIX = "$:/lares/pulama/keeper/";
export const pulamaKeeperPrefix = (): string => PREFIX;
export const pulamaKeeperTitle = (tessera: string, half: "guest" | "host" | "vest"): string => `${PREFIX}${tessera}/${half}`;
/** A closure as `tools/pulama-closure.mjs` prints it. */
export const CLOSURE = /^sha256:[0-9a-f]{64}$/;
const VEST_INFO = new TextEncoder().encode("lares/pulama/keeper-vest/v1");
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const unhex = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, "hex"));

export type KeeperRed = "begun-refused" | "landed-refused" | "begun-absent" | "landed-names-another" | "version-skew" | "closure-differs" | "faces-short" | "vest-unwitnessed" | "fork";
export interface KeeperPair { readonly tessera: string; readonly v: number | null; readonly begun: string | null; readonly landed: string | null; readonly par: boolean; readonly red?: KeeperRed; readonly vest: boolean }
/** The chain as the status fold reads it: its tip, each landed pair, the live commit, the handed run and the struck fire due. */
export interface KeeperFold {
  readonly v: number;
  readonly tip: string | null;
  readonly pairs: readonly KeeperPair[];
  readonly pending: { readonly tessera: string; readonly v: number; readonly next: string; readonly begun: string; readonly devices: number | null } | null;
  readonly vestings: number;
  readonly struckDue: boolean;
  readonly fork: boolean;
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
  let tip: Landed | null = null, fork = false;
  for (let v = 1; landedAt.has(v); v++) {
    const par = landedAt.get(v)!.filter((l) => { const b = beginOf(l); return b !== null && keeperRed(b, l, rows, tip?.cid ?? null) === null; });
    if (par.length > 1) { fork = true; break; }
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
  const superseded = new Set([...rows.begun.values()].flatMap((b) => (b !== "refused" && b.body.supersedes !== null ? [b.body.supersedes] : [])));
  const live = open.filter((b) => !superseded.has(b.cid));
  if (live.length > 1) fork = true;
  const pending = live.length === 1 ? { tessera: live[0]!.body.tessera, v: live[0]!.body.v, next: live[0]!.body.next, begun: live[0]!.cid, devices: typeof live[0]!.body.devices === "number" ? live[0]!.body.devices : null } : null;
  const vestings = tip?.body.vestings ?? 0;
  const spentBy = [...rows.begun].flatMap(([t, b]) => (b !== "refused" && !rows.landed.has(t) && linked(b) && rows.vested.get(t)?.begun === b.cid ? [b] : []));
  const vested = spentBy.length === 1 ? { tessera: spentBy[0]!.body.tessera, v: spentBy[0]!.body.v, next: spentBy[0]!.body.next, begun: spentBy[0]!.cid } : null;
  return { v: tip?.body.v ?? 0, tip: tip?.cid ?? null, pairs, pending: fork ? null : pending, vestings, struckDue: vestings >= KEEPER_STRUCK_EVERY, fork, vested: fork ? null : vested };
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
export async function keeperCommit(records: SwarmWikiPort, by: KukuluSigner, at: KeeperStanding & { readonly next: string; readonly devices: number | null }): Promise<{ readonly tessera: string; readonly v: number; readonly next: string; readonly supersedes: string | null } | KeeperRefusal> {
  if (!CLOSURE.test(at.next)) return refuse("next-malformed", "the successor's closure reads `sha256:<64 hex>`, as tools/pulama-closure.mjs prints it");
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so the chain cannot name what it hands from");
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", "the keeper chain reads a fork (two commits or two landings at one link); read `pulama status`, and the hand settles it before a new commit");
  const v = fold.v + 1, nonce = randomUUID();
  const tessera = sha256HexBytesSync(canonicalJsonBytes({ v, prev: fold.tip, next: at.next, nonce }));
  const supersedes = fold.pending?.begun ?? null;
  const act = await signPulamaRecord<"keeper-begun">({ act: "keeper-begun", tessera, v, prev: fold.tip, closure: at.closure, next: at.next, image: at.image, faces: at.faces, worn: at.worn, budget: { spent: at.spent }, supersedes, nonce, devices: at.devices }, by);
  if (!(await records.writeNew(pulamaKeeperTitle(tessera, "guest"), JSON.stringify(act)))) return refuse("keeper-begun-stands", `a guest half already rests for tessera ${tessera}`);
  return { tessera, v, next: at.next, supersedes };
}

/** What the vest seals: the house's end of the bond and the budget (the keeper's and each face's), nothing of the human's. */
interface VestPayload {
  readonly node: string;
  readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: string; readonly spent: number }>;
  readonly spent: number; readonly worn: number | null;
}

/** The live rite a vest rides, as the pūlama reads the offer: each lent face's rite tessera it began, and the faces' device count. */
export type KeeperRiteReading = { readonly ok: true; readonly rite: readonly string[]; readonly devices: number } | { readonly ok: false; readonly refusal: string; readonly detail: string };
/** The keys a vest seals, copied out of the lit holder for one seal (the caller's copies zero-fill after). */
export type KeeperKeys = { readonly treeKey: Uint8Array; readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: Uint8Array; readonly spent?: number }> };

const coSignRefusal = (devices: number | null, where: string): KeeperRefusal | null =>
  devices === null || devices < 1
    ? refuse("vest-devices-unread", `${where} carries no device count, so the vest cannot tell whether a co-sign is owed; light the successor by hand (the struck fire): lares rite kukulu on a terminal`)
    : devices > 1
      ? refuse("vest-cosign-owed", `${where} names a face of ${devices} devices, and a vest of a face of two devices co-signs, which no path carries yet; light the successor by hand (the struck fire): lares rite kukulu on a terminal`)
      : null;

/**
 * THE VEST, OUTGOING (the lit keeper, no route: the human's consent rode the commit). It proceeds only inside a live kūkulu rite
 * (`rite`: the offer's vouches name this keeper move and the vest's own begin claims a lei return), only where the successor's
 * host-reported closure equals the committed `next`, only for faces of one device, and never past the scheduled struck fire.
 *
 * ONE RITE ATTEMPT PER COMMIT: once the live commit stands, any refusal rests `keeper-lapsed` at the commit's mark, and a vest rests
 * `keeper-vested` there, so the commit spends either way and no stale commit waits for a later frame. A crash after the mark leaves
 * the old fire burning; the next try refuses `vest-spent`, and the hand relights struck (`lares rite kukulu` on a terminal).
 */
export async function keeperVest(records: SwarmWikiPort, by: KukuluSigner, at: {
  readonly to: string; readonly closure: string;
  readonly rite: (keeper: { readonly to: string; readonly next: string }) => Promise<KeeperRiteReading>;
  readonly keys: () => KeeperKeys | null;
  readonly spent: number; readonly worn: number | null;
}): Promise<{ readonly slot: SignedPulamaAdmit; readonly tessera: string; readonly faces: readonly number[]; readonly rite: readonly string[] } | KeeperRefusal> {
  if (!/^[0-9a-f]{64}$/.test(at.to)) return refuse("vest-key-malformed", "the successor's key reads 64 hex (an X25519 public key)");
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", "the keeper chain reads a fork; nothing vests: read it with `lares pulama status`, then light the successor by hand: lares rite kukulu on a terminal");
  if (fold.pending === null) return refuse("commit-absent", "no live keeper commit names a successor closure, so no key vests: commit one on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
  const { tessera, begun, next } = fold.pending;
  // FROM HERE THE ATTEMPT SPENDS THE COMMIT: a refusal lapses it by name.
  const lapse = async (why: KeeperRefusal): Promise<KeeperRefusal> => {
    const mark = await signPulamaRecord<"keeper-lapsed">({ act: "keeper-lapsed", tessera, begun, reason: why.refusal, nonce: randomUUID() }, by);
    return (await records.writeNew(pulamaKeeperTitle(tessera, "vest"), JSON.stringify(mark))) ? why : refuse("vest-spent", "this commit already spent its one rite attempt; commit again on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
  };
  if (fold.struckDue) return lapse(refuse("struck-due", `${fold.vestings} handed links stand in a row; light this successor by passphrase (the struck fire): lares rite kukulu on a terminal, and the run starts over`));
  const early = coSignRefusal(fold.pending.devices, "the commit");
  if (early !== null) return lapse(early);
  if (at.closure !== next) return lapse(refuse("closure-differs", `the successor reports closure ${at.closure}, and the commit names ${next}; nothing vests and the old fire still burns: commit the closure you mean (\`lares pulama keeper-commit\`), or light the successor by hand: lares rite kukulu`));
  const rite = await at.rite({ to: at.to, next });
  if (!rite.ok) return lapse(refuse(rite.refusal, rite.detail));
  const late = coSignRefusal(rite.devices, "the rite's vouch");
  if (late !== null) return lapse(late);
  const keys = at.keys();
  if (keys === null) return lapse(refuse("pulama-locked", "this keeper holds no key to vest; light the successor by hand: lares rite kukulu on a terminal"));
  try {
    const mark = await signPulamaRecord<"keeper-vested">({ act: "keeper-vested", tessera, begun, next, to: sha256HexBytesSync(unhex(at.to)), node: true, faces: keys.faces.map((f) => f.fcid), nonce: randomUUID(), rite: [...rite.rite] }, by);
    if (!(await records.writeNew(pulamaKeeperTitle(tessera, "vest"), JSON.stringify(mark)))) return refuse("vest-spent", "this commit already spent its one rite attempt; commit again on a terminal (`lares pulama keeper-commit`), or light the successor by hand: lares rite kukulu");
    const payload: VestPayload = { node: hex(keys.treeKey), faces: keys.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal, fck: hex(f.fck), spent: f.spent ?? 0 })), spent: at.spent, worn: at.worn };
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    let box;
    try { box = sealToRecipient({ recipientPub: unhex(at.to), plaintext: plain, info: VEST_INFO, extraSalt: [unhex(begun), new TextEncoder().encode(next)] }); } finally { plain.fill(0); }
    const slot = await signPulamaRecord<"keeper-slot">({ act: "keeper-slot", tessera, begun, next, to: at.to, box: { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) } }, by);
    return { slot, tessera, faces: keys.faces.map((f) => f.ordinal).sort((x, y) => x - y), rite: rite.rite };
  } finally {
    keys.treeKey.fill(0);
    for (const f of keys.faces) f.fck.fill(0);
  }
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
      try {
        const plain = openFromSender({ recipientSecret: secret, senderEphemeralPub: unhex(slot.box.e), aeadNonce: unhex(slot.box.n), ciphertext: unhex(slot.box.c), info: VEST_INFO, extraSalt: [unhex(slot.begun), new TextEncoder().encode(slot.next)] });
        if (plain === null) return null;
        try { return JSON.parse(new TextDecoder().decode(plain)) as VestPayload; } catch { return null; } finally { plain.fill(0); }
      } finally { secret.fill(0); }
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
      : refuse(before.fork ? "fork" : "begun-absent", before.fork ? "the keeper chain reads a fork; nothing lands" : "no live keeper commit stands to land");
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
