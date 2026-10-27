/**
 * carriage-relay — the CARRIAGE capability as a live, registrable service: the herm's relay port (persona-KEL
 * drops over plain HTTP; every WebSocket upgrade meets silence) PLUS the DHT-free `cid → holders` bag-tracker,
 * composed into one startable unit.
 *
 * WHAT IT HOLDS, WHAT IT NEVER HOLDS. The port carries no envelope, so the tracker's announce sniff hears nothing and
 * the HINT index (cids + holder handles, secret-free) stands empty. It carries NO read-cap, reads NO plaintext, keeps
 * NO charter / content key / roster — a compromised carriage leaks nothing (carry ⊥ read ⊥ contract). It stands from a
 * 32-byte gate seed + a bound port and nothing else, so a bare hearth stands one with a single call.
 *
 * TWO PORTS STAY TWO. This relay port SEPARATES from the Automerge `/ws` doc relay (Socket A, cleartext
 * CRDT behind the face gate) — cleartext CRDT never routes through here, so carry ⊥ read holds at the transport.
 *
 * ISOMORPHISM BY COMPOSITION. It re-uses `startHermRelayPort` (the herm's drop port) and `makeBagTracker` (the
 * discovery index) VERBATIM — it re-derives no gate, no crypto, no index.
 *
 * NO-GLOBAL-NOW: the bag-tracker reads "holders as the relay last heard", never a global truth; a member re-verifies
 * every fetched byte itself (`verifyCiphertextCid`), so the tracker stays a hint, never an authority on the bytes.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/carriage-relay
 */

import * as ed from "@noble/ed25519";
import { hex, type MembershipEnvelope } from "@lararium/mesh";
import {
  startHermRelayPort,
  type HermRelayPort, type RelayAnnounceObserver,
} from "./herm-relay-port.js";
import { CAS_HAVE } from "./cas-wire.js";
import { makeBagTracker, type BagTracker } from "./bag-tracker.js";

/** A running carriage relay — the authenticated transport, its bound port, and the DHT-free discovery index. */
export interface CarriageRelay {
  /** The bound port the members dial (`ws://<host>:<port>`). */
  readonly port: number;
  /** The durable relay row's verifying key, handed to dialing hearths with the URL. */
  readonly gatePubKey: string;
  /** The `cid → holders` hint index the Nexus discovers sealed bodies through (secret-free, plaintext-blind). */
  readonly tracker: BagTracker;
  /** Tear the transport down (closes the WS server + every peer socket). */
  close(): Promise<void>;
}

/**
 * Stand a carriage relay: the authenticated membership transport bound to `port` (0 → an OS-assigned free port),
 * plus an empty bag-tracker. The gate seed binds the proof-of-possession challenge (a peer proves it holds its key
 * before any envelope crosses); it grants NO read-cap and names NO roster — the member gate lives on the cas-wire
 * SERVE side (in the vessels), never here.
 */
export function startCarriageRelay(cfg: {
  gateSeed: Uint8Array;
  port?: number;
  /** Every sibling frame the relay carries, exactly as it carries it — the herm's whole sight of a channel. */
  onSiblingFrame?: RelayAnnounceObserver["onSiblingFrame"];
  /** Where the relay journals the successor drops it verified, so a restarted herm keeps them. */
  dropJournalPath?: string;
}): Promise<CarriageRelay> {
  return (async (): Promise<CarriageRelay> => {
    const tracker = makeBagTracker();
    // Per-holder cid set — so a DEPARTED holder's every announced cid prunes at once (the tracker forgets by
    // {cid, holder}, holding no holder→cids reverse index; this sniff-local map supplies it, tracker unchanged).
    const heldByHolder = new Map<string, Set<string>>();

    // The RE-SHARE sniff: a PROVEN peer's `cas-have(cid)` announce lands `cid → holder` in the bag-tracker FROM
    // THE WIRE (the leg that stood empty). A departure prunes every cid that holder announced. The tracker stays
    // a HINT — a member re-verifies `verifyCiphertextCid` on the fetched bytes, so a stale/hostile hint is caught.
    const relay: HermRelayPort = await startHermRelayPort(cfg.gateSeed, cfg.port ?? 0, {
      onEnvelope: (env: MembershipEnvelope) => {
        if (env.kind !== CAS_HAVE) return;                                  // only the announce leg feeds discovery
        const cid = typeof (env.payload as { cid?: unknown })?.cid === "string" ? (env.payload as { cid: string }).cid : "";
        if (!cid) return;
        tracker.note(cid, env.from);                                        // env.from is the relay-PROVEN key (never spoofable)
        let held = heldByHolder.get(env.from);
        if (!held) { held = new Set<string>(); heldByHolder.set(env.from, held); }
        held.add(cid);
      },
      onLeave: (from: string) => {
        const held = heldByHolder.get(from);
        if (!held) return;
        for (const cid of held) tracker.forget(cid, from);                  // prune every cid this holder announced
        heldByHolder.delete(from);
      },
      ...(cfg.onSiblingFrame ? { onSiblingFrame: cfg.onSiblingFrame } : {}),
    }, cfg.dropJournalPath ? { dropJournalPath: cfg.dropJournalPath } : {});
    const gatePubKey = hex(await ed.getPublicKeyAsync(cfg.gateSeed));
    return {
      port: relay.port,
      gatePubKey,
      tracker,
      close: () => relay.close(),
    };
  })();
}
