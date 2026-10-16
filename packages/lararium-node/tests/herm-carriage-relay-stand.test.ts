/**
 * herm-carriage-relay-stand.test.ts — a Herm STANDS its relay port, and the port opens no WebSocket.
 *
 * The herm's relay port serves persona-KEL drops over plain HTTP and destroys every WebSocket upgrade before any
 * 101. So a member's carry and a stranger's Mu have no socket to ride (their ring laws live in the cas-wire suites),
 * and what this suite proves is the port's standing shore:
 *   · INERT — the EXACT boot gate (`relayPort !== null ? startCarriageRelay : null`) stands nothing when no relay
 *     port rides the config, and a listener when it does;
 *   · SHUT — a dialer at the stood port on its pinned knock never reaches an open socket (the upgrade's silence
 *     is asserted at the relay itself, in herm-relay-port.test);
 *   · STABLE IDENTITY — `resolveRelayGateSeed` yields the SAME gate key across restarts from the Herm's own
 *     identity seed, a DIFFERENT one from a pinned seed hex, and NEVER a fresh random;
 *   · CLEAN TEARDOWN — `close()` stops the crossroads: its port answers nothing afterwards.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/herm-carriage-relay-stand
 */
import { afterEach, describe, test, expect } from "vitest";
import { connect } from "node:net";
import { WebSocket } from "ws";
import { knockSegment, hex } from "@lararium/mesh";
import { startCarriageRelay, resolveRelayGateSeed, type CarriageRelay } from "../src/carriage-relay.js";

/** The EXACT boot gate: a relay stands ONLY when a port rides the config, on the resolved (stable) gate seed. */
function bootRelayGate(cfg: {
  vesselSeed: Uint8Array; relayPort: number | null; gateSeedHex?: string;
}): Promise<CarriageRelay | null> {
  const seed = resolveRelayGateSeed(cfg.vesselSeed, cfg.gateSeedHex);
  return cfg.relayPort !== null && !Number.isNaN(cfg.relayPort)
    ? startCarriageRelay({ gateSeed: seed, port: cfg.relayPort })
    : Promise.resolve(null);
}

/** Does a WS dial to `url` reach an OPEN socket? A shut route destroys the upgrade, so `error` or `close` answers false. */
function opens(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const done = (v: boolean) => { try { ws.close(); } catch { /* down */ } resolve(v); };
    ws.on("open", () => done(true));
    ws.on("error", () => done(false));
    ws.on("close", () => done(false));
    setTimeout(() => done(false), 3000);
  });
}

describe("herm-carriage-relay-stand — a Herm stands its relay port and the port opens no socket; off = inert", () => {
  let relay: CarriageRelay | null = null;
  afterEach(async () => { if (relay) { try { await relay.close(); } catch { /* down */ } relay = null; } });

  test("INERT + SHUT: no port stands nothing; with a port the relay port stands and opens no socket", async () => {
    const hermSeed = new Uint8Array(32).fill(21);
    expect(await bootRelayGate({ vesselSeed: hermSeed, relayPort: null })).toBeNull();

    relay = await bootRelayGate({ vesselSeed: hermSeed, relayPort: 0 });
    expect(relay).not.toBeNull();
    const url = `ws://127.0.0.1:${relay!.port}/ws/${knockSegment(relay!.gatePubKey, "/ws")}`;
    expect(await opens(url)).toBe(false);
  }, 20_000);

  test("STABLE IDENTITY: the resolved gate seed is deterministic — same across restarts, distinct from a pinned seed", async () => {
    const hermSeed = new Uint8Array(32).fill(31);

    // Two "restarts" from the Herm's own identity seed → the IDENTICAL gate seed (a hearth keeps dialing one key).
    const restart1 = resolveRelayGateSeed(hermSeed);
    const restart2 = resolveRelayGateSeed(hermSeed);
    expect([...restart2]).toEqual([...restart1]);   // stable across restarts — the property that matters

    // A pinned seed hex → a DIFFERENT, still-deterministic key (the operator's out-of-band choice).
    const pinnedHex = "aa".repeat(32);
    const pinned1 = resolveRelayGateSeed(hermSeed, pinnedHex);
    const pinned2 = resolveRelayGateSeed(hermSeed, pinnedHex);
    expect([...pinned1]).toEqual([...pinned2]);
    expect([...pinned1]).not.toEqual([...hermSeed]);   // the pin overrides the identity seed
    expect(hex(pinned1)).toBe(pinnedHex);

    // An empty / absent seed hex falls back to the identity seed — never a fresh random.
    // ★ AND THE DERIVED SEED IS NOT THE VESSEL'S OWN ★ — an empty/absent pin still DERIVES rather than
    // passing the identity seed through. These two lines once asserted equality, pinning the flaw: the
    // relay gate key WAS the vessel identity key, published to every dialing hearth, joining two trust
    // domains in one correlatable pair. Deterministic still, separated now.
    expect([...resolveRelayGateSeed(hermSeed, "")]).not.toEqual([...hermSeed]);
    expect([...resolveRelayGateSeed(hermSeed, undefined)]).not.toEqual([...hermSeed]);
    expect([...resolveRelayGateSeed(hermSeed, "")]).toEqual([...resolveRelayGateSeed(hermSeed, undefined)]);
    expect(resolveRelayGateSeed(hermSeed).length).toBe(32);   // an Ed25519 seed's exact width

    // The gate PUBKEY the two restarts announce is therefore identical — the stable-identity guarantee, end to end.
    const stood1 = await startCarriageRelay({ gateSeed: restart1, port: 0 });
    const stood2 = await startCarriageRelay({ gateSeed: restart2, port: 0 });
    try { expect(stood1.gatePubKey).toBe(stood2.gatePubKey); }
    finally { await stood1.close(); await stood2.close(); }
  }, 20_000);

  test("CLEAN TEARDOWN: close() stops the crossroads — its port answers nothing afterwards", async () => {
    const hermSeed = new Uint8Array(32).fill(41);
    const stood = await bootRelayGate({ vesselSeed: hermSeed, relayPort: 0 });
    expect(stood).not.toBeNull();
    const port = stood!.port;
    const listens = (): Promise<boolean> => new Promise((resolve) => {
      const sock = connect({ host: "127.0.0.1", port });
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => resolve(false));
    });
    expect(await listens(), "control: the listener stands before close()").toBe(true);
    await stood!.close();
    expect(await listens()).toBe(false);
  }, 20_000);
});
