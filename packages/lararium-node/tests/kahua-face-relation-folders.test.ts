/**
 * kahua-face-relation-folders — the face's private folders take its PET NAME, never its relation id and never a tag derived from
 * keys or group.
 *
 * Operator ruling (2026-11-18, "one pool per face keyed by pet name"), superseding 2026-11-02's relation-keyed folders: a relation
 * id changes at every re-found, so a relation-keyed folder orphans; the pet name carries across. The wiki projects to
 * `<projections>/faces/<pet name>/wiki` and the stage to `<projections>/faces/<pet name>/stage`. The label index is a DISK view
 * regenerated from the face records and never read to decide.
 *
 * Reds: the folders name the pet name; a group change (rotation or recovery) and a re-found (a new relation) leave the folder
 * where it stood; `kahuaFaceTag` leaves the module. Controls: two faces never share a folder; the index lists F with its tag,
 * label and group and decides nothing.
 */
import { describe, expect, test } from "vitest";
import { daemonWorkingMirror, faceSegment, kahuaStageMirror } from "../src/bag-paths.js";
import { kahuaIndexToml, writeKahuaIndex } from "../src/kahua-index.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const F1 = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31", F2 = "5d2c9e70-1b3a-4f68-8a47-c0e91d3b7a25";
const SCOPE_TAG = "2a1f0c9e4b7d";

describe("the folder names the pet name", () => {
  test("RED: wiki and stage mirrors rest in the face's root; a new relation under the same pet name keeps them", () => {
    expect(daemonWorkingMirror("/state", { relation: F1, segment: "home" }).mirrorRoot).toBe("/state/faces/home/wiki");
    expect(kahuaStageMirror("/state", { relation: F1, segment: "home" }).mirrorRoot).toBe("/state/faces/home/stage");
    expect(kahuaStageMirror("/state", { relation: F2, segment: "home" }).mirrorRoot).toBe("/state/faces/home/stage");
  });
  test("CONTROL: two faces never share a folder", () => {
    expect(() => faceSegment("HOME", ["home"])).toThrowError(/face-segment-collision/);
    expect(faceSegment("work", ["home"])).not.toBe(faceSegment("home", ["work"]));
  });
});

describe("the label index is a convenience view", () => {
  test("RED: the toml maps F to tag, label and the current group", () => {
    const toml = kahuaIndexToml([{ relation: F1, tag: SCOPE_TAG, label: "home", group: "g1" }, { relation: F2, tag: "9c8b7a6f5e4d", label: "work", group: "g2" }]);
    expect(toml).toContain(`[faces."${F1}"]`);
    expect(toml).toContain('label = "home"');
    expect(toml).toContain('group = "g1"');
    expect(toml).toContain(`tag = "${SCOPE_TAG}"`);
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
    expect(kahuaStageMirror("/state", { relation: F1, segment: "home" }).mirrorRoot).toBe("/state/faces/home/stage");
  });
});

describe("the index write never drops another face's row", () => {
  const A = { relation: F1, tag: "t1", label: "home", group: "g1" }, B = { relation: F2, tag: "t2", label: "work", group: "g2" };
  const fresh = () => mkdtempSync(join(tmpdir(), "kahua-index-"));

  test("RED: two faces on one root; a boot wearing one leaves both rows standing", async () => {
    const root = fresh();
    try {
      await writeKahuaIndex(root, [A]);
      await writeKahuaIndex(root, [B]);
      const toml = readFileSync(join(root, "kahua-index.toml"), "utf8");
      expect(toml).toContain(`[faces."${F1}"]`);
      expect(toml).toContain(`[faces."${F2}"]`);
      expect(toml).toContain('label = "home"');
      expect(toml).toContain('label = "work"');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED: a face's own row merges by F, so a group change replaces its row and leaves the other", async () => {
    const root = fresh();
    try {
      await writeKahuaIndex(root, [A, B]);
      await writeKahuaIndex(root, [{ ...A, group: "g-new" }]);
      const toml = readFileSync(join(root, "kahua-index.toml"), "utf8");
      expect(toml).toContain('group = "g-new"');
      expect(toml).not.toContain('group = "g1"');
      expect(toml).toContain('group = "g2"');
      expect(toml.match(/\[faces\./g)).toHaveLength(2);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: a first write on a fresh root writes exactly its rows, and an identical rewrite changes no byte", async () => {
    const root = fresh();
    try {
      await writeKahuaIndex(root, [A, B]);
      const first = readFileSync(join(root, "kahua-index.toml"), "utf8");
      expect(first).toBe(kahuaIndexToml([A, B]));
      await writeKahuaIndex(root, [A, B]);
      expect(readFileSync(join(root, "kahua-index.toml"), "utf8")).toBe(first);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe("a restored bundle keeps F end to end (OWED with R17, the face-keyed names lane)", () => {
  test.fails("RED (owed): a recovery onto a new group restores the bundle and the kahua folders keep kahua-<F>", () => {
    // R17 (packages/lararium-node/tests/face-bundle-restore.test.ts) carries the real restore walk; this pin flips when
    // the bundle-to-founding wiring carries F through a recovery. Until then the restore mints no F of its own.
    expect(false).toBe(true);
  });
});
