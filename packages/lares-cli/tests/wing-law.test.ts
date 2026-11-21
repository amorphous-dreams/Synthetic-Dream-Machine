/**
 * wing-law — the wing-slug fixture, the TS side of the cross-language pin.
 *
 * The wing law lives ONCE in TS (src/wing-law.ts); the python sweep carries its port
 * (`wing_derive.py`). This table and `scripts/test_wing_derive.py`'s hold the same rows,
 * so a slug law that moves on either side fails loud. The resolver reads a synthetic
 * transcript (recorded cwd → wing; sibling-first; no cwd → null, never a guess).
 */

import { describe, test, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wingFromDir, resolveTranscriptWing } from "../src/wing-law.js";

describe("wingFromDir ≡ wing_derive.py wing_from_dir", () => {
  // The exact rows of scripts/test_wing_derive.py's WING_FIXTURES, each a basename → its wing.
  const fixtures: Record<string, string> = {
    "Synthetic-Dream-Machine": "wing_synthetic_dream_machine",   // hyphen + case
    "My Project": "wing_my_project",                             // space → underscore
    "weird@Name!.v2": "wing_weirdnamev2",                        // punctuation stripped
    "already_snake_09": "wing_already_snake_09",                 // fixpoint
    "": "wing_unsorted",                                          // empty → unsorted
  };

  for (const [base, want] of Object.entries(fixtures)) {
    test(`"${base}" derives ${want}`, () => {
      expect(wingFromDir(base)).toBe(want);
    });
  }
});

describe("resolveTranscriptWing — the resolver `lares wing-of` and the capture share", () => {
  function scratchProject(): { dir: string; done: () => void } {
    const dir = mkdtempSync(join(tmpdir(), "wing-of-"));
    return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  const row = (cwd?: string): string => JSON.stringify(cwd ? { cwd, type: "user" } : { type: "user" }) + "\n";

  test("derives the wing from the transcript's recorded cwd", () => {
    const { dir, done } = scratchProject();
    try {
      const t = join(dir, "session-b.jsonl");
      writeFileSync(t, row() + row("/home/op/Synthetic-Dream-Machine"));
      expect(resolveTranscriptWing(t)).toBe("wing_synthetic_dream_machine");
    } finally { done(); }
  });

  test("the FIRST sibling's cwd wins (the project dir's stable identity, discoverClaude parity)", () => {
    const { dir, done } = scratchProject();
    try {
      writeFileSync(join(dir, "a-first.jsonl"), row("/home/op/Stable-Project"));
      const t = join(dir, "z-later.jsonl");
      writeFileSync(t, row("/home/op/some/drifted-subdir"));
      expect(resolveTranscriptWing(t)).toBe("wing_stable_project");
    } finally { done(); }
  });

  test("no recorded cwd anywhere → null (fail loud, never a guessed wing)", () => {
    const { dir, done } = scratchProject();
    try {
      const t = join(dir, "bare.jsonl");
      writeFileSync(t, row() + row());
      expect(resolveTranscriptWing(t)).toBeNull();
    } finally { done(); }
  });
});
