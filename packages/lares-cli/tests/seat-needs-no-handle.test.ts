import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { makeNodePersonaDeclarationStore, nexusCharterDocPath, parseNexusDoc, readNexusDoc } from "@lararium/node";
import { seatFingerprint } from "@lararium/mesh";

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
  beforeEach(async () => {
    vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
    root = mkdtempSync(join(tmpdir(), "lares-seat-no-handle-"));
    env("LAR_ROOT", root); env("LARES_ARCHIVE_PASSPHRASE", undefined);
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } })).toBe(0);
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
    expect(await cmdPersona(personaArgs("1", "veil-two", { seat: true }, { chair: "first-chair" }))).toBe(0);
    expect(output(wire).data.chair).toBe("first-chair");
    expect(await cmdPersona(personaArgs("2", "veil-three", {}, { handle: "outward" }))).toBe(0);

    expect(await cmdNexus(nexusArgs(["seal", "seat"], { "next-key-commit": "a".repeat(64) }))).toBe(0);
    const standing = readNexusDoc(larSealHome())!;
    const fingerprints = standing.kahu.map((k) => seatFingerprint(k.verifyingKey!));
    const seatPayload = output(wire).data.kahu;
    expect(seatPayload.map((k: any) => k.fingerprint)).toEqual(fingerprints);
    expect(seatPayload.every((k: any) => /^[0-9a-f]{4}(-[0-9a-f]{4}){4}$/.test(k.fingerprint))).toBe(true);
    expect(seatPayload.map((k: any) => k.displayName)).toEqual(["chair-h0", "first-chair"]);

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
