/**
 * carriage-serve-loop — the vessel's SERVE side of the carriage: it dials a carriage relay over an authenticated
 * WS channel and answers members' `want-block`s on a clean poll interval, so a sealed cad body crosses hearth to
 * hearth. This closes the LIVE-WIRE: a member over the relay carries a sealed ciphertext; a stranger draws Mu.
 *
 * INERT UNTIL CONFIGURED. The vessel starts NO loop when no relay URL rides the config — the caller gates the whole
 * thing, so an unconfigured boot opens zero carriage socket and changes zero behaviour (additive, off by default).
 *
 * CARRY ⊥ READ. The loop serves CIPHERTEXT + the void ONLY, gated by `serveCasWire`'s `carrierShareDecision`
 * (a proven MEMBER over a provably-sealed plane carries; a STRANGER / non-member / Kapae'd draws byte-identical Mu).
 * The read-cap NEVER rides this shore — it arrives via the keyring at admission, on the private lane.
 *
 * CLEAN LIFECYCLE. The connect runs fire-and-forget with a caught rejection (a down relay never blocks or crashes
 * the boot); once `auth-ok` lands, an interval polls. `stop()` latches the loop shut, clears the timer, and closes
 * the live channel — NON-BLOCKING, so a stop mid-handshake never hangs on a slow / half-open relay. A connect that
 * lands AFTER stop reads the latched flag and closes its own fresh channel (the stopped-guard below), so no timer /
 * socket survives teardown either way. A poll never overlaps itself (a slow serve turn holds the next tick off).
 *
 * HEAL — the RECONNECTING dialer (the immune keel's heal-after-drop tooth). A relay that drops mid-serve, a
 * partition, a restarted crossroads: the channel's `onClose` fires, the loop clears its poll timer and RE-DIALS on
 * a backoff until the relay answers again. A RE-connect (never the first) fires `onReconnect`, so the vessel
 * RE-FOLDS the board it read as-of-its-last-sync (a peer's bans/admits that landed during the gap). The first
 * dial fires no re-fold — it stood on a fresh read already. `stop()` latches every timer shut so no re-dial
 * outlives teardown. A relay down at boot retries on the backoff, unblocked, off-thread (boot never waits on it).
 *
 * TWO SOCKETS STAY TWO. This channel (Socket B, ciphertext) SEPARATES from the vessel's Automerge `/ws` relay
 * (Socket A, cleartext CRDT behind the DaemonAuthGate) — the two never cross.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/carriage-serve-loop
 */

import { MEMBERSHIP_BROADCAST, verifyCidBytes, type CasTransitTransport, type MembershipEnvelope } from "@lararium/mesh";
import { AuthenticatedWSMembershipChannel } from "./authenticated-membership-relay.js";
import { serveCasWireEnvelopes, CAS_HAVE, CAS_WANT_BLOCK, CAS_BLOCK, CAS_MU, type CasWireServerDeps } from "./cas-wire.js";

/** The default poll cadence — a member's want-block waits at most this long for a serve turn. */
const DEFAULT_POLL_INTERVAL_MS = 200;
/** The default backoff before a re-dial after a drop / a failed connect — bounds a flapping relay's retry rate. */
const DEFAULT_RECONNECT_DELAY_MS = 500;
/** A fetch waits this long for ONE holder's answer before it reads the void (a dead upstream leaves PENDING). */
const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/** A running carriage serve-loop — the vessel's answer side over the relay. */
export interface CarriageServeLoop {
  /** Latch the loop shut: clear the timer + close the channel (idempotent, awaits the pending connect). */
  stop(): Promise<void>;
  /** RE-SHARE: broadcast a `cas-have(cid)` over the LIVE channel for each cid, so the relay's bag-tracker re-learns
   *  this holder (after a prune / reconnect). Best-effort — a down channel offers nothing. Returns the count offered. */
  announce(cids: Iterable<string>): Promise<number>;
  /** THE FETCH DOOR's transport: `want-block` ONE holder over the live channel and await its `cas-block` / `cas-mu`.
   *  The bytes come back VERIFIED against the cid's own class; the void, a dead holder or a down channel → null.
   *  `discover` names the holders the caller configured (the fleet peers) — DHT-free, no tracker query. */
  transit(holders: () => readonly string[]): CasTransitTransport;
}

