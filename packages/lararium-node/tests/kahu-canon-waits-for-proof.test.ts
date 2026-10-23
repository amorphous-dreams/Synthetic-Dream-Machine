/**
 * kahu-canon-waits-for-proof — between the keel's mount of the Kahu canon and the worn face's proof verdict, nothing touches it.
 *
 * The mount happens during assembly, before the proof (which needs the KEL board and the daemon doc that stand later). What could
 * touch the mounted documents in that window: an ACT (verbs wire only after the daemon opens, which runs the proof), a WRITE (the
 * disk mirrors and the projection start after the daemon), and a SYNC (a wire peer pulling a canon document). The sync channel is the
 * one open before the proof, so `canonHeldUntilProof` closes it. RED: a canon document is denied to a wire peer until the proof passes
 * for a vessel that owes one; CONTROL: after the proof, and for a vessel owing none, the verdict defers to the ordinary law; a
 * document that is not canon is never held.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateAutomergeUrl, interpretAsDocumentId } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import { canonHeldUntilProof } from "../src/kahu-realm.js";

const LARES = generateAutomergeUrl(), LARARIUM = generateAutomergeUrl(), OTHER = generateAutomergeUrl();
const idOf = (url: string): string => String(interpretAsDocumentId(url as never));
const canon = { lares: LARES, lararium: LARARIUM };

describe("the Kahu canon waits for the face proof", () => {
  test("RED: both canon documents are held from a wire peer until the proof; CONTROL: proven, faceless and non-canon documents are not", () => {
    for (const url of [LARES, LARARIUM]) {
      expect(canonHeldUntilProof({ canon, owesFaceProof: true, faceProven: false, documentId: idOf(url) }), url).toBe(true);
      expect(canonHeldUntilProof({ canon, owesFaceProof: true, faceProven: true, documentId: idOf(url) }), "proven").toBe(false);
      expect(canonHeldUntilProof({ canon, owesFaceProof: false, faceProven: false, documentId: idOf(url) }), "a vessel owing no proof").toBe(false);
    }
    expect(canonHeldUntilProof({ canon, owesFaceProof: true, faceProven: false, documentId: idOf(OTHER) }), "an ordinary document").toBe(false);
    expect(canonHeldUntilProof({ canon: {}, owesFaceProof: true, faceProven: false, documentId: idOf(LARES) }), "no canon mounted").toBe(false);
  });

  test("RED: the guard stands in the share verdict BEFORE the self-slot law, and no verb wires or mirror starts before the daemon opens", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    const guard = src.indexOf("canonHeldUntilProof({ canon: kahuCanon");
    const law = src.indexOf("return selfSlotShareDecision({");
    expect(guard).toBeGreaterThan(0);
    expect(guard, "the hold precedes the ordinary verdict").toBeLessThan(law);
    // Acts: the verbs wire after the daemon (the proof's home) opens, as the boot's own ordering note says.
    expect(src).toContain("Ordering: openDaemon runs (awaited) inside daemonCap.build BEFORE the un-awaited wireVerbs");
  });
});
