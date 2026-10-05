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

describe("capture source identity", () => {
  test("live Claude staging and a direct Claude capture converge", () => {
    expect(captureSourceFile(wing, `/home/op/.claude/projects/project/${run}`))
      .toBe(`${wing}/claude__${run}`);
    expect(captureSourceFile(wing, `/state/harvest-stage/live/${wing}/claude/hash/${run}`))
      .toBe(`${wing}/claude__${run}`);
  });

  test("the --all stage carries the same identity without double-prefixing", () => {
    expect(captureSourceFile(wing, `/state/harvest-stage/bulk/${wing}/claude/hash/${run}`))
      .toBe(`${wing}/claude__${run}`);
  });

  test("Codex and Copilot preserve their own surface while staging remains transparent", () => {
    expect(captureSourceFile(wing, `/home/op/.codex/sessions/2026/rollout-a.jsonl`))
      .toBe(`${wing}/codex__rollout-a.jsonl`);
    expect(captureSourceFile(wing, `/state/harvest-stage/live/${wing}/codex/hash/rollout-a.jsonl`))
      .toBe(`${wing}/codex__rollout-a.jsonl`);
    expect(captureSourceFile(wing, "/home/op/.config/Code/User/workspaceStorage/x/GitHub.copilot-chat/transcripts/chat.jsonl"))
      .toBe(`${wing}/copilot-vscode__chat.jsonl`);
  });
});
