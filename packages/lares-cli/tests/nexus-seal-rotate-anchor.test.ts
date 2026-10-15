/**
 * nexus-seal-rotate-anchor — the rotate lands its ROLL ANCHOR before it writes the new charter head, and a
 * roll whose anchor cannot land writes NOTHING.
 *
 * Proven, over a real persona vault + the charter doc on disk:
 *   · a lawful rotate lands the anchor on the board FIRST: at the moment the anchor lands, the charter on disk
 *     still stands at the closing head; afterwards the board holds the anchor that opens the new head;
 *   · an anchor that cannot be signed, or does not count (the `nexus-roll-anchor` door row refusing with
 *     `NexusContractError`), refuses the rotate and leaves the charter byte-identical;
 *   · CONTROL: any other fault in the anchor step throws through, and still writes no head.
 *
 * The anchor step runs the real door row (`storeVerb("nexus-roll-anchor", …)`, direct-held since no vessel
 * stands in this test) unless a test injects a fault in its place. The row itself — not the module-level
 * `runNexusRollAnchor` it wraps — is where `nexus-seal.ts` now reaches it (the store's one door,
 * `store-door-verbs.ts`), so the fault rides the same seam the rotate itself calls through.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const anchorStep = vi.hoisted(() => ({
  fault: null as null | (() => Error),
  /** Answers the anchor step as landed while landing nothing: the head it lets through stands with no anchor. */
  skipLanding: false,
  charterDepthAtAnchor: [] as number[],
}));

vi.mock("../src/store-door.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/store-door.js")>();
  return {
    ...real,
    storeVerb: async (
      verb: Parameters<typeof real.storeVerb>[0], args: Parameters<typeof real.storeVerb>[1],
      Refusal?: Parameters<typeof real.storeVerb>[2],
    ) => {
      if (verb === "nexus-roll-anchor") {
        const { readNexusDoc } = await import("@lararium/node");
        const { larSealHome } = await import("../src/env.js");
        anchorStep.charterDepthAtAnchor.push(readNexusDoc(larSealHome())?.sealLineage?.length ?? 0);
        if (anchorStep.fault) throw anchorStep.fault();
        if (anchorStep.skipLanding) return { output: { anchorCid: "00".repeat(32), parents: [] }, via: "direct" as const };
      }
      return real.storeVerb(verb, args, Refusal);
    },
  };
});

import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, readNexusDoc,
  nexusCharterDocPath, NexusContractError,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat, sealLineageHead,
} from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";
import { sealRite, type SealRite } from "./seal-rite-fixture.js";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];

describe("lares nexus seal rotate — the anchor lands before the head, or nothing lands", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-rotate-anchor-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    anchorStep.fault = null;
    anchorStep.skipLanding = false;
    anchorStep.charterDepthAtAnchor = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    // A storage-backed Repo arms a trailing save on materialize; let it land before the dir goes.
    await new Promise((r) => setTimeout(r, 200));
    rmSync(root, { recursive: true, force: true });
  });
  // The seat reads the persona roster under the vessel key, so each test stands on a founded custody.
  // A founding derives a key from its route and every seat seals a row, so a test here takes seconds under a
  // loaded suite: the room below belongs to that work, and no assertion reads a clock.
  let custody: ScratchCustody;
  beforeEach(async () => { vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); custody = await seatScratchCustody(); });
  afterEach(async () => { await custody.drop(); });
  // One rite per charter: the helper alone spells how a seat or a rotate arms the head it writes.
  let rite: SealRite;
  beforeEach(() => { rite = sealRite(); });

  /** Three personas stand for chairs; the genesis seats them armed for the same set. */
  async function seatedGenesis(): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < KAHU.length; i++) {
      const rt = await generateOrLoadPersonaGroupRoot(i);
      await renameOwnPersona(petnames, i, `compartment-${i}`);
      await declarePersonaHandle(declarations, i, KAHU[i]!);
      await standForKahuSeat(declarations, i, true);
      keys.push(rt.verifyingKey);
    }
    expect((await rite.seat()).code).toBe(0);
    return keys;
  }

  test("★ a lawful rotate lands the anchor while the charter still stands at the closing head ★", async () => {
    const keys = await seatedGenesis();
    const genesis = sealLineageHead(readNexusDoc(larSealHome()))!;

    const r = await rite.rotate();
    expect(r.code).toBe(0);
    expect(anchorStep.charterDepthAtAnchor).toEqual([1]);          // the anchor step ran against the closing head
    const head = sealLineageHead(readNexusDoc(larSealHome()))!;
    expect(head.predecessors).toEqual([genesis.epochCid]);
    const data = r.out["data"] as { rollAnchor: { cid: string; parents: number } | null; sealEpochCid: string };
    expect(data.rollAnchor, "the rotate wrote a head with no anchor").not.toBeNull();
    expect(data.sealEpochCid).toBe(head.epochCid);
    // A roll answers no keyring reading: nothing mints beside a charter epoch.
    expect(Object.keys(r.out["data"] as Record<string, unknown>)).not.toContain("keyring");
  });

  test("★ an anchor that cannot be signed or does not count leaves the charter UNWRITTEN ★", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);

    anchorStep.fault = () => new NexusContractError("refusing to write: the roll anchor does not count under the new roster (fail-closed).");
    const r = await rite.rotate();
    expect(r.code).not.toBe(0);
    expect(anchorStep.charterDepthAtAnchor).toEqual([1]);          // the step was reached …
    expect(readFileSync(path).equals(before)).toBe(true);           // … and the charter never moved
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(1);

    // THE SAME ROLL RUN AGAIN LANDS: the refusal left nothing behind that a second run trips on.
    anchorStep.fault = null;
    const again = await rite.rotate();
    expect(again.code).toBe(0);
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(2);
  });

  test("CONTROL — a fault of any other kind throws through the anchor step and still writes no head", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);

    anchorStep.fault = () => new Error("the board store faulted");
    const r = await rite.rotate();
    expect(r.code).not.toBe(0);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  test("★ a roll waits on its prior anchor: a rotate over an anchorless head refuses by name and writes nothing ★", async () => {
    await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());

    // CONTROL: the single-vault rotate anchors inside itself, so a second rotate over that head opens.
    expect((await rite.rotate()).code).toBe(0);
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(2);
    expect((await rite.rotate()).code).toBe(0);
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(3);

    // RED: a head whose roll landed no anchor (the step answered, nothing reached the board) blocks the next roll.
    anchorStep.skipLanding = true;
    expect((await rite.rotate()).code).toBe(0);
    anchorStep.skipLanding = false;
    const depth = readNexusDoc(larSealHome())!.sealLineage!.length;
    const before = readFileSync(path);
    const r = await rite.rotate();
    expect(r.code).not.toBe(0);
    expect(JSON.stringify(r.out)).toMatch(/prior-roll-unanchored/);
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(depth);
  });
});
