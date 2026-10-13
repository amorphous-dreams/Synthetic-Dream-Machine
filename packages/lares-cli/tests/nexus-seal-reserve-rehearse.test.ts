/**
 * nexus-seal-reserve-rehearse — a reserve card describes itself, and a rehearsal reads two cards back.
 *
 * A card names its generation and its quorum beside an unchanged share code. `seal reserve
 * rehearse` decodes two cards, rebuilds the seed in memory, derives the key-set and proves its commit against
 * the charter head. It runs only under a harness-staged scratch root, writes nothing, and rolls nothing.
 *   · R1 — every card carries generation, threshold and share count, and no Nexus binding; the payload names its reader;
 *   · R2 — the two guardian cards rebuild the seated head, and no byte under the root moves;
 *   · R3 — any two cards rebuild (mine + a guardian);
 *   · R4 — a root without the scratch marker refuses by name, tree untouched;
 *   · R5 — a wrong generation rebuilds a different commit and refuses by name;
 *   · R6 — a card of one generation never answers with a card of another;
 *   · R7 — a transcription slip names the card that slipped;
 *   · R8 — one custodian slot never forms a quorum;
 *   · R9 — a green rehearsal speaks only public commit digests;
 *   · R10 — a green rehearsal leaves the reserve-armed head refused by the roll;
 *   · CONTROL — the library path (decode, assemble, rebuild, derive) reaches the printed commit with no verb,
 *     the share code keeps its decode-guarded shape, and a roster-armed head answers the same cards with a
 *     mismatch.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import * as sealDoor from "../src/commands/nexus-seal.js";
import { deriveReserveKeySet, reserveNextKeyCommit, reserveShareFromCard, type ReserveCard } from "../src/seal-reserve.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore } from "@lararium/node";
import {
  assembleQuorum, confirmationPhrase, declarePersonaHandle, reconstructFromQuorum, renameOwnPersona,
  sealKeySetHash, standForKahuSeat,
} from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

type Payload = Record<string, unknown>;
interface Ran { code: number; out: Payload }

async function run(a: ParsedArgs): Promise<Ran> {
  const lines: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = await cmdNexus(a);
    const json = lines.find((line) => line.trim().startsWith("{"));
    return { code, out: json ? JSON.parse(json) as Payload : {} };
  } finally { out.mockRestore(); }
}

/** Every file under `root`, path → bytes: the instrument that proves a verb wrote nothing. */
function tree(root: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.set(path.slice(root.length), readFileSync(path).toString("hex"));
    }
  };
  walk(root);
  return found;
}

const errorCode = (r: Ran): unknown => (r.out["error"] as Payload | undefined)?.["code"];
const dataOf = (r: Ran): Payload => (r.out["data"] ?? {}) as Payload;

