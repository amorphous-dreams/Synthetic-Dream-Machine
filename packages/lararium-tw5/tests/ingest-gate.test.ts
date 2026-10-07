/**
 * ingest-gate — vectors for the three-way decision (Confluence triangle), driven
 * by the live boot meme: real carrier, real shore, no vessel.
 *
 * The five branches under proof:
 *   noop/disk-matches-synced · refuse · noop/canonical-equivalent ·
 *   ingest (clean + fresh-adoption) · conflict (both moved, surfaced).
 * Plus the gofmt-loop guard composed: a non-canonical edit converges in
 * ONE cycle (ingest → project → re-ingest reads noop).
 */

import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideIngest } from "../src/ingest-gate.js";
import { memeticWikitextDeserializer, expandMemeRefs } from "../src/deserializer.js";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;
const BOOT = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
const URI  = "lar:///ha.ka.ba/lares/api/noosphere-boot";

const sha = (s: string) => `sha256:${createHash("sha256").update(s, "utf8").digest("hex")}`;

/** Canonical render of arbitrary carrier text through the shore. */
function renderOf(text: string, uri: string): string {
  const records = memeticWikitextDeserializer(text, { title: uri });
  const map = new Map(records.map((r) => [String(r.title), r] as const));
  return expandMemeRefs((t) => map.get(t), uri) ?? "";
}

const source = readFileSync(BOOT, "utf8");          // corpus-canonical (the slate)
const canonical = renderOf(source, URI);

