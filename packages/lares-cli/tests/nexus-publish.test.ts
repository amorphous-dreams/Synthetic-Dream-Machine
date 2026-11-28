/**
 * nexus publish — THE OFFERING DOOR, held apart from the kāhuli ratchets.
 *
 * `pluginsCid` names THIS operator's own collection. It layers on the required blobs, overturns nobody
 * else's reading, and moves with no ratchet act at all — so it never stood as a kāhuli tier, and the
 * kāhuli door said so in its own header while reporting the region anyway. An operator who wanted to see
 * their own collection had to walk in through the door that governs the MESH's grammar.
 *
 * `publish` takes the region back. It reads tier-parameterized exactly as `kahuli` does — one case per
 * publishable thing — so a second cap arrives as a case rather than a door.
 *
 * `--apply` reaches the production adapter: the signed offering and its announce land on the Nexus's publication board
 * (`publicationDocUrl`), never on the crossroads document, and an unseated local face refuses by name.
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { join } from "node:path";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { cmdNexus } from "../src/commands/nexus.js";
import { publishLanding } from "../src/commands/nexus-publish.js";
import { cmdVessel } from "../src/commands/vessel.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { generateOrLoadPersonaGroupRoot, wardRootSigner } from "@lararium/node";
import { signPluginOffering, verifyPluginOffering } from "@lararium/mesh/plugin-offering";

// The room each test and hook takes, stated where the file loads: a case founds a vessel, lights a face and seals rows under a derived key, so it runs for seconds. A timeout stated inside a hook reaches no
// case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const args = (positional: string[], flags: Record<string, boolean> = {}, options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags } as unknown as ParsedArgs);

/** An UNSIGNED offering source directory (H3, F2-3) — `offering.json` plus the one blob's bytes
 *  beside it, never genesis. */
function offeringSourceDir(root: string): string {
  const dir = join(root, "offering-source");
  mkdirSync(dir, { recursive: true });
  const bytes = new TextEncoder().encode("good plugin bytes");
  const descriptor = {
    blobs: [{
      id: "$:/plugins/example/one", version: "v1", sha256: sha256HexBytesSync(bytes),
      provenance: { source: "https://example.test/example-one", commit: "a".repeat(40), path: "plugins/example/one", licence: "MIT" },
      file: "plugin.bin",
    }],
  };
  writeFileSync(join(dir, "offering.json"), JSON.stringify(descriptor));
  writeFileSync(join(dir, "plugin.bin"), bytes);
  return dir;
}

