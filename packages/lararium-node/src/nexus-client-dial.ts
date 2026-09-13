/**
 * nexus-client-dial — the vessel's CLIENT dial-out leg (Socket A, cleartext CRDT). Today a node stands
 * only a SERVER adapter (`ListeningWSServerAdapter` behind the `DaemonAuthGate`); NONE dials out. When a
 * peer sync URL rides the config, the live vessel mounts a `LarWSClientAdapter` — carrying the OPERATOR's
 * OWN Ed25519 identity + the peer's gate verifying-key — onto its running Automerge `Repo`, so it DIALS a
 * peer node's `/ws` and syncs. This is the SAME-OPERATOR device path: a second device whose key sits in
 * the founder's PersonaGroup dials in, the peer's gate vouches it `same-operator`, and full private sync
 * breathes both ways (`self-slot-share.ts`, `selfSlotShareDecision`).
 *
 * INERT UNTIL CONFIGURED. `maybeStartNexusClientDial` returns null when no sync URL / gate key rides the
 * config — NO adapter mounts, NO socket opens, the boot behaves EXACTLY as it did before (additive, off by
 * default). The caller gates the whole thing, the same discipline the carriage serve-loop follows.
 *
 * ONE SOCKET, ITS OWN. This client dial rides the Automerge `/ws` relay (Socket A) — the SAME transport the
 * server adapter answers on, cleartext CRDT behind the gate. It NEVER touches the carriage relay (Socket B,
 * ciphertext cad bodies); the two stay two.
 *
 * REAL CRYPTO, NEVER FORGED. The dial carries the operator's OWN leaf identity (its cached ContactCard +
 * bare-Ed25519 signer) and binds its V3 proof-of-possession to the DIALED peer's gate key (known
 * out-of-band, NEVER trusted from the wire — the anti-relay law). An un-admitted key ANERGIZES at the
 * peer's gate and never syncs; the deny is load-bearing, not an incidental transport failure.
 *
 * THE RETURN IS ARMED. The adapter re-dials on its own and the transport re-attaches, but a Repo re-offers
 * only the docs a live query already registered — so a `find` that settled `unavailable` during a partition
 * leaves nothing to re-offer and that document never crosses again. `armDialReconnect` counts the adapter's
 * `peer-candidate` crossings: the first is the connect, every one after it is a RETURN, and a return re-folds
 * through `onReconnect` and re-asks `docUrl`. Socket B has carried this since `carriage-serve-loop.ts`'s
 * `attempt > 1`; Socket A carries it here.
 *
 * CLEAN LIFECYCLE. `stop()` stands the re-arm down and disconnects the client adapter (standing down its
 * reconnect loop), so no socket leaks past the vessel's close — folded into the vessel teardown beside the
 * carriage loop's `stop()`.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-client-dial
 */

