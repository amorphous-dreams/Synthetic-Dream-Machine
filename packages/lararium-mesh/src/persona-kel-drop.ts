/**
 * persona-kel-drop — a PersonaGroup's leaves catch up on their KEL through herm-held SUCCESSOR DROPS, never from a
 * sibling.
 *
 * WHY A DROP. The persona-KEL links backwards (`prevEventCid`): nothing in an event names its successor, and a herm
 * answers only a name its traveler brings. So a leaf names the successors of the head it holds: the drop
 * `personaKelDropName(H.eventCid, gate)` holds the events whose predecessor is `H`. The leaf brings the name, and
 * the herm lists nothing unasked. Each herm's gate key enters the name, so two herms see two names.
 *
 * THE HERM'S FACE: AVAILABILITY BY CID, NEVER A VOUCH. A drop rides the herm's FLOOR voice, the voice that serves
 * bytes by content address. A deposit carries the successor AND its predecessor event. The herm keeps the successor
 * only when it VERIFIES against that predecessor (`admitPersonaKelDropDeposit`): the predecessor's cid recomputes,
 * the drop's name derives from it, and the successor passes the one reader's own successor check
 * (`personaSuccessorFault`) — a rotation by a guardian quorum against the predecessor's committed next keys (the
 * pre-rotation), a veto by the predecessor's op-key, every enrolment by its op-key's seal. So no one who lacks the
 * persona's keys files anything under a name a leaf pulls, and every quota counts verified values alone. A drop
 * holds plural values: a provisional rotation and its veto share a predecessor, and both stay; rotations and vetoes
 * hold separate places under a name, so an op-key holder's vetoes never crowd out a quorum's rotation. The herm
 * stores the bytes and no holder hint, vouches for nothing it keeps, and may refuse any deposit: a refusal reads as
 * withholding. The herm's sealed acting voice never reads, writes or signs a drop.
 *
 * WHAT THE HERM'S BUDGET STILL BEARS. Anyone may mint a persona of their own, so anyone can file values that
 * verify under names no leaf of another persona pulls. The herm caps a deposit's bytes and every drop's bytes in
 * all, and past that cap it lets go of the drops it heard from least lately: a flood spends the herm's budget and
 * displaces values, and every leaf's re-deposit on its next dial files its own chain again.
 *
 * THE CONNECTION: UNSTAMPED, PUBLIC. Deposit and pull ride a plain request on the herm's relay port, never the
 * device-proven socket, so no drop request carries a proven key. A name the herm holds nothing under, a malformed
 * request and a refused deposit all meet the same silence as every closed door. A herm that answers nothing within
 * the leaf's deadline reads as UNANSWERED, never as an empty drop, and the leaf proceeds on the others.
 *
 * WHAT A PULL SAYS. A drop's name is computed from the gate key and a predecessor's cid, so only a pin-holder
 * computes one, and a stranger meets silence. To a pin-holder who can read the persona's KEL, the drop door answers
 * "this herm serves persona P", and the name a leaf pulls says which head it holds, so a pull tells the herm how far
 * behind that leaf stands, and its address and timing link the pull to the proven socket it opens next.
 *
 * THE LEAF'S FACE. Every leaf pulls before it joins its channel, on every dial and whenever a sibling closes a
 * session because the head rolled. Every leaf re-deposits its own head chain, so a herm that restarted or let go
 * heals. A leaf pins at least two herms and asks them all at once, each under a deadline and a body cap: one herm
 * that withholds, floods or hangs costs the leaf no more than its deadline, and the others carry the move.
 * Withholding stays undetectable from one herm: a truncated suffix verifies, so it reads as "no rotation yet".
 *
 * THE READER FOLDS (`pullPersonaKelSuccessors`) through the one reader (`foldPersonaContests`: verify, then fold). It
 * unions every herm's values with the KEL it holds, folds, and asks again from the new head and from the
 * predecessor of every provisional it holds, so a veto a first pull missed still lands. It names every value it
 * refused and every herm that did not answer, and a fork — two verified successors at one seat — surfaces whole,
 * never settled by which herm answered first.
 *
 * NO CLOCK in any decision: a name hashes a cid; plurality and fold order follow KEL event order; a deadline paces
 * a request and decides nothing about the KEL.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-persona-group-secret
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson, canonicalJsonBytes, hex } from "./crypto.js";
import { PERSONA_KEL_DROP_DOMAIN } from "./domains.js";
import { pinnedRelayAddress } from "./gate-knock.js";
import {
  foldPersonaContests, personaEventCidOf, personaSuccessorFault, type PersonaKelEvent, type PersonaKelFork,
} from "./persona-kel.js";
import { coercePersonaKelEvent } from "./persona-kel-board.js";

const KEY_RE = /^[0-9a-f]{64}$/;

/** The route a drop rides on a herm's relay port: `/drop/<name>`. */
export const PERSONA_KEL_DROP_ROUTE = "/drop/";