describe("lares nexus publish — the operator's own collection, apart from the ratchets", () => {
  let house: Scratch;
  let root: string;
  let errs: string[];
  let logs: string[];

  beforeEach(() => {
    house = openScratch();
    root = house.root;
    errs = []; logs = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errs.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    closeScratch(house);
  });

  test("★ `publish plugins` with no --source refuses through usage, never genesis ★", async () => {
    expect(await cmdNexus(args(["publish", "plugins"], { json: false }))).toBe(2);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/source=/);
  });

  test("★ `publish plugins --source <dir>` READS the local offering source and builds nothing ★", async () => {
    const source = offeringSourceDir(root);
    expect(await cmdNexus(args(["publish", "plugins"], { json: false }, { source }))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/plugins/i);
    expect(said).toMatch(/example\/one/);
    // The read reports the SOURCE's own fold — never genesis's, which carries the boot set alone (H3).
    expect(said).toMatch(/local offering source/i);
  });

  test("L-d: `publish plugins --source <dir> --json` in READ mode emits STRUCTURED JSON, never human prose", async () => {
    const source = offeringSourceDir(root);
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    expect(await cmdNexus(args(["publish", "plugins"], { json: true }, { source }))).toBe(0);
    write.mockRestore();
    const payload = JSON.parse(out.join("")) as { ok: boolean; data: { source: string; pluginsCid: string; blobCount: number } };
    expect(payload.ok).toBe(true);
    expect(payload.data.blobCount).toBe(1);
    expect(typeof payload.data.pluginsCid).toBe("string");
    expect(logs.join("\n")).toBe("");                  // no human-readable prose leaked onto console.log
  });

  test("★ `--apply` reaches the production adapter and refuses an unseated local face cleanly ★", async () => {
    const source = offeringSourceDir(root);
    const code = await cmdNexus(args(["publish", "plugins"], { apply: true, json: false }, { source }));
    expect(code).not.toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/a face to sign as|genesis/i);
    expect(said).not.toMatch(/unknown/i);
  });

  test("RED (under a pūlama): `--terms` prints ONE line, the face and the closed descriptor, through the store door; `--land` announces the offering the face root signed over it", async () => {
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    const source = offeringSourceDir(root);
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    writeFileSync(join(process.env["LAR_ROOT"]!, ".lar-test-scratch"), "");
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } })).toBe(0);
    await generateOrLoadPersonaGroupRoot(0);
    out.length = 0; logs.length = 0;

    // Off a TTY the terms line prints as the one JSON line the pūlama takes, never the envelope.
    expect(await cmdNexus(args(["publish", "plugins"], { terms: true }, { source, face: "0" }))).toBe(0);
    write.mockRestore();
    expect(logs).toHaveLength(1);
    const terms = JSON.parse(logs[0]!) as { face: number; offering: Parameters<typeof signPluginOffering>[0] };
    expect(terms.face).toBe(0);
    expect(Object.keys(terms.offering).sort()).toEqual(["blobs", "offeror", "pluginsCid"]);

    // THE PŪLAMA'S HAND signs that descriptor; its answer lands through the vessel.
    const offering = await signPluginOffering(terms.offering, (await wardRootSigner(0, undefined, "the test's hand")).sign);
    const out2: string[] = [];
    const write2 = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out2.push(String(chunk)); return true; });
    const answer = JSON.stringify({ op: "publish", reading: "signed", face: 0, offering, cid: "x" });
    expect(await cmdNexus(args(["publish", "plugins"], { json: true }, { source, land: answer }))).toBe(0);
    write2.mockRestore();
    const payload = JSON.parse(out2.join("")) as { ok: boolean; data: { offeror: string; blobCount: number } };
    expect(payload).toMatchObject({ ok: true, data: { offeror: terms.offering.offeror, blobCount: 1 } });
    expect(await verifyPluginOffering(offering)).toEqual({ ok: true });
  });

  test("★ `--apply --json` emits the structured success boundary, without human-only prose ★", async () => {
    // Founding itself needs the genesis seed (the engine CID etc.) regardless of this door's own
    // source — that dependency is `vessel found`'s, not `nexus publish`'s (H3: publish reads a local
    // `--source`, never genesis, but SOMETHING must still found the vessel this test applies into).
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    const source = offeringSourceDir(root);
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    });

    // Stand the minimum real place + face context. The command under test remains the production CLI
    // door; no adapter is mocked and no offering is assembled by the test.
    writeFileSync(join(process.env["LAR_ROOT"]!, ".lar-test-scratch"), "");   // a staged root: the place card's read-back stands in
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } })).toBe(0);
    await generateOrLoadPersonaGroupRoot(0);
    out.length = 0;

    expect(await cmdNexus(args(["publish", "plugins"], { apply: true, json: true }, { source }))).toBe(0);
    const payload = JSON.parse(out.join("")) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
    expect(payload).toMatchObject({ ok: true });
    expect(Object.keys(payload.data)).toEqual([
      "offeringCid", "boardUrl", "offeror", "pluginsCid", "blobCount",
    ]);
    expect(payload.data.offeringCid).toMatch(/^sha256:/);
    expect(payload.data.boardUrl).toMatch(/^automerge:/);
    expect(typeof payload.data.offeror).toBe("string");
    expect(typeof payload.data.pluginsCid).toBe("string");
    expect(typeof payload.data.blobCount).toBe("number");
    expect(logs.join("\n")).not.toMatch(/IMMUTABLE OFFERING ANNOUNCED/i);
    expect(errs.join("\n")).toBe("");
    write.mockRestore();
  });

  test("no tier / an unknown tier refuses THROUGH the emit choke point", async () => {
    // Off-TTY (every pipe, and every test runner) `emit` renders the machine payload, so the usage prose
    // reaches a human and the verdict reaches an agent.
    const out: string[] = [];
    const w = vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { out.push(String(c)); return true; });
    expect(await cmdNexus(args(["publish"]))).toBe(2);
    expect(await cmdNexus(args(["publish", "engine"]))).toBe(2);
    const payloads = out.join("").trim().split("\n").map((l) => JSON.parse(l) as { ok: boolean; error?: { code?: string; message?: string } });
    expect(payloads.every((p) => p.ok === false && p.error?.code === "usage")).toBe(true);
    // `engine` names a real KĀHULI tier and no publishable thing — the refusal says which door holds it.
    expect(payloads[1]?.error?.message).toContain("engine");
    w.mockRestore();
  });

  test("★ the KĀHULI door stops reporting the plugins region — the ratchet names only what it ratchets ★", async () => {
    expect(await cmdNexus(args(["kahuli", "grammar"]))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/grammar/i);
    expect(said).toMatch(/engine/i);
    // The region moved out. The door MAY POINT at where it went — a reader who looked here deserves the
    // forwarding address — but it may not REPORT the region, which is the reading that made it look like
    // a third tier. So: no report line, and a pointer naming the door that holds it.
    expect(said, "the kahuli door still REPORTS the plugins region").not.toMatch(/plugins \(pluginsCid/);
    expect(said, "the kahuli door drops the region without saying where it went").toMatch(/nexus publish plugins/);
  });

  test("CONTROL — the kāhuli door still reads its OWN two regions, so the cut removed nothing else", async () => {
    expect(await cmdNexus(args(["kahuli", "grammar"]))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/grammarCid/);
    expect(said).toMatch(/engineCid/);
  });
});