describe("ingest-gate — the Confluence triangle decides", () => {
  test("disk == synced → noop (the echo gate)", () => {
    const d = decideIngest({
      uri: URI, diskText: source, diskHash: sha(source),
      syncedHash: sha(source), currentRenderHash: sha(canonical), hash: sha,
    });
    expect(d).toEqual({ kind: "noop", reason: "disk-matches-synced" });
  });

  test("framing-only edit → noop canonical-equivalent (gofmt-loop guard)", () => {
    // un-sort one meta line pair: swap two lines — parses to the same records
    const reframed = source.replace(
      'cacheable = true\nl-space   = "stable"',
      'l-space   = "stable"\ncacheable = true',
    );
    expect(reframed).not.toBe(source);
    const d = decideIngest({
      uri: URI, diskText: reframed, diskHash: sha(reframed),
      syncedHash: sha(source), currentRenderHash: sha(canonical), hash: sha,
    });
    expect(d).toEqual({ kind: "noop", reason: "canonical-equivalent" });
  });

  test("clean content edit, records unmoved → ingest", () => {
    const edited = source.replace("! Entry ~ Lararium Hearth", "! Entry ~ Lararium Hearth (edited)");
    expect(edited).not.toBe(source); // guard: heading drift must fail loud, not collapse to noop
    const d = decideIngest({
      uri: URI, diskText: edited, diskHash: sha(edited),
      syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
    });
    expect(d.kind).toBe("ingest");
    if (d.kind === "ingest") {
      expect(d.canonicalText).toContain("(edited)");
      // one-cycle convergence: re-ingesting the projected canonical reads noop
      const second = decideIngest({
        uri: URI, diskText: d.canonicalText, diskHash: sha(d.canonicalText),
        syncedHash: sha(d.canonicalText), currentRenderHash: sha(d.canonicalText), hash: sha,
      });
      expect(second).toEqual({ kind: "noop", reason: "disk-matches-synced" });
    }
  });

  test("never-projected carrier → fresh adoption ingest", () => {
    const d = decideIngest({
      uri: URI, diskText: source, diskHash: sha(source),
      syncedHash: null, currentRenderHash: sha("(unrelated records)"), hash: sha,
    });
    expect(d.kind).toBe("ingest");
  });

  test("both moved → conflict, surfaced never overwritten", () => {
    const diskEdit = source.replace("! Entry ~ Lararium Hearth", "! Entry (disk hand)");
    const recordsMovedRender = canonical.replace("! Entry ~ Lararium Hearth", "! Entry (record hand)");
    expect(diskEdit).not.toBe(source);
    expect(recordsMovedRender).not.toBe(canonical);
    const d = decideIngest({
      uri: URI, diskText: diskEdit, diskHash: sha(diskEdit),
      syncedHash: sha(canonical), currentRenderHash: sha(recordsMovedRender), hash: sha,
    });
    expect(d.kind).toBe("conflict");
  });

  test("unparseable carrier → refuse, loudly", () => {
    // a closer swallowed by a TRULY unclosed fence (opened at the tail,
    // nothing after it to close on) — the doubling hazard
    const broken = source.replace("\n<<^ code=\"&#x0003;\">>", "\n```text\n<<^ code=\"&#x0003;\">>");
    expect(broken).not.toBe(source);
    const d = decideIngest({
      uri: URI, diskText: broken, diskHash: sha(broken),
      syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
    });
    expect(d.kind).toBe("refuse");
    if (d.kind === "refuse") expect(d.warnings.join(" ")).toMatch(/fence|UNCLOSED/i);
  });

  /**
   * ONE ROW PER DIAGNOSTIC PRODUCER the ingest law (a) fix touches or sits beside — pinned so a
   * future pass over `memeticIngestOps.deserialize`'s diagnostics channel cannot silently re-widen
   * `block-check-mismatch` back to a refuse, or narrow `block-check-torn`/`frame-malformed` by
   * accident while doing it. A stale BLOCK CHECK on a hand-edited disk carrier is an EDIT, never
   * tampering (#/the-touchstone) — the gate must still reach a real decision over it. A TORN frame
   * and a SECOND live ETX are different in kind: neither names an honest edit, so both still refuse.
   */
  describe("the gate's grade, per diagnostic producer", () => {
    test("a stale block check (mismatch) warns, never refuses — the body is unchanged, so it's framing-only", () => {
      // Re-stamp the disk text with a check that no longer covers the (unedited) span below it —
      // the exact shape `stampCarrier` repairs and `tools/meme-check-staged.sh` still refuses staged.
      // The BCC slot sits OUTSIDE the STX..ETX span it checks, so the render through the shore comes
      // back canonically identical — a stale check alone is the purest framing-only edit there is.
      const staleChecked = source.replace(
        /ni:\/\/\/sha-256;[A-Za-z0-9_-]+(?=\n)/,
        "ni:///sha-256;0000000000000000000000000000000000000000000",
      );
      expect(staleChecked).not.toBe(source);
      const d = decideIngest({
        uri: URI, diskText: staleChecked, diskHash: sha(staleChecked),
        syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
      });
      // BEFORE this fix, `block-check-mismatch` graded `error` and this read `refuse` — the exact
      // honest-edit-reads-as-tampering bug ingest law (a) rules against. Now it grades a WARNING
      // (still surfaced) and the gate reaches its real verdict: canonical-equivalent, never a refuse.
      expect(d.kind).toBe("noop");
      if (d.kind === "noop") expect(d.reason).toBe("canonical-equivalent");
    });

    test("a stale block check still warns when it DOES carry a real content edit — ingest, not refuse", () => {
      const staleAndEdited = source
        .replace("! Entry ~ Lararium Hearth", "! Entry ~ Lararium Hearth (edited)")
        .replace(/ni:\/\/\/sha-256;[A-Za-z0-9_-]+(?=\n)/, "ni:///sha-256;0000000000000000000000000000000000000000000");
      expect(staleAndEdited).not.toBe(source);
      const d = decideIngest({
        uri: URI, diskText: staleAndEdited, diskHash: sha(staleAndEdited),
        syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
      });
      expect(d.kind).toBe("ingest");
      if (d.kind === "ingest") {
        expect(d.canonicalText).toContain("(edited)");
        expect(d.diagnostics.some((x) => x.code === "block-check-mismatch" && x.severity === "warning")).toBe(true);
      }
    });

    test("a TORN frame (STX, no ETX) still refuses — never an honest edit", () => {
      const torn = source.slice(0, source.indexOf("<<^ code=\"&#x0003;\">>"));
      expect(torn).not.toBe(source);
      const d = decideIngest({
        uri: URI, diskText: torn, diskHash: sha(torn),
        syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
      });
      expect(d.kind).toBe("refuse");
      if (d.kind === "refuse") expect(d.diagnostics.some((x) => x.code === "block-check-torn" && x.severity === "error")).toBe(true);
    });

    test("a SECOND live ETX (frame-malformed) still refuses — unchanged by the mismatch fix", () => {
      const doubled = source.replace(
        "<<^ code=\"&#x0003;\">>",
        "<<^ code=\"&#x0003;\">>\n\nstray trailing body\n\n<<^ code=\"&#x0003;\">>",
      );
      expect(doubled).not.toBe(source);
      const d = decideIngest({
        uri: URI, diskText: doubled, diskHash: sha(doubled),
        syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
      });
      expect(d.kind).toBe("refuse");
      if (d.kind === "refuse") expect(d.diagnostics.some((x) => x.code === "frame-malformed" && x.severity === "error")).toBe(true);
    });

    test("a literal ETB mark (torn-spelling) still refuses — the weld to the frame fault kind", () => {
      const withEtb = source.replace(
        '<<^ code="&#x0004;" -> to="?">>',
        '<<^ code="&#x0017;">>\n<<^ code="&#x0004;" -> to="?">>',
      );
      expect(withEtb).not.toBe(source);
      const d = decideIngest({
        uri: URI, diskText: withEtb, diskHash: sha(withEtb),
        syncedHash: sha(canonical), currentRenderHash: sha(canonical), hash: sha,
      });
      expect(d.kind).toBe("refuse");
      if (d.kind === "refuse") expect(d.diagnostics.some((x) => x.code === "torn-spelling" && x.severity === "error")).toBe(true);
    });
  });
});
