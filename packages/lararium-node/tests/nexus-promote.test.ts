/**
 * nexus-promote — R-KAHU's S1 witness: seats on DIFFERENT vessels approve ONE exact byte-string of a promotion.
 *
 * Two vessels stand under two scratch `LAR_ROOT`s, each holding one chair of a 2-of-2 charter (the way
 * `edge-cosign.test.ts` stands them). Vessel A opens a high-impact approval over a file and reads a PARTIAL
 * (`below-class-threshold`, 1 of 2); a person carries the approval text to vessel B, which signs the hash it
 * reads once its person confirms that hash, and the verdict over the file's exact bytes reads ok 2 of 2.
 * The person confirms the WHOLE signed statement (the digest `open` prints), so purpose, surface, class or
 * epoch edited in transit draws a refusal. Controls: one moved byte reads `bytes-differ`; a wrong confirmation refuses and signs nothing; a signature
 * from a key no seat holds counts nothing; an approval of another charter epoch refuses at B's head.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road ("Planes ~ cabal, realm, Nexus")
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exactBytesHash, ed25519SignerFromSeed, promotionApprovalBytes, type PromotionApproval } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larSealHome } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { heldCharter, bookSeat } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, seatChairs } from "./seat-fixture.js";
import { runPromoteOpen, runPromoteSign, runPromoteCheck, PromoteError } from "../src/commands/nexus-promote.js";

let genesis: ReturnType<typeof heldCharter>;
let roots: string[];
let chairA: string;
let chairB: string;
let priorLarRoot: string | undefined;
const BYTES = new TextEncoder().encode("the exact bytes a promotion approves");
/** A file of `bytes` under the scratch root of vessel A: a person points the door at a path, never at bytes. */
const fileOf = (bytes: Uint8Array, name = "promoted.txt"): string => { const path = join(roots[0]!, name); writeFileSync(path, bytes); return path; };
const at = (index: number) => { process.env["LAR_ROOT"] = roots[index]!; return larSealHome(); };

async function stand(index: number, face: number) {
  process.env["LAR_ROOT"] = roots[index]!;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(face);
  await seatChairs([face]);
  writeNexusDoc(larSealHome(), genesis.doc());
}

