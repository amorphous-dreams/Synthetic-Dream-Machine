/**
 * offline-custody — the key session of a command that acts with no vessel standing.
 *
 *   O1  seating the session builds no holder and reads no home: a command that touches no sealed row asks nobody.
 *                                                   control: the first sealed row builds it and runs the opener
 *   O2  under a root that carries the scratch marker the session opens by the published test route, says so on
 *       stderr, and the sealed row reads back.      control (O3): the same root with no marker refuses
 *   O3  with no marker and no terminal the session refuses `OfflineCustodyRefused`, naming where to run the
 *       command; the holder stays locked and no file moves.
 *   O4  a marked root whose custody answers another route refuses by name: the published route opens only a tree
 *       a harness bound to it.
 *   O5  the dispatcher turns a sealed row that stayed shut into ONE line and exit 1, never a stack; a founding over
 *       a standing custody opens the key before it mints, so its refusal leaves the identity home untouched.
 *   O6  the published route here and the harness's own (`tools/test-custody-route.mjs`) spell one string.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FsCustodyIo, foundCustody, loadIdentityAnchors, makeCustodyHolder, persistIdentityAnchors, seatCustody,
  seatedCustody, vesselCustodyHomes, larIdentityDir,
} from "@lararium/node";
import { OfflineCustodyRefused, seatOfflineCustody, TEST_ROUTE_PASSPHRASE, TEST_SCRATCH_MARKER } from "../src/offline-custody.js";
import { dispatch } from "../src/bin/lares.js";
import * as secretPrompt from "../src/prompt-secret.js";
import * as custodyPrompt from "../src/custody-prompt.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ANCHORS = { personaGroupId: "aa11", meshCabalDocIdHex: "bb22" };
const roots: string[] = [];
let priorRoot: string | undefined;

/** A scratch root with custody founded under `passphrase` and one sealed anchors row; nothing stays seated. */
async function stage(passphrase: string, opts: { marked: boolean }): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "lar-offline-custody-"));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  if (opts.marked) writeFileSync(join(root, TEST_SCRATCH_MARKER), "staged by offline-custody.test\n");
  const homes = vesselCustodyHomes();
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const io = new FsCustodyIo(homes);
  const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase }] }] });
  const holder = makeCustodyHolder({ io, homes });
  await holder.adopt(founded.treeKey);
  // The face must answer the same route as the vessel; the suite's automatic face founder uses its own scratch route.
  await holder.foundFace({ ordinal: 0, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase }] }] });
  seatCustody(holder);
  await persistIdentityAnchors(ANCHORS);
  await holder.lock();
  seatCustody(null);
  return root;
}
function digest(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) Object.assign(out, digest(p));
    else out[p] = createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  return out;
}

