/**
 * founding-three-personas — a HEARTH'S three founding faces, driven end-to-end through the REAL CLI doors: the
 * Stable founding act (`lares vessel found --hearth`), `lares persona new`, and the roll that grows the seed charter
 * (`lares nexus seal rotate`), over a genuine vault + petname/declaration stores.
 *
 * The Stable founding act founds persona zero and seats its ONE chair in the hearth's seed charter. Two more faces
 * stand for chairs by `persona new 1/2 --seat`, and the seed card reveals so the roll seats every chair that stands.
 * The hearth's Nexus AID never moves: a re-seat over the seed charter refuses by name.
 *
 * THE JOIN READS THE DECLARED HANDLE, NEVER THE PRIVATE LABEL. A chair belongs to whoever declared the Handle
 * it names AND stood for a seat; the pet-name labels a compartment and reaches no roster.
 *
 * Proven:
 *   · the act and `persona new 1/2 --name '<label>' --handle '<kahu>' --seat` each return 0; the roster reads
 *     [0,1,2] with all three private labels, and all three declared Handles beside them;
 *   · `persona new 0` on the hearth LOADS persona zero (created:false) and still lands label + declaration;
 *   · the roll joins persona→chair BY DECLARED HANDLE and seats ALL THREE (persona zero among them);
 *   · a persona that declares a Handle and does NOT stand for a seat takes no chair;
 *   · the roll keeps the seed's rule unless the operator names one, and a rule past the roster refuses;
 *   · a re-seat over the hearth's seed charter refuses by name, and the AID stays.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore,
  listPersonaRoots, readNexusDoc, loadIdentityAnchors,
} from "@lararium/node";
import { ownPersonaPetname, declaredHandle, foundingQuorumSeated, nexusAidOf } from "@lararium/mesh";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/** The three chair names — the PUBLIC Handles each founding persona answers to. */
const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
/** A FOURTH Handle, for the reading that needs one persona to stand OUTSIDE the seated roster. */
const KAHU_SPARE = "Kahu Delta";
const LABEL_SPARE = "veil-four";
/** The human's PRIVATE labels for the same three compartments — deliberately unlike the Handles above. */
const LABELS = ["veil-one", "veil-two", "veil-three"];
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
const personaArgs = (
  positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {},
): ParsedArgs => ({ command: "persona", positional,
  options: { ...options, ...(flags.seat && options.handle ? { chair: options.handle } : {}) }, flags: { json: true, ...flags } });
const nexusArgs = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });
const lastJson = (spy: { mock: { calls: unknown[][] } }): Record<string, any> =>
  JSON.parse(String(spy.mock.calls.map((c) => String(c[0])).filter((l) => l.trim().startsWith("{")).at(-1)));

