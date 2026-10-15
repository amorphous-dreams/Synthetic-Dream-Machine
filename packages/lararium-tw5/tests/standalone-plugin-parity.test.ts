/**
 * standalone-plugin-parity — the local-first freshness gate for the tracked `$:/` distribution.
 *
 * `plugin-artifact-parity.test.ts` proves the lar:// canonical artifact (`src/plugin-tiddler.generated.ts`
 * ≡ `plugins/lares-memetic-wikitext.json`) stays fresh. This is its sibling for the OTHER committed
 * artifact: `plugins/standalone/lares-memetic-wikitext.tid` — the stock-TW5 drag-and-drop distribution
 * (operator ruling, 2026-10-04: that copy IS a first-class distribution, not a build intermediate, so
 * it moved out of the gitignored dist-plugin/ into a tracked home).
 *
 * The two variants share every packed inner tiddler; `build-plugin-tiddler.ts` swaps `title`, drops
 * `lares-canonical-title` (the lar:// tiddler's self-identification — a different relation on this
 * variant), and adds `lares-projection-of` naming the lar:// canonical title. This test re-derives
 * the `$:/` variant's expected fields from the committed `.ts` (never re-runs the TW5 CLI pack step —
 * that's CI's rebuild+diff currency job) and
 * checks the committed `.tid` and its attestation agree with that derivation. A drift here means one
 * of the two committed artifacts was regenerated — or hand-edited — without its sibling.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/meme-normalize  (sibling: build-attestation)
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256HexSync } from "@lararium/mesh";
import { LARES_MEMETIC_WIKITEXT_PLUGIN } from "../src/plugin-tiddler.generated.js";
import { parseTidFile } from "../plugin-build/tid-file.js";

const TID_TITLE = "$:/plugins/lares/memetic-wikitext";

const tidPath = fileURLToPath(new URL("../plugins/standalone/lares-memetic-wikitext.tid", import.meta.url));
const attestationPath = fileURLToPath(new URL("../plugins/standalone/lares-memetic-wikitext.attestation.json", import.meta.url));

describe("standalone plugin parity — committed .tid ≡ generated .ts (title + compatibility field swapped)", () => {
  const lar = LARES_MEMETIC_WIKITEXT_PLUGIN as Record<string, unknown>;
  const parsed = parseTidFile(readFileSync(tidPath, "utf8"), tidPath);
  const attestation = JSON.parse(readFileSync(attestationPath, "utf8")) as Record<string, unknown>;

  // The expected `$:/` object — same derivation `build-plugin-tiddler.ts` runs.
  const expected: Record<string, unknown> = {
    ...lar,
    title: TID_TITLE,
    "lares-projection-of": lar["lares-canonical-title"],
  };
  delete expected["lares-canonical-title"];

  test("the .tid header carries every non-text field the derivation expects", () => {
    for (const [key, val] of Object.entries(expected)) {
      if (key === "text") continue;
      if (typeof val === "string" && val.includes("\n")) continue; // emitTid drops multi-line fields from the header too
      expect(parsed.fields[key], `field "${key}"`).toBe(String(val));
    }
  });

  test("the .tid header does NOT carry lares-canonical-title (replaced by lares-projection-of)", () => {
    expect(parsed.fields["lares-canonical-title"]).toBeUndefined();
  });

  test("the .tid body carries the same packed inner tiddlers as the lar:// canonical artifact", () => {
    expect(parsed.body).toBe(lar["text"] as string);
  });

  test("the attestation names this title as its compatibility title and self-digests correctly", () => {
    expect(attestation["compatibilityTitle"]).toBe(TID_TITLE);
    expect(attestation["pluginTw5Sha256"]).toMatch(/^[0-9a-f]{64}$/);
    const expectedJson = JSON.stringify(expected, null, 2);
    expect(attestation["pluginTw5Sha256"]).toBe(sha256HexSync(expectedJson));
  });
});