import type { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { LarWSClientAdapter, DAEMON_BAG_ID } from "@lararium/mesh";
import type { LeafIdentity } from "@lararium/mesh";

/** A mounted client dial — the adapter it mounted (for assertion) + a clean stop. */
export interface NexusClientDial {
  /** The mounted client adapter — carries `.anergized` (the peer's refusal, or null). */
  readonly adapter: LarWSClientAdapter;
  /** Disconnect the client adapter + stand down its reconnect loop (idempotent). */
  stop(): void;
}

/** What the dial-out mounts with. */
export interface NexusClientDialConfig {
  /** The running Automerge Repo the client adapter mounts onto (Socket A). */
  readonly repo:       Repo;
  /** The peer node's `/ws` URL (`ws://…/ws` or `wss://…/ws`) this vessel dials. */
  readonly syncUrl:    string;
  /** The DIALED peer's gate verifying-key hex — the gate-binding the V3 proof commits to (out-of-band). */
  readonly gatePubKey: string;
  /** This vessel's OWN leaf identity — cached ContactCard + bare-Ed25519 signer (never a forged one). */
  readonly identity:   LeafIdentity;
  /** The target bag URI the proof seeks (`aud`) — defaults to the daemon bag, the gate's armed audience. */
  readonly aud?:       string;
  /** OPTIONAL: an island/doc URL to `repo.find()` once mounted — pulls the peer's doc across the socket.
   *  Consumes the device-admit payload's `islandDocUrl`. Absent → the vessel syncs only docs it already knows. */
  readonly docUrl?:    string | null;
  /** A log sink for the dial (defaults to a no-op). */
  readonly onLog?:     (line: string) => void;
  /** THE RETURN. Fires on every re-connect PAST THE FIRST — the counterpart Socket B already stands
   *  (`carriage-serve-loop.ts` `attempt > 1`). A caller re-folds the boards a partition staled and
   *  re-reads the Repo's cached share verdicts here; a re-ask of `docUrl` follows it regardless. */
  readonly onReconnect?: () => Promise<void> | void;
}

/** The adapter shape the re-arm reads — its own `peer-candidate` event and nothing else. Named as a
 *  SHAPE rather than the concrete adapter so the arm constructs no socket and a witness can drive it. */
export interface DialCandidateSource {
  on(event: "peer-candidate", listener: (payload: { peerId: string }) => void): unknown;
  off?(event: "peer-candidate", listener: (payload: { peerId: string }) => void): unknown;
  removeListener?(event: "peer-candidate", listener: (payload: { peerId: string }) => void): unknown;
}

/** The one Repo reading the re-arm performs. */
export interface DialDocAsker { find(url: string): Promise<unknown>; }

/**
 * ARM THE RETURN on Socket A.
 *
 * The inherited `WebSocketClientAdapter` re-dials on its own and nothing above it hears, so a peer that
 * comes back from a partition re-attaches at the transport and NOTHING re-asks: `CollectionSynchronizer`
 * re-offers only the docs a live query already registered, and a `find` that settled `unavailable` during
 * the cut left no query to re-offer — so that document never crosses again, silently. Beside it, the
 * boards the cut staled (membership · posture · realm registrations) stay stale, and the Repo caches its
 * share verdict per (doc, peer) until something asks it to read anew.
 *
 * The adapter announces each successful gate crossing as `peer-candidate`. The FIRST is the connect; every
 * one after it is a RETURN. On a return the arm re-folds through `onReconnect` and then re-asks `docUrl`.
 *
 * FAIL-SOFT BOTH WAYS, and the order carries it: a torn re-fold MUST NOT cost the re-ask (the doc is the
 * thing the operator notices), and a down peer's rejected re-ask must cost the next return and never the
 * process. Both are caught here, and both are logged.
 */
export function armDialReconnect(input: {
  readonly adapter:      DialCandidateSource;
  readonly repo:         DialDocAsker;
  readonly docUrl?:      string | null;
  readonly onReconnect?: () => Promise<void> | void;
  readonly onLog?:       (line: string) => void;
}): { stop(): void } {
  const log = input.onLog ?? ((): void => { /* quiet */ });
  let crossings = 0;
  let stopped = false;
  const onCandidate = ({ peerId }: { peerId: string }): void => {
    crossings += 1;
    if (stopped || crossings < 2) return;                    // the first crossing is the CONNECT
    void (async () => {
      log(`nexus dial-out RE-connected at peer ${peerId} — re-folding the boards and re-asking the peer doc`);
      try { await input.onReconnect?.(); }
      catch (err: unknown) { log(`nexus dial-out re-fold failed (the re-ask follows anyway): ${String(err)}`); }
      if (stopped || !input.docUrl) return;
      try { await input.repo.find(input.docUrl); log(`nexus dial-out re-asked peer doc ${input.docUrl}`); }
      catch (err: unknown) { log(`nexus dial-out could not re-ask peer doc ${input.docUrl}: ${String(err)}`); }
    })();
  };
  input.adapter.on("peer-candidate", onCandidate);
  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      const drop = input.adapter.off ?? input.adapter.removeListener;
      try { drop?.call(input.adapter, "peer-candidate", onCandidate); } catch { /* an adapter that drops nothing keeps a listener that now returns early */ }
    },
  };
}