describe("seal reserve rehearse", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-reserve-rehearse-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    await new Promise((resolve) => setTimeout(resolve, 200));
    rmSync(root, { recursive: true, force: true });
  });
  // The seat reads the persona roster under the vessel key, so each test stands on a founded custody.
  // A founding derives a key from its route and every seat seals a row, so a test here takes seconds under a
  // loaded suite: the room below belongs to that work, and no assertion reads a clock.
  let custody: ScratchCustody;
  beforeEach(async () => { vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); custody = await seatScratchCustody(); });
  afterEach(async () => { await custody.drop(); });

  const stage = (): void => writeFileSync(join(root, ".lar-test-scratch"), "staged by a test\n");

  async function standThree(): Promise<string[]> {
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
    return keys;
  }

  async function reserve(): Promise<Payload> {
    const r = await run(args(["seal", "reserve"]));
    expect(r.code).toBe(0);
    return dataOf(r);
  }

  const cardsOf = (data: Payload): Payload[] => data["cards"] as Payload[];
  const card = (data: Payload, slot: string): string =>
    cardsOf(data).find((c) => c["slot"] === slot)!["shareCode"] as string;

  async function seat(commit: string): Promise<void> {
    expect((await run(args(["seal", "seat"], { "next-key-commit": commit }))).code).toBe(0);
  }

  const rehearse = (a: string, b: string, extra: Record<string, string> = {}): Promise<Ran> =>
    run(args(["seal", "reserve", "rehearse"], { "card-a": a, "card-b": b, ...extra }));

  test("CONTROL — the library path reaches the printed commit, and the share code keeps its shape", async () => {
    const data = await reserve();
    const shares = ["guardian-a", "guardian-b"].map((slot) => {
      const c = cardsOf(data).find((x) => x["slot"] === slot)!;
      // The printed phrase derives from the share code alone, and the code decodes under its own checksum.
      expect(c["confirmPhrase"]).toBe(confirmationPhrase(c["shareCode"] as string));
      return reserveShareFromCard(c as unknown as ReserveCard, data["reserveEpoch"] as number);
    });
    const seed = new Uint8Array(reconstructFromQuorum(assembleQuorum(shares, 2)));
    const { verifyingKeys } = await deriveReserveKeySet(seed, data["reserveEpoch"] as number);
    expect(reserveNextKeyCommit(verifyingKeys)).toBe(data["nextKeyCommit"]);
  });

  test("R1 — each card names its generation, quorum and commit, and the payload names its reader", async () => {
    const data = await reserve();
    expect(data["cardReader"]).toBe("nexus seal reserve rehearse");
    expect(cardsOf(data)).toHaveLength(3);
    for (const c of cardsOf(data)) {
      expect(c).toMatchObject({ generation: data["reserveEpoch"], threshold: 2, shares: 3 });
      // The card stays unbound from its Nexus: the commit rides the reserve payload, never a card.
      expect(Object.keys(c).sort()).toEqual(["confirmPhrase", "custodian", "generation", "label", "shareCode", "shares", "slot", "threshold"]);
    }
  });

  test("R2 — two guardian cards rebuild the seated head and no byte under the root moves", async () => {
    stage();
    await standThree();
    const data = await reserve();
    const commit = data["nextKeyCommit"] as string;
    await seat(commit);
    const before = tree(root);
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"));
    expect(r.code).toBe(0);
    expect(dataOf(r)).toMatchObject({ rehearsed: true, matchesHead: true, derivedCommit: commit, headCommit: commit, wrote: null, rolls: false });
    expect(tree(root)).toEqual(before);
  });

  test("R3 — mine and a guardian card also rebuild", async () => {
    stage();
    await standThree();
    const data = await reserve();
    await seat(data["nextKeyCommit"] as string);
    const r = await rehearse(card(data, "mine"), card(data, "guardian-b"), { "slot-a": "mine" });
    expect(r.code).toBe(0);
    expect(dataOf(r)["matchesHead"]).toBe(true);
  });

  test("R4 — a root without the scratch marker refuses by name and leaves the tree untouched", async () => {
    await standThree();
    const data = await reserve();
    await seat(data["nextKeyCommit"] as string);
    const before = tree(root);
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"));
    expect(r.code).not.toBe(0);
    expect(errorCode(r)).toBe("rehearsal-needs-scratch-root");
    expect(tree(root)).toEqual(before);
    expect(sealDoor.rehearsalRootStands(undefined)).toBe(false);
    expect(sealDoor.rehearsalRootStands(root)).toBe(false);
    stage();
    expect(sealDoor.rehearsalRootStands(root)).toBe(true);
  });

  test("R5 — a wrong generation rebuilds a different commit and refuses by name", async () => {
    stage();
    await standThree();
    const data = await reserve();
    await seat(data["nextKeyCommit"] as string);
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"), { generation: "2" });
    expect(r.code).not.toBe(0);
    expect(errorCode(r)).toBe("rehearsal-commit-mismatch");
    expect(dataOf(r)["matchesHead"]).toBe(false);
  });

  test("R6 — a card of one generation never answers with a card of another", async () => {
    stage();
    await standThree();
    const old = await reserve();
    await seat(old["nextKeyCommit"] as string);
    const fresh = dataOf(await run(args(["seal", "reserve", "refresh"])));
    expect(fresh["reserveEpoch"]).toBe(2);
    for (const generation of ["1", "2"]) {
      const r = await rehearse(card(old, "guardian-a"), card(fresh, "guardian-b"), { generation });
      expect(r.code).not.toBe(0);
      expect(errorCode(r)).toBe("rehearsal-commit-mismatch");
    }
  });

  test("R7 — a transcription slip names the card that slipped", async () => {
    stage();
    const data = await reserve();
    const original = card(data, "guardian-a");
    const slipped = `${original.slice(0, -1)}${original.endsWith("0") ? "1" : "0"}`;
    const a = await rehearse(slipped, card(data, "guardian-b"));
    expect(a.code).not.toBe(0);
    expect(errorCode(a)).toBe("rehearsal-card-unreadable");
    expect((a.out["error"] as Payload)["message"]).toContain("card a");
    const b = await rehearse(card(data, "guardian-b"), slipped, { "slot-a": "guardian-b", "slot-b": "guardian-a" });
    expect(errorCode(b)).toBe("rehearsal-card-unreadable");
    expect((b.out["error"] as Payload)["message"]).toContain("card b");
  });

  test("R8 — one custodian slot never forms a rehearsal quorum", async () => {
    stage();
    const data = await reserve();
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"), { "slot-a": "guardian-a", "slot-b": "guardian-a" });
    expect(r.code).not.toBe(0);
    expect(errorCode(r)).toBe("rehearsal-same-custodian");
  });

  test("R9 — a green rehearsal speaks only public commit digests", async () => {
    stage();
    await standThree();
    const data = await reserve();
    const commit = data["nextKeyCommit"] as string;
    await seat(commit);
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"));
    expect(r.code).toBe(0);
    const spoken = JSON.stringify(r.out).match(/[a-f0-9]{64}/gi) ?? [];
    expect(spoken.length).toBeGreaterThan(0);
    for (const digest of spoken) expect(digest).toBe(commit);
  });

  test("R10 — a green rehearsal leaves the reserve-armed head refused by the roll", async () => {
    stage();
    const keys = await standThree();
    const data = await reserve();
    await seat(data["nextKeyCommit"] as string);
    expect((await rehearse(card(data, "guardian-a"), card(data, "guardian-b"))).code).toBe(0);
    const rotate = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(rotate.code).not.toBe(0);
    expect(errorCode(rotate)).toBe("reserve-armed");
  });

  test("CONTROL — a head armed with the standing roster answers the same cards with a mismatch", async () => {
    stage();
    const keys = await standThree();
    const data = await reserve();
    await seat(sealKeySetHash(keys, 2));
    const r = await rehearse(card(data, "guardian-a"), card(data, "guardian-b"));
    expect(r.code).not.toBe(0);
    expect(errorCode(r)).toBe("rehearsal-commit-mismatch");
    expect(dataOf(r)).toMatchObject({ matchesHead: false, matchesReserveState: true });
  });
});
