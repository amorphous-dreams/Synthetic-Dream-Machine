/**
 * normalize re-stamps — the door leaves no carrier holding a check its body does not match.
 *
 * FRAMING RIDES INSIDE THE CHECKED SPAN, so canonicalizing a carrier moves the very bytes its check
 * covers. A door that stamps nothing therefore reports `canonical` on a carrier it just made
 * non-canonical, and `meme check` — the form a CI gate runs — exits 0 on it. The silence is total: every
 * other law still holds, so nothing else in the suite has anything to say. Any sweep that edits
 * carrier bodies and then normalizes rests on this test.
 *
 * DRIVEN THROUGH THE BUILT BINARY, never the helper. This law lives in what the command composes;
 * `bccOf` satisfies it alone and can agree with nothing that calls it. A unit test over the helper
 * passes on a door that never calls it, which makes the binary the only honest witness.
 *
 * ── MINTING ON ABSENT READS PONO (operator ruling) ──────────────────────────────────────────────
 * A FRAMED carrier holding no check gets one MINTED. Read-optional, emit-always is the fault it cures:
 * `block-check.ts` rules the BCC optional on READ while the deserializer mints one unconditionally on
 * EMIT, so a hand-authored carrier lands legal on every gate its author runs and red on the one they do
 * not — which is how a torn-then-unchecked carrier reached `main`. Of the 701 carriers under `bags/`,
 * zero legitimately want to stand unchecked: the option reads real in the grammar and unexercised in
 * the corpus.
 *
 * TWO CASES STAY UNSTAMPED, and for different reasons:
 *   · TORN — the frame opens and never closes, so a digest would cover bytes the grammar never bounded.
 *     Torn wants the frame closed first, and the door says so rather than passing in silence.
 *   · UNFRAMED — no span stands at all, so nothing is stampable either way. The corpus's six
 *     `<bag>/meta.mem` bag descriptors sit here, and the new law reaches none of them.
 *
 * ⚠ THE COST: this forecloses deliberately authoring an unchecked FRAMED carrier — the BSC
 * trusted-link case `block-check.ts` cites, where a block ran without a BCC by choice. One line to
 * reverse in `restamp` if that case ever becomes real.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { verifyBcc } from "@lararium/tw5";

const REPO = path.resolve(new URL("../../..", import.meta.url).pathname);
const BIN = path.join(REPO, "packages/lares-cli/dist/src/bin/lares.js");
/** A real carrier, so the fixture carries every mark the door reads rather than a hand-built stub. */
const SOURCE = path.join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/prism.mem");

