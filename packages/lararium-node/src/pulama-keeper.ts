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
 *                            key) to ONE successor key, once per commit. It names the key's digest, the faces and the commit; no
 *                            key rests in it. A second vest of the same commit finds the row and refuses `vest-spent`.
 *   keeper/<tessera>/host    `keeper-landed`: the successor names what it stands on (its own reported closure, image, lit faces)
 *                            and what it received (`vest`: the slot, the node key, each face key; null where the hand's light
 *                            lit it: the struck fire). `vestings` counts the handed links since the last struck one.
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
 * names a vest finds its spend mark. Every other pair reads red, by name: `begun-refused`, `landed-refused`, `begun-absent`,
 * `landed-names-another`, `version-skew`, `closure-differs`, `faces-short`, `vest-unwitnessed`, `fork` (two live commits, or two
 * landings, at one link). Red is loud and never auto-accepted, and it never locks: the hand's light stays under every red.
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
  readonly pending: { readonly tessera: string; readonly v: number; readonly next: string; readonly begun: string } | null;
  readonly vestings: number;
  readonly struckDue: boolean;
  readonly fork: boolean;
}

type Begun = { readonly cid: string; readonly body: KeeperBegunBody };
type Landed = { readonly cid: string; readonly body: KeeperLandedBody };
interface Rows { begun: Map<string, Begun | "refused">; landed: Map<string, Landed | "refused">; vested: Map<string, KeeperVestedBody> }

async function rowsOf(records: SwarmWikiPort, by: KukuluSigner): Promise<Rows> {
  const out: Rows = { begun: new Map(), landed: new Map(), vested: new Map() };
  for (const title of await records.list(PREFIX)) {
    const [tessera, half, ...rest] = title.slice(PREFIX.length).split("/");
    if (!tessera || rest.length > 0) continue;
    const row = verifiedPulamaRecord(await records.read(title), by.key);
    const body = row?.body;
    if (half === "guest") out.begun.set(tessera, row !== null && body?.act === "keeper-begun" && body.tessera === tessera ? { cid: pulamaRecordCid(row), body } : "refused");
    else if (half === "host") out.landed.set(tessera, row !== null && body?.act === "keeper-landed" && body.tessera === tessera ? { cid: pulamaRecordCid(row), body } : "refused");
    else if (half === "vest" && body?.act === "keeper-vested" && body.tessera === tessera) out.vested.set(tessera, body);
  }
  return out;
}

/** THE STATUS FOLD: walk the chain from the founding keeper to the tip, and read each pair par or red by name. */
export async function keeperFold(records: SwarmWikiPort, by: KukuluSigner): Promise<KeeperFold> {
  const rows = await rowsOf(records, by);
  const pairs: KeeperPair[] = [];
  const landedAt = new Map<number, Landed[]>();
  for (const l of rows.landed.values()) if (l !== "refused") landedAt.set(l.body.v, [...(landedAt.get(l.body.v) ?? []), l]);
  // THE CHAIN WALKS FROM v1: each link one landing whose guest half names the landing before it; two at one link read a fork.
  let tip: Landed | null = null, fork = false;
  for (let v = 1; landedAt.has(v); v++) {
    const at = landedAt.get(v)!;
    if (at.length > 1) { fork = true; break; }
    const begun = rows.begun.get(at[0]!.body.tessera);
    if (begun === undefined || begun === "refused" || begun.body.prev !== (tip?.cid ?? null)) break;
    tip = at[0]!;
  }
  const linked = (b: Begun): boolean => b.body.v === (tip?.body.v ?? 0) + 1 && b.body.prev === (tip?.cid ?? null);
  for (const [tessera, landed] of rows.landed) {
    const begun = rows.begun.get(tessera);
    const v = landed !== "refused" ? landed.body.v : begun !== undefined && begun !== "refused" ? begun.body.v : null;
    const red = landed === "refused" ? "landed-refused" : begun === undefined ? "begun-absent" : begun === "refused" ? "begun-refused" : keeperRed(begun, landed, rows, landedAt);
    pairs.push({ tessera, v, begun: begun !== undefined && begun !== "refused" ? begun.cid : null, landed: landed !== "refused" ? landed.cid : null, par: red === null, ...(red === null ? {} : { red }), vest: landed !== "refused" && landed.body.vest !== null });
  }
  pairs.sort((a, b) => (a.v ?? 0) - (b.v ?? 0) || a.tessera.localeCompare(b.tessera));
  // THE LIVE COMMIT: a guest half at the next link, unlanded, that no later commit supersedes. Two live ones read a fork.
  const open = [...rows.begun].flatMap(([t, b]) => (b !== "refused" && !rows.landed.has(t) && linked(b) ? [b] : []));
  const superseded = new Set(open.map((b) => b.body.supersedes).filter((s): s is string => s !== null));
  const live = open.filter((b) => !superseded.has(b.cid));
  if (live.length > 1) fork = true;
  const pending = live.length === 1 ? { tessera: live[0]!.body.tessera, v: live[0]!.body.v, next: live[0]!.body.next, begun: live[0]!.cid } : null;
  const vestings = tip?.body.vestings ?? 0;
  return { v: tip?.body.v ?? 0, tip: tip?.cid ?? null, pairs, pending: fork ? null : pending, vestings, struckDue: vestings >= KEEPER_STRUCK_EVERY, fork };
}

