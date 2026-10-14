/** The edge primitive is standing; a Nexus cosign caller must judge before invoking its signer. */
import { describe, expect, test } from "vitest";
import { cosignEdgeActPartial, readEdgeActPartial, type EdgeActPartial } from "../src/edge-partial.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
const malformed = {
  kind: "edge-act-partial", scope: "ab".repeat(32),
  subject: { kind: "member", member: "cd".repeat(32) },
  act: { kind: "wrong-domain", edgeId: "00".repeat(32), actCid: "11".repeat(32),
    raised: true, hand: "quorum", parents: [], epochCid: "epoch", signatures: [] },
} as unknown as EdgeActPartial;

describe("Nexus partial signing boundary", () => {
  test("CONTROL: the standing edge reader rejects a malformed act before any signer runs", () => {
    expect(readEdgeActPartial(malformed)).toBeNull();
  });

  red("PARTIAL_COSIGN_JUDGES_BEFORE_SIGNING: no seat signs a partial its reader rejects", async () => {
    let calls = 0;
    try {
      await cosignEdgeActPartial(malformed, [{ signer: "ef".repeat(32), sign: async () => {
        calls++;
        return "00".repeat(64);
      } }]);
    } catch { /* the read boundary still may reject after the attempted signature */ }
    expect(calls).toBe(0);
  });
});
