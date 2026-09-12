/**
 * fetch-door.test — THE FETCH DOOR over a LIVE carriage (basket-one #/the-fetch-door, ruled 2026-09-11).
 *
 * Two hearths dial one crossroads. A holds a cleartext `cid/` blob a pointer names; B holds the pointer alone.
 * B's resolver — `makeCidResolver(localRead, loop.transit(fleetHolders), cacheWriteThrough)` — misses locally,
 * `want-block`s A over Socket B, A's gate reads B as FLEET and serves the cleartext, B verifies sha256 and
 * writes through. Fetch-on-read: nothing moved until B read.
 *
 * CONTROLS: a CONTRACT member (not fleet) asking the same cleartext cid draws Mu and caches nothing; a holder
 * that never answers (a dead upstream) leaves the read null after the window — no fault, no fabricated bytes.
 */
import { afterEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { DeterministicFederationGate, utf8Bytes, hex, sha256HexBytesSync, makeCidResolver } from "@lararium/mesh";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import type { CasWireServerDeps } from "../src/cas-wire.js";
import { startCarriageRelay, type CarriageRelay } from "../src/carriage-relay.js";
import { startCarriageServeLoop, type CarriageServeLoop } from "../src/carriage-serve-loop.js";
import { readCasBlobFromFs, writeCasEntriesFs } from "../src/node-cas.js";
import { membershipOf, antigenOf } from "./cas-test-setup.js";

const pubOf = (seed: Uint8Array): Promise<string> => ed.getPublicKeyAsync(seed).then(hex);
const CLEAR = utf8Bytes("a grandmother's likeness, public, riding as bytes and never as text");
const CLEAR_CID = sha256HexBytesSync(CLEAR);

describe("the fetch door — a fleet peer's read pulls a cleartext blob across Socket B", () => {
  let relay: CarriageRelay | null = null;
  const loops: CarriageServeLoop[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const l of loops) await l.stop();
    loops.length = 0;
    await relay?.close();
    relay = null;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function depsFor(cidDir: string, fleet: string[], members: string[], selfKey: string): CasWireServerDeps {
    const reg = makeSealedPlaneRegistry();
    const cadDir = mkdtempSync(join(tmpdir(), "cad-")); dirs.push(cadDir);
    return { cadDir, cidDir, seal: reg.seal, membership: membershipOf(members), antigen: antigenOf([]),
             fedGate: new DeterministicFederationGate(selfKey), fleet: (p) => fleet.includes(p) };
  }

  test("B reads → A serves the cleartext to its FLEET peer → B verifies + writes through; a CONTRACT member draws Mu", async () => {
    const seedA = new Uint8Array(32).fill(11), seedB = new Uint8Array(32).fill(12), seedC = new Uint8Array(32).fill(13);
    const [keyA, keyB, keyC] = await Promise.all([pubOf(seedA), pubOf(seedB), pubOf(seedC)]);
    const cidA = mkdtempSync(join(tmpdir(), "cidA-")), cidB = mkdtempSync(join(tmpdir(), "cidB-")), cidC = mkdtempSync(join(tmpdir(), "cidC-"));
    dirs.push(cidA, cidB, cidC);
    writeFileSync(join(cidA, CLEAR_CID), CLEAR);

    relay = await startCarriageRelay({ gateSeed: seedA });
    const url = `ws://127.0.0.1:${relay.port}`;
    // A: fleet = {B}; members (CONTRACT) = {C}. C stands as a contracted cabal's hearth, never fleet.
    const loopA = startCarriageServeLoop({ relayUrl: url, vesselSeed: seedA, serverAddr: keyA, deps: depsFor(cidA, [keyB], [keyC], keyA), pollIntervalMs: 25 });
    const loopB = startCarriageServeLoop({ relayUrl: url, vesselSeed: seedB, serverAddr: keyB, deps: depsFor(cidB, [], [], keyB), pollIntervalMs: 25 });
    const loopC = startCarriageServeLoop({ relayUrl: url, vesselSeed: seedC, serverAddr: keyC, deps: depsFor(cidC, [], [], keyC), pollIntervalMs: 25 });
    loops.push(loopA, loopB, loopC);
    await new Promise((r) => setTimeout(r, 400));   // the three dials land

    const resolveB = makeCidResolver((cid) => readCasBlobFromFs(cid, cidB), loopB.transit(() => [keyA]),
                                     (cid, bytes) => { writeCasEntriesFs([{ cid, bytes }], cidB); });
    expect(existsSync(join(cidB, CLEAR_CID))).toBe(false);          // fetch-on-read: nothing crossed yet
    const got = await resolveB(CLEAR_CID);
    expect(got && [...got]).toEqual([...CLEAR]);
    expect(existsSync(join(cidB, CLEAR_CID))).toBe(true);           // write-through landed in B's cid/

    // CONTROL — C (a CONTRACT member, not fleet) asks the same cleartext cid: Mu, nothing cached.
    const resolveC = makeCidResolver((cid) => readCasBlobFromFs(cid, cidC), loopC.transit(() => [keyA]),
                                     (cid, bytes) => { writeCasEntriesFs([{ cid, bytes }], cidC); });
    expect(await resolveC(CLEAR_CID)).toBeNull();
    expect(existsSync(join(cidC, CLEAR_CID))).toBe(false);
  }, 30_000);

  test("CONTROL: a dead upstream leaves the read null after the window — no fault, no fabricated bytes", async () => {
    const seedA = new Uint8Array(32).fill(21), seedB = new Uint8Array(32).fill(22);
    const [keyA, keyB] = await Promise.all([pubOf(seedA), pubOf(seedB)]);
    const cidB = mkdtempSync(join(tmpdir(), "cidB-")); dirs.push(cidB);
    relay = await startCarriageRelay({ gateSeed: seedA });
    const url = `ws://127.0.0.1:${relay.port}`;
    // Only B dials; A (the named holder) never stands.
    const loopB = startCarriageServeLoop({ relayUrl: url, vesselSeed: seedB, serverAddr: keyB, deps: depsFor(cidB, [], [], keyB), pollIntervalMs: 25, fetchTimeoutMs: 300 });
    loops.push(loopB);
    await new Promise((r) => setTimeout(r, 300));
    const resolveB = makeCidResolver((cid) => readCasBlobFromFs(cid, cidB), loopB.transit(() => [keyA]),
                                     (cid, bytes) => { writeCasEntriesFs([{ cid, bytes }], cidB); });
    await expect(resolveB(CLEAR_CID)).resolves.toBeNull();
    expect(existsSync(join(cidB, CLEAR_CID))).toBe(false);
  }, 15_000);
});
