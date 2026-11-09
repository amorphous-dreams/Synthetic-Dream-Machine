/**
 * DaemonEventStore — persist Keyhive events in the vessel's separately held secret store.
 *
 * Implements EventStore against a directly held store outside every page recipe.
 * Each Keyhive event becomes one tiddler:
 *
 *   title:    lar:///ha.ka.ba/bags/secret/cap/<face>/<eventHash>
 *   tag:      lar:///ha.ka.ba/tags/cap-event (sub-tags by variant: .../prekey, .../cgka,
 *             .../delegation, .../revocation)
 *   fields:   variant, hash, bytes-len, is-delegated, is-revoked
 *   text:     base64-encoded `event.toBytes()` payload
 *
 * All events rest in the secret home, regardless of their semantic scope
 * (operator-principal vs document vs group-CGKA).
 *
 * Hash: a content hash of `event.toBytes()` keyed via sha256. Used as the
 * tiddler title suffix and as a stable de-dup key — the same event ingested
 * twice produces the same tiddler title.
 */

import {
  SECRET_HOME_ID, type LarTiddlerStore,
  CAP_EVENT_TAG, CAP_EVENT_PREKEY_TAG, CAP_EVENT_CGKA_TAG,
  CAP_EVENT_DELEGATION_TAG, CAP_EVENT_REVOCATION_TAG,
} from "@lararium/mesh";
import { type ChangeOrigin, type LarTiddlerRecord, toLarTiddlerRecord, hex, sha256HexBytesSync } from "@lararium/mesh";
import type { EventStore, EventRecord } from "./event-store.js";
import { inIslandSlice } from "./event-store.js";
import { bytesToBase64, base64ToBytes } from "./bytes-base64.js";

/** Map a Keyhive event variant to its lar sub-tag URI. */
/**
 * The variant written for an event this vessel PERSISTS WITHOUT TAKING.
 *
 * A crossing's bundle is wider than any one receiver's appetite: keyhive accepts the events that move its
 * state and ignores the rest. The accepted ones arrive typed — the receiver's own handler parses the bytes
 * back into events and stamps the true variant (see `absorbCapEvents`). The remainder still persist, so a
 * boot replay sees the whole crossing, and for those the variant is genuinely unknown here: nothing on this
 * side has read them. Deliberately OUTSIDE the vocabulary below — `subTagFor` falls to `null` for it, and
 * no reader can mistake it for a real event class. The field stands because the store reads a record back
 * by its PRESENCE; the crypto rides the bytes, never this word.
 */
export const CAP_EVENT_VARIANT_UNKNOWN = "UNTYPED";

function subTagFor(variant: string): string | null {
  switch (variant) {
    case "PREKEY_ROTATED":  return CAP_EVENT_PREKEY_TAG;
    case "CGKA_OPERATION":  return CAP_EVENT_CGKA_TAG;
    case "DELEGATED":       return CAP_EVENT_DELEGATION_TAG;
    case "REVOKED":         return CAP_EVENT_REVOCATION_TAG;
    default:                return null;
  }
}

/** Title for a cap-event tiddler in the secret home. */
export function capEventTitle(face: string, hash: string): string {
  const scope = sha256HexBytesSync(new TextEncoder().encode(face)).slice(0, 24);
  return `${SECRET_HOME_ID}/cap/${scope}/${hash}`;
}

/** Base64-encode bytes for tiddler `text` storage (tiddler.text is string). */
/** Compute a stable hash for an event payload. SHA-256, hex-encoded. */
async function hashBytes(bytes: Uint8Array): Promise<string> {
  // .slice() copies into a fresh ArrayBuffer-backed Uint8Array — avoids the
  // SharedArrayBuffer-vs-ArrayBuffer typing conflict crypto.subtle.digest
  // imposes in strict mode.
  const buf = await crypto.subtle.digest("SHA-256", bytes.slice());
  return hex(new Uint8Array(buf));
}

export interface DaemonEventStoreOptions {
  /** The vessel grants this store only to the secret holder, outside every page recipe. */
  readonly secretStore?: LarTiddlerStore;
  /** A trusted storage capability confirms that this store's underlying document rests sealed. */
  readonly secretRest?: SecretRestCapability;
  readonly face: string;
}

export interface SecretRestCapability {
  /** Resolve true only after the secret document's storage confirms sealed rest. */
  assertSealed(): Promise<boolean>;
}

export class DaemonEventStore implements EventStore {
  constructor(private readonly opts: DaemonEventStoreOptions) {}

  private async home(): Promise<LarTiddlerStore> {
    if (!this.opts.secretStore || !this.opts.secretRest || !await this.opts.secretRest.assertSealed()) {
      throw new Error("secret-home-unavailable: Keyhive events require a secret store with confirmed sealed rest");
    }
    return this.opts.secretStore;
  }

