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
 * the frame package rules the BCC optional on READ while the deserializer mints one unconditionally on
 * EMIT, so a hand-authored carrier lands legal on every gate its author runs and red on the one they do
 * not — which is how a torn-then-unchecked carrier reached `main`. Of the 701 carriers under `bags/`,
 * zero legitimately want to stand unchecked: the option reads real in the grammar and unexercised in
 * the corpus.
 *
 * TWO FRAME CONDITIONS RECEIVE NO STAMP, and each names a distinct condition:
 *   · TORN — the frame opens and never closes, so a digest would cover bytes the grammar never bounded.
 *     Torn wants the frame closed first, and the door says so rather than passing in silence.
 *   · ABSENT — no bounded span stands, so no check has a body to attest. Each bag-declaring carrier
 *     carries a complete checked frame.
 *
 * ⚠ THE COST: this forecloses deliberately authoring an unchecked FRAMED carrier — the BSC
 * trusted-link case the frame package cites, where a block ran without a BCC by choice. One line to
 * reverse in `stampCarrier` if that case ever becomes real.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { verifyBcc, checkSpan, classifyPostamble } from "@lararium/memetic-frame";

const REPO = path.resolve(new URL("../../..", import.meta.url).pathname);
const BIN = path.join(REPO, "packages/lares-cli/dist/src/bin/lares.js");
/** A real carrier, so the fixture carries every mark the door reads rather than a hand-built stub. */
const SOURCE = path.join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/prism.mem");

