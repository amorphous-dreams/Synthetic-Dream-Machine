/**
 * ed25519-verdict-memo — a signature verdict is a pure function of (signature, key, message bytes), so the one verify door answers a
 * triple it has read before from memory. The fold that re-reads a growing stage on every change then verifies each act ONCE, and the
 * work grows with the acts, not with acts times changes. P5's ea hang: a daemon island burned 90 to 190 s of pure-JS curve maths
 * re-verifying the whole stage on every read.
 *
 * RED: the equation count over N cumulative folds equals N (linear), not N(N+1)/2. CONTROL: a changed message, key or signature still
 * runs its own equation and a forged signature still reads false, cached or not.
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519EquationRuns, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyEd25519 } from "../src/ed25519-door.js";
import { kahuaActRecords, readKahuaStage, signKahuaLift, writeKahuaAct } from "../src/kahua-stage.js";

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const GROUP = "face-group";

describe("the verify door remembers its verdicts", () => {
  test("RED: the same triple read 10 times runs its equation once; CONTROL: each distinct message, and a forged signature, runs and reads right", async () => {
    const root = await signer(31);
    const before = ed25519EquationRuns();
    const msgs = Array.from({ length: 6 }, (_, i) => new TextEncoder().encode(`memo-${i}-${Math.random()}`));
    const sigs = await Promise.all(msgs.map((m) => root.sign(m)));
    for (let round = 0; round < 10; round++) msgs.forEach((m, i) => expect(verifyEd25519(sigs[i], m, root.key)).toBe(true));
    expect(ed25519EquationRuns() - before, "six distinct triples, six equations").toBe(6);
    const forged = sigs[0]!.slice(0, -2) + (sigs[0]!.endsWith("00") ? "01" : "00");
    for (let round = 0; round < 5; round++) expect(verifyEd25519(forged, msgs[0], root.key)).toBe(false);
    expect(verifyEd25519(sigs[1], msgs[0], root.key), "a signature over another message still refuses").toBe(false);
  });

  test("RED: folding a growing stage after each of N lifts verifies each act once (linear), not N(N+1)/2 times", async () => {
    const root = await signer(32);
    const origin = { seat: root.key, device: root.key, session: "s" };
    const grant = (k: string) => k === root.key;
    const doc = { tiddlers: {} } as LarDoc;
    const N = 8;
    const before = ed25519EquationRuns();
    for (let i = 0; i < N; i++) {
      const act = await signKahuaLift({ group: GROUP, epoch: 0, title: `t${i}-${Math.random()}`, text: `x${i}`, fields: {}, parent: null, origin, taint: [], sources: [{ title: `daemon/t${i}`, revision: "r1" }] }, root);
      writeKahuaAct(doc, act);
      readKahuaStage(kahuaActRecords(doc, GROUP), { group: GROUP, grant } as never);
      readKahuaStage(kahuaActRecords(doc, GROUP), { group: GROUP, grant } as never);   // a second read of the same standing stage
    }
    expect(ed25519EquationRuns() - before, "one equation per distinct act").toBe(N);
  });
});
