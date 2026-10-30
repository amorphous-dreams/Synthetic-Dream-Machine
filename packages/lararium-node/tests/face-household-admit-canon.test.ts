/**
 * face-household-admit-canon — THE ADMIT'S CARRIAGE CARRIES THE HEARTH'S CANON AS THE CATALOG NAMES IT NOW (walk R4).
 *
 * A fleet-join answer carries the face's household admit, and the joinee takes the hearth's gate pin AND canon list off
 * the admit's own signed bytes (`nexus-contract`: the admit signs what it carries). The admit is minted ONCE and kept
 * (`face-household-admit`), so its canon is the catalog's list AT MINT. On the founding walk the kept admit carried
 * `canon: {}` (measured on root w1, 2026-10-29) and every later join read `the admit names no hearth canon`, the seed's
 * records never reaching the leaf. The pin and the canon move together inside one signature, so a kept admit whose
 * canon drifts from the catalog's current list is minted again under the same pin commitment, never patched beside it.
 *
 *   R4a  RED: a kept admit with `canon: {}` while the catalog names `@lares` and `@lararium` is minted again through the
 *        checked contract door, and the bundle kept and answered carries the catalog's list.
 *   R4b  CONTROL: a kept admit whose canon equals the catalog's current list stays kept; the door never runs.
 *   R4c  CONTROL: no catalog names no canon: a kept `{}` admit stays kept with no catalog url.
 *   R4d  CONTROL: a kept admit committed to another pin is minted again (the standing rule, unchanged).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const AID = "nexus-" + "a".repeat(64);
const NYM = "d".repeat(64);
const PIN = { signingKey: "pin-standing" };
const OTHER_PIN = { signingKey: "pin-other" };
const CANON = { "lar:///ha.ka.ba/lares": "automerge:3UQRlares", "lar:///ha.ka.ba/lararium": "automerge:3UQRlararium" };

const seam = vi.hoisted(() => ({
  catalogCanon: {} as Record<string, string>,
  minted: [] as Array<Record<string, unknown>>,
}));

vi.mock("../src/admit-bundle.js", () => ({
  admitBundlePathFor: (home: string, aid: string) => `${home}/nexus/carriage-admit/${aid}.json`,
  isAdmitBundle: (v: unknown) => typeof v === "object" && v !== null && "aid" in v,
}));
vi.mock("../src/carried-set.js", () => ({ primaryNexusAid: () => AID }));
vi.mock("../src/hearth-sovereign-pin.js", () => ({ hearthSovereignPin: () => PIN }));
vi.mock("../src/nexus-leaf.js", () => ({ mintNexusLeaf: async () => ({ verifyingKey: NYM, seed: new Uint8Array(32) }) }));
vi.mock("../src/nexus-doc.js", () => ({ readNexusDoc: () => ({}) }));
vi.mock("../src/commands/device-admit.js", () => ({ admitCanonDocs: async () => ({ ...seam.catalogCanon }) }));
vi.mock("../src/commands/nexus-contract.js", () => ({
  runNexusContract: async (opts: Record<string, unknown>) => {
    seam.minted.push(opts);
    return { bundle: bundleWith(PIN, { ...seam.catalogCanon }) };
  },
}));
vi.mock("@lararium/mesh", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  // The pin stands as a plain object here; its digest is its shape (the fleet-join witnesses read it the same way).
  gateBundleDigest: (pin: unknown) => JSON.stringify(pin),
  heldNexusRoot: () => ({ nexus: AID }),
  makeMultiSigQuorumVerifier: () => ({}),
  verifySignedAdmitBundle: async () => ({ carriage: {} }),
}));

import { ensureFaceHouseholdAdmit, faceHouseholdAdmitPath } from "../src/face-household-admit.js";

function bundleWith(gatePin: unknown, canon: Record<string, string>) {
  return { aid: AID, gatePubKey: "g".repeat(64), admit: { nym: NYM }, lineage: [], opening: { carriage: { gatePin, canon }, salt: "s" } };
}

describe("the household admit's carriage carries the canon the catalog names now", () => {
  let sealHome: string;
  beforeEach(() => {
    sealHome = mkdtempSync(join(tmpdir(), "lares-household-admit-canon-"));
    seam.minted = [];
    seam.catalogCanon = {};
  });
  afterEach(() => { rmSync(sealHome, { recursive: true, force: true }); });

  const keep = (bundle: unknown): string => {
    const path = faceHouseholdAdmitPath(sealHome, AID, NYM);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(bundle));
    return path;
  };
  const kept = (path: string) => JSON.parse(readFileSync(path, "utf8")) as ReturnType<typeof bundleWith>;

  test("R4a — a kept admit with no canon while the catalog names two docs is minted again, and the answer carries them", async () => {
    const path = keep(bundleWith(PIN, {}));
    seam.catalogCanon = { ...CANON };
    const answered = await ensureFaceHouseholdAdmit({ repo: {} as never, catalogUrl: "automerge:catalog", sealHome, face: 0 });
    expect(seam.minted, "the checked contract door mints the admit again").toHaveLength(1);
    expect(seam.minted[0]).toMatchObject({ action: "admit", nym: NYM, catalogUrl: "automerge:catalog" });
    expect(answered.opening.carriage.canon).toEqual(CANON);
    expect(answered.opening.carriage.gatePin).toEqual(PIN);
    expect(kept(path).opening.carriage.canon, "the kept bundle carries the catalog's list").toEqual(CANON);
  });

  test("R4b — CONTROL: a kept admit whose canon equals the catalog's current list stays kept; the door never runs", async () => {
    keep(bundleWith(PIN, { ...CANON }));
    seam.catalogCanon = { ...CANON };
    const answered = await ensureFaceHouseholdAdmit({ repo: {} as never, catalogUrl: "automerge:catalog", sealHome, face: 0 });
    expect(seam.minted).toHaveLength(0);
    expect(answered.opening.carriage.canon).toEqual(CANON);
  });

  test("R4c — CONTROL: no catalog names no canon, and a kept empty-canon admit stays kept", async () => {
    keep(bundleWith(PIN, {}));
    seam.catalogCanon = { ...CANON };
    const answered = await ensureFaceHouseholdAdmit({ repo: {} as never, sealHome, face: 0 });
    expect(seam.minted).toHaveLength(0);
    expect(answered.opening.carriage.canon).toEqual({});
  });

  test("R4d — CONTROL: a kept admit committed to another pin is minted again (the standing rule)", async () => {
    keep(bundleWith(OTHER_PIN, { ...CANON }));
    seam.catalogCanon = { ...CANON };
    const answered = await ensureFaceHouseholdAdmit({ repo: {} as never, catalogUrl: "automerge:catalog", sealHome, face: 0 });
    expect(seam.minted).toHaveLength(1);
    expect(answered.opening.carriage.gatePin).toEqual(PIN);
  });
});