beforeEach(() => { priorRoot = process.env["LAR_ROOT"]; seatCustody(null); });
afterEach(async () => {
  const held = seatedCustody();
  if (held) await held.lock();
  seatCustody(null);
  vi.restoreAllMocks();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

test("gathering skips a blank extra passphrase and explains the multi-pin question", async () => {
  vi.spyOn(secretPrompt, "canPromptSecret").mockReturnValue(true);
  vi.spyOn(secretPrompt, "promptSecret").mockResolvedValueOnce("held phrase").mockResolvedValueOnce("");
  const lines = vi.spyOn(secretPrompt, "promptLine").mockResolvedValueOnce("y").mockResolvedValueOnce("n");
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  expect(await custodyPrompt.gatherCredentials("test", { route: "passphrase" })).toEqual([{ kind: "passphrase", passphrase: "held phrase" }]);
  expect(lines.mock.calls[0]?.[0]).toContain("only a slot sealed with several pins needs one");
  expect(output.mock.calls.map((c) => String(c[0])).join("")).toContain("blank extra passphrase skipped");
});

test("paper pin warns against digital copies before asking the sheet back", async () => {
  vi.spyOn(secretPrompt, "canPromptSecret").mockReturnValue(true);
  let printed = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { printed += String(chunk); return true; });
  vi.spyOn(secretPrompt, "promptSecret").mockImplementation(async () => {
    expect(printed).toContain("Never paste these words anywhere: no chat, no notes app, no screenshot");
    return /sheet 1: ([^\n]+)/.exec(printed)![1]!;
  });
  expect((await custodyPrompt.gatherNewSlot("test", "paper")).pins).toHaveLength(1);
});

describe("a command's own key session", () => {
  test("RED: a planted marker cannot lock a person's root out; CONTROL: the same terminal opens it without the marker", async () => {
    const root = await stage("person-chosen-route", { marked: true });
    vi.spyOn(secretPrompt, "canPromptSecret").mockReturnValue(true);
    vi.spyOn(custodyPrompt, "gatherCredentials").mockResolvedValue([{ kind: "passphrase", passphrase: "person-chosen-route" }]);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    rmSync(join(root, TEST_SCRATCH_MARKER));
    seatOfflineCustody();
    await expect(loadIdentityAnchors()).resolves.toEqual(ANCHORS);
    await seatedCustody()!.lock();
    seatCustody(null);
    writeFileSync(join(root, TEST_SCRATCH_MARKER), "");
    seatOfflineCustody();
    await expect(loadIdentityAnchors()).resolves.toEqual(ANCHORS);
  });
  test("O1 seating builds nothing; O2 the first sealed row opens a marked root by the published route", async () => {
    await stage(TEST_ROUTE_PASSPHRASE, { marked: true });
    const err = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    seatOfflineCustody();
    expect(err.mock.calls.length, "O1: seating wrote nothing").toBe(0);
    // O1 control + O2: the first sealed row builds the holder, runs the opener and reads the row back.
    expect(await loadIdentityAnchors()).toEqual(ANCHORS);
    expect(seatedCustody()!.isUnlocked()).toBe(true);
    expect(err.mock.calls.map((c) => String(c[0])).join("")).toContain("TEST SCRATCH ROOT");
  });

  test("O3 no marker and no terminal: the session refuses by name, holds nothing and moves no file", async () => {
    const root = await stage(TEST_ROUTE_PASSPHRASE, { marked: false });
    const before = digest(root);
    seatOfflineCustody();
    await expect(loadIdentityAnchors()).rejects.toThrow(OfflineCustodyRefused);
    await expect(loadIdentityAnchors()).rejects.toThrow(/no terminal stands.*lares vault unlock/s);
    expect(seatedCustody()!.isUnlocked()).toBe(false);
    expect(digest(root)).toEqual(before);
  });

  test("O4 a marked root bound to another route answers the published one with a refusal", async () => {
    await stage("a-route-some-person-chose", { marked: true });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    seatOfflineCustody();
    await expect(loadIdentityAnchors()).rejects.toThrow(/no terminal stands/);
    expect(seatedCustody()!.isUnlocked()).toBe(false);
  });

  test("O5 the dispatcher names a shut row on one line and exits 1, and the act lands nothing", async () => {
    // A founding over a custody that already stands seals rows under its key, so it opens the seat first.
    const root = await stage(TEST_ROUTE_PASSPHRASE, { marked: false });
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    const before = digest(larIdentityDir());
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(" ")); });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await dispatch(["vessel", "found", "--root", root, "--skip-build", "--json"]);
    expect(code).toBe(1);
    const said = lines.filter((l) => l.includes("sealed under the vessel key"));
    expect(said.length, lines.join("\n")).toBe(1);
    expect(said[0]).toMatch(/^lares vessel: /);
    expect(digest(larIdentityDir()), "the refused founding minted nothing in the identity home").toEqual(before);
  });

  test("O6 the published route spells one string in the CLI and in the harness", async () => {
    const harness = readFileSync(join(import.meta.dirname, "..", "..", "..", "tools", "test-custody-route.mjs"), "utf8");
    const m = /export const TEST_PASSPHRASE = "([^"]+)";/.exec(harness);
    expect(m?.[1]).toBe(TEST_ROUTE_PASSPHRASE);
  });
});
