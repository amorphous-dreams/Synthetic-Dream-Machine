/**
 * browser-seed-zero — row 7's S2b custody read (C1): every seed-deriving browser act zeroes the root seed bytes it opened. A test-only
 * watch over each Uint8Array the act constructs reads whether a buffer still holds the seed after the act. Every red pairs a CONTROL:
 * the act still signs, and the watch itself finds a planted copy.
 */
import { afterEach, describe, expect, test } from "vitest";
import { verifyAttestation, type HandleKelEvent } from "@lararium/mesh";
import { generateOrLoadBrowserPersonaRoot, loadBrowserPersonaRootSeed } from "../src/browser-vessel-identity.js";
import { sealBrowserKeystore } from "../src/browser-custody.js";
import { publishHandleBrowser } from "../src/browser-handle-publish.js";
import { burnFaceBrowser, attestFaceBrowser } from "../src/browser-handle-verbs.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { BootHalted } from "./wire-vessel-rig.js";
import { sealOwnerFace } from "./handle-owner-fixture.js";
import { bindSyntheticBrowserCustodySlot, FIXTURE_WARD, FIXTURE_WARD_PASSPHRASE, watchByteBuffers } from "./browser-custody-fixture.js";

const SLOW = 120_000;
let created = 0;
const opened = new Set<string>();
const idb = (): string => { const n = `lares:test-seedzero:${Date.now()}:${created++}`; opened.add(n); return n; };
afterEach(async () => {
  for (const name of opened) await new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
  opened.clear();
});
const fakeBoard = (): { doc(): never; change(fn: (d: never) => void): void } => { const d = { tiddlers: {} } as never; return { doc: () => d, change: (fn) => fn(d) }; };

async function face() {
  const name = idb();
  await bindSyntheticBrowserCustodySlot(name);
  const owner = await sealOwnerFace(name, 0);
  const board = fakeBoard();
  const seed = await loadBrowserPersonaRootSeed(name, 0, FIXTURE_WARD);
  return { name, owner, board, seed };
}

describe("c1 · a seed-deriving act leaves its root seed zeroed", () => {
  test("RED: the watch finds a planted copy (instrument control), and no buffer still holds the seed after a publish", async () => {
    const f = await face();
    const watch = watchByteBuffers();
    let planted: Uint8Array;
    try {
      planted = new Uint8Array(32); planted.set(f.seed);
      await publishHandleBrowser({ board: f.board as never, kelBoard: f.owner.kelBoard as never, handleIndex: 0, glamour: "Guru-Josh", idbName: f.name, ward: FIXTURE_WARD });
      expect(watch.standing(f.seed), "only the planted copy stands").toBe(1);
      planted.fill(0);
      expect(watch.standing(f.seed), "a publish left the root seed un-zeroed").toBe(0);
    } finally { watch.stop(); }
  }, SLOW);

  test("RED: a self-burn, an owner-burn and an attest each leave no buffer holding the seed; CONTROL: the attestation verifies", async () => {
    const f = await face();
    const card = await publishHandleBrowser({ board: f.board as never, kelBoard: f.owner.kelBoard as never, handleIndex: 0, glamour: "Guru-Josh", idbName: f.name, ward: FIXTURE_WARD });
    const watch = watchByteBuffers();
    try {
      const claim = { surface: "dns-control", domain: "example.net" } as const;
      const statement = await attestFaceBrowser({ board: f.board as never, handleIndex: 0, claim, idbName: f.name, ward: FIXTURE_WARD });
      expect(watch.standing(f.seed), "an attest left the root seed un-zeroed").toBe(0);
      expect((await verifyAttestation(card.chain as HandleKelEvent[], statement)).ok).toBe(true);
      await burnFaceBrowser({ board: f.board as never, handleIndex: 0, idbName: f.name, ward: FIXTURE_WARD, fromPersona: true, kelBoard: f.owner.kelBoard as never });
      expect(watch.standing(f.seed), "an owner-burn left the root seed un-zeroed").toBe(0);
    } finally { watch.stop(); }
  }, SLOW);

  test("RED: the founding leaves no buffer holding the root seed; CONTROL: the founding lands a warded root the seed opens", async () => {
    const idbName = `lares:test-seedzero-found:${globalThis.crypto.randomUUID()}`; opened.add(idbName);
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: FIXTURE_WARD_PASSPHRASE });
    const watch = watchByteBuffers();
    try {
      await expect(openBrowserVessel({ idbName, askWardRoute: async () => FIXTURE_WARD_PASSPHRASE,
        onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); } } as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
    } finally { watch.stop(); }
    const seed = await loadBrowserPersonaRootSeed(idbName, 0, FIXTURE_WARD);
    expect(seed.some((b) => b !== 0), "control: the warded root opens to a live seed").toBe(true);
    expect(watch.standing(seed), "the founding left the root seed un-zeroed").toBe(0);
  }, SLOW);
});
