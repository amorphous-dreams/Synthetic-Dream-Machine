/**
 * A refusal note never quotes a credential. `openTreeKey` names a credential that reached no pin; a caller prints or
 * logs that note, so it carries no word of a paper sheet and no character of a passphrase.
 *   N1  a malformed paper sheet: the note names the fault and quotes none of the sheet's words.
 *   control: the note exists (a silent reader proves nothing), and the right passphrase still opens.
 */
import { describe, expect, test } from "vitest";
import { bindSlot, mintTreeKey, openTreeKey } from "../src/index.js";
import { nativeKdf } from "../src/node.js";

describe("an unlock note quotes no credential", () => {
  test("N1 — a malformed paper sheet leaves a note with none of its words", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase: "notes-test-passphrase" }] }, nativeKdf);
    const sheets = ["zebra-not-a-real-word quixotic-secret-fragment plinth", "another-mistyped-sheet-word"];
    const miss = await openTreeKey(tree, [{ kind: "paper", sheets }], nativeKdf);
    expect(miss.reading).toBe("no-slot-opens");
    const notes = miss.reading === "no-slot-opens" ? miss.notes.join("\n") : "";
    expect(notes).toMatch(/a paper credential reads no secret/);
    for (const word of sheets.join(" ").split(/\s+/)) expect(notes, `the note quotes "${word}"`).not.toContain(word);
    expect((await openTreeKey(tree, [{ kind: "passphrase", passphrase: "notes-test-passphrase" }], nativeKdf)).reading).toBe("opens");
  }, 120_000);
});