/** `lares meme normalize <file>` writes; `lares meme check <file>` reads alone — the same law, two seats. */
function meme(sub: "normalize" | "check", file: string): { out: string; code: number } {
  try {
    return { out: execFileSync("node", [BIN, "meme", sub, file], { encoding: "utf8" }), code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { out: err.stdout ?? "", code: err.status ?? 1 };
  }
}

describe("meme normalize — the check follows the body", () => {
  let dir: string, file: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "lares-normalize-"));
    file = path.join(dir, "prism.mem");
    copyFileSync(SOURCE, file);
    // Move a byte inside the checked span. The carrier stays well-formed and every other law holds —
    // the check alone disagrees with what it covers, which is the one fault this door owes a repair.
    writeFileSync(file, readFileSync(file, "utf8").replace("The node summons it.", "The node summons it, once."));
  });

  test("a staled check reads as drift, and --check fails the gate", () => {
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("mismatch");
    const { out, code } = meme("check", file);
    expect(out).toMatch(/would re-stamp/);
    expect(code).toBe(1);
    // --check writes NOTHING: the carrier it reported on is the carrier still on disk.
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("mismatch");
  });

  test("normalize leaves the check matching the body it follows", () => {
    meme("normalize", file);
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("ok");
  });

  test("a normalized carrier reads canonical, and the gesture repeats clean", () => {
    const { out, code } = meme("check", file);
    expect(out).toMatch(/canonical/);
    expect(code).toBe(0);
  });

  test("★ RED: a FRAMED carrier holding NO check gets one MINTED — minting on absent reads pono ★", () => {
    // The operator ruling. Read-optional, emit-always: `block-check.ts` rules the BCC optional on READ
    // and the deserializer mints one unconditionally on EMIT, so a hand-authored carrier lands legal on
    // every gate its author runs and red on the one they do not. Of the 701 carriers the corpus gate
    // walks, zero legitimately want to stand unchecked.
    const bare = path.join(dir, "unstamped.mem");
    writeFileSync(bare, readFileSync(SOURCE, "utf8").replace(/ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, ""));
    expect(verifyBcc(readFileSync(bare, "utf8")), "the fixture never lost its trailer").toBe("unchecked");

    meme("normalize", bare);
    expect(verifyBcc(readFileSync(bare, "utf8"))).toBe("ok");
  });

  test("the minted check stands ADJACENT to the ETX sigil, and nowhere else in the body", () => {
    // `verifyBcc` demands EXACT adjacency: a shifted check reads as postamble content and verifies as
    // nothing. And ANCHORED AT THE SPAN, never a whole-file replace — `ni:///…` reads as prose in a
    // carrier that discusses checks, and a global swap would rewrite the lesson along with the stamp.
    const bare = path.join(dir, "adjacent.mem");
    const stripped = readFileSync(SOURCE, "utf8").replace(/ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, "");
    const proseCount = (stripped.match(/ni:\/\/\//g) ?? []).length;
    writeFileSync(bare, stripped);
    meme("normalize", bare);
    const after = readFileSync(bare, "utf8");
    expect(after).toMatch(/code="&#x0003;"[^>]*>>ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/);
    // Exactly ONE mark appeared: the stamp. Every `ni:///` the body discussed stands untouched.
    expect((after.match(/ni:\/\/\//g) ?? []).length).toBe(proseCount + 1);
  });

  test("★ CONTROL: a TORN carrier gets NO stamp — a digest over an unbounded span attests to nothing ★", () => {
    // A torn frame opens STX and never closes, so a check over it would cover bytes the grammar never
    // bounded — the check-over-the-wrong-span defect this house has measured, where a hash over nothing
    // matched its own recomputation and carriers read `ok` at every gate with kilobytes outside the
    // verdict. Torn wants the frame CLOSED FIRST, never a stamp.
    const torn = path.join(dir, "torn.mem");
    writeFileSync(torn, readFileSync(SOURCE, "utf8")
      .replace(/ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, "")
      .replace(/<<\^\s*code="&#x0003;"[^>]*>>/, ""));
    expect(verifyBcc(readFileSync(torn, "utf8")), "the fixture never tore").toBe("torn");

    const { out } = meme("normalize", torn);
    // NOTHING MINTED, and the door SAYS SO — silence here is how a torn carrier passed the pre-commit
    // gate: `meme check` read "canonical" while `--gradient` read "the frame opens and never closes".
    expect(verifyBcc(readFileSync(torn, "utf8"))).toBe("torn");
    expect(out).toMatch(/torn/i);
  });

  test("CONTROL: an UNFRAMED file gets no check — no span stands, so nothing is stampable", () => {
    // True under both the old law and the new, and for a reason unrelated to minting: with no STX/ETX
    // there is no span for a check to cover, so `checkSpan` answers null and the door has nothing to
    // attest to. This is the case the corpus's six `<bag>/meta.mem` bag descriptors stand in.
    const bare = path.join(dir, "bare.mem");
    writeFileSync(bare, "plain text, no frame, no check\n");
    meme("normalize", bare);
    expect(readFileSync(bare, "utf8")).not.toMatch(/ni:\/\/\//);
  });

  test("★ CORPUS: the six unstamped bag descriptors stay untouched — a door that stamped manifests would regress ★", () => {
    // Measured: 701 `.mem` stand under `bags/`, all tracked; SIX carry no `ni:///` trailer, and all six
    // are `<bag>/meta.mem` bag descriptors declaring no `uri-path`, no STX and no ETX. Unframed by
    // construction, so the new law reaches none of them.
    const descriptors = ["sdm", "crossroads", "elyncia", "lares", "elyncia-referee", "lararium"]
      .map((bag) => path.join(REPO, "bags", bag, "meta.mem"));
    for (const src of descriptors) {
      const copy = path.join(dir, `meta-${path.basename(path.dirname(src))}.mem`);
      copyFileSync(src, copy);
      const before = readFileSync(copy, "utf8");
      expect(verifyBcc(before), `${src} carries a frame`).toBe("unchecked");
      meme("normalize", copy);
      expect(readFileSync(copy, "utf8"), `${src} was stamped`).toBe(before);
    }
    // SIX binary spawns; the default 5s budget is the parallel suite's, not this law's.
  }, 30_000);
});
