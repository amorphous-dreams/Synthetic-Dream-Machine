/**
 * nexus-seal-state — a charter that STANDS with no seal epoch reads UNSEALED, never ABSENT.
 *
 * The two empty readings take different paths: an absent charter has nothing to read and its founding has not
 * begun; an unsealed one holds a written roster and waits for its epoch to be seated. A torn charter (one that
 * stands and will not parse) is a third reading, named apart from both. The CONTROL is a sealed charter, which
 * reads sealed and rotates past the reading guard.
 *
 * Every charter here lives under a scratch `LAR_ROOT`.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { cmdNexus } from "../src/commands/nexus.js";
import { readCharterSeal } from "../src/commands/nexus-seal.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore,
  writeNexusKahu, writeNexusSeal, nexusCharterDocPath,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat,
  charterSealState, emptyFoundingCharterDoc, type NexusDoc,
} from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";
import { heldCharter, sealRite, type SealRite } from "./seal-rite-fixture.js";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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

const message = (out: Record<string, unknown>): string =>
  String((out["error"] as { message?: string } | undefined)?.message ?? "");

/** A charter whose roster stands written and whose seal joint names no epoch. */
function writeUnsealedCharter(): void {
  const home = larSealHome();
  const doc: NexusDoc = {
    ...emptyFoundingCharterDoc(), threshold: 2,
    kahu: [{ displayName: "Kahu Alpha", verifyingKey: null }, { displayName: "Kahu Beta", verifyingKey: null }],
  };
  writeNexusKahu(home, { threshold: doc.threshold, kahu: doc.kahu }, doc);
  writeNexusSeal(home, { kind: doc.kind, sealEpochCid: null }, doc);
}

describe("the charter's seal reading — pure", () => {
  test("no doc reads ABSENT; a doc with no lineage reads UNSEALED", () => {
    expect(charterSealState(null)).toBe("absent");
    expect(charterSealState(emptyFoundingCharterDoc())).toBe("unsealed");
  });

  test("CONTROL — a doc carrying a lineage reads SEALED", () => {
    // Real verifying keys (RFC 8032 §7.1 TEST 1 and 2): a charter seats only a key the Ed25519 door accepts.
    const keys = ["d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c"];
    const doc = heldCharter({ keys, threshold: 2, successors: { keys, threshold: 2 } }).doc({ labels: ["K0", "K1"] });
    expect(charterSealState(doc)).toBe("sealed");
  });
});

describe("lares nexus seal — an unsealed charter is named, never read as absent", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-seal-state-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
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

  test("★ a charter with no epoch reads UNSEALED, and rotate says so ★", async () => {
    writeUnsealedCharter();
    expect(readCharterSeal(larSealHome()).state).toBe("unsealed");

    const show = await run(args(["seal", "show"]));
    expect(show.code).toBe(0);
    expect((show.out["data"] as { seal: string }).seal).toBe("unsealed");

    const rotate = await rite.rotate("nobody");
    expect(rotate.code).not.toBe(0);
    expect(message(rotate.out)).toMatch(/UNSEALED/);
    expect(message(rotate.out)).toMatch(/seal seat/);
    expect(message(rotate.out)).not.toMatch(/no charter stands/);

    const grow = await run(args(["seal", "grow", "open"]));
    expect(grow.code).not.toBe(0);
    expect(message(grow.out)).toMatch(/UNSEALED/);
  });

  test("★ a missing charter reads ABSENT, and rotate says so ★", async () => {
    expect(readCharterSeal(larSealHome()).state).toBe("absent");

    const show = await run(args(["seal", "show"]));
    expect((show.out["data"] as { seal: string; present: boolean }).seal).toBe("absent");

    const rotate = await rite.rotate("nobody");
    expect(rotate.code).not.toBe(0);
    expect(message(rotate.out)).toMatch(/no charter stands/);
    expect(message(rotate.out)).not.toMatch(/UNSEALED/);
  });

  test("a charter that stands and will not parse reads TORN, apart from both", async () => {
    const path = nexusCharterDocPath(larSealHome());
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "not a charter\n");
    expect(readCharterSeal(larSealHome()).state).toBe("torn");
    const rotate = await rite.rotate("nobody");
    expect(rotate.code).not.toBe(0);
    expect(message(rotate.out)).toMatch(/TORN/);
  });

  test("CONTROL — a sealed charter reads SEALED, and rotate passes the reading guard", async () => {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const rt = await generateOrLoadPersonaGroupRoot(i);
      await renameOwnPersona(petnames, i, `compartment-${i}`);
      await declarePersonaHandle(declarations, i, `Kahu ${i}`);
      await standForKahuSeat(declarations, i, true);
      keys.push(rt.verifyingKey);
    }
    expect((await rite.seat({ keys, threshold: 2 })).code).toBe(0);
    expect(readCharterSeal(larSealHome()).state).toBe("sealed");
    const show = await run(args(["seal", "show"]));
    expect((show.out["data"] as { seal: string }).seal).toBe("sealed");
    const rotate = await rite.rotate({ keys, threshold: 2 });
    expect(rotate.code, message(rotate.out)).toBe(0);
  });
});
