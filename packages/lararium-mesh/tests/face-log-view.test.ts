/**
 * face-log-view — one party's signed view of a face's head.
 *
 *   CONTROL: a view signed by its party reads back from its line and verifies under the key it names.
 *   RED vectors: a view whose head, prefix, party or key moved after signing fails its signature; a line that
 *   reads as no view, a party no kind names, and a view with a stray part each read as none.
 *
 * Synthetic keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { describe, expect, it } from "vitest";
import { faceLogViewLine, faceLogViewSigned, readFaceLogView, readFaceLogViewLine, signFaceLogView } from "../src/face-log-view.js";

const SEED = Uint8Array.from({ length: 32 }, (_, i) => (i * 5 + 3) & 0xff);
const view = () => signFaceLogView({ prefix: "persona-" + "ab".repeat(32), seq: 1, eventCid: "pkel1-" + "cd".repeat(32), party: "recovery-contact", seed: SEED });

describe("a party's own view of a face's head", () => {
  it("CONTROL: a signed view crosses as one line and verifies", async () => {
    const v = await view();
    const back = readFaceLogViewLine(faceLogViewLine(v));
    expect(back).toEqual(v);
    expect(faceLogViewSigned(back!)).toBe(true);
  });

  it.each([
    ["another head sequence", { seq: 2 }],
    ["another head event", { eventCid: "pkel1-" + "ee".repeat(32) }],
    ["another face", { prefix: "persona-" + "ff".repeat(32) }],
    ["another party kind", { party: "chair" as const }],
    ["another key", { key: "11".repeat(32) }],
  ])("RED: %s fails the signature", async (_name, bend) => {
    expect(faceLogViewSigned({ ...(await view()), ...bend })).toBe(false);
  });

  it("RED: a line or a value of another shape reads as no view", async () => {
    const v = await view();
    expect(readFaceLogViewLine("lar-recovery-contact-offer:zz")).toBeNull();
    expect(readFaceLogViewLine("lar-log-view:!!!")).toBeNull();
    expect(readFaceLogView({ ...v, party: "stranger" })).toBeNull();
    expect(readFaceLogView({ ...v, seat: true })).toBeNull();
    expect(readFaceLogView({ ...v, seq: -1 })).toBeNull();
  });
});