/** The most values a reader takes from one herm under one name: a hostile herm spends a bounded read. */
export const PERSONA_KEL_DROP_READ_CAP = 64;

/** The most bytes one deposit carries, and the most a reader reads of one herm's answer. */
export const PERSONA_KEL_DROP_BODY_CAP = 128 * 1024;

/** How long a leaf waits on one herm's drop request before it reads the herm as unanswered. Paces; decides nothing. */
export const PERSONA_KEL_DROP_DEADLINE_MS = 5000;

/**
 * The name of the drop that holds the successors of one KEL event at one herm: a hash under `persona-kel-drop`
 * over the predecessor's cid and the herm's gate key.
 */
export function personaKelDropName(predecessorCid: string, gatePubKey: string): string {
  return hex(sha256(canonicalJsonBytes({ domain: PERSONA_KEL_DROP_DOMAIN, prev: predecessorCid, gate: gatePubKey.toLowerCase() })));
}

/** One deposit: a successor and the predecessor it verifies against. */
export interface PersonaKelDropDeposit {
  readonly prev:  PersonaKelEvent;
  readonly event: PersonaKelEvent;
}

/**
 * Read an untrusted deposit for the drop `name` at the herm `gatePubKey`: its successor event, when the predecessor's
 * cid recomputes over its core, `name` derives from that cid under this gate, and the successor verifies against the
 * predecessor (`personaSuccessorFault`). Else null.
 */
export function admitPersonaKelDropDeposit(raw: unknown, name: string, gatePubKey: string): PersonaKelDropDeposit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const prev = coercePersonaKelEvent((raw as { prev?: unknown }).prev);
  const event = coercePersonaKelEvent((raw as { event?: unknown }).event);
  if (!prev || !event) return null;
  if (personaEventCidOf(prev) !== prev.eventCid) return null;
  if (personaKelDropName(prev.eventCid, gatePubKey) !== name) return null;
  return personaSuccessorFault(prev, event) === null ? { prev, event } : null;
}

/** What a herm keeps of one deposit: the successor it serves, the predecessor it verified against, its byte count. */
interface HeldDeposit {
  readonly deposit: PersonaKelDropDeposit;
  readonly bytes:   number;
}

/** A herm's journal of kept deposits: it reads them back on start, so a restarted herm keeps what it verified. */
export interface PersonaKelDropJournal {
  /** Every deposit kept, oldest first, as raw values the store re-admits. */
  load(): Iterable<{ readonly name: string; readonly deposit: unknown }>;
  /** Keep one more deposit. */
  append(name: string, deposit: PersonaKelDropDeposit): void;
  /** Replace the whole journal with exactly these deposits, oldest first. */
  rewrite(entries: readonly { readonly name: string; readonly deposit: PersonaKelDropDeposit }[]): void;
}

