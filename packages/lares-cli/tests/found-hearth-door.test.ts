/**
 * found-hearth-door — `lares vessel found --hearth`, THE STABLE FOUNDING ACT at the CLI door (one act under one route).
 *
 *   D1 · on a staged root the act answers the hearth's Nexus AID, its one seat's fingerprint and posture PRIVATE, and
 *        its JSON carries the card's code (the read-back stood in); persona zero stands as a held root.
 *   D2 · with no label for persona zero the act refuses by name before any byte lands.
 *   D3 · off a staged root, a JSON run refuses the card (a live card prints on the terminal alone) and seats no
 *        charter and founds no face.
 *   D4 · `persona new 0` on a place with no seed charter refuses, naming the act — CONTROL: after the act it answers.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdPersona } from "../src/commands/persona.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { listPersonaRoots, readNexusDoc } from "@lararium/node";
import { NEXUS_AID_PATTERN, nexusAidOf } from "@lararium/mesh";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const found = (options: Record<string, string>, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "vessel", positional: ["found"], options, flags: { json: true, ...flags } });
const lastJson = (lines: string[]): Record<string, any> =>
  JSON.parse(lines.filter((l) => l.trim().startsWith("{")).at(-1) ?? "{}");

describe("lares vessel found --hearth", () => {
  let root: string;
  let prior: string | undefined;
  let wire: string[];
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-found-hearth-door-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    wire = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { wire.push(String(chunk)); return true; });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
  });

  test("D1 — on a staged root it answers the AID, one seat, PRIVATE, and the stood-in card's code; persona zero stands", async () => {
    writeFileSync(join(root, ".lar-test-scratch"), "");
    expect(await cmdVessel(found({ name: "keeper" }, { hearth: true }))).toBe(0);
    const data = lastJson(wire)["data"];
    expect(data.nexusAid).toMatch(NEXUS_AID_PATTERN);
    expect(data.nexusAid).toBe(nexusAidOf(readNexusDoc(larSealHome())));
    expect(data.posture).toBe("private");
    expect(data.seatFingerprint).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){4}$/);
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].code).toMatch(/^[0-9a-f-]+$/);
    expect(data.cards[0].digest).toBe(data.nextDigest);
    expect(await listPersonaRoots()).toEqual([0]);
  });

  test("D2 — no label for persona zero refuses by name before any byte lands", async () => {
    writeFileSync(join(root, ".lar-test-scratch"), "");
    expect(await cmdVessel(found({}, { hearth: true }))).not.toBe(0);
    expect(existsSync(join(root, "data", "lares", "vessel", "social-bootstrap.json"))).toBe(false);
    expect(readNexusDoc(larSealHome())).toBeNull();
  });

  test("D3 — off a staged root a JSON run refuses the card, seats no charter and founds no face", async () => {
    const errors: string[] = [];
    vi.mocked(console.error).mockImplementation((line: unknown) => { errors.push(String(line)); });
    expect(await cmdVessel(found({ name: "keeper" }, { hearth: true }))).not.toBe(0);
    expect(errors.join("\n")).toMatch(/CardReadBackRefused: .*prints each chair's cold-key card on the terminal/);
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(await listPersonaRoots()).toEqual([0]);                 // the root its seat claim stood for stays held
  });

  test("D4 — persona new 0 on a place refuses and names the act — CONTROL: after the act it answers", async () => {
    writeFileSync(join(root, ".lar-test-scratch"), "");
    expect(await cmdVessel(found({}))).toBe(0);
    const persona: ParsedArgs = { command: "persona", positional: ["new", "0"], options: { name: "keeper" }, flags: { json: true } };
    expect(await cmdPersona(persona)).not.toBe(0);
    expect(wire.join("\n")).toMatch(/no seed charter stands here/);
    expect(await cmdVessel(found({ name: "keeper" }, { hearth: true }))).toBe(0);              // CONTROL
    expect(await cmdPersona(persona)).toBe(0);
  });
});