  async put(rec: EventRecord): Promise<void> {
    const home = await this.home();
    const hash    = rec.hash || (await hashBytes(rec.bytes));
    const title   = capEventTitle(this.opts.face, hash);
    // Avoid re-writing identical events.
    const existing = await home.get(title);
    if (existing && existing.meta?.deleted !== true) return;

    const subTag = subTagFor(rec.variant);
    const tags   = subTag ? `${CAP_EVENT_TAG} ${subTag}` : CAP_EVENT_TAG;

    const record: LarTiddlerRecord = toLarTiddlerRecord(
      {
        title,
        text: bytesToBase64(rec.bytes),
        tags,
        face:       this.opts.face,
        variant:    rec.variant,
        hash,
        "bytes-len": String(rec.bytes.length),
        // CIV-3 — stamp the island scope (a keyhive DocumentId hex) so list(islandId) fetches one
        // slice; absent leaves the event cross-cutting (co-loaded by every island). Stamping stays
        // in the secret home.
        ...(rec.island !== undefined ? { island: rec.island } : {}),
      },
      { authority: "lares-keyhive" },
    );
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: `cap-event-${hash.slice(0, 8)}` };
    await home.put(record, origin);
  }

  async list(islandId?: string): Promise<readonly EventRecord[]> {
    const home = await this.home();
    const out: EventRecord[] = [];
    const titles = await home.listVisible();
    for (const title of titles) {
      if (!title.startsWith(`${SECRET_HOME_ID}/cap/`)) continue;
      const rec = await home.get(title);
      if (!rec || rec.meta?.deleted) continue;
      const fields = rec.tiddler as Record<string, string>;
      if (fields["face"] !== this.opts.face) continue;
      const variant = fields["variant"];
      const hash    = fields["hash"];
      const text    = rec.tiddler.text;
      if (!variant || !hash || !text) continue;
      const island = fields["island"];
      const record: EventRecord = island !== undefined ? { hash, variant, bytes: new Uint8Array(), island } : { hash, variant, bytes: new Uint8Array() };
      // CIV-3 — skip records outside the requested island slice BEFORE decoding the payload
      // (island own-events + cross-cutting unattributed; islandId absent → all).
      if (!inIslandSlice(record, islandId)) continue;
      try {
        out.push({ ...record, bytes: base64ToBytes(text) });
      } catch {
        // Malformed payload — skip; log via console for operator visibility.
        console.warn(`[daemon-event-store] skipped malformed cap event ${title}`);
      }
    }
    return out;
  }
}

/** Identify an event by its bytes — the one key both writers share. */
function bytesKey(bytes: Uint8Array): string {
  return hex(bytes);
}

/** The reach `absorbCapEvents` needs of a live keyhive — ingest, then let its handler's writes land. */
export interface CapEventSink {
  ingestPeerEvents(events: readonly Uint8Array[]): Promise<void>;
  settleEvents(): Promise<void>;
}

/**
 * Take a crossing's cap events into a live keyhive AND onto the store — TRUTH FIRST.
 *
 * The wire drops the variant (`eventsForPeer` hands bare bytes), but the receiver re-derives it: keyhive
 * parses those same bytes back into events and fires this provider's OWN handler, which stamps the real
 * variant and self-attributes the island off the event's subject. So the ingest is not merely a state
 * change here, it is the READING — and because `put` is first-writer-wins by content hash, it has to
 * happen before anything else writes. Persist first and an `UNTYPED` row masks a knowable variant for good.
 *
 * The trailing loop is the backstop: keyhive accepts a subset of any bundle, and what it did not take must
 * still persist for a boot replay. Those rows carry the sentinel honestly — nothing on this side read them.
 */
/** The guard refused at the boundary: the reading that licensed this absorb differs from the one it was asked under; nothing mutated, nothing persisted. */
export class IngestOvertaken extends Error {
  constructor() { super("cap-event ingest overtaken: the reading that licensed it changed before the mutation; nothing taken"); this.name = "IngestOvertaken"; }
}

/**
 * THE COMMIT BOUNDARY (`admit`): Keyhive changes membership inside `ingestPeerEvents`, before the caller's await returns, so a
 * check after the await reads a mutation already made. The caller's guard is asked HERE, synchronously, with no await between
 * the answer and the mutation's call: a guard that answers false refuses by name (`IngestOvertaken`) and the crossing neither
 * mutates nor persists. A proof change that lands after this line meets a committed membership.
 */
export async function absorbCapEvents(
  kh: CapEventSink,
  store: EventStore,
  events: readonly Uint8Array[],
  boundary: { readonly admit?: () => boolean } = {},
): Promise<void> {
  if (boundary.admit && !boundary.admit()) throw new IngestOvertaken();
  // THE READ MAY FAIL; THE RECORD MAY NOT. Keyhive refuses a bundle it cannot deserialize — a crossing packed
  // by a peer running other code, or one event corrupted in carriage — and it refuses the WHOLE array, not the
  // bad element. Persisting is what lets a later boot replay the crossing against whatever keyhive stands then,
  // so an unreadable bundle costs the vessel its variants, never its events.
  try {
    await kh.ingestPeerEvents(events);
  } catch (err) {
    console.warn(`[cap-events] ingest refused the crossing (${(err as Error)?.message ?? err}) — persisting it untyped for replay`);
  }
  // The handler persists fire-and-forget, so its typed rows are not yet in the store when ingest returns.
  await kh.settleEvents();
  // What the handler already wrote, read by CONTENT: both writers name a row by the sha256 of its bytes, and the
  // bytes are what identify an event across them.
  const taken = new Set<string>();
  for (const rec of await store.list()) taken.add(bytesKey(rec.bytes));
  for (const bytes of events) {
    if (taken.has(bytesKey(bytes))) continue;
    await store.put({ bytes, variant: CAP_EVENT_VARIANT_UNKNOWN, hash: await hashBytes(bytes) });
  }
}
