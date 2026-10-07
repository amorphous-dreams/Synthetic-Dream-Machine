/**
 * seal-import — receiving a partner's charter must never destroy your own.
 *
 * ── THE ACT, AND WHY IT IS DANGEROUS ────────────────────────────────────────────────────────────
 * Before an operator can consent to carriage she must hold the founding operator's charter: seated
 * keys, threshold, epoch lineage — public material, and she "cannot consent to a charter she has
 * never seen". `accept-carriage` then signs a contract-in against whatever charter stands in the
 * seal home it reads.
 *
 * Which makes the placement load-bearing. An operator who has founded her OWN Nexus and drops a
 * partner's `founding-roster.mem` into her seal home has overwritten her own charter — and every
 * contract-in she signs afterwards binds to the wrong epoch. The witness that proves the crossing
 * carries the file with `cp`, on a vessel that had no charter to lose, so nothing has ever met this.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────────
 * At the PRIMARY path a charter arrives where none stands, or it refuses. Re-importing the SAME charter
 * is not a destruction and passes — an operator who runs a step twice should not be punished for it.
 * A partner's charter takes `--carry` and lands BESIDE the primary, under its own Nexus AID.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, renderNexusDoc, writeNexusDoc, nexusCharterDocPath, carriedCharterHome, readConsent,
  parseNexusDoc,
} from "@lararium/node";
import {
  NEXUS_DOC_DOMAIN, hex, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, realmIdOfCharter, type NexusDoc,
} from "@lararium/mesh";
import { sealImportVerdict } from "../src/seal-import.js";

const A = "epoch0-" + "a".repeat(64);
const B = "epoch0-" + "b".repeat(64);

describe("seal-import — a charter arrives where none stands", () => {
  it("★ a charter lands cleanly on a vessel holding none ★", () => {
    const v = sealImportVerdict({ incoming: A, standing: null });
    expect(v.ok).toBe(true);
  });

  it("★ a DIFFERENT charter over a standing one REFUSES — that write destroys a founding ★", () => {
    const v = sealImportVerdict({ incoming: A, standing: B });
    expect(v.ok).toBe(false);
    // The refusal must name what would have been lost, so the operator can tell this from a typo.
    expect(v.why).toMatch(/own charter|already stands|would replace/i);
    expect(v.why).toContain(B.slice(0, 12));
  });

  it("★ re-importing the SAME charter passes — idempotent, not destructive ★", () => {
    expect(sealImportVerdict({ incoming: A, standing: A }).ok).toBe(true);
  });

  it("★ an incoming charter with no epoch refuses — unseated material seats nothing ★", () => {
    // A roster carried before its epoch was established grants nothing and would overwrite something.
    expect(sealImportVerdict({ incoming: "", standing: null }).ok).toBe(false);
  });

  it("★ the refusal says where the charter SHOULD go, not only that it stopped ★", () => {
    const v = sealImportVerdict({ incoming: A, standing: B });
    expect(v.why.length).toBeGreaterThan(60);
  });
});

// ── THE VERBS, in process over a real seal home ──────────────────────────────────────────────────
//
// `seal import --carry` lands a partner charter BESIDE the primary; plain `seal import` keeps the primary
// rule; `accept-carriage --nexus` consents to one Nexus; `seal show` reports the carried set.

const verb = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true, ...flags } });

/** The seed behind each foreign key, so a partner's revealed hands can sign its rolls. */
const seedOf = new Map<string, Uint8Array>();

/** The hands over `keys`, each signing with its own seed. */
function partnerHands(keys: readonly string[]): { signer: string; sign: (b: Uint8Array) => Promise<string> }[] {
  return keys.map((k) => {
    const seed = seedOf.get(k);
    if (!seed) throw new Error("fixture: no seed for a key that must sign a roll");
    return { signer: k, sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) };
  });
}

/** A charter over `keys` with a pre-rotated, signed lineage `rotations` epochs past genesis. */
async function charter(keys: string[], rotations = 0): Promise<NexusDoc> {
  const lineage = [genesisCharterEpoch(keys, 2, sealKeySetHash(keys, 3))];
  let threshold = 2;
  for (let i = 0; i < rotations; i++) {
    const revealed = threshold === 2 ? 3 : 2;
    const r = await rotateSealEpoch(lineage[lineage.length - 1]!, { keys, threshold: revealed }, sealKeySetHash(keys, threshold), partnerHands(keys));
    if (!r.ok) throw new Error(r.reason);
    lineage.push(r.epoch);
    threshold = revealed;
  }
  return { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: lineage[lineage.length - 1]!.epochCid, sealLineage: lineage,
           kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })) };
}

async function foreignKeys(salt: number): Promise<string[]> {
  return Promise.all([1, 2, 3].map(async (i) => {
    const seed = new Uint8Array(32).fill(salt + i);
    const pub = hex(await ed.getPublicKeyAsync(seed));
    seedOf.set(pub, seed);
    return pub;
  }));
}

