/**
 * nexus-seal-keyring — the seat act alone mints a Nexus convergence secret.
 *
 * Vectors:
 *   · Q1 — genesis seat mints its (Nexus AID, epoch CID) secret; CONTROL: before seat, the founded row holds none.
 *   · Q2 — repeating the seat mints nothing and leaves row bytes unchanged.
 *   · Q3 — rotate mints the new head's secret while preserving genesis.
 *   · Q4 — a seat below quorum emits keyring null and moves no byte of the row.
 *   · Q5 — locked-holder seat refuses before the charter or the row moves; CONTROL: Q1 on an unlocked holder moves both.
 *   · Q6 — locked-holder rotate refuses before charter bytes move.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore,
  loadNexusKeyring, heldNexusKeyringEntries, NEXUS_KEYRING_FILE, readNexusDoc,
  nexusCharterDocPath, writeNexusDoc,
} from "@lararium/node";
import {
  declarePersonaHandle, renameOwnPersona, sealKeySetHash, sealLineageHead,
  realmIdOfCharter, readVkCarrier, standForKahuSeat, NEXUS_DOC_DOMAIN,
} from "@lararium/mesh";

vi.setConfig({ testTimeout: 120_000 });

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, unknown> }> {
  const lines: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = await cmdNexus(a);
    const json = lines.find((line) => line.trim().startsWith("{"));
    return { code, out: json ? JSON.parse(json) as Record<string, unknown> : {} };
  } finally { out.mockRestore(); }
}

describe("lares nexus seal — seat-owned convergence keyring", () => {
  let root: string;
  let custody: ScratchCustody;
  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "lares-nexus-keyring-"));
    setEnv("LAR_ROOT", root);
    setEnv("LARES_ARCHIVE_PASSPHRASE", undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    custody = await seatScratchCustody();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await custody.drop();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  async function seatVault(count = 3): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const rt = await generateOrLoadPersonaGroupRoot(i);
      await renameOwnPersona(petnames, i, `keyring-compartment-${i}`);
      await declarePersonaHandle(declarations, i, KAHU[i]!);
      await standForKahuSeat(declarations, i, true, KAHU[i]!);
      keys.push(rt.verifyingKey);
    }
    return keys;
  }

  const rowPath = (): string => join(custody.homes.identity, NEXUS_KEYRING_FILE);

  test("Q1 — genesis seat mints one named secret; CONTROL — before seat the row is absent", async () => {
    const keys = await seatVault();
    expect(await heldNexusKeyringEntries()).toEqual([]);
    const born = readFileSync(rowPath());

    const result = await run(args(["seal", "seat"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(result.code).toBe(0);
    expect((result.out["data"] as Record<string, unknown>)["keyring"]).toEqual({ minted: true });
    const doc = readNexusDoc(larSealHome())!;
    const genesis = sealLineageHead(doc)!;
    const nexusAid = realmIdOfCharter(doc)!;
    const held = await heldNexusKeyringEntries();
    expect(held).toHaveLength(1);
    expect(held.map(({ nexusAid: aid, epochCid }) => [aid, epochCid])).toEqual([[nexusAid, genesis.epochCid]]);
    expect(readFileSync(rowPath()).equals(born)).toBe(false);
    expect(readVkCarrier(readFileSync(rowPath()))).toBe("sealed");
    const keyring = await loadNexusKeyring({ nexusAid, headEpochCid: genesis.epochCid });
    expect(keyring).not.toBeNull();
    expect(keyring!.current()).toMatchObject({ nexusAid, epochCid: genesis.epochCid });
  });

  test("Q2 — repeating the seat does not mint or move the row bytes", async () => {
    const keys = await seatVault();
    const options = { "next-key-commit": sealKeySetHash(keys, 2) };
    expect((await run(args(["seal", "seat"], options))).code).toBe(0);
    const first = readFileSync(rowPath());
    const before = (await heldNexusKeyringEntries())[0]!;
    const again = await run(args(["seal", "seat"], options));
    expect(again.code).toBe(0);
    expect((again.out["data"] as Record<string, unknown>)["keyring"]).toEqual({ minted: false });
    expect(readFileSync(rowPath()).equals(first)).toBe(true);
    expect(await heldNexusKeyringEntries()).toEqual([before]);
  });

  test("Q3 — rotate mints a second epoch secret and preserves genesis", async () => {
    const keys = await seatVault();
    const commit = sealKeySetHash(keys, 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": commit }))).code).toBe(0);
    const doc0 = readNexusDoc(larSealHome())!;
    const genesis = sealLineageHead(doc0)!;
    const nexusAid = realmIdOfCharter(doc0)!;
    const genesisSecret = (await loadNexusKeyring({ nexusAid, headEpochCid: genesis.epochCid }))!.current().secret;

    const rotated = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(rotated.code).toBe(0);
    expect((rotated.out["data"] as Record<string, unknown>)["keyring"]).toEqual({ minted: true });
    const head = sealLineageHead(readNexusDoc(larSealHome()))!;
    expect(head.epochCid).not.toBe(genesis.epochCid);
    const held = await heldNexusKeyringEntries();
    expect(held.map(({ nexusAid: aid, epochCid }) => [aid, epochCid])).toEqual([[nexusAid, genesis.epochCid], [nexusAid, head.epochCid]]);
    const keyring = await loadNexusKeyring({ nexusAid, headEpochCid: head.epochCid });
    const current = keyring!.current();
    expect(current).toMatchObject({ nexusAid, epochCid: head.epochCid });
    expect(Buffer.from((await loadNexusKeyring({ nexusAid, headEpochCid: genesis.epochCid }))!.current().secret).equals(Buffer.from(genesisSecret))).toBe(true);
    expect(Buffer.from(current.secret).equals(Buffer.from(genesisSecret))).toBe(false);
  });

  test("Q4 — a seat short of quorum roots no epoch, emits keyring null and writes no row", async () => {
    // Three chairs at two of three, and one hand standing: the roster lands, no epoch roots, nothing mints.
    writeNexusDoc(larSealHome(), {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null,
      kahu: KAHU.map((displayName) => ({ displayName, verifyingKey: null })),
    });
    await seatVault(1);
    const born = readFileSync(rowPath());
    const result = await run(args(["seal", "seat"]));
    expect(result.code).toBe(0);
    const data = result.out["data"] as Record<string, unknown>;
    expect(data["sealEpochCid"]).toBeNull();
    expect(data["keyring"]).toBeNull();
    expect(readFileSync(rowPath()).equals(born)).toBe(true);
    expect(await heldNexusKeyringEntries()).toEqual([]);
  });

  test("Q5 — THE REFUSAL: locked seat names vault unlock and writes neither charter nor row; CONTROL — Q1", async () => {
    await seatVault();
    const born = readFileSync(rowPath());
    await custody.holder.lock();
    const result = await run(args(["seal", "seat"], { "next-key-commit": "b".repeat(64) }));
    expect(result.code).not.toBe(0);
    expect(JSON.stringify(result.out["error"])).toMatch(/lares vault unlock/);
    expect(readNexusDoc(larSealHome())).toBeNull();
    expect(existsSync(nexusCharterDocPath(larSealHome()))).toBe(false);
    expect(readFileSync(rowPath()).equals(born)).toBe(true);
  });

  test("Q6 — locked rotate refuses before charter bytes move", async () => {
    const keys = await seatVault();
    const commit = sealKeySetHash(keys, 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": commit }))).code).toBe(0);
    const charter = nexusCharterDocPath(larSealHome());
    const before = readFileSync(charter);
    await custody.holder.lock();
    const result = await run(args(["seal", "rotate"], { "next-key-commit": commit }));
    expect(result.code).not.toBe(0);
    expect(JSON.stringify(result.out["error"])).toMatch(/lares vault unlock/);
    expect(readFileSync(charter).equals(before)).toBe(true);
  });
});