function keeperRed(begun: Begun, landed: Landed, rows: Rows, landedAt: Map<number, Landed[]>): KeeperRed | null {
  const g = begun.body, h = landed.body;
  if (h.begun !== begun.cid || h.prev !== begun.cid) return "landed-names-another";
  if ((landedAt.get(h.v)?.length ?? 0) > 1) return "fork";
  const before = landedAt.get(g.v - 1)?.[0];
  if (h.v !== g.v || (g.v === 1 ? g.prev !== null : before === undefined || g.prev !== before.cid)) return "version-skew";
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
export async function keeperCommit(records: SwarmWikiPort, by: KukuluSigner, at: KeeperStanding & { readonly next: string }): Promise<{ readonly tessera: string; readonly v: number; readonly next: string; readonly supersedes: string | null } | KeeperRefusal> {
  if (!CLOSURE.test(at.next)) return refuse("next-malformed", "the successor's closure reads `sha256:<64 hex>`, as tools/pulama-closure.mjs prints it");
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so the chain cannot name what it hands from");
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", "the keeper chain reads a fork (two commits or two landings at one link); read `pulama status`, and the hand settles it before a new commit");
  const v = fold.v + 1, nonce = randomUUID();
  const tessera = sha256HexBytesSync(canonicalJsonBytes({ v, prev: fold.tip, next: at.next, nonce }));
  const supersedes = fold.pending?.begun ?? null;
  const act = await signPulamaRecord<"keeper-begun">({ act: "keeper-begun", tessera, v, prev: fold.tip, closure: at.closure, next: at.next, image: at.image, faces: at.faces, worn: at.worn, budget: { spent: at.spent }, supersedes, nonce }, by);
  if (!(await records.writeNew(pulamaKeeperTitle(tessera, "guest"), JSON.stringify(act)))) return refuse("keeper-begun-stands", `a guest half already rests for tessera ${tessera}`);
  return { tessera, v, next: at.next, supersedes };
}

/** What the vest seals: the house's end of the bond and the budget, nothing of the human's. */
interface VestPayload { readonly node: string; readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: string }>; readonly spent: number; readonly worn: number | null }

/**
 * THE VEST, OUTGOING (the lit keeper, no route: the human's consent rode the commit). The live commit must stand, the successor's
 * host-reported closure must equal its `next`, and the handed run must not owe the struck fire. The spend mark rests FIRST (one vest
 * per commit; a crash after it leaves the old fire burning and the next try refuses `vest-spent`); then the keys seal to `to`.
 */
export async function keeperVest(records: SwarmWikiPort, by: KukuluSigner, at: {
  readonly to: string; readonly closure: string;
  readonly keys: () => { readonly treeKey: Uint8Array; readonly faces: ReadonlyArray<{ readonly fcid: string; readonly ordinal: number; readonly fck: Uint8Array }> } | null;
  readonly spent: number; readonly worn: number | null;
}): Promise<{ readonly slot: SignedPulamaAdmit; readonly tessera: string; readonly faces: readonly number[] } | KeeperRefusal> {
  if (!/^[0-9a-f]{64}$/.test(at.to)) return refuse("vest-key-malformed", "the successor's key reads 64 hex (an X25519 public key)");
  const fold = await keeperFold(records, by);
  if (fold.fork) return refuse("fork", "the keeper chain reads a fork; nothing vests");
  if (fold.pending === null) return refuse("commit-absent", "no keeper commit names a successor closure, so no key vests: the hand commits first (`keeper-commit`), or lights the successor by hand");
  if (fold.struckDue) return refuse("struck-due", `${fold.vestings} handed links stand in a row; the hand lights this successor by passphrase (the struck fire), and the run starts over`);
  if (at.closure !== fold.pending.next) return refuse("closure-differs", `the successor reports closure ${at.closure}, and the commit names ${fold.pending.next}; nothing vests, the old fire still burns`);
  const keys = at.keys();
  if (keys === null) return refuse("pulama-locked", "this keeper holds no key to vest");
  try {
    const { tessera, begun, next } = { tessera: fold.pending.tessera, begun: fold.pending.begun, next: fold.pending.next };
    const fcids = keys.faces.map((f) => f.fcid);
    const mark = await signPulamaRecord<"keeper-vested">({ act: "keeper-vested", tessera, begun, next, to: sha256HexBytesSync(unhex(at.to)), node: true, faces: fcids, nonce: randomUUID() }, by);
    if (!(await records.writeNew(pulamaKeeperTitle(tessera, "vest"), JSON.stringify(mark)))) return refuse("vest-spent", "this commit already vested once; a second vest refuses (commit again for a new handoff, or light the successor by hand)");
    const payload: VestPayload = { node: hex(keys.treeKey), faces: keys.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal, fck: hex(f.fck) })), spent: at.spent, worn: at.worn };
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    let box;
    try { box = sealToRecipient({ recipientPub: unhex(at.to), plaintext: plain, info: VEST_INFO, extraSalt: [unhex(begun), new TextEncoder().encode(next)] }); } finally { plain.fill(0); }
    const slot = await signPulamaRecord<"keeper-slot">({ act: "keeper-slot", tessera, begun, next, to: at.to, box: { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) } }, by);
    return { slot, tessera, faces: keys.faces.map((f) => f.ordinal).sort((x, y) => x - y) };
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
  const pending = before.pending;
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