/**
 * Mount the client dial-out onto the running Repo. Adds a `LarWSClientAdapter` to the repo's network
 * subsystem (the adapter dials + runs the V3 handshake on connect), then — when a `docUrl` rides the
 * config — kicks a `repo.find()` to pull the peer's doc across the crossed socket. Returns the mounted
 * dial; `stop()` disconnects it cleanly.
 */
export function startNexusClientDial(cfg: NexusClientDialConfig): NexusClientDial {
  const log = cfg.onLog ?? ((): void => { /* quiet */ });
  const adapter = new LarWSClientAdapter({
    url:        cfg.syncUrl,
    identity:   cfg.identity,
    aud:        cfg.aud ?? DAEMON_BAG_ID,
    gatePubKey: cfg.gatePubKey,
  });
  cfg.repo.networkSubsystem.addNetworkAdapter(adapter);
  log(`nexus dial-out up → ${cfg.syncUrl} (aud=${cfg.aud ?? DAEMON_BAG_ID})`);

  // Pull the peer's named doc, when one rides the config. A denial reads as "never resolved" (the adapter
  // anergizes at the gate), so the find just never settles — never a crash. Fire-and-forget with a caught
  // rejection so a down peer / an un-admitted key never blocks or crashes the boot.
  if (cfg.docUrl) {
    void cfg.repo.find(cfg.docUrl as AutomergeUrl).then(
      () => log(`nexus dial-out synced peer doc ${cfg.docUrl}`),
      (err: unknown) => log(`nexus dial-out could not resolve peer doc ${cfg.docUrl}: ${String(err)}`),
    );
  }

  // THE RETURN. Without this the dial is connect-once: the adapter re-dials, the transport re-attaches,
  // and no doc is re-asked and no verdict re-read — the seam the docker `meme` PARTITION step names.
  const rearm = armDialReconnect({
    adapter,
    repo: { find: (url) => cfg.repo.find(url as AutomergeUrl) },
    ...(cfg.docUrl ? { docUrl: cfg.docUrl } : {}),
    ...(cfg.onReconnect ? { onReconnect: cfg.onReconnect } : {}),
    onLog: log,
  });

  let stopped = false;
  return {
    adapter,
    stop(): void {
      if (stopped) return;
      stopped = true;
      rearm.stop();
      try { adapter.disconnect(); } catch { /* never connected / already down */ }
      log(`nexus dial-out down → ${cfg.syncUrl}`);
    },
  };
}

/** The resolved dial-out config — a sync URL + a gate key both present, else null (inert). */
export interface NexusClientDialInput {
  readonly repo:        Repo;
  readonly syncUrl?:    string | null;
  readonly gatePubKey?: string | null;
  readonly identity:    LeafIdentity;
  readonly aud?:        string;
  readonly docUrl?:     string | null;
  readonly onLog?:      (line: string) => void;
  readonly onReconnect?: () => Promise<void> | void;
}

/**
 * The INERT gate: mount the client dial ONLY when BOTH a sync URL and a peer gate key ride the config;
 * otherwise return null — no adapter, no socket, zero behaviour change. A sync URL without a gate key
 * cannot bind the anti-relay proof, so it fails CLOSED to inert (never a gate-less dial).
 */
export function maybeStartNexusClientDial(input: NexusClientDialInput): NexusClientDial | null {
  const syncUrl = input.syncUrl?.trim();
  const gate    = input.gatePubKey?.trim();
  if (!syncUrl) return null;                       // no peer configured → the leaf carries only what it pulls
  if (!gate) {
    input.onLog?.(`nexus dial-out SKIPPED — a sync URL (${syncUrl}) rides the config but no gate key (LAR_JOIN_GATE); a gate-less dial cannot bind the anti-relay proof (fail-closed to inert)`);
    return null;
  }
  return startNexusClientDial({
    repo:       input.repo,
    syncUrl,
    gatePubKey: gate,
    identity:   input.identity,
    ...(input.aud ? { aud: input.aud } : {}),
    ...(input.docUrl ? { docUrl: input.docUrl } : {}),
    ...(input.onLog ? { onLog: input.onLog } : {}),
    ...(input.onReconnect ? { onReconnect: input.onReconnect } : {}),
  });
}