/** Capture the one JSON payload a verb emits. */
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, unknown> }> {
  const lines: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = await cmdNexus(a);
    const json = lines.find((l) => l.trim().startsWith("{"));
    return { code, out: json ? JSON.parse(json) as Record<string, unknown> : {} };
  } finally { log.mockRestore(); err.mockRestore(); out.mockRestore(); }
}

describe("lares nexus seal import --carry · accept-carriage --nexus · seal show (in process)", () => {
  let root: string;
  let prior: string | undefined;
  let scratch: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-carry-cli-"));
    scratch = mkdtempSync(join(tmpdir(), "lares-carry-src-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
  });
  afterEach(() => {
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  });

  /** This vessel's own founding: three held roots seated at the primary path. */
  async function found(): Promise<string[]> {
    const keys = (await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)))).map((r) => r.verifyingKey);
    writeNexusDoc(larSealHome(), (await charter(keys)));
    return keys;
  }

  function partnerFile(doc: NexusDoc, name = "partner.mem"): string {
    const path = join(scratch, name);
    writeFileSync(path, renderNexusDoc(doc), "utf8");
    return path;
  }

  it("★ seal import --carry lands a partner charter BESIDE the primary and leaves its bytes identical ★", async () => {
    await found();
    const before = readFileSync(nexusCharterDocPath(larSealHome()));
    const partner = (await charter(await foreignKeys(10)));
    const aid = realmIdOfCharter(partner)!;

    const r = await run(verb(["seal", "import"], { carry: partnerFile(partner) }));
    expect(r.code).toBe(0);
    expect(r.out["data"]).toMatchObject({ aid, outcome: "landed" });
    expect(readFileSync(nexusCharterDocPath(larSealHome())).equals(before)).toBe(true);
    expect(existsSync(join(carriedCharterHome(larSealHome(), aid), "founding-roster.mem"))).toBe(true);
  });

  it("CONTROL — a plain seal import of a DIFFERENT charter over the standing primary still refuses", async () => {
    await found();
    const before = readFileSync(nexusCharterDocPath(larSealHome()));
    const r = await run(verb(["seal", "import", partnerFile((await charter(await foreignKeys(10))))]));
    expect(r.code).toBe(3);
    expect(String((r.out["error"] as { message?: string })?.message)).toMatch(/--carry/);
    expect(readFileSync(nexusCharterDocPath(larSealHome())).equals(before)).toBe(true);
  });

  it("CONTROL — seal import --carry of a charter that does not extend the held head refuses", async () => {
    await found();
    const keys = await foreignKeys(10);
    expect((await run(verb(["seal", "import"], { carry: partnerFile((await charter(keys, 1)), "head.mem") }))).code).toBe(0);
    const r = await run(verb(["seal", "import"], { carry: partnerFile((await charter(keys, 0)), "behind.mem") }));
    expect(r.code).toBe(3);
    expect((r.out["error"] as { code?: string })?.code).toBe("refused");
  });

  it("★ accept-carriage --nexus consents to one Nexus, and seal show reports the carried set ★", async () => {
    const keys = await found();
    const primary = realmIdOfCharter((await charter(keys)))!;
    const partner = (await charter(await foreignKeys(10)));
    const aid = realmIdOfCharter(partner)!;
    await run(verb(["seal", "import"], { carry: partnerFile(partner) }));

    const before = await run(verb(["seal", "show"]));
    const carriedBefore = (before.out["data"] as { carried: Array<{ aid: string; carried: boolean }> }).carried;
    expect(carriedBefore.map((c) => [c.aid, c.carried])).toEqual([[primary, true], [aid, false]]);   // seated · not consented

    const c = await run(verb(["accept-carriage"], { nexus: aid }));
    expect(c.code).toBe(0);
    expect(c.out["data"]).toMatchObject({ aid, sealEpochCid: partner.sealEpochCid });
    expect(readConsent(larSealHome(), aid)).not.toBeNull();

    const after = await run(verb(["seal", "show"]));
    const data = after.out["data"] as { carried: Array<{ aid: string; carried: boolean; consented: boolean }>; phase: { contractedInto?: boolean } };
    expect(data.carried.map((x) => [x.aid, x.carried, x.consented])).toEqual([[primary, true, false], [aid, true, true]]);
  });

  // ── A FAILED WRITE LEAVES NO TEMP AND THROWS NOTHING ───────────────────────────────────────────
  //
  // The write rides a sibling temp (`<dest>.incoming`) and a rename. A write that faults must leave neither
  // a stranded temp nor a changed primary, and must answer with a refusal. Two planted faults: a DIRECTORY
  // at the temp path (EISDIR, nothing written), and a symlink to /dev/full there (ENOSPC mid-write — the
  // shape that strands a partial temp on a full disk).
  const strayTemps = (dir: string): string[] => readdirSync(dir).filter((n) => /\.incoming$|\.tmp$/.test(n));
  const hasDevFull = existsSync("/dev/full");

  /** This vessel's founding, plus the SAME charter in different bytes — it passes the verdict, so the write is reached. */
  async function foundAndSameBytes(): Promise<{ dest: string; before: Buffer; same: string }> {
    const keys = await found();
    const dest = nexusCharterDocPath(larSealHome());
    const same = partnerFile((await charter(keys)), "same.mem");
    writeFileSync(same, readFileSync(same, "utf8") + "\n", "utf8");
    return { dest, before: readFileSync(dest), same };
  }

  it("★ a primary land leaves no temp file beside the charter ★", async () => {
    const r = await run(verb(["seal", "import", partnerFile((await charter(await foreignKeys(10))))]));
    expect(r.code).toBe(0);
    expect(existsSync(nexusCharterDocPath(larSealHome()))).toBe(true);
    expect(strayTemps(larSealHome())).toEqual([]);
  });

  it("★ a primary write that faults (directory at the temp) returns non-zero without throwing; the standing bytes stay ★", async () => {
    const { dest, before, same } = await foundAndSameBytes();
    mkdirSync(`${dest}.incoming`);
    const r = await run(verb(["seal", "import", same]));
    expect(r.code).not.toBe(0);
    expect(r.out["ok"]).toBe(false);
    expect(readFileSync(dest).equals(before)).toBe(true);
  });

  it.skipIf(!hasDevFull)("★ a primary write that hits ENOSPC strands no temp and leaves the standing bytes ★", async () => {
    const { dest, before, same } = await foundAndSameBytes();
    symlinkSync("/dev/full", `${dest}.incoming`);
    const r = await run(verb(["seal", "import", same]));
    expect(r.code).not.toBe(0);
    expect(r.out["ok"]).toBe(false);
    expect(readFileSync(dest).equals(before)).toBe(true);
    expect(strayTemps(larSealHome())).toEqual([]);
  });

  it("CONTROL — the same re-import with no planted fault lands its bytes and strands nothing", async () => {
    const { dest, same } = await foundAndSameBytes();
    expect((await run(verb(["seal", "import", same]))).code).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(readFileSync(same, "utf8"));
    expect(strayTemps(larSealHome())).toEqual([]);
  });

  it.skipIf(!hasDevFull)("★ a carried write that hits ENOSPC refuses, strands no temp, and leaves the held charter ★", async () => {
    await found();
    const keys = await foreignKeys(10);
    expect((await run(verb(["seal", "import"], { carry: partnerFile((await charter(keys, 0)), "held.mem") }))).code).toBe(0);
    const home = carriedCharterHome(larSealHome(), realmIdOfCharter((await charter(keys, 0)))!);
    const path = join(home, "founding-roster.mem");
    const before = readFileSync(path);
    symlinkSync("/dev/full", `${path}.incoming`);

    const r = await run(verb(["seal", "import"], { carry: partnerFile((await charter(keys, 1)), "next.mem") }));
    expect(r.code).toBe(3);
    expect((r.out["error"] as { code?: string })?.code).toBe("refused");
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(strayTemps(home)).toEqual([]);
  });

  // ── A TORN STANDING CHARTER IS NOT AN ABSENT ONE ──────────────────────────────────────────────
  //
  // A primary that stands but reads torn is a founding whose bytes need recovering, never a vacancy: landing
  // any incoming charter over it would replace the founding the torn bytes still name.
  it("★ a plain import over a TORN standing charter refuses (code 3) and leaves the torn bytes ★", async () => {
    const keys = await found();
    const dest = nexusCharterDocPath(larSealHome());
    const whole = readFileSync(dest, "utf8");
    writeFileSync(dest, whole.slice(0, Math.floor(whole.length / 2)), "utf8");
    expect(parseNexusDoc(readFileSync(dest, "utf8"))).toBeNull();
    const torn = readFileSync(dest);

    const r = await run(verb(["seal", "import", partnerFile((await charter(keys)))]));
    expect(r.code).toBe(3);
    expect(String((r.out["error"] as { message?: string })?.message)).toMatch(/reads torn/);
    expect(readFileSync(dest).equals(torn)).toBe(true);
    expect(strayTemps(larSealHome())).toEqual([]);
  });

  it("CONTROL — a truly absent primary still lands", async () => {
    const dest = nexusCharterDocPath(larSealHome());
    expect(existsSync(dest)).toBe(false);
    expect((await run(verb(["seal", "import", partnerFile((await charter(await foreignKeys(10))))]))).code).toBe(0);
    expect(parseNexusDoc(readFileSync(dest, "utf8"))).not.toBeNull();
  });

  it("CONTROL — accept-carriage and members --list for an AID this vessel holds no charter for refuse", async () => {
    await found();
    const ghost = "epoch0-" + "e".repeat(64);
    expect((await run(verb(["accept-carriage"], { nexus: ghost }))).code).not.toBe(0);
    expect((await run(verb(["members"], { nexus: ghost }, { list: true }))).code).not.toBe(0);
    expect(readConsent(larSealHome(), ghost)).toBeNull();
  });
});