/** A herm's drops: the verified successors under each name, plural, within its budget. */
export interface PersonaKelDropStore {
  /** The herm's gate key, which every name it holds derives under. */
  readonly gatePubKey: string;
  /** Keep one deposit, or refuse it: one that does not verify, or one past a name's place. True when kept or held. */
  deposit(name: string, raw: unknown): boolean;
  /** Every successor the drop holds. */
  pull(name: string): readonly PersonaKelEvent[];
  /** The bytes every kept deposit spends. */
  readonly bytes: number;
}

/** How much a herm keeps: the bytes of every drop in all, and the rotations and the vetoes under one name. */
export interface PersonaKelDropQuota {
  readonly bytes?:   number;
  readonly perName?: number;
}

/**
 * Stand a herm's drop store. Values key by their cid: one verified copy stands for an event, and a re-deposit of an
 * event it holds stays idempotent. A name holds at most `perName` rotations and `perName` vetoes. Past the byte
 * budget the store lets go of whole drops, the one it heard from least lately first, down to three quarters of the
 * budget. With a `journal` it reads back every deposit it kept, re-verified as any deposit is.
 */
export function makePersonaKelDropStore(opts: {
  readonly gatePubKey: string;
  readonly quota?: PersonaKelDropQuota;
  readonly journal?: PersonaKelDropJournal;
}): PersonaKelDropStore {
  const gatePubKey = opts.gatePubKey.toLowerCase();
  const maxBytes = opts.quota?.bytes ?? 16 * 1024 * 1024;
  const perName = opts.quota?.perName ?? 16;
  /** name → cid → held. The map's order is the order the herm last heard from each drop. */
  const drops = new Map<string, Map<string, HeldDeposit>>();
  let bytes = 0;
  let loading = false;

  const entries = (): { name: string; deposit: PersonaKelDropDeposit }[] => {
    const out: { name: string; deposit: PersonaKelDropDeposit }[] = [];
    for (const [name, drop] of drops) for (const held of drop.values()) out.push({ name, deposit: held.deposit });
    return out;
  };
  /** Let go of whole drops, least lately heard first, sparing `keep`, until `room` more bytes fit. */
  const makeRoom = (room: number, keep: string): boolean => {
    if (bytes + room <= maxBytes) return true;
    const target = Math.floor(maxBytes * 0.75) - room;
    for (const [name, drop] of [...drops]) {
      if (bytes <= target) break;
      if (name === keep) continue;
      for (const held of drop.values()) bytes -= held.bytes;
      drops.delete(name);
    }
    if (!loading) opts.journal?.rewrite(entries());
    return bytes + room <= maxBytes;
  };

  const store: PersonaKelDropStore = {
    gatePubKey,
    get bytes() { return bytes; },
    deposit(name, raw) {
      if (!KEY_RE.test(name)) return false;
      const admitted = admitPersonaKelDropDeposit(raw, name, gatePubKey);
      if (!admitted) return false;
      const { event } = admitted;
      const drop = drops.get(name) ?? new Map<string, HeldDeposit>();
      if (drop.has(event.eventCid)) {
        drops.delete(name);
        drops.set(name, drop);   // heard from lately
        return true;
      }
      const isVeto = event.vetoOfCid !== null;
      const sameKind = [...drop.values()].filter((h) => (h.deposit.event.vetoOfCid !== null) === isVeto);
      if (sameKind.length >= perName) {
        // A veto that names a provisional this drop holds displaces one that names none; nothing else displaces.
        const named = isVeto && [...drop.values()].some((h) => h.deposit.event.provisional && h.deposit.event.eventCid === event.vetoOfCid);
        const idle = named ? sameKind.find((h) => ![...drop.values()].some((o) => o.deposit.event.provisional && o.deposit.event.eventCid === h.deposit.event.vetoOfCid)) : undefined;
        if (!idle) return false;
        drop.delete(idle.deposit.event.eventCid);
        bytes -= idle.bytes;
      }
      const kept: PersonaKelDropDeposit = { prev: admitted.prev, event };
      const size = canonicalJson(kept).length;
      if (size > PERSONA_KEL_DROP_BODY_CAP || !makeRoom(size, name)) return false;
      drop.set(event.eventCid, { deposit: kept, bytes: size });
      drops.delete(name);
      drops.set(name, drop);
      bytes += size;
      if (!loading) opts.journal?.append(name, kept);
      return true;
    },
    pull(name) {
      return [...(drops.get(name)?.values() ?? [])].map((h) => h.deposit.event);
    },
  };
  if (opts.journal) {
    loading = true;
    try { for (const { name, deposit } of opts.journal.load()) store.deposit(name, deposit); }
    finally { loading = false; }
    opts.journal.rewrite(entries());
  }
  return store;
}