beforeEach(async () => {
  priorLarRoot = process.env["LAR_ROOT"];
  roots = [mkdtempSync(join(tmpdir(), "lares-promote-a-")), mkdtempSync(join(tmpdir(), "lares-promote-b-"))];
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(0);
  chairA = (await seatChairs([0])).keys[0]!;
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(1);
  chairB = (await seatChairs([1])).keys[0]!;
  genesis = heldCharter({ keys: [chairA, chairB], threshold: 2, successors: { keys: [await chairKey(0, 1), await chairKey(1, 1)], threshold: 2 } });
  await stand(0, 0); await stand(1, 1);
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const open = (surface = "charter", actClass: "ordinary" | "high-impact" = "high-impact") =>
  runPromoteOpen({ file: fileOf(BYTES), purpose: "publish the charter page", surface, actClass, sealHome: at(0) });
const carried = (a: PromotionApproval): PromotionApproval => JSON.parse(JSON.stringify(a)) as PromotionApproval;

describe("the cross-vessel promotion approval door (R-KAHU S1)", () => {
  it("A opens a partial, B signs the hash it reads on confirmation, and the exact bytes verify 2 of 2", async () => {
    const opened = await open();
    expect(opened.signed).toEqual([chairA]);
    expect(opened.verdict).toMatchObject({ ok: false, reason: "below-class-threshold", counted: 1, threshold: 2 });
    const signed = await runPromoteSign({ approval: carried(opened.approval), sealHome: at(1), confirmHash: opened.approval.bytesHash, confirmStatement: opened.statement });
    expect(signed.added).toEqual([chairB]);
    expect([signed.counted, signed.threshold, signed.complete]).toEqual([2, 2, true]);
    expect(await runPromoteCheck({ approval: signed.approval, file: fileOf(BYTES), sealHome: at(0) })).toMatchObject({ ok: true, counted: 2, threshold: 2 });
    // The hash B signed names the bytes A opened over, and B never held them.
    expect(signed.approval.bytesHash).toBe(exactBytesHash(BYTES));
  });

  it("one byte moved after approval reads bytes-differ (control: the original bytes still verify)", async () => {
    const opened = await open();
    const signed = await runPromoteSign({ approval: carried(opened.approval), sealHome: at(1), confirmHash: opened.approval.bytesHash, confirmStatement: opened.statement });
    const moved = new Uint8Array(BYTES); moved[0] = moved[0]! ^ 1;
    expect(await runPromoteCheck({ approval: signed.approval, file: fileOf(moved, "moved.txt"), sealHome: at(0) })).toMatchObject({ ok: false, reason: "bytes-differ" });
    expect(await runPromoteCheck({ approval: signed.approval, file: fileOf(BYTES), sealHome: at(0) })).toMatchObject({ ok: true });
  });

  it("a wrong confirmation refuses and signs nothing; no confirmation only reads", async () => {
    const opened = await open();
    const wrong = exactBytesHash(new TextEncoder().encode("other bytes"));
    await expect(runPromoteSign({ approval: carried(opened.approval), sealHome: at(1), confirmHash: wrong, confirmStatement: opened.statement })).rejects.toThrow(PromoteError);
    const read = await runPromoteSign({ approval: carried(opened.approval), sealHome: at(1) });
    expect(read.added).toEqual([]);
    expect(read.would).toBe("sign");
    expect(read.approval.signatures).toHaveLength(1);
    expect([read.counted, read.complete]).toEqual([1, false]);
  });

  it("a signature from a key no seat holds counts nothing (a persona never stands in)", async () => {
    const opened = await open();
    const seed = new Uint8Array(32).fill(77);
    const stranger = await bookSeat(seed);
    const smuggled: PromotionApproval = { ...opened.approval, signatures: [...opened.approval.signatures,
      { signer: stranger, sig: await ed25519SignerFromSeed(seed)(promotionApprovalBytes(opened.approval)) }] };
    expect(await runPromoteCheck({ approval: smuggled, file: fileOf(BYTES), sealHome: at(1) })).toMatchObject({ ok: false, reason: "below-class-threshold", counted: 1, threshold: 2 });
  });

  it("an approval of another charter epoch refuses wrong-charter-epoch at B's head", async () => {
    const opened = await open();
    const other: PromotionApproval = { ...opened.approval, sealEpochCid: "another-epoch" };
    await expect(runPromoteSign({ approval: other, sealHome: at(1), confirmHash: other.bytesHash, confirmStatement: opened.statement }))
      .rejects.toMatchObject({ verdict: { ok: false, reason: "wrong-charter-epoch" } });
  });

  it("CONTROL: an ordinary class over a charter surface refuses at open; a whole-quorum vessel verifies alone", async () => {
    await expect(open("charter", "ordinary")).rejects.toThrow(/class-below-surface/);
    // An ordinary surface at ordinary class needs 2 of 2 under a two-seat charter: one vessel stays partial.
    const ord = await open("crossroads", "ordinary");
    expect(ord.verdict).toMatchObject({ ok: false, reason: "below-class-threshold", counted: 1, threshold: 2 });
  });

  it("P1: a junk signature carried under B's seat never locks that seat out; B's real signature lands", async () => {
    const opened = await open();
    const junked: PromotionApproval = { ...opened.approval, signatures: [...opened.approval.signatures, { signer: chairB, sig: "00".repeat(64) }] };
    const signed = await runPromoteSign({ approval: junked, sealHome: at(1), confirmHash: opened.approval.bytesHash, confirmStatement: opened.statement });
    expect(signed.added).toEqual([chairB]);
    expect([signed.counted, signed.complete]).toEqual([2, true]);
    expect(await runPromoteCheck({ approval: signed.approval, file: fileOf(BYTES), sealHome: at(0) })).toMatchObject({ ok: true, counted: 2, threshold: 2 });
  });

  it("P2: a carried partial whose surface or purpose moved after open refuses at sign with the original confirmation", async () => {
    const opened = await open("charter");
    for (const moved of [{ surface: "crossroads" }, { purpose: "publish something else" }, { actClass: "ordinary" as const }]) {
      const edited: PromotionApproval = { ...opened.approval, ...moved };
      await expect(runPromoteSign({ approval: edited, sealHome: at(1), confirmHash: edited.bytesHash, confirmStatement: opened.statement }))
        .rejects.toThrow(PromoteError);
    }
    // CONTROL: the untouched approval signs under the same confirmation.
    const signed = await runPromoteSign({ approval: carried(opened.approval), sealHome: at(1), confirmHash: opened.approval.bytesHash, confirmStatement: opened.statement });
    expect(signed.added).toEqual([chairB]);
    expect(signed.statement).toBe(opened.statement);
  });
});
