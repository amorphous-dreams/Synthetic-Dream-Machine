/**
 * nexus-seal-grow — THE GROWTH RITE's CLI ceremony: the crossing record walked over a real vault + disk.
 *
 * The rite spans the rotate: `grow open` captures the STANDING hands before anything moves; the operator
 * pre-commits the successor and rotates (the existing succession door); `grow bind` fixes the record's
 * far side to the new head; hands SIGN (a key seated in both sets counts in both quorums); a witness —
 * a key seated in NEITHER — attests with a note; `grow seal` verifies the crossing whole and keeps the
 * record beside the charter. This is the verb that makes a second operator's arrival an event with an
 * artifact instead of an improvisation.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome, larDataDir } from "../src/env.js";
import {
  generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, readNexusDoc,
} from "@lararium/node";
import {
  renameOwnPersona, declarePersonaHandle, standForKahuSeat, sealKeySetHash, sealLineageHead,
  type ReserveTransition,
} from "@lararium/mesh";

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

describe("lares nexus seal grow — the crossing record ceremony", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-sealgrow-"));
    setEnv("LAR_ROOT", root);
    setEnv("LARES_ARCHIVE_PASSPHRASE", undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  /** Stand personas 0..n-1 as seated kahu; return their verifying keys. */
  async function stand(names: readonly string[], startAt = 0): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const idx = startAt + i;
      const rt = await generateOrLoadPersonaGroupRoot(larDataDir(), idx);
      await renameOwnPersona(petnames, idx, `compartment-${idx}`);
      await declarePersonaHandle(declarations, idx, names[i]!);
      await standForKahuSeat(declarations, idx, true);
      keys.push(rt.verifyingKey);
    }
    return keys;
  }

  test("★ THE CROSSING WALKS — open before the rotate, bind after, sign both quorums, witness, seal ★", async () => {
    // Three found; the fourth chair (the arriving operator) pre-commits into the successor set.
    const founders = await stand(KAHU);
    expect((await cmdNexus(args(["seal", "seat"], { "next-key-commit": sealKeySetHash(founders, 2) }))) ).toBe(0);
    // Arm the succession: the four-key set, pre-committed an epoch ahead.
    const rt3 = await generateOrLoadPersonaGroupRoot(larDataDir(), 3);
    const fourKeys = [...founders, rt3.verifyingKey];
    expect((await cmdNexus(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(fourKeys, 2) })))).toBe(0);
    const fromHead = sealLineageHead(readNexusDoc(larSealHome()))!;

    // ── OPEN: capture the standing hands BEFORE anything moves.
    expect((await cmdNexus(args(["seal", "grow", "open"])))).toBe(0);

    // The fourth stands; the succession rotate seats the four (matching the armed pre-commit).
    await stand(["Kahu Freyja"], 3);
    expect((await cmdNexus(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(fourKeys, 2) })))).toBe(0);
    const toHead = sealLineageHead(readNexusDoc(larSealHome()))!;
    expect(toHead.epochCid).not.toBe(fromHead.epochCid);

    // ── BIND: the record's far side fixes to the new head; the byte-image is now closed.
    expect((await cmdNexus(args(["seal", "grow", "bind"])))).toBe(0);

    // ── SIGN: two founders (in BOTH sets) satisfy the old quorum and carry the new one halfway;
    //          the arriving chair countersigns the receipt.
    for (const idx of ["0", "1", "3"]) {
      expect((await cmdNexus(args(["seal", "grow", "sign"], { index: idx })))).toBe(0);
    }
    // ── WITNESS: a hand seated in NEITHER set attests with a note.
    await stand(["Watcher At The Door"], 4);
    expect((await cmdNexus(args(["seal", "grow", "witness"], { index: "4", note: "watched the rite at the hearth, script in hand" })))).toBe(0);

    // ── SEAL: the crossing verifies whole and lands beside the charter.
    expect((await cmdNexus(args(["seal", "grow", "seal"])))).toBe(0);

    const kept = JSON.parse(readFileSync(join(larSealHome(), "transitions.json"), "utf8")) as ReserveTransition[];
    expect(kept).toHaveLength(1);
    expect(kept[0]!.fromEpochCid).toBe(fromHead.epochCid);
    expect(kept[0]!.toEpochCid).toBe(toHead.epochCid);
    expect(kept[0]!.witnesses).toHaveLength(1);
    expect(existsSync(join(larSealHome(), "transition-pending.json"))).toBe(false);   // the pending clears
  });

  test("★ AN UNSIGNED CROSSING REFUSES TO SEAL — and writes nothing ★", async () => {
    const founders = await stand(KAHU);
    await cmdNexus(args(["seal", "seat"], { "next-key-commit": sealKeySetHash(founders, 2) }));
    await cmdNexus(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(founders, 2) }));
    expect((await cmdNexus(args(["seal", "grow", "open"])))).toBe(0);
    await cmdNexus(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(founders, 2) }));
    expect((await cmdNexus(args(["seal", "grow", "bind"])))).toBe(0);

    expect((await cmdNexus(args(["seal", "grow", "seal"])))).not.toBe(0);
    expect(existsSync(join(larSealHome(), "transitions.json"))).toBe(false);
  });
});