describe("lares nexus publish under a pūlama — the terms line and the land of the hand's signature", () => {
  const offering = { kind: "k", offeror: "a".repeat(64), pluginsCid: "c", blobs: [], sig: "s" };
  test("RED: `--land` takes the pūlama's signed publish answer and its face; a refusal, another act, or a face the line names otherwise lands nothing; CONTROL: the signed answer reads", () => {
    expect(publishLanding(JSON.stringify({ op: "publish", reading: "signed", face: 1, offering }), undefined)).toEqual({ offering, face: 1 });
    expect(publishLanding(JSON.stringify({ op: "publish", reading: "signed", face: 1, offering }), 1)).toEqual({ offering, face: 1 });
    for (const [raw, named, said] of [
      [JSON.stringify({ op: "publish", reading: "signed", face: 1, offering }), 0, /signed for h1/],
      [JSON.stringify({ op: "publish", reading: "ward-no-slot-opens", face: 1 }), undefined, /signed nothing/],
      [JSON.stringify({ op: "lei", reading: "signed", face: 1, record: {} }), undefined, /publish answer/],
      [JSON.stringify({ op: "publish", reading: "signed", face: 1 }), undefined, /no signed offering/],
      ["not json", undefined, /no JSON/],
    ] as const) expect((publishLanding(raw, named) as { usage: string }).usage, raw).toMatch(said);
  });

  test("RED: `--apply`, `--terms` and `--land` name one mode, and a malformed land refuses through usage before any row runs", async () => {
    const out: string[] = [];
    const w = vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { out.push(String(c)); return true; });
    expect(await cmdNexus(args(["publish", "plugins"], { apply: true, terms: true }, { source: "x" }))).toBe(2);
    expect(await cmdNexus(args(["publish", "plugins"], {}, { source: "x", land: JSON.stringify({ op: "publish", reading: "face-locked" }) }))).toBe(2);
    w.mockRestore();
    const payloads = out.join("").trim().split("\n").map((l) => JSON.parse(l) as { ok: boolean; error?: { code?: string; message?: string } });
    expect(payloads.map((p) => p.error?.code)).toEqual(["usage", "usage"]);
    expect(payloads[0]?.error?.message).toMatch(/one of apply=true, terms=true or land=/);
    expect(payloads[1]?.error?.message).toMatch(/signed nothing \(face-locked\)/);
  });
});