describe("a hearth's three founding faces (CLI, real vault + disk)", () => {
  let root: string;
  /** The seed card's code the founding printed (the read-back stands in on this staged root). */
  let card = "";
  beforeEach(async () => {
    vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
    root = mkdtempSync(join(tmpdir(), "lares-founding3-"));
    setEnv("LAR_ROOT", root);                       // isolates bags + vault-state + petname store under one tree
    // A STAGED root, as a harness stages one: the marker beside custody under the published test route, so the
    // card's read-back stands in.
    writeFileSync(join(root, ".lar-test-scratch"), "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    // THE HEARTH STANDS FIRST: the Stable founding act founds persona zero, whose one chair seats the seed charter.
    const wire = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: { name: LABELS[0]!, chair: KAHU[0]! }, flags: { json: true, hearth: true } })).toBe(0);
    card = String(lastJson(wire).data.cards[0].code);
    wire.mockRestore();
    expect(card).toMatch(/^[0-9a-f-]+$/);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  /** Persona zero takes its Handle; h1 and h2 stand for chairs beside it. */
  async function standThree(): Promise<void> {
    for (let i = 0; i < KAHU.length; i++) {
      expect(await cmdPersona(personaArgs(["new", String(i)], { name: LABELS[i]!, handle: KAHU[i]! }, { seat: true }))).toBe(0);
    }
  }
  const roll = (options: Record<string, string> = {}) => cmdNexus(nexusArgs(["seal", "rotate"], { "cold-key": card, face: "0", ...options }));

  test("the hearth's persona zero and persona new 1/2 → roster [0,1,2]; the private label and the declared Handle land SEPARATELY", async () => {
    await standThree();
    expect(await listPersonaRoots()).toEqual([0, 1, 2]);
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    for (let i = 0; i < KAHU.length; i++) {
      expect(await ownPersonaPetname(petnames, i)).toBe(LABELS[i]);      // the compartment's own label
      expect(await declaredHandle(declarations, i)).toBe(KAHU[i]);        // what it answers to outward
      expect(LABELS[i]).not.toBe(KAHU[i]);                                // the two registers stay independent
    }
  });

  test("★ each founded persona persists its wear-reboot mount material (signerDid · KEL prefix · signed edge) into anchors-hN ★", async () => {
    await standThree();
    const aid = nexusAidOf(readNexusDoc(larSealHome()));
    for (let i = 0; i < KAHU.length; i++) {
      const a = await loadIdentityAnchors(i);
      expect(a, `h${i} anchors exist`).not.toBeNull();
      expect(a?.signerDid, `h${i} anchors carry its signer DID`).toBeTruthy();
      expect(a?.personaKelPrefix, `h${i} anchors carry its KEL prefix`).toBeTruthy();
      expect(a?.deviceEdge?.kind, `the edge is a device-delegation record`).toBe("device-delegation");
      expect(a?.deviceEdge?.hearthTrueName, `h${i}'s edge binds the hearth's seed charter`).toBe(aid);
    }
  });

  test("persona new 0 on the hearth LOADS persona zero + names it (idempotent — same key, never re-minted)", async () => {
    const founder = await generateOrLoadPersonaGroupRoot(0);
    expect(founder.created).toBe(false);                       // the Stable founding act minted it
    expect(await cmdPersona(personaArgs(["new", "0"], { name: "renamed", handle: KAHU[0]! }, { seat: true }))).toBe(0);
    const reloaded = await generateOrLoadPersonaGroupRoot(0);
    expect(reloaded.created).toBe(false);
    expect(reloaded.verifyingKey).toBe(founder.verifyingKey);
    expect(await ownPersonaPetname(await makeNodePersonaPetnameStore(), 0)).toBe("renamed");
    expect(await declaredHandle(await makeNodePersonaDeclarationStore(), 0)).toBe(KAHU[0]);
  });

  test("the roll joins by DECLARED HANDLE and seats ALL THREE — persona zero among the seated, the AID unmoved", async () => {
    const aid = nexusAidOf(readNexusDoc(larSealHome()));
    await standThree();
    expect(await roll({ threshold: "2" })).toBe(0);
    const doc = readNexusDoc(larSealHome());
    expect(doc?.kahu.length).toBe(3);
    for (const k of doc!.kahu) expect(k.verifyingKey, `${k.chairLabel} seated by declared-Handle join`).toBeTruthy();
    expect(doc!.kahu.find((k) => k.chairLabel === KAHU[0])?.verifyingKey).toBeTruthy();
    expect(foundingQuorumSeated(doc)).toBe(true);
    expect(nexusAidOf(doc)).toBe(aid);
    expect(doc!.sealLineage).toHaveLength(2);
  });

  test("★ a declared Handle WITHOUT --seat takes NO CHAIR — the roster holds only what stood ★", async () => {
    await standThree();
    await cmdPersona(personaArgs(["new", "3"], { name: LABEL_SPARE, handle: KAHU_SPARE }));
    expect(await roll({ threshold: "2" })).toBe(0);
    const doc = readNexusDoc(larSealHome());
    expect(doc!.kahu.map((k) => k.chairLabel)).toEqual(KAHU);
    expect(doc!.kahu.find((k) => k.chairLabel === KAHU_SPARE)).toBeUndefined();
    expect(doc!.threshold).toBe(2);
  });

  test("the roll keeps the seed's rule unless the operator names one, and --threshold takes the operator's call", async () => {
    await standThree();
    expect(await roll()).toBe(0);
    expect(readNexusDoc(larSealHome())!.threshold).toBe(1);          // the seed charter's own rule still fits
  });

  test("★ --threshold past the roster REFUSES — it would seat a rule no quorum could ever reach ★", async () => {
    await standThree();
    const before = readNexusDoc(larSealHome());
    expect(await roll({ threshold: "4" })).not.toBe(0);
    expect(readNexusDoc(larSealHome())).toEqual(before);
  });

  test("★ a re-seat over the hearth's seed charter REFUSES by name, and the AID stays ★", async () => {
    await standThree();
    const before = readNexusDoc(larSealHome());
    expect(await cmdNexus(nexusArgs(["seal", "seat"]))).not.toBe(0);
    expect(readNexusDoc(larSealHome())).toEqual(before);
  });

  test("★ the PRIVATE label never reaches the seal — the doc carries chair names and keys, no compartment labels ★", async () => {
    await standThree();
    await roll({ threshold: "2" });
    const wire = JSON.stringify(readNexusDoc(larSealHome()));
    for (const label of LABELS) expect(wire).not.toContain(label);
  });

  test("★ a MIRROR never fails the act it mirrors — no fleet answers, and the naming still lands ★", async () => {
    expect(await cmdPersona(personaArgs(["new", "0"], { name: LABELS[0]!, handle: KAHU[0]! }, { seat: true }))).toBe(0);
    expect(await ownPersonaPetname(await makeNodePersonaPetnameStore(), 0)).toBe(LABELS[0]);
    expect(await declaredHandle(await makeNodePersonaDeclarationStore(), 0)).toBe(KAHU[0]);
    expect(readNexusDoc(larSealHome())!.kahu.find((k) => k.chairLabel === KAHU[0])?.verifyingKey).toBeTruthy();
  });
});
