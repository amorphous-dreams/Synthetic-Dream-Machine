/**
 * AN ADMIT INTO GROUP B NEVER RESTORES FROM GROUP A'S ATOM ARCHIVE.
 *
 * The veil-archive rows rest by handle index (`veil-archive-h<N>`), where the atom row rests by PersonaGroup. A browser
 * that founded solo as face A keeps A's atom archive at h0; an admit into group B arrives at the same row. The
 * joinee's hive stands from B's atom seed, and it restores only from an Archive that belongs to that seed: the kept
 * row is offered to the ceremony when it names B's atom and to nothing else.
 *
 *   G1  RED: founded solo as A, then admitted into B, the ceremony meets B's own atom (not A's) and no Archive bytes
 *   G2  `archiveIsOf` reads a seed's own Archive as its own and another seed's as another's
 *   G3  CONTROL: an admit over a kept Archive of B's atom restores from it
 */
import { describe, expect, test, vi } from "vitest";
import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore } from "@lararium/keyhive";
import { BootHalted, admitNaming } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { archiveIsOf, readBrowserFaceAtom } from "../src/browser-face-atom.js";
import { loadBrowserVeilArchive, saveBrowserVeilArchive } from "../src/browser-keyhive-archive.js";

const seen: Array<{ atomSeed: Uint8Array; archiveBytes: Uint8Array | undefined; group: string }> = [];
vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return {
    ...(await orig<object>()),
    runApplyAdmitPayload: async (input: { atomSeed: Uint8Array; archiveBytes?: Uint8Array; payload: { personaGroupId: string; deviceEdge?: unknown } }) => {
      seen.push({ atomSeed: Uint8Array.from(input.atomSeed), archiveBytes: input.archiveBytes, group: input.payload.personaGroupId });
      return rig.fakeAdmitResult(input);
    },
  };
});

const halted = (extra: Partial<BrowserVesselOptions>): BrowserVesselOptions =>
  ({ onPhase: (phase: string) => { if (phase === "catalog-ready") throw new BootHalted(); }, ...extra }) as BrowserVesselOptions;

async function archiveOf(seed: Uint8Array): Promise<Uint8Array> {
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: new InMemoryEventStore() });
  const bytes = await p.exportArchiveAfterTheCard();
  await p.dispose();
  return bytes;
}

describe("an admit and the archive row by handle index", () => {
  test("G1 — founded solo as A, then admitted into B: the ceremony meets B's own atom and no byte of A's Archive", { timeout: 120_000 }, async () => {
    const idbName = `admit-guard-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    await expect(openBrowserVessel(halted({ idbName }))).rejects.toBeInstanceOf(BootHalted);   // the solo founding: face A
    const keptA = await loadBrowserVeilArchive(idbName, 0);
    expect(keptA, "face A's atom Archive rests at h0").toBeDefined();

    seen.length = 0;
    const admit = admitNaming("cd".repeat(32), {});
    await expect(openBrowserVessel(halted({ idbName, admit }))).rejects.toBeInstanceOf(BootHalted);
    expect(seen).toHaveLength(1);
    const b = await readBrowserFaceAtom(idbName, admit.personaGroupId);
    expect(b, "B's atom rests under B").toBeDefined();
    expect(faceAtomKeyFromSeed(seen[0]!.atomSeed, admit.personaGroupId).key).toBe(b!.key);
    expect(seen[0]!.archiveBytes, "no byte of A's Archive seeds B").toBeUndefined();
  });

  test("G2 — a seed's own Archive reads as its own, another's as another's", { timeout: 60_000 }, async () => {
    const a = new Uint8Array(32).fill(0x11), b = new Uint8Array(32).fill(0x22);
    const archiveA = await archiveOf(a);
    expect(await archiveIsOf(a, archiveA)).toBe(true);
    expect(await archiveIsOf(b, archiveA)).toBe(false);
  });

  test("G3 — CONTROL: an admit over B's own kept Archive restores from it", { timeout: 120_000 }, async () => {
    const idbName = `admit-guard-own-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    const admit = admitNaming("cd".repeat(32), {});
    seen.length = 0;
    await expect(openBrowserVessel(halted({ idbName, admit }))).rejects.toBeInstanceOf(BootHalted);   // first attempt mints B's atom
    const bSeed = seen[0]!.atomSeed;
    const own = await archiveOf(bSeed);
    await saveBrowserVeilArchive(idbName, 0, own);   // a crash left B's Archive at h0 before the bootstrap landed
    seen.length = 0;
    await expect(openBrowserVessel(halted({ idbName, admit }))).rejects.toBeInstanceOf(BootHalted);
    expect(seen[0]!.archiveBytes, "B's own Archive is offered back").toEqual(own);
  });
});
