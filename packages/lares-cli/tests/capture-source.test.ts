/**
 * capture-source — every ingress must hand the NALU one source identity for
 * one transcript.  The source string participates in sink-side dedup, so a
 * staging-only prefix cannot mint a second memory drawer.
 */

import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { captureSourceFile, sha } from "../src/commands/capture/harvest.js";

const wing = "wing_synthetic_dream_machine";
const run = "session-123.jsonl";

// DIGEST-EQUALITY CONTROL: harvest.ts's turn-key `sha()` now routes through the shared
// `@lararium/mesh` sha256HexSync (the hand-rolled local `createHash` wrapper retired, item 5) —
// pin its 16-char truncation byte-equal to node crypto over the same preimage.
describe("harvest.ts sha() agrees with node crypto (truncated)", () => {
  test("16-char prefix of the full sha256 hex", () => {
    const preimage = "lar:///ha.ka.ba/lares/api/pono/meme#turn-key-pin";
    const want = createHash("sha256").update(preimage).digest("hex").slice(0, 16);
    expect(sha(preimage)).toBe(want);
  });
});