/** What the serve-loop dials with + answers over. */
export interface CarriageServeLoopConfig {
  /** The carriage relay URL (`ws://<host>:<port>`) — the vessel dials it and proves possession of `vesselSeed`. */
  readonly relayUrl:        string;
  /** The vessel's 32-byte Ed25519 seed — its PROVEN key stamps every envelope it offers. */
  readonly vesselSeed:    Uint8Array;
  /** This vessel's own membership address (its verifying-key hex) — the addr members want-block against. */
  readonly serverAddr:      string;
  /** The cas-wire serve deps (cadDir + the seal / membership / antigen / fedGate rings) — the carry-lane gate. */
  readonly deps:            CasWireServerDeps;
  /** The poll cadence in ms (default 200). */
  readonly pollIntervalMs?: number;
  /** Backoff before a re-dial after a drop / a failed connect (default 500). */
  readonly reconnectDelayMs?: number;
  /** Fired after a RE-connect completes (NEVER on the first connect) — the vessel re-folds its board here (HEAL). */
  readonly onReconnect?:    () => void | Promise<void>;
  /** A log sink for connect / serve faults (defaults to a no-op). */
  readonly onLog?:          (line: string) => void;
  /** How long one fetch waits for a holder's answer (default 8000). */
  readonly fetchTimeoutMs?: number;
}

/**
 * Start the carriage serve-loop. Dials the relay, completes the proof-of-possession handshake, then polls
 * `serveCasWire` on an interval. Returns immediately (the connect is async); `stop()` tears it down cleanly.
 */
