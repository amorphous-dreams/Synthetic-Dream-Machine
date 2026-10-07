/**
 * nexus-seal-rotate-anchor — the rotate lands its ROLL ANCHOR before it writes the new charter head, and a
 * roll whose anchor cannot land writes NOTHING.
 *
 * Proven, over a real persona vault + the charter doc on disk:
 *   · a lawful rotate lands the anchor on the board FIRST: at the moment the anchor lands, the charter on disk
 *     still stands at the closing head; afterwards the board holds the anchor that opens the new head;
 *   · an anchor that cannot be signed, or does not count (`runNexusRollAnchor` refusing with
 *     `NexusContractError`), refuses the rotate and leaves the charter byte-identical;
 *   · CONTROL: any other fault in the anchor step throws through, and still writes no head.
 *
 * The anchor step is the real `runNexusRollAnchor` unless a test injects a fault in its place.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const anchorStep = vi.hoisted(() => ({
  fault: null as null | (() => Error),
  charterDepthAtAnchor: [] as number[],
}));

vi.mock("@lararium/node", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/node")>();
  return {
    ...real,
    runNexusRollAnchor: async (opts: Parameters<typeof real.runNexusRollAnchor>[0]) => {
      anchorStep.charterDepthAtAnchor.push(real.readNexusDoc(opts.sealHome)?.sealLineage?.length ?? 0);
      if (anchorStep.fault) throw anchorStep.fault();
      return real.runNexusRollAnchor(opts);
    },
  };
});

import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, readNexusDoc,
  nexusCharterDocPath, NexusContractError,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat, sealKeySetHash, sealLineageHead,
} from "@lararium/mesh";

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
  });

  test("★ an anchor that cannot be signed or does not count leaves the charter UNWRITTEN ★", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);

    anchorStep.fault = () => new NexusContractError("refusing to write: the roll anchor does not count under the new roster (fail-closed).");
    const r = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(r.code).not.toBe(0);
    expect(anchorStep.charterDepthAtAnchor).toEqual([1]);          // the step was reached …
    expect(readFileSync(path).equals(before)).toBe(true);           // … and the charter never moved
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(1);
  });

  test("CONTROL — a fault of any other kind throws through the anchor step and still writes no head", async () => {
    const keys = await seatedGenesis();
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);

    anchorStep.fault = () => new Error("the board store faulted");
    const r = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(r.code).not.toBe(0);
    expect(readFileSync(path).equals(before)).toBe(true);
  });
});