/** `lares meme normalize <file>` writes; `lares meme check <file>` reads alone — the same law, two seats. */
function meme(sub: "normalize" | "check", file: string, extra: readonly string[] = []): { out: string; code: number } {
  // The CLI deliberately reports human diagnostics on either stream depending on the exit seat.
  // `execFileSync` only exposes stdout on success and its thrown shape hides stderr, which made a
  // real child-process refusal look like an empty report. Capture both streams while preserving
  // the command's actual exit status.
  const result = spawnSync("node", [BIN, "meme", sub, file, ...extra], { encoding: "utf8" });
  return {
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    code: result.status ?? 1,
  };
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

  test("★ a stale check names BOTH digests — the one standing and the one the body computes ★", () => {
    const { out } = meme("check", file);
    expect(out).toMatch(/stale: stored ni:\/\/\/sha-256;[A-Za-z0-9_-]{43} · computed ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}/);
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

  test("★ RED: content after the terminating 0004 refuses the boundary ★", () => {
    // OWN FIXTURE, not the corpus — this used to mutate `kapu.mem`, trading on the one carrier that
    // (at the time) ended on an authored EOT2 close standing alone. Operator ruling 2a623c1a2
    // (2026-10-04) closed `kapu.mem` on a plain EOT like every other carrier, so that carrier no
    // longer holds the `&#x0014;` line this test's `.replace` needed to find — the substitution
    // silently no-op'd and the "stray" file read as an unmodified, canonical copy.
    //
    // Built from SOURCE (`prism.mem`) instead: a real ETX check and EOT stand, then a second
    // terminator follows. `verifyBcc` sees the adjacent digest and used to call the whole source
    // canonical while the parser discarded the post-EOT bytes.
    const stray = path.join(dir, "post-eot.mem");
    const source = readFileSync(SOURCE, "utf8");
    if (checkSpan(source) === null) throw new Error("fixture must carry a complete frame");
    writeFileSync(stray, `${source.trimEnd()}\n<<^ code="&#x0014;" -> to="?">>\n`);
    const before = readFileSync(stray, "utf8");
    const { out, code } = meme("check", stray);
    expect(out).toMatch(/postamble|boundary|after.*0004|terminat/i);
    expect(code).toBe(1);
    expect(readFileSync(stray, "utf8")).toBe(before);
  });

  test("★ RED: a FRAMED carrier holding NO check gets one MINTED — minting on absent reads pono ★", () => {
    // The operator ruling. Read-optional, emit-always: the frame package rules the BCC optional on READ
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

  test("CONTROL: a source without a complete frame gets no check — no span stands, so nothing is stampable", () => {
    // With no STX/ETX there is no span for a check to cover, so `checkSpan` answers null and the door has nothing to
    // attest to. A bag-declaring carrier does carry a span; this input arrives without one.
    const bare = path.join(dir, "bare.mem");
    writeFileSync(bare, "plain text, no frame, no check\n");
    meme("normalize", bare);
    expect(readFileSync(bare, "utf8")).not.toMatch(/ni:\/\/\//);
  });

  test("★ CORPUS: the six bag-declaring carriers stand fully framed, sealed, and canonical ★", () => {
    // A bag-declaring carrier has no `uri-path`, and its self-description remains authored content. Its STX–ETX
    // body and BCC make that content independently inspectable and preserve a single carrier law.
    const bagCarriers = ["sdm", "crossroads", "elyncia", "lares", "elyncia-referee", "lararium"]
      .map((bag) => path.join(REPO, "bags", bag, "meta.mem"));
    for (const src of bagCarriers) {
      const copy = path.join(dir, `meta-${path.basename(path.dirname(src))}.mem`);
      copyFileSync(src, copy);
      const before = readFileSync(copy, "utf8");
      expect(verifyBcc(before), `${src} must carry a checked bag-declaring body`).toBe("ok");
      meme("normalize", copy);
      expect(readFileSync(copy, "utf8"), `${src} drifted under normalization`).toBe(before);
    }
    // SIX binary spawns; the default 5s budget is the parallel suite's, not this law's.
  }, 30_000);
});

/**
 * `stampCarrier`'s mint branch — a SHIFTED check must be REPLACED, never left beside a fresh mint.
 *
 * `verifyBcc` demands byte-exact adjacency (the frame package's check.ts) — a check standing even one
 * space after the frame's close reads `unchecked`, the same verdict a carrier with NO check at all
 * reads. `stampCarrier`'s mint branch used to treat both alikes: glue the fresh `ni:///…` to the frame's
 * close and leave whatever already stood there untouched. For the truly-absent case that is correct.
 * For a SHIFTED check it duplicates: the carrier ends up wearing two checks, `ni:///…NEW ni:///…OLD`,
 * and every reader downstream of the frame now meets TWO `ni:///` occurrences where the grammar
 * promises one.
 *
 * `classifyPostamble` (the frame package) already answers the distinction the mint branch was missing: it
 * tolerates the whitespace `verifyBcc` refuses, so a shifted-but-otherwise-well-formed check reads
 * `{ kind: "bcc" }` to it while `verifyBcc` still reads `unchecked`. That gap between the two readers
 * IS the signal — `stampCarrier` reads it and REPLACES rather than inserts.
 */
describe("meme normalize — a SHIFTED check is REPLACED, never duplicated", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "lares-restamp-dup-"));
  });

  test("★ RED: a check standing ONE SPACE after the frame gets REPLACED, not duplicated ★", () => {
    const file = path.join(dir, "shifted.mem");
    const source = readFileSync(SOURCE, "utf8");
    const span = checkSpan(source);
    if (!span) throw new Error("fixture must carry a complete frame");
    // Insert one space between the frame's close and the standing check — the check itself is
    // untouched, only its adjacency to ETX is broken.
    const shifted = source.slice(0, span.end) + " " + source.slice(span.end);
    writeFileSync(file, shifted);
    expect(verifyBcc(shifted), "the shift must read unchecked, not ok — that is the whole bug surface").toBe("unchecked");
    expect(classifyPostamble(shifted.slice(span.end)).kind, "the shifted check must still classify as a standing bcc").toBe("bcc");

    meme("normalize", file);
    const after = readFileSync(file, "utf8");

    // (a) exactly ONE ni:/// stands after the frame — no second, stranded check.
    const afterSpan = checkSpan(after);
    if (!afterSpan) throw new Error("normalize must not tear the frame");
    const postamble = after.slice(afterSpan.end);
    const niCount = (postamble.match(/ni:\/\/\//g) ?? []).length;
    expect(niCount, `postamble after normalize: ${JSON.stringify(postamble.slice(0, 200))}`).toBe(1);

    // (b) classifyPostamble on the text after the frame reads a single bcc, and it is the FRESH digest —
    // not a foreign/duplicated slot, which is the second face of this defect: `meme check` calls a
    // duplicated slot foreign, so a carrier `normalize` just "fixed" fails its own canonical check.
    const post = classifyPostamble(postamble);
    expect(post.kind, `postamble classified ${JSON.stringify(post)} — a duplicated slot reads foreign`).toBe("bcc");
    expect(verifyBcc(after)).toBe("ok");
  });

  test("★ CONTROL: a check ALREADY glued adjacent re-stamps to a single check, before and after the fix ★", () => {
    const file = path.join(dir, "adjacent-control.mem");
    copyFileSync(SOURCE, file);
    expect(verifyBcc(readFileSync(file, "utf8")), "the control fixture must start canonical").toBe("ok");

    meme("normalize", file);
    const after = readFileSync(file, "utf8");
    const span = checkSpan(after);
    if (!span) throw new Error("fixture must carry a complete frame");
    const niCount = (after.slice(span.end).match(/ni:\/\/\//g) ?? []).length;
    expect(niCount).toBe(1);
    expect(verifyBcc(after)).toBe("ok");
  });

  test("★ RED: a SHIFTED check followed by MORE real content after EOT refuses the boundary ★", () => {
    // A shifted check is recoverable while the carrier still has one bounded ETX…EOT transmission.
    // Once content follows EOT, however, the source has escaped its canonical boundary. Preserve it
    // byte-for-byte and hand the separation back to an operator rather than re-stamping through it.
    const file = path.join(dir, "shifted-with-tail.mem");
    const source = readFileSync(SOURCE, "utf8");
    const span = checkSpan(source);
    if (!span) throw new Error("fixture must carry a complete frame");
    // Shift the check by one space AND append real trailing content after EOT.
    const shifted = source.slice(0, span.end) + " " + source.slice(span.end) + "\n<<~ loulou \"lar:///ha.ka.ba/lares/api/pono\">>\n";
    writeFileSync(file, shifted);
    expect(verifyBcc(shifted)).toBe("unchecked");
    expect(classifyPostamble(shifted.slice(span.end)).kind, "the whole tail must read foreign — that is the case this test guards").toBe("foreign");

    const before = readFileSync(file, "utf8");
    const { out, code } = meme("normalize", file);
    expect(code).toBe(1);
    expect(out).toMatch(/content follows the terminating EOT|boundary/i);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

/**
 * FRAME drift vs GRAMMAR drift — the operator's finding.
 *
 * `normalize` used to hold two authorities in one verb: FRAME (the envelope the house mints and
 * owns — DOCTYPE address, sigil spellings, child-slot roots, the block check) and GRAMMAR
 * (authored bytes — a call site's `:` vs `=` separator). A FRAME mismatch has exactly one right
 * answer, and the house may fix it unasked. A GRAMMAR mismatch is a PREFERENCE — both spellings
 * build the identical attribute (measured against the TiddlyWiki fork and pinned 5.4.1: only the
 * recorded `assignmentOperator` differs) — so rewriting it changes no reading and must never apply
 * unasked. `normalize` silently took both, which is how a hand-authored `<<~ kue key:"…">>` call
 * site in a grammar-demonstration fixture came out spelled `key="…"` nobody asked for.
 *
 * `--grammar` is the escape hatch: name it and the grammar clauses apply too, exactly as normalize
 * always behaved before this split.
 */
describe("meme normalize/check — FRAME drift and GRAMMAR drift read as two authorities", () => {
  let dir: string;

  /** A real carrier (so every FRAME mark reads), staled at a body byte (FRAME drift: the block
   *  check goes stale) and carrying a freshly-injected colon call site (GRAMMAR drift). */
  function bothDrifts(): string {
    const source = readFileSync(SOURCE, "utf8");
    const staled = source.replace("The node summons it.", "The node summons it, once.");
    return staled.replace(
      "<<~/ahu>>\n\n<<~ ahu #/operation>>",
      '<<~/ahu>>\n\n<<~ kue voice:Mischief-Muse key:"a value carrying spaces" held:[[a bracketed value]]>>\n\n<<~ ahu #/operation>>',
    );
  }

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "lares-drift-class-"));
  });

  test("★ RED: normalize re-stamps the FRAME check and leaves the GRAMMAR call site BYTE-IDENTICAL ★", () => {
    const file = path.join(dir, "both-drift.mem");
    const src = bothDrifts();
    writeFileSync(file, src);
    expect(verifyBcc(src), "the fixture's block check must stale").toBe("mismatch");
    expect(src).toContain('voice:Mischief-Muse key:"a value carrying spaces" held:[[a bracketed value]]');

    const { out } = meme("normalize", file);
    const after = readFileSync(file, "utf8");

    // FRAME: the check now matches the (still-colon) body it follows.
    expect(verifyBcc(after)).toBe("ok");
    // GRAMMAR: the colon call site moved NO byte.
    expect(after).toContain('voice:Mischief-Muse key:"a value carrying spaces" held:[[a bracketed value]]');
    expect(after).not.toContain('voice="Mischief-Muse"');
    // AND normalize NAMES the site it declined to touch.
    expect(out).toMatch(/would take the equals sign/);
    expect(out).toMatch(/rerun with --grammar/);
  });

  test("★ RED: check on GRAMMAR-only drift exits ZERO and names the preference — never fails the gate ★", () => {
    const file = path.join(dir, "grammar-only.mem");
    const source = readFileSync(SOURCE, "utf8");
    const src = source.replace(
      "<<~/ahu>>\n\n<<~ ahu #/operation>>",
      '<<~/ahu>>\n\n<<~ kue key:"a value carrying spaces">>\n\n<<~ ahu #/operation>>',
    );
    writeFileSync(file, src);
    expect(verifyBcc(src), "the fixture must start with a MATCHING check — the only drift here is grammar").toBe("mismatch");
    // Re-stamp it first so the ONLY remaining drift is the colon call site.
    meme("normalize", file);
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("ok");
    expect(readFileSync(file, "utf8")).toContain('key:"a value carrying spaces"');

    const { out, code } = meme("check", file);
    expect(code).toBe(0);
    expect(out).toMatch(/would take the equals sign/);
  });

  test("★ CONTROL: check on FRAME-only drift (a stale block check) still exits non-zero ★", () => {
    const file = path.join(dir, "frame-only.mem");
    const source = readFileSync(SOURCE, "utf8");
    writeFileSync(file, source.replace("The node summons it.", "The node summons it, once."));
    expect(verifyBcc(readFileSync(file, "utf8"))).toBe("mismatch");

    const { out, code } = meme("check", file);
    expect(code).toBe(1);
    expect(out).toMatch(/would re-stamp/);
  });

  test("★ CONTROL: normalize --grammar applies BOTH, exactly as normalize always did before the split ★", () => {
    const file = path.join(dir, "both-drift-grammar-flag.mem");
    writeFileSync(file, bothDrifts());

    meme("normalize", file, ["--grammar"]);
    const after = readFileSync(file, "utf8");
    expect(verifyBcc(after)).toBe("ok");
    // `voice:Mischief-Muse` carries an UNQUOTED value, which the colon-param law never touches
    // (it fires only ahead of a quoted or bracketed value) — so it stays colon-spelled under
    // EITHER reading, and only the quoted/bracketed sites move.
    expect(after).toContain('voice:Mischief-Muse key="a value carrying spaces" held=[[a bracketed value]]');
    expect(after).not.toContain('key:"a value carrying spaces"');
    expect(after).not.toContain("held:[[a bracketed value]]");
  });
});

describe("★ bare data — no frame at all — reads as bare data, never as a broken meme ★", () => {
  test("check names it bare and UNSTABLE, and normalize frames nothing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lares-bare-"));
    const file = path.join(dir, "found.mem");
    const bytes = "bare data found on the internet\n\n```toml meta\nk = 1\n```\n";
    writeFileSync(file, bytes);
    const { out, code } = meme("check", file);
    expect(out).toMatch(/bare: /);
    expect(out).toMatch(/UNSTABLE/);
    expect(code).toBe(0);
    meme("normalize", file);
    expect(readFileSync(file, "utf8")).toBe(bytes);
  });
});
