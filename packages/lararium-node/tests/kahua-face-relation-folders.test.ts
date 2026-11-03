/**
 * kahua-face-relation-folders — the face's kahua folders take the opaque relation id F, never a tag derived from keys or group.
 *
 * Operator law (2026-11-02): no pet-names, no key-derived names that move, in dir structure. The wiki projects to
 * `<state>/wikis/kahua-<F>` and the stage to `<state>/bags/kahua-<F>`. The old derived tag burns with no back-compat: the
 * pre-`F` spelling refuses by name. The label index is a DISK view regenerated from the face records and never read to decide.
 *
 * Reds: the folders name F; a group change (rotation or recovery) leaves the folder where it stood; the old tag-shaped folder
 * refuses; `kahuaFaceTag` leaves the module. Controls: two faces' F never collide; a tag-free state root stays free of
 * `kahua-<tag>` dirs; the index lists F with its tag, label and group and decides nothing.
 */
import { describe, expect, test } from "vitest";
import * as paths from "../src/bag-paths.js";
import { daemonWorkingMirror, kahuaFaceFolder, isKahuaFaceFolder, kahuaStageMirror } from "../src/bag-paths.js";
import { kahuaIndexToml } from "../src/kahua-index.js";

const F1 = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31", F2 = "5d2c9e70-1b3a-4f68-8a47-c0e91d3b7a25";
const OLD_TAG = "2a1f0c9e4b7d";

describe("the folder names F", () => {
  test("RED: wiki and stage mirrors take kahua-<F>", () => {
    expect(kahuaFaceFolder(F1)).toBe(`kahua-${F1}`);
    expect(daemonWorkingMirror("/state", F1).mirrorRoot).toBe(`/state/wikis/kahua-${F1}`);
    expect(kahuaStageMirror("/state", F1).mirrorRoot).toBe(`/state/bags/kahua-${F1}`);
  });
  test("CONTROL: two faces never share a folder", () => {
    expect(kahuaFaceFolder(F1)).not.toBe(kahuaFaceFolder(F2));
    expect(isKahuaFaceFolder(`kahua-${F1}`)).toBe(true);
  });
  test("RED: the old derived tag refuses by name, and its folder shape reads as no kahua folder", () => {
    expect(() => kahuaFaceFolder(OLD_TAG)).toThrowError(/relation/);
    expect(isKahuaFaceFolder(`kahua-${OLD_TAG}`)).toBe(false);
  });
  test("RED: kahuaFaceTag burned (no key-derived name remains in the module)", () => {
    expect("kahuaFaceTag" in paths).toBe(false);
  });
});

describe("the label index is a convenience view", () => {
  test("RED: the toml maps F to tag, label and the current group", () => {
    const toml = kahuaIndexToml([{ relation: F1, tag: OLD_TAG, label: "home", group: "g1" }, { relation: F2, tag: "9c8b7a6f5e4d", label: "work", group: "g2" }]);
    expect(toml).toContain(`[faces."${F1}"]`);
    expect(toml).toContain('label = "home"');
    expect(toml).toContain('group = "g1"');
    expect(toml).toContain(`tag = "${OLD_TAG}"`);
  });
  test("CONTROL: the index is deterministic, sorted by F (F2 before F1), and holds no key material", () => {
    const rows = [{ relation: F2, tag: "t2", label: "b", group: "g2" }, { relation: F1, tag: "t1", label: "a", group: "g1" }];
    expect(kahuaIndexToml(rows)).toBe(kahuaIndexToml([...rows].reverse()));
    expect(kahuaIndexToml(rows).indexOf(F1)).toBeGreaterThan(kahuaIndexToml(rows).indexOf(F2));
    expect(kahuaIndexToml(rows)).not.toMatch(/seed|secret|private/i);
  });
  test("RED: a group change moves the index row's group and leaves its folder key F", () => {
    const before = kahuaIndexToml([{ relation: F1, tag: "t1", label: "home", group: "g-old" }]);
    const after = kahuaIndexToml([{ relation: F1, tag: "t1", label: "home", group: "g-new" }]);
    expect(after).toContain('group = "g-new"');
    expect(before.replace("g-old", "g-new")).toBe(after);
    expect(kahuaFaceFolder(F1)).toBe(`kahua-${F1}`);
  });
});