export function startCarriageServeLoop(cfg: CarriageServeLoopConfig): CarriageServeLoop {
  const interval       = cfg.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const reconnectDelay = cfg.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const log = cfg.onLog ?? ((): void => { /* quiet */ });

  let stopped = false;
  let running = false;   // one serve turn at a time — a slow turn holds the next tick off (no overlap)
  let timer:          ReturnType<typeof setInterval>  | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>   | null = null;
  let channel: AuthenticatedWSMembershipChannel | null = null;
  let dials = 0;   // the first dial stands the loop; every dial past it is a RE-connect (fires onReconnect)
  const fetchTimeout = cfg.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  // The fetches this vessel has in flight, keyed by cid — a `cas-block` / `cas-mu` addressed to us settles the
  // waiter for that cid. ONE inbox serves both purposes: the poll below drains it once and routes each envelope
  // (a want-block → serve; a block / mu → settle), so a pending fetch never loses its answer to the serve side.
  const waiting = new Map<string, (bytes: Uint8Array | null) => void>();
  const settle = (cid: string, bytes: Uint8Array | null): void => {
    const w = waiting.get(cid);
    if (!w) return;
    waiting.delete(cid);
    w(bytes);
  };
  // The relay frames ride JSON, so a served Uint8Array arrives as a numeric-keyed object (or an array); read
  // either back to bytes. A base64 leg on the envelope stays the tidier carriage — a seam, not this loop's.
  const payloadBytes = (v: unknown): Uint8Array | null => {
    if (v instanceof Uint8Array) return v;
    if (Array.isArray(v)) return Uint8Array.from(v as number[]);
    if (v && typeof v === "object") return Uint8Array.from(Object.values(v as Record<string, number>));
    return null;
  };
  const routeResponses = (inbound: readonly MembershipEnvelope[]): MembershipEnvelope[] => {
    const rest: MembershipEnvelope[] = [];
    for (const env of inbound) {
      if (env.kind === CAS_BLOCK) {
        const p = env.payload as { cid?: unknown; bytes?: unknown };
        const cid = typeof p?.cid === "string" ? p.cid : "";
        const bytes = payloadBytes(p?.bytes);
        // The verify runs HERE, on the fetcher's side, against the cid's own class — a holder's word never stands in.
        settle(cid, bytes && verifyCidBytes(bytes, cid) ? bytes : null);
      } else if (env.kind === CAS_MU) {
        // The void carries no cid — settle EVERY waiter this holder could have answered as a miss. A void reads
        // the same for "denied" and "not held"; the requester learns nothing more, and PENDING stays PENDING.
        const p = env.payload as { cid?: unknown };
        if (typeof p?.cid === "string") settle(p.cid, null); else for (const cid of [...waiting.keys()]) settle(cid, null);
      } else if (env.kind === CAS_WANT_BLOCK) {
        rest.push(env);
      }
    }
    return rest;
  };

  const tick = (): void => {
    if (stopped || running || !channel) return;
    running = true;
    const ch = channel;
    void ch.poll(cfg.serverAddr)
      .then((inbound) => serveCasWireEnvelopes(routeResponses(inbound), ch, cfg.serverAddr, cfg.deps))
      .catch((err: unknown) => { log(`serve turn faulted: ${String(err)}`); })
      .finally(() => { running = false; });
  };

  const scheduleRedial = (): void => {
    if (stopped || reconnectTimer) return;              // one pending re-dial at a time; never past stop()
    reconnectTimer = setTimeout(() => { reconnectTimer = null; void dial(); }, reconnectDelay);
    reconnectTimer.unref?.();                           // a pending re-dial never keeps the process alive
  };

  // The live channel dropped (a relay restart / partition): clear the poll timer, drop the dead channel, and
  // schedule a re-dial. `stop()` sets `stopped` BEFORE it closes the channel, so a teardown-triggered close
  // reads `stopped` here and never reschedules — no re-dial outlives teardown.
  const onDrop = (): void => {
    if (timer) { clearInterval(timer); timer = null; }
    channel = null;
    if (!stopped) { log(`carriage channel dropped over ${cfg.relayUrl} — re-dialing`); scheduleRedial(); }
  };

  // Dial + latch the channel once auth-ok lands. A down relay / a pre-auth close REJECTS → caught, logged, and
  // RE-DIALED on a backoff (boot never blocks — the retry runs off-thread). A connect that lands after stop()
  // reads `stopped` and closes its own channel — no leak, no matter the order. A RE-connect fires onReconnect.
  const dial = async (): Promise<void> => {
    if (stopped) return;
    const attempt = ++dials;
    try {
      const ch = await AuthenticatedWSMembershipChannel.connect(cfg.relayUrl, cfg.vesselSeed, { onClose: onDrop });
      if (stopped) { ch.close(); return; }              // stopped mid-connect → close the fresh channel, no timer
      channel = ch;
      timer = setInterval(tick, interval);
      if (attempt === 1) {
        log(`carriage serve-loop up over ${cfg.relayUrl} (serverAddr ${cfg.serverAddr})`);
      } else {
        log(`carriage serve-loop RE-connected over ${cfg.relayUrl} (attempt ${attempt}) — re-folding the board`);
        try { await cfg.onReconnect?.(); } catch (err) { log(`onReconnect faulted: ${String(err)}`); }
      }
    } catch (err) {
      if (stopped) return;
      log(`carriage connect failed (${cfg.relayUrl}): ${String(err)} — retrying in ${reconnectDelay}ms`);
      scheduleRedial();
    }
  };

  void dial();

  return {
    async stop(): Promise<void> {
      stopped = true;                                    // a still-pending connect will close its own channel on land
      if (timer)          { clearInterval(timer);   timer = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      channel?.close();                                  // close the LIVE channel (null when the handshake never landed)
      channel = null;
    },
    async announce(cids: Iterable<string>): Promise<number> {
      const ch = channel;
      if (!ch || stopped) return 0;                      // down / torn-down → nothing to announce over (best-effort)
      let n = 0;
      for (const cid of cids) {
        await ch.offer({ kind: CAS_HAVE, from: cfg.serverAddr, to: MEMBERSHIP_BROADCAST, payload: { cid } });
        n += 1;
      }
      return n;
    },
    transit(holders: () => readonly string[]): CasTransitTransport {
      return {
        async discover() { return channel && !stopped ? holders() : []; },   // a down channel knows no holder
        fetchBlock(cid, holder) {
          const ch = channel;
          if (!ch || stopped) return Promise.resolve(null);
          if (waiting.has(cid)) return Promise.resolve(null);                // one fetch per cid in flight
          return new Promise<Uint8Array | null>((resolve) => {
            const timer = setTimeout(() => settle(cid, null), fetchTimeout);  // a dead holder → the void, no fault
            timer.unref?.();
            waiting.set(cid, (bytes) => { clearTimeout(timer); resolve(bytes); });
            ch.offer({ kind: CAS_WANT_BLOCK, from: cfg.serverAddr, to: holder, payload: { cid } })
              .catch((err: unknown) => { log(`want-block offer faulted: ${String(err)}`); settle(cid, null); });
          });
        },
      };
    },
  };
}
