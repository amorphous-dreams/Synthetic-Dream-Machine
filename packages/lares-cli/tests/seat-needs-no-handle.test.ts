import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { makeNodePersonaDeclarationStore, nexusCharterDocPath, parseNexusDoc, readNexusDoc } from "@lararium/node";
import { seatFingerprint } from "@lararium/mesh";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const saved: Record<string, string | undefined> = {};
const env = (key: string, value: string | undefined): void => {
  saved[key] = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
};
const personaArgs = (index: string, name: string, flags: Record<string, boolean> = {}, options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "persona", positional: ["new", index], options: { name, ...options }, flags: { json: true, ...flags } });
const nexusArgs = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });
const output = (spy: { mock: { calls: unknown[][] } }, index = -1): Record<string, any> => JSON.parse(String(spy.mock.calls.at(index)?.[0]));

describe("a seat claim needs no Handle and exports no chair label", () => {
  let root: string;
  // One rite per charter: the helper alone spells how a seat or a rotate arms the head it writes.
  let card = "";
  beforeEach(async () => {
    vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
    root = mkdtempSync(join(tmpdir(), "lares-seat-no-handle-"));
    env("LAR_ROOT", root);
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    // The Stable founding act: persona zero under its private label, its one chair seating the seed charter.
    writeFileSync(join(root, ".lar-test-scratch"), "");
    const wire = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: { name: "veil-one" }, flags: { json: true, hearth: true } })).toBe(0);
    card = String(output(wire).data.cards[0].code);
    wire.mockRestore();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  });

  test("two private labels seat keys; export redacts labels and preserves authority", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const wire = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await cmdPersona(personaArgs("0", "veil-one", { seat: true }))).toBe(0);
    const one = output(wire);
    expect(one.data).toMatchObject({ seat: true, handle: null, chair: "chair-h0" });
    const seed = readNexusDoc(larSealHome())!;
    expect(await cmdPersona(personaArgs("1", "veil-two", { seat: true }, { chair: "first-chair" }))).toBe(0);
    expect(output(wire).data.chair).toBe("first-chair");
    expect(await cmdPersona(personaArgs("2", "veil-three", {}, { handle: "outward" }))).toBe(0);

    // The seed card reveals, and the roll seats every chair that stands: the AID stays the hearth's.
    expect(await cmdNexus(nexusArgs(["seal", "rotate"], { "cold-key": card, face: "0" }))).toBe(0);
    const standing = readNexusDoc(larSealHome())!;
    expect(standing.sealLineage![0]!.epochCid).toBe(seed.sealLineage![0]!.epochCid);
    const fingerprints = standing.kahu.map((k) => seatFingerprint(k.verifyingKey!));
    expect(fingerprints.every((f) => /^[0-9a-f]{4}(-[0-9a-f]{4}){4}$/.test(f))).toBe(true);
    expect(standing.kahu.map((k) => k.chairLabel)).toEqual(["chair-h0", "first-chair"]);

    expect(await cmdNexus(nexusArgs(["seal", "export"]))).toBe(0);
    const exported = output(wire).data;
    for (const secret of ["chair-h0", "first-chair", "veil-one", "veil-two"]) expect(exported.charter).not.toContain(secret);
    for (const fingerprint of fingerprints) expect(exported.charter).toContain(fingerprint);
    expect(exported.chairs).toEqual(fingerprints.map((fingerprint: string) => ({ fingerprint, seated: true })));
    const parsed = parseNexusDoc(exported.charter)!;
    expect(parsed.kahu.map((k) => k.verifyingKey)).toEqual(standing.kahu.map((k) => k.verifyingKey));
    expect(parsed.sealEpochCid).toBe(standing.sealEpochCid);
    const standingBytes = readFileSync(nexusCharterDocPath(larSealHome()), "utf8");
    expect(standingBytes).toContain("chair-h0");
    expect(standingBytes).toContain("first-chair");
    const outward = await (await makeNodePersonaDeclarationStore()).get(2);
    expect(outward?.handle).toBe("outward");
    expect(outward?.seat).not.toBe(true);
    expect(standing.kahu).toHaveLength(2);
  });
});