/** One pinned herm's drops, as a leaf reaches them. A pull or deposit REJECTS when the herm answers nothing within
 *  the leaf's deadline; a closed door — a cut socket, a refusal, an unreadable answer — pulls the empty list. */
export interface PersonaKelDropHerm {
  readonly gatePubKey: string;
  pull(name: string): Promise<readonly unknown[]>;
  deposit(name: string, deposit: PersonaKelDropDeposit): Promise<void>;
}

/** The drops of a store this process holds itself — a herm's own, or a test's. */
export function localPersonaKelDropHerm(store: PersonaKelDropStore): PersonaKelDropHerm {
  return {
    gatePubKey: store.gatePubKey,
    pull: async (name) => store.pull(name),
    deposit: async (name, deposit) => { store.deposit(name, JSON.parse(JSON.stringify(deposit))); },
  };
}

/** Read at most `cap` bytes of a response body as text, or null past the cap. */
async function cappedText(res: Response, cap: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}

/** True for the abort a request's deadline raises. */
const timedOut = (err: unknown): boolean =>
  typeof err === "object" && err !== null && ["TimeoutError", "AbortError"].includes((err as { name?: string }).name ?? "");

/**
 * A pinned herm's drops over its relay port: `GET` and `POST` on `/drop/<name>` at the address's own host, a plain
 * request apart from the proven socket. The POST carries `text/plain`, so a browser leaf sends it with no preflight.
 * Every request runs under `deadlineMs` and reads at most `PERSONA_KEL_DROP_BODY_CAP` bytes: past the deadline the
 * request rejects (unanswered); a cut socket, a refusal, an overlong or unreadable answer pulls the empty list.
 *
 * @param address the herm's pinned relay address, `ws(s)://host:port#<gate key hex>`.
 */
export function httpPersonaKelDropHerm(address: string, opts: { readonly deadlineMs?: number } = {}): PersonaKelDropHerm {
  const pinned = pinnedRelayAddress(address);
  const base = new URL(pinned.url);
  base.protocol = base.protocol === "wss:" ? "https:" : "http:";
  const at = (name: string): string => new URL(`${PERSONA_KEL_DROP_ROUTE}${name}`, base.origin).href;
  const deadline = opts.deadlineMs ?? PERSONA_KEL_DROP_DEADLINE_MS;
  const unanswered = (): Error => new Error(`the herm ${pinned.gatePubKey.slice(0, 8)}… answered no drop request within ${deadline} ms`);
  return {
    gatePubKey: pinned.gatePubKey,
    pull: async (name) => {
      try {
        const res = await fetch(at(name), { signal: AbortSignal.timeout(deadline) });
        if (!res.ok) { await res.body?.cancel().catch(() => undefined); return []; }
        const text = await cappedText(res, PERSONA_KEL_DROP_BODY_CAP * PERSONA_KEL_DROP_READ_CAP);
        if (text === null) return [];
        const body = JSON.parse(text) as unknown;
        return Array.isArray(body) ? body : [];
      } catch (err) {
        if (timedOut(err)) throw unanswered();
        return [];
      }
    },
    deposit: async (name, deposit) => {
      try {
        const res = await fetch(at(name), {
          method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(deposit), signal: AbortSignal.timeout(deadline),
        });
        await res.body?.cancel().catch(() => undefined);
      } catch (err) {
        if (timedOut(err)) throw unanswered();
        /* a herm may refuse any deposit: a refusal is withholding */
      }
    },
  };
}

