/**
 * ZERO CHURN, WHOLE CORPUS — the check moves into the ETX mark's `bcc` slot and its value never changes.
 *
 * Every carrier's stated check, read wherever it stands (the retired trailer after ETX's `>>`, or the
 * slot), must verify under the slot law once it rides the slot: the digest reads the span with the
 * ` bcc=`…`` run deleted, which is byte for byte the span the trailer covered. One carrier proved it
 * by hand; this proves all of them.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verdict } from "@lararium/memetic-frame";
import { readCarrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

const TRAILER = /^<<\^ code=`&#x0003;`>>(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)$/m;
const SLOT = /^<<\^ code=`&#x0003;` bcc=`(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)`>>$/m;

describe("★ every sealed carrier verifies in the slot, value unchanged ★", () => {
  const sealedCarriers = readCarrierFiles(REPO)
    .map((c) => ({ path: c.path, text: readFileSync(join(REPO, c.path), "utf8") }))
    .filter((c) => TRAILER.test(c.text) || SLOT.test(c.text));

  test("the corpus holds sealed carriers (no silent zero)", () => {
    expect(sealedCarriers.length).toBeGreaterThan(700);
  });

  test("each stated check, moved into the slot unchanged, reads match with that same value", () => {
    const broken: string[] = [];
    for (const { path, text } of sealedCarriers) {
      const old = TRAILER.exec(text);
      const value = (old ?? SLOT.exec(text))![1]!;
      const slotted = old ? text.replace(old[0], `<<^ code=\`&#x0003;\` bcc=\`${value}\`>>`) : text;
      const v = verdict(slotted);
      if (!(v.kind === "match" && v.check === value)) broken.push(`${path}: ${v.kind}`);
    }
    expect(broken).toEqual([]);
  }, 60_000);
});
