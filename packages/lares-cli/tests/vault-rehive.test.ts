/**
 * `lares vault rehive face=N` — what the operator reads once a rehive lands.
 *
 *   V1  a rehive from the seed names the moved row, what was lost, and the next acts in order: wear the face, land its shares
 *       again, read the kahu share's standing by the face's own PersonaGroup.
 *   V2  a rehive that restored the previous generation says only the last overwrite was lost.
 */
import { describe, expect, test } from "vitest";
import { rehiveLines } from "../src/vault-rehive.js";

const ANSWER = {
  op: "rehive", face: 1, outcome: "stood-from-seed", foreignIdentity: "4719534d00000000aaaa", ownIdentity: "1a2b3c4d00000000bbbb",
  aside: `veil-archive-g${"a".repeat(64)}.bin.mismatch-${"c".repeat(16)}`, personaGroup: "0xfeed",
};

describe("the rehive's answer", () => {
  test("V1 from the seed: the moved row, the loss, and the next acts in order", () => {
    const text = rehiveLines(ANSWER).join("\n");
    expect(text).toContain("restored identity 4719534d00000000aaaa…");
    expect(text).toContain(`rest aside at ${ANSWER.aside}`);
    expect(text).toContain("nothing was deleted");
    expect(text).toMatch(/LOST with the old Archive: the prekey secrets/);
    const wear = text.indexOf("lares vault unlock all=true face=1"), share = text.indexOf("lares bag share list=true"), kahu = text.indexOf("lares nexus cabal standing 0xfeed");
    expect(wear).toBeGreaterThan(-1);
    expect(share).toBeGreaterThan(wear);
    expect(kahu).toBeGreaterThan(share);
    expect(text).toContain("lares kahua get face=1");
    expect(text).toContain("lares kahua carry all=true face=1");
    expect(text).toContain("lares bag share list=true --json > shares-before.json");
    expect(text).toContain("[note='<its note>']");
    expect(text).toContain("with * kept, its note, workspace and owner");
    expect(text).toMatch(/owner back into config\/share\.tid by hand/);
    expect(text).toContain("it promises no mechanical round trip");
  });
  test("V2 a restored generation names only the last overwrite lost", () => {
    const text = rehiveLines({ ...ANSWER, outcome: "restored-prev" }).join("\n");
    expect(text).toContain("only the last overwrite is lost");
    expect(text).not.toMatch(/LOST with the old Archive/);
  });
});