/**
 * Deposit a KEL chain's every event past inception at every herm, each with its predecessor, under that
 * predecessor's name — every deposit at once. Names each herm that answered no deposit within its deadline.
 */
export async function depositPersonaKelChain(
  kel: readonly PersonaKelEvent[], herms: readonly PersonaKelDropHerm[],
): Promise<{ readonly unanswered: readonly string[] }> {
  const silent = new Set<string>();
  await Promise.all(herms.flatMap((herm) => kel.slice(1).map(async (event, i) => {
    const prev = kel[i]!;
    try { await herm.deposit(personaKelDropName(prev.eventCid, herm.gatePubKey), { prev, event }); }
    catch { silent.add(herm.gatePubKey); }
  })));
  return { unanswered: [...silent] };
}

/** What a pull hands back: the KEL to stand under, every drop value it refused, every herm that did not answer, and
 *  the fork the fold stopped at. */
export interface PersonaKelPull {
  readonly kel: readonly PersonaKelEvent[];
  readonly refused: readonly string[];
  readonly unanswered: readonly string[];
  readonly fork: PersonaKelFork | null;
}

/**
 * Pull the successors of `kel` from every herm at once and fold them in through the one reader (`foldPersonaContests`).
 * It asks from the folded head and from the predecessor of every provisional on the lineage, folds again, and asks
 * again from the new head until no name it has not asked remains. A herm that answers nothing within its deadline
 * is asked nothing more in this pull and named in `unanswered`; the leaf proceeds on what the others gave.
 */
export async function pullPersonaKelSuccessors(kel: readonly PersonaKelEvent[], herms: readonly PersonaKelDropHerm[]): Promise<PersonaKelPull> {
  const refused: string[] = [];
  const events: PersonaKelEvent[] = [...kel];
  const seen = new Set(events.map((e) => canonicalJson(e)));
  const servedBy = new Map<string, string>();
  const asked = new Set<string>();
  const silent = new Set<string>();
  const reported = new Set<string>();
  for (;;) {
    const fold = foldPersonaContests(events);
    for (const { event, reason } of fold.setAside) {
      const label = servedBy.get(canonicalJson(event));
      if (!label || reported.has(label + reason)) continue;
      reported.add(label + reason);
      refused.push(`${label} an event that does not verify: ${reason}`);
    }
    const open = new Set<string>();
    const head = fold.kel[fold.kel.length - 1];
    if (head && !fold.fork) open.add(head.eventCid);
    for (const e of fold.kel) if (e.provisional && e.prevEventCid !== null) open.add(e.prevEventCid);
    const names = [...open].filter((cid) => !asked.has(cid));
    if (names.length === 0) return { kel: fold.kel, refused, unanswered: [...silent], fork: fold.fork };
    for (const cid of names) asked.add(cid);
    const answers = await Promise.all(names.flatMap((cid) => herms.filter((h) => !silent.has(h.gatePubKey)).map(async (herm) => {
      try { return { cid, herm, values: (await herm.pull(personaKelDropName(cid, herm.gatePubKey))).slice(0, PERSONA_KEL_DROP_READ_CAP) }; }
      catch { silent.add(herm.gatePubKey); return { cid, herm, values: [] as readonly unknown[] }; }
    })));
    for (const { cid, herm, values } of answers) {
      const label = `the herm ${herm.gatePubKey.slice(0, 8)}… served under the successors of ${cid.slice(0, 16)}…`;
      for (const raw of values) {
        const event = coercePersonaKelEvent(raw);
        if (!event) { refused.push(`${label} bytes that read as no KEL event`); continue; }
        const key = canonicalJson(event);
        if (seen.has(key)) continue;
        seen.add(key);
        if (event.prevEventCid !== cid) { refused.push(`${label} an event whose predecessor is another`); continue; }
        servedBy.set(key, label);
        events.push(event);
      }
    }
  }
}
