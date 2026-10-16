/**
 * carriage-relay-serve-loop.test.ts — the carriage serve-loop ships SHUT by name beside the retired relay wire.
 *
 * The loop dialed a carriage relay over the challenge/auth handshake and answered members' want-blocks. That
 * handshake is retired and house ruling "Routes at the cutover" ships the herm membership relay SHUT by name:
 * "a closed route grants no silent legacy authority". So the live carriage (a member carrying a sealed body, a
 * stranger drawing Mu, the heal-after-drop re-dial) has no transport until a gate-native caller flips it, and
 * its old vectors retire with the wire they rode. The carriage's ring laws (who may carry; the void for the
 * rest) live in the cas-wire suites, over no socket at all.
 *
 * What stays true, and is proven here:
 *   · INERT: an unconfigured vessel stands no loop and says nothing;
 *   · SHUT, by name: a configured loop meets the refusal, logs it ONCE by name, and does not redial — no timer
 *     outlives the refusal, and a mutant that retries it is caught by the redial log;
 *   · the shut loop is inert in every verb: it names no holder, offers nothing, and a stop is clean and repeatable;
 *   · nothing is dialed: a socket counter beside the pinned address sees no connection at all.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/carriage-relay-serve-loop
 */
import { afterEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { DeterministicFederationGate } from "@lararium/mesh";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import type { CasWireServerDeps } from "../src/cas-wire.js";
import { MEMBERSHIP_RELAY_SHUT } from "../src/authenticated-membership-relay.js";
import { startCarriageServeLoop, type CarriageServeLoop } from "../src/carriage-serve-loop.js";
import { membershipOf, antigenOf } from "./cas-test-setup.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("carriage-relay-serve-loop — the loop meets the shut relay by name, redials nothing, dials nothing", () => {
  const loops: CarriageServeLoop[] = [];
  const dirs: string[] = [];
  const mkDir = (tag: string): string => { const d = mkdtempSync(join(tmpdir(), `lares-carriage-${tag}-`)); dirs.push(d); return d; };
  afterEach(async () => {
    for (const l of loops.splice(0)) { try { await l.stop(); } catch { /* down */ } }
    for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } }
  });

  const depsFor = (tag: string): CasWireServerDeps => ({
    cadDir: mkDir(tag), seal: makeSealedPlaneRegistry().seal,
    membership: membershipOf([]), antigen: antigenOf([]), fedGate: new DeterministicFederationGate("00".repeat(8)),
  });

  test("INERT: an unconfigured vessel stands no loop; a configured one dials NOTHING and says the shut once, by name", async () => {
    let connections = 0;
    const sockets: WebSocket[] = [];
    const counter = new WebSocketServer({ port: 0 });
    counter.on("connection", (s: WebSocket) => { connections += 1; sockets.push(s); });
    await new Promise<void>((r) => counter.on("listening", () => r()));
    const addr = counter.address();
    const url = `ws://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}#${"ab".repeat(32)}`;
    const seed = new Uint8Array(32).fill(6);
    const said: string[] = [];
    try {
      // UNCONFIGURED: the exact ternary the boot uses stands no loop.
      const unconfigured: string | null = null;
      const inert: CarriageServeLoop | null = unconfigured ? startCarriageServeLoop({ relayUrl: unconfigured, vesselSeed: seed, serverAddr: "x", deps: depsFor("inert") }) : null;
      expect(inert).toBeNull();
      expect(said).toEqual([]);

      // CONFIGURED: the loop meets the refusal and names it.
      const loop = startCarriageServeLoop({
        relayUrl: url, vesselSeed: seed, serverAddr: "x", deps: depsFor("live"), pollIntervalMs: 20, reconnectDelayMs: 20,
        onLog: (line) => said.push(line),
      });
      loops.push(loop);
      const deadline = Date.now() + 10_000;
      while (!said.some((l) => l.includes(MEMBERSHIP_RELAY_SHUT)) && Date.now() < deadline) await sleep(10);
      expect(said.filter((l) => l.includes(MEMBERSHIP_RELAY_SHUT))).toHaveLength(1);

      // Many redial windows later: still one refusal, no retry line, and the counter never saw a socket.
      await sleep(300);
      expect(said.filter((l) => l.includes(MEMBERSHIP_RELAY_SHUT))).toHaveLength(1);
      expect(said.filter((l) => /retrying in|re-dialing|RE-connected|serve-loop up/.test(l))).toEqual([]);
      expect(connections).toBe(0);
    } finally {
      for (const s of sockets) { try { s.close(); } catch { /* down */ } }
      await new Promise<void>((r) => counter.close(() => r()));
    }
  }, 20_000);

  test("the shut loop is inert in every verb: it names no holder, offers nothing, and stops clean twice", async () => {
    const loop = startCarriageServeLoop({
      relayUrl: `ws://127.0.0.1:9#${"ab".repeat(32)}`, vesselSeed: new Uint8Array(32).fill(7), serverAddr: "y", deps: depsFor("verbs"),
      pollIntervalMs: 20, reconnectDelayMs: 20,
    });
    loops.push(loop);
    await sleep(100);
    expect(await loop.transit(() => ["peer"]).discover()).toEqual([]);
    expect(await loop.announce(["cid-a", "cid-b"])).toBe(0);
    await loop.stop();
    await loop.stop();
  }, 20_000);
});
