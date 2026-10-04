/**
 * `source-sha256` HASHES WHAT THE GATE HASHES, and a patched anchor re-stamps its check.
 *
 * Two layers, both standing:
 *   (L1) a `ka` anchor's `source-sha256` is the SHA-256 of the module's CODE — exactly the deserialized
 *        record `text` the boot gate (`tw5-module-gate.ts`) verifies before it injects a module;
 *   (L2) the block check over STX..ETX covers the whole body, root meta INCLUDED — so the meta that
 *        holds L1 is itself covered by L2.
 *
 * No circularity, as long as a writer runs in order: hash the code → write the field → re-stamp the
 * check. Two faults broke that order: the digest hashed the module carrier's STX..ETX span (which now
 * carries that carrier's own meta and prose, so it never equals the gate's `text`), and the field patch
 * never re-stamped the anchor's check (so every patched anchor read `mismatch`).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-module
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { frameCarrier, verifyBcc } from "@lararium/memetic-frame";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { moduleBodyDigest, applySourceSha256Patch } from "../scripts/heleuma-digest.js";

const MODULE = "lar:///ha.ka.ba/lararium/tw5/modules/probe";
const CODE = 'exports.probe = function () { return "probe"; };';
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** A module carrier in the canonical shape: root meta opens the body, the code follows it. */
const moduleCarrier = frameCarrier({
  head: { uri: MODULE },
  body: '```toml meta\nmodule-type = "library"\ntype        = "application/javascript"\n```\n\n' + CODE,
});

/** The anchor whose meta carries the digest, framed and checked. */
const anchor = frameCarrier({
  head: { uri: "lar:///ha.ka.ba/lararium/tw5/probe-anchor" },
  body: `\`\`\`toml meta\nsource-sha256 = "sha256:stale"\nheleuma     = "ka"\nmodule-ref  = "${MODULE}"\n\`\`\`\n\nAnchor prose.`,
});

describe("★ source-sha256 is the gate's own hash ★", () => {
  test("the digest equals SHA-256 of the record text the gate verifies", () => {
    const gateText = String(memeticWikitextDeserializer(moduleCarrier, { title: MODULE }).find((r) => r.title === MODULE)?.text);
    expect(gateText).toBe(CODE);
    expect(moduleBodyDigest(moduleCarrier, MODULE)).toBe(`sha256:${sha(CODE)}`);
  });

  test("CONTROL — the STX..ETX span is NOT what the gate hashes (it carries the meta)", () => {
    expect(moduleBodyDigest(moduleCarrier, MODULE)).not.toBe(`sha256:${sha(moduleCarrier.slice(moduleCarrier.indexOf("&#x0002;")))}`);
  });
});

describe("★ a patched anchor re-stamps its check ★", () => {
  test("the field moves, and the check moves with it", () => {
    expect(verifyBcc(anchor)).toBe("ok");
    const patched = applySourceSha256Patch(anchor, sha(CODE));
    expect(patched).toContain(`source-sha256 = "sha256:${sha(CODE)}"`);
    expect(verifyBcc(patched)).toBe("ok");
  });
});
