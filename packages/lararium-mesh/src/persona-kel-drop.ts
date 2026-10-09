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
 * bytes by content address. It stores the bytes and no holder hint (`makePersonaKelDropStore`), and keeps only an
 * event whose cid recomputes over its core, whose enrolment list matches the digest that cid commits, and whose
 * `prevEventCid` names the drop's own predecessor. A drop holds plural values: a provisional rotation and its veto
 * share a predecessor, and both stay. The herm verifies no quorum and vouches for nothing, and the reader re-walks
 * every quorum. A write quota bounds what it keeps, and it may refuse any deposit: a refusal reads as withholding.
 * The herm's sealed acting voice never reads, writes or signs a drop.
 *
 * THE CONNECTION: UNSTAMPED, PUBLIC. Deposit and pull ride a plain request on the herm's relay port, never the
 * device-proven socket, so no drop request carries a proven key. The bytes self-certify, so a writer's identity
 * would add nothing and only leak. A name the herm holds nothing under, a malformed request and a refused deposit
 * all meet the same silence as every closed door.
 *
 * THE LEAF'S FACE: EVERY LEAF ACTS ALIKE, SO A PULL SIGNALS NOTHING. Every leaf pulls before it joins its channel,
 * on every dial and whenever a sibling closes a session because the head rolled. Every leaf re-deposits its own
 * head chain, so a herm that restarted or evicted heals. Every leaf pins at least two herms, so one herm that
 * withholds is tolerated through another. Withholding stays undetectable from one herm: a truncated suffix
 * verifies, so it reads as "no rotation yet".
 *
 * THE READER FOLDS (`pullPersonaKelSuccessors`). It unions every herm's values under each name, keeps an event
 * only when the chain up to its predecessor plus that event verifies in full (every rotation's guardian quorum,
 * every veto's signature), folds contests (`foldPersonaContests`: a veto beats the provisional it names), and walks
 * on from the new head. It names every value it refused, so a herm that strips or swaps a successor surfaces. It
 * also re-reads the drop of every provisional's predecessor, so a veto a first pull missed still lands.
 *
 * NO CLOCK: a name is a hash of a cid; plurality and fold order are KEL event order.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-persona-group-secret
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson, canonicalJsonBytes, hex, sha256HexSync } from "./crypto.js";
import { PERSONA_KEL_DROP_DOMAIN } from "./domains.js";
import { pinnedRelayAddress } from "./gate-knock.js";
import {
  enrolmentsAttested, foldPersonaContests, personaEventCidOf, verifyPersonaKelFull, type PersonaKelEvent,
} from "./persona-kel.js";
import { coercePersonaKelEvent } from "./persona-kel-board.js";

const KEY_RE = /^[0-9a-f]{64}$/;

/** The route a drop rides on a herm's relay port: `/drop/<name>`. */
export const PERSONA_KEL_DROP_ROUTE = "/drop/";

/** The most values a reader takes from one herm under one name: a hostile herm spends a bounded read. */
export const PERSONA_KEL_DROP_READ_CAP = 64;

/**
 * The name of the drop that holds the successors of one KEL event at one herm: a hash under `persona-kel-drop`
 * over the predecessor's cid and the herm's gate key.
 */
export function personaKelDropName(predecessorCid: string, gatePubKey: string): string {
  return hex(sha256(canonicalJsonBytes({ domain: PERSONA_KEL_DROP_DOMAIN, prev: predecessorCid, gate: gatePubKey.toLowerCase() })));
}

/**
 * Read an untrusted deposit for the drop `name` at the herm `gatePubKey`: the event, when its cid recomputes over
 * its core, its enrolments match the digest that cid commits and its predecessor names this drop. Else null.
 */
export function admitPersonaKelDropEvent(raw: unknown, name: string, gatePubKey: string): PersonaKelEvent | null {
  const event = coercePersonaKelEvent(raw);
  if (!event || event.prevEventCid === null) return null;
  if (personaEventCidOf(event) !== event.eventCid) return null;
  if (!enrolmentsAttested(event)) return null;
  return personaKelDropName(event.prevEventCid, gatePubKey) === name ? event : null;
}

/** A herm's drops: the stored bytes under each name, plural, within its quota. */
export interface PersonaKelDropStore {
  /** The herm's gate key, which every name it holds derives under. */
  readonly gatePubKey: string;
  /** Keep one deposit, or refuse it: a value that does not admit, or one past the quota. True when kept or held. */
  deposit(name: string, raw: unknown): boolean;
  /** Every value the drop holds, as deposited. */
  pull(name: string): readonly PersonaKelEvent[];
}

/** How much a herm keeps: every value across every drop, and the values under one name. */
export interface PersonaKelDropQuota {
  readonly values?:  number;
  readonly perName?: number;
}

/**
 * Stand a herm's drop store. Values key by the hash of their whole bytes, so two copies of one event that differ
 * outside the cid (a quorum signature set) both stay for the reader to judge. In memory: a restarted herm holds no
 * drop until a leaf re-deposits.
 */
export function makePersonaKelDropStore(opts: { readonly gatePubKey: string; readonly quota?: PersonaKelDropQuota }): PersonaKelDropStore {
  const gatePubKey = opts.gatePubKey.toLowerCase();
  const maxValues = opts.quota?.values ?? 4096;
  const perName = opts.quota?.perName ?? 16;
  const drops = new Map<string, Map<string, PersonaKelEvent>>();
  let held = 0;
  return {
    gatePubKey,
    deposit(name, raw) {
      if (!KEY_RE.test(name)) return false;
      const event = admitPersonaKelDropEvent(raw, name, gatePubKey);
      if (!event) return false;
      const key = sha256HexSync(canonicalJson(event));
      const drop = drops.get(name) ?? new Map<string, PersonaKelEvent>();
      if (drop.has(key)) return true;
      if (drop.size >= perName || held >= maxValues) return false;
      drop.set(key, event);
      drops.set(name, drop);
      held += 1;
      return true;
    },
    pull(name) {
      return [...(drops.get(name)?.values() ?? [])];
    },
  };
}

