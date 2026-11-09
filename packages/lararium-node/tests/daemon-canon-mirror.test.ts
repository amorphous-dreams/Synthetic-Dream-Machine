/**
 * daemon-canon-mirror — the daemon wiki's mirrors follow the worn face: its working top projects to
 * `<projections>/wikis/daemon-<F>`, its canon `bags/daemon-<F>` to `<projections>/bags/daemon-<F>`. The daemon document
 * (`bags/daemon`) and the control document (`bags/control`) carry no mirror, so no control family reaches disk by placement.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { CONTROL_HOME_ID, DAEMON_BAG_ID, KAHUA_BAG, daemonFaceCanonBag, emptyLarDoc, expandRecipe, kahuaRecipe, ownEntry, tiddlerText, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { daemonDiskMirrors } from "../src/bag-paths.js";
import { standFaceDaemonCanon } from "../src/face-daemon-canon.js";

const F = "123e4567-e89b-42d3-a456-426614174000";

describe("the daemon wiki's mirrors follow the worn face", () => {
  test("RED: a worn face with its canon mirrors the working top at wikis/daemon-<F> and the canon at bags/daemon-<F>; neither the daemon nor the control document mirrors", () => {
    const list = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: F, canon: true });
    expect(list.find((m) => m.scope === "daemon")).toMatchObject({ bagId: wikiSlotUri("daemon", "working"), mirrorRoot: `/p/wikis/daemon-${F}` });
    expect(list.find((m) => m.scope === "daemon-canon")).toMatchObject({ bagId: daemonFaceCanonBag(F), mirrorRoot: `/p/bags/daemon-${F}` });
    expect(list.map((m) => m.scope)).toEqual(expect.arrayContaining(["kahua", "crossroads"]));
    expect(list.some((m) => m.bagId === DAEMON_BAG_ID || m.bagId === CONTROL_HOME_ID)).toBe(false);
  });

  test("CONTROL: the floor (no face worn) mirrors no private layer; a face whose catalog names no canon mirrors no canon", () => {
    const floor = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: null });
    expect(floor.map((m) => m.scope)).toEqual(["crossroads"]);
    const noCanon = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: F });
    expect(noCanon.some((m) => m.scope === "daemon-canon")).toBe(false);
    expect(noCanon.some((m) => m.scope === "daemon")).toBe(true);
  });
});

describe("the daemon wiki's canon per face", () => {
  test("RED: the daemon recipe reads working -> bags/daemon-<F> -> bags/kahua, and the daemon document rides beneath every canon", () => {
    const slots = expandRecipe(kahuaRecipe({ wikiSlug: "daemon", canonBag: daemonFaceCanonBag(F) }));
    const at = (slot: string) => slots.indexOf(slot);
    expect(at(wikiSlotUri("daemon", "working"))).toBeLessThan(at(daemonFaceCanonBag(F)));
    expect(at(daemonFaceCanonBag(F))).toBe(at(wikiSlotUri("daemon", "working")) + 1);
    expect(at(KAHUA_BAG)).toBe(at(daemonFaceCanonBag(F)) + 1);
    expect(at(DAEMON_BAG_ID)).toBeGreaterThan(at(KAHUA_BAG));
    expect(slots).not.toContain(CONTROL_HOME_ID);
  });

  test("CONTROL: a recipe naming no canonBag keeps its own bag as canon", () => {
    const slots = expandRecipe({ wikiSlug: "notes" });
    expect(slots.indexOf("lar:///ha.ka.ba/bags/notes")).toBe(slots.indexOf(wikiSlotUri("notes", "working")) + 1);
  });

  test("RED: the face's first stand mints its daemon canon and names it in the face's catalog; CONTROL: a second stand returns that same document", async () => {
    const repo = new Repo({});
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    const first = await standFaceDaemonCanon({ repo, catalog, faceRelation: F });
    expect(first.bagId).toBe(daemonFaceCanonBag(F));
    expect(tiddlerText(ownEntry(catalog.doc()?.tiddlers, first.bagId))).toBe(first.url);
    const second = await standFaceDaemonCanon({ repo, catalog, faceRelation: F });
    expect(second.handle.documentId).toBe(first.handle.documentId);
  });

  test("a face relation that is no relation names no canon", () => {
    expect(() => daemonFaceCanonBag("not-a-relation")).toThrow(/invalid relation/);
  });
});
