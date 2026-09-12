/**
 * A CEREMONY MUST NOT CLAIM A VARIANT IT CANNOT KNOW.
 *
 * A keyhive cap-event carries a `variant` from a real vocabulary — PREKEY_ROTATED · CGKA_OPERATION ·
 * DELEGATED · REVOKED — minted beside the event by the provider's own handler. The FOUNDING path carries
 * that value through. The ADMIT path cannot: `eventsForPeer` returns bare `Uint8Array[]`, discarding the
 * variant at the boundary, so by the time the bytes reach the daemon doc the true value is GONE.
 *
 * It used to stamp `"cap-membership"` there — a string outside the vocabulary entirely, over a bundle that
 * is provably heterogeneous (a crossing carries DELEGATED re-grants AND the CGKA/PCS ops together). Nothing
 * branches on the value today, so nothing broke; but the record asserted something false, and the only test
 * pinning variant values reads the FOUNDER's vessel alone, so the admit path's claim was never checked
 * against the vocabulary it violated.
 *
 * The honest reading is "unknown", said in a word that can never be mistaken for a real variant.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAP_EVENT_VARIANT_UNKNOWN } from "../src/daemon-event-store.js";

/** The vocabulary the provider actually mints, and the sub-tag switch actually reads. */
const REAL_VARIANTS = ["PREKEY_ROTATED", "CGKA_OPERATION", "DELEGATED", "REVOKED"] as const;
const SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

describe("the cap-event variant a ceremony writes", () => {
  test("★ the unknown sentinel stands OUTSIDE the real vocabulary — it can never be read as a variant ★", () => {
    // A missing export reads `undefined`, and `not.toContain(undefined)` passes for the wrong reason —
    // so demand a real, non-empty string BEFORE asserting it stands outside the vocabulary.
    expect(typeof CAP_EVENT_VARIANT_UNKNOWN).toBe("string");
    expect(CAP_EVENT_VARIANT_UNKNOWN.length).toBeGreaterThan(0);
    expect(REAL_VARIANTS).not.toContain(CAP_EVENT_VARIANT_UNKNOWN);
    // CONTROL: the vocabulary itself is non-empty and distinct, so the assertion above is not vacuous.
    expect(new Set(REAL_VARIANTS).size).toBe(REAL_VARIANTS.length);
  });

  test("★ no ceremony writer invents a domain-looking variant ★", () => {
    // `cap-membership` READ like a variant and was not one. A fabricated value that resembles the
    // vocabulary is worse than an obvious sentinel: it survives review by looking plausible.
    for (const f of ["ceremony-core.ts", "operator-daemon-behavior.ts"]) {
      expect(SRC(f), `${f} still invents a variant`).not.toContain('"cap-membership"');
    }
  });

  test("CONTROL — the writers still stamp SOME variant (the field is a presence gate the store reads back)", () => {
    for (const f of ["ceremony-core.ts", "operator-daemon-behavior.ts"]) {
      expect(SRC(f), `${f} writes no variant at all`).toMatch(/variant:/);
    }
  });
});