/** One pinned herm's drops, as a leaf reaches them. A herm that answers nothing pulls the empty list. */
export interface PersonaKelDropHerm {
  readonly gatePubKey: string;
  pull(name: string): Promise<readonly unknown[]>;
  deposit(name: string, event: PersonaKelEvent): Promise<void>;
}

/** The drops of a store this process holds itself — a herm's own, or a test's. */
export function localPersonaKelDropHerm(store: PersonaKelDropStore): PersonaKelDropHerm {
  return {
    gatePubKey: store.gatePubKey,
    pull: async (name) => store.pull(name),
    deposit: async (name, event) => { store.deposit(name, JSON.parse(JSON.stringify(event))); },
  };
}

/**
 * A pinned herm's drops over its relay port: `GET` and `POST` on `/drop/<name>` at the address's own host, a plain
 * request apart from the proven socket. The POST carries `text/plain`, so a browser leaf sends it with no preflight.
 * Every failure — silence, a cut socket, an unreadable answer — pulls the empty list.
 *
 * @param address the herm's pinned relay address, `ws(s)://host:port#<gate key hex>`.
 */
export function httpPersonaKelDropHerm(address: string): PersonaKelDropHerm {
  const pinned = pinnedRelayAddress(address);
  const base = new URL(pinned.url);
  base.protocol = base.protocol === "wss:" ? "https:" : "http:";
  const at = (name: string): string => new URL(`${PERSONA_KEL_DROP_ROUTE}${name}`, base.origin).href;
  return {
    gatePubKey: pinned.gatePubKey,
    pull: async (name) => {
      try {
        const res = await fetch(at(name));
        if (!res.ok) return [];
        const body = await res.json() as unknown;
        return Array.isArray(body) ? body : [];
      } catch { return []; }
    },
    deposit: async (name, event) => {
      try {
        const res = await fetch(at(name), { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(event) });
        await res.arrayBuffer().catch(() => undefined);
      } catch { /* a herm may refuse any deposit: a refusal is withholding */ }
    },
  };
}

/** Deposit a KEL chain's every event past inception at every herm, each under its predecessor's drop. */
export async function depositPersonaKelChain(kel: readonly PersonaKelEvent[], herms: readonly PersonaKelDropHerm[]): Promise<void> {
  const events = kel.filter((e) => e.prevEventCid !== null);
  await Promise.all(herms.map(async (herm) => {
    for (const e of events) await herm.deposit(personaKelDropName(e.prevEventCid!, herm.gatePubKey), e);
  }));
}

/** What a pull hands back: the KEL to stand under, and every drop value it refused, said. */
export interface PersonaKelPull {
  readonly kel: readonly PersonaKelEvent[];
  readonly refused: readonly string[];
}

/**
 * Pull the successors of `kel` from every herm and fold them in. `kel` must verify in full; the reader walks from
 * its head and from the predecessor of every provisional it holds, keeps each value only when the chain up to its
 * predecessor plus that value verifies in full, folds contests, and repeats from the new head until no drop yields
 * a value it lacks.
 */
export async function pullPersonaKelSuccessors(kel: readonly PersonaKelEvent[], herms: readonly PersonaKelDropHerm[]): Promise<PersonaKelPull> {
  const refused: string[] = [];
  let events: PersonaKelEvent[] = [...kel];
  const seen = new Set(events.map((e) => sha256HexSync(canonicalJson(e))));
  const asked = new Set<string>();
  for (;;) {
    const chain = foldPersonaContests(events);
    const open = new Set<string>();
    const head = chain[chain.length - 1];
    if (head) open.add(head.eventCid);
    for (const e of chain) if (e.provisional && e.prevEventCid !== null) open.add(e.prevEventCid);
    const fresh: PersonaKelEvent[] = [];
    for (const cid of open) {
      if (asked.has(cid)) continue;
      asked.add(cid);
      const at = chain.findIndex((e) => e.eventCid === cid);
      if (at < 0) continue;
      const prefix = chain.slice(0, at + 1);
      for (const herm of herms) {
        const values = (await herm.pull(personaKelDropName(cid, herm.gatePubKey)).catch(() => [] as unknown[])).slice(0, PERSONA_KEL_DROP_READ_CAP);
        for (const raw of values) {
          const event = coercePersonaKelEvent(raw);
          const label = `the herm ${herm.gatePubKey.slice(0, 8)}… served under the successors of ${cid.slice(0, 16)}…`;
          if (!event) { refused.push(`${label} bytes that read as no KEL event`); continue; }
          const key = sha256HexSync(canonicalJson(event));
          if (seen.has(key)) continue;
          seen.add(key);
          if (event.prevEventCid !== cid) { refused.push(`${label} an event whose predecessor is another`); continue; }
          const verified = await verifyPersonaKelFull([...prefix, event]);
          if (!verified.ok) { refused.push(`${label} an event that does not verify: ${verified.reason ?? "refused"}`); continue; }
          fresh.push(event);
        }
      }
    }
    if (fresh.length === 0) return { kel: chain, refused };
    events = [...chain, ...events.filter((e) => !chain.includes(e)), ...fresh];
  }
}
