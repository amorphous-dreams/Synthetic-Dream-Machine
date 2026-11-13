/**
 * face-labels-kept — the vessel keeps each face's label and its bases sidecar true with no CLI door running.
 *
 *   K1  a label writes once, rewrites where the pet-name moved, and refuses no face (never throws)
 *   K2  the bases keeper writes a face's sidecar off its working documents, rewrites on each change, keeps the sidecar
 *       while a document stands unhydrated, and lets go on stop
 *   K3  two faces: the owner table files each face's working slot under its own group, so each face's keeper writes its
 *       own sidecar, never the bases of the face lit now
 *   K4  a fresh face that pins no stage lists an empty stage named `none`, never a refusal; every other refusal stands
 */
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deviceDaemonDocs, CONTROL_HOME_ID, emptyLarDoc, storedLarRecord, type LarDoc } from "@lararium/mesh";
import { writeFaceLabel, readFaceLabel, keepFaceBases, readFaceBases, faceBasesPath, type KeptDoc, type KeptDocState } from "../src/face-labels.js";
import { listStage, KahuaRefused } from "../src/commands/kahua.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const F3 = "33333333-3333-4333-8333-333333333333";
const B1 = `sha256:${"1".repeat(64)}`, B2 = `sha256:${"2".repeat(64)}`, B3 = `sha256:${"3".repeat(64)}`;

/** A working document a keeper watches: its tiddlers, and change events a test fires. */
class Doc implements KeptDoc {
  listeners = new Set<() => void>();
  constructor(public state: { tiddlers: Record<string, { meta?: Record<string, unknown> }> } | undefined) {}
  doc() { return this.state as unknown as KeptDocState | undefined; }
  on(_e: "change", l: () => void) { this.listeners.add(l); }
  off(_e: "change", l: () => void) { this.listeners.delete(l); }
  set(title: string, meta: Record<string, unknown>) { this.state = { tiddlers: { ...(this.state?.tiddlers ?? {}), [title]: { meta } } }; for (const l of this.listeners) l(); }
}
const turn = () => new Promise((r) => setTimeout(r, 0));

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lar-face-labels-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("the vessel keeps each face's label and bases", () => {
  test("K1 — a label writes once, follows a renamed pet-name, and never throws", () => {
    expect(writeFaceLabel({ relation: F1, petname: "hearth-one", handleIndex: 0 }, root)).toBe(true);
    expect(writeFaceLabel({ relation: F1, petname: "hearth-one", handleIndex: 0 }, root)).toBe(false);
    expect(readFaceLabel(F1, root)).toMatchObject({ relation: F1, petname: "hearth-one", handleIndex: 0 });
    expect(writeFaceLabel({ relation: F1, petname: "renamed", handleIndex: 0 }, root)).toBe(true);
    expect(readFaceLabel(F1, root)?.petname).toBe("renamed");
    expect(writeFaceLabel({ relation: null, petname: "x", handleIndex: 0 }, root)).toBe(false);
    expect(writeFaceLabel({ relation: "not-a-relation", petname: "x", handleIndex: 0 }, root)).toBe(false);
    expect(writeFaceLabel({ relation: F3, petname: undefined, handleIndex: 1 }, root)).toBe(false);
  });

  test("K2 — the keeper writes the sidecar, follows each change, keeps it while unhydrated, and lets go on stop", async () => {
    const working = new Doc({ tiddlers: { pond: { meta: { overrideBase: B1 } }, heron: { meta: {} }, gone: { meta: { overrideBase: B2, deleted: true } } } });
    const keeper = keepFaceBases({ relation: F1, projections: root, docs: () => [working] });
    expect(readFaceBases(F1, root)).toEqual({ pond: B1 });
    working.set("lake", { overrideBase: B2 });
    await turn();
    expect(readFaceBases(F1, root)).toEqual({ lake: B2, pond: B1 });
    const late = new Doc(undefined);
    const k2 = keepFaceBases({ relation: F3, projections: root, docs: () => [late] });
    expect(existsSync(faceBasesPath(F3, root))).toBe(false);          // nothing hydrated: nothing written, nothing wiped
    k2.stop();
    keeper.stop();
    working.set("after-stop", { overrideBase: B3 });
    await turn();
    expect(readFaceBases(F1, root)).toEqual({ lake: B2, pond: B1 });
  });

  test("K3 — two faces: each keeper reads its own group's working slot through the owner table", async () => {
    const table = deviceDaemonDocs({ enrollFloor: () => {} });
    const control: LarDoc = emptyLarDoc();
    const G1 = "group-one", G3 = "group-three";
    control.tiddlers[`${CONTROL_HOME_ID}/daemon-slot/working/${G1}`] = storedLarRecord(`${CONTROL_HOME_ID}/daemon-slot/working/${G1}`, { text: "automerge:2DrjgbFdhNzMs7KwYv3jcFpqxH3L" }, "t") as never;
    control.tiddlers[`${CONTROL_HOME_ID}/daemon-slot/working/${G3}`] = storedLarRecord(`${CONTROL_HOME_ID}/daemon-slot/working/${G3}`, { text: "automerge:3TzPkAHbW2dVcYgnJ1ofoaJv7mNS" }, "t") as never;
    table.readControl(control);
    const docs: Record<string, Doc> = {
      "2DrjgbFdhNzMs7KwYv3jcFpqxH3L": new Doc({ tiddlers: { pond: { meta: { overrideBase: B1 } } } }),
      "3TzPkAHbW2dVcYgnJ1ofoaJv7mNS": new Doc({ tiddlers: { pond: { meta: { overrideBase: B3 } } } }),
    };
    const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
    const keep = (group: string, relation: string) => keepFaceBases({ relation, projections: root, docs: () => table.docsOf(WORKING, [{ group, relation, face: null }]).map((id) => docs[id]!).filter(Boolean) });
    const one = keep(G1, F1), three = keep(G3, F3);
    expect(readFaceBases(F1, root)).toEqual({ pond: B1 });
    expect(readFaceBases(F3, root)).toEqual({ pond: B3 });
    one.stop(); three.stop();
  });

  test("K4 — a fresh face lists an empty stage named none; every other refusal stands", async () => {
    await expect(listStage({ list: async () => { throw new KahuaRefused("kahua-unpinned: the face pins no stage"); } }, null)).resolves.toEqual({ items: [], relation: null, stage: "none" });
    await expect(listStage({ list: async () => [{ title: "t" }] }, F1)).resolves.toEqual({ items: [{ title: "t" }], relation: F1 });
    await expect(listStage({ list: async () => { throw new KahuaRefused("face-log-unreadable: the face's signed log does not fold"); } }, null)).rejects.toThrow(/face-log-unreadable/);
  });
});
