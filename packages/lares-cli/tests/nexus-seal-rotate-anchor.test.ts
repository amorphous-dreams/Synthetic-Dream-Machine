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
      }
      return real.storeVerb(verb, args, Refusal);
    },
  };
});

import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, readNexusDoc,
  nexusCharterDocPath, NexusContractError, heldNexusKeyringEntries,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat, sealKeySetHash, sealLineageHead,
} from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

/** Run a verb and capture the one JSON payload it emits. */
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, unknown> }> {
  const lines: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = await cmdNexus(a);
    const json = lines.find((l) => l.trim().startsWith("{"));
    return { code, out: json ? JSON.parse(json) as Record<string, unknown> : {} };
  } finally { out.mockRestore(); }
}

describe("lares nexus seal rotate — the anchor lands before the head, or nothing lands", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-rotate-anchor-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    anchorStep.fault = null;
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
  // The seat mints its epoch's keyring secret under the vessel key, so each test stands on a founded custody.
  let custody: ScratchCustody;
  beforeEach(async () => { custody = await seatScratchCustody(); });
  afterEach(async () => { await custody.drop(); });

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
    expect((await run(args(["seal", "seat"], { "next-key-commit": sealKeySetHash(keys, 2) }))).code).toBe(0);
    return keys;
  }

  test("★ a lawful rotate lands the anchor while the charter still stands at the closing head ★", async () => {
    const keys = await seatedGenesis();
    const genesis = sealLineageHead(readNexusDoc(larSealHome()))!;

    const r = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(r.code).toBe(0);
    expect(anchorStep.charterDepthAtAnchor).toEqual([1]);          // the anchor step ran against the closing head
    const head = sealLineageHead(readNexusDoc(larSealHome()))!;
    expect(head.prevEpochCid).toBe(genesis.epochCid);
    const data = r.out["data"] as { rollAnchor: { cid: string; parents: number } | null; sealEpochCid: string };
    expect(data.rollAnchor, "the rotate wrote a head with no anchor").not.toBeNull();
    expect(data.sealEpochCid).toBe(head.epochCid);
    // the control for the refusals below: a roll that lands mints the new head's secret itself
    expect((r.out["data"] as unknown as { keyring: { minted: boolean } }).keyring).toEqual({ minted: true });
    expect((await heldNexusKeyringEntries()).map((e) => e.epochCid)).toEqual([genesis.epochCid, head.epochCid]);
  });

  test("★ an anchor that cannot be signed or does not count leaves the charter UNWRITTEN ★", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);
    const heldBefore = await heldNexusKeyringEntries();
    expect(heldBefore.length).toBe(1);

    anchorStep.fault = () => new NexusContractError("refusing to write: the roll anchor does not count under the new roster (fail-closed).");
    const r = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(r.code).not.toBe(0);
    expect(anchorStep.charterDepthAtAnchor).toEqual([1]);          // the step was reached …
    expect(readFileSync(path).equals(before)).toBe(true);           // … and the charter never moved
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(1);
    // … and the secret the roll minted stands under an epoch no charter names yet, beside the genesis secret,
    // which never moved. It seals nothing: the charter head still names the genesis epoch.
    const stranded = await heldNexusKeyringEntries();
    expect(stranded.length).toBe(2);
    expect(stranded[0]).toEqual(heldBefore[0]);
    expect(stranded[1]!.epochCid).not.toBe(sealLineageHead(readNexusDoc(larSealHome()))!.epochCid);

    // THE SAME ROLL RUN AGAIN ADOPTS IT: the epoch CID content-addresses its own fields, so the roll derives the
    // very name the secret stands under, mints nothing, and the head it lands answers to that secret.
    anchorStep.fault = null;
    const again = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(again.code).toBe(0);
    expect((again.out["data"] as { keyring: { minted: boolean } }).keyring).toEqual({ minted: false });
    expect(sealLineageHead(readNexusDoc(larSealHome()))!.epochCid).toBe(stranded[1]!.epochCid);
    expect(await heldNexusKeyringEntries()).toEqual(stranded);
  });

  test("CONTROL — a fault of any other kind throws through the anchor step and still writes no head", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);
    const heldBefore = await heldNexusKeyringEntries();

    anchorStep.fault = () => new Error("the board store faulted");
    const r = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(r.code).not.toBe(0);
    expect(readFileSync(path).equals(before)).toBe(true);
    expect((await heldNexusKeyringEntries())[0]).toEqual(heldBefore[0]);   // the genesis secret never moved
  });
});
