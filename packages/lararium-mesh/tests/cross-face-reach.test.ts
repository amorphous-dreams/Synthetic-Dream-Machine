/**
 * cross-face-reach — A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20, state/decisions "the cross-face reach"): a seat
 * wearing one face reads another lit face's wikis standing, with no lei, and PRIVATE bags refuse every cross-face reach.
 *
 *   X1  RED: the personal and draft layers of every wiki read PRIVATE by law (what a face keeps for itself, and its unsaved
 *       edits); canon, working and the libraries read visitable
 *   X2  RED: the cross-face view's slots: canon, working, the libraries and the floor; never personal, draft, temp, the kahua
 *       stage or the vessel's own daemon document; the private classification runs before every other choice
 *   X3  RED: the designated read verbs, and nothing that writes; the verbs whose `target` names a face
 *   X4  RED: the refusal names the private bag by class
 *   X5  RED (Sol H3): the classification canonicalizes the address (case, a trailing slash) and reads another wiki's private
 *       layer as private wherever a recipe lays it, as a library or otherwise
 *   X6  RED (fail closed): beneath a wiki's address only `working` and `temp` read visitable; an unknown kind, a deeper path
 *       (a per-place draft key) and any spelling of them read PRIVATE, and no view lays one
 */
import { describe, expect, test } from "vitest";
import {
  CROSS_FACE_READ_VERBS, CROSS_FACE_TARGET_VERBS, bagReachOf, crossFacePrivateRefusal, crossFaceViewSlots, isPrivateBag,
} from "../src/cross-face-reach.js";
import { DAEMON_BAG_ID, KAHUA_BAG, ORACLE_BAG, daemonFaceCanonBag, wikiBagUri, wikiSlotUri } from "../src/index.js";

const REL = "11111111-1111-4111-8111-111111111111";

describe("a lit face receives visits: the PRIVATE classification", () => {
  test("X1 RED: the personal and draft layers of every wiki read PRIVATE; canon, working and libraries read visitable", () => {
    for (const slug of ["daemon", "garden", "lares"]) {
      expect(isPrivateBag(wikiSlotUri(slug, "personal")), slug).toBe(true);
      expect(bagReachOf(wikiSlotUri(slug, "personal")), slug).toBe("private");
      expect(isPrivateBag(wikiSlotUri(slug, "draft")), `${slug} draft`).toBe(true);
      expect(isPrivateBag(wikiSlotUri(slug, "working")), `${slug} working`).toBe(false);
      expect(isPrivateBag(wikiBagUri(slug)), `${slug} canon`).toBe(false);
    }
    expect(isPrivateBag(daemonFaceCanonBag(REL))).toBe(false);
    expect(bagReachOf(ORACLE_BAG)).toBe("visitable");
    // A path beneath a private slot reads private too: the classification fails closed beneath a wiki's address (X6).
    expect(isPrivateBag("lar:///ha.ka.ba/wikis/garden/personal/extra")).toBe(true);
  });

  test("X2 RED: the cross-face view composes canon, working, the libraries and the floor alone", () => {
    const daemon = crossFaceViewSlots({ wikiSlug: "daemon", canonBag: daemonFaceCanonBag(REL), libraryBags: [KAHUA_BAG, "lar:///ha.ka.ba/bags/shared-lib"] });
    expect(daemon).toEqual([wikiSlotUri("daemon", "working"), daemonFaceCanonBag(REL), "lar:///ha.ka.ba/bags/shared-lib", ORACLE_BAG]);
    for (const out of [wikiSlotUri("daemon", "personal"), wikiSlotUri("daemon", "draft"), wikiSlotUri("daemon", "temp"), KAHUA_BAG, DAEMON_BAG_ID]) {
      expect(daemon, out).not.toContain(out);
    }
    const garden = crossFaceViewSlots({ wikiSlug: "garden" });
    expect(garden).toEqual([wikiSlotUri("garden", "working"), wikiBagUri("garden"), ORACLE_BAG]);
    // A library that names a private layer (any wiki's personal slot) never composes, wherever the recipe lays it.
    expect(crossFaceViewSlots({ wikiSlug: "garden", libraryBags: [wikiSlotUri("daemon", "personal")] })).not.toContain(wikiSlotUri("daemon", "personal"));
  });

  test("X3 RED: the designated read verbs, and none that writes", () => {
    expect([...CROSS_FACE_READ_VERBS].sort()).toEqual(["meme-get", "meme-list", "tiddler-get", "wiki-filter", "wiki-render", "wiki-status"]);
    for (const write of ["tiddler-put", "tiddler-delete", "meme-put", "meme-delete", "meme-patch", "INGEST"]) expect(CROSS_FACE_READ_VERBS.has(write), write).toBe(false);
    // The verbs whose `target` names a face: every read above, and the writes a target refuses on.
    for (const verb of CROSS_FACE_READ_VERBS) expect(CROSS_FACE_TARGET_VERBS.has(verb), verb).toBe(true);
    for (const write of ["tiddler-put", "tiddler-delete", "meme-put", "meme-delete", "meme-patch", "meme-project"]) expect(CROSS_FACE_TARGET_VERBS.has(write), write).toBe(true);
    for (const other of ["intent-propose", "kahua-lift", "floor-pin", "INGEST"]) expect(CROSS_FACE_TARGET_VERBS.has(other), other).toBe(false);
  });

  test("X4 RED: a private bag's refusal names its class and the bag; a visitable bag refuses nothing", () => {
    expect(crossFacePrivateRefusal(wikiSlotUri("daemon", "personal"))).toMatch(/^cross-face-private: /);
    expect(crossFacePrivateRefusal(wikiSlotUri("daemon", "personal"))).toContain(wikiSlotUri("daemon", "personal"));
    expect(crossFacePrivateRefusal(wikiSlotUri("daemon", "working"))).toBeNull();
  });

  test("X5 RED: case and a trailing slash never hide a private layer, and another wiki's private layer stays private as a library", () => {
    for (const spelled of ["LAR:///HA.KA.BA/WIKIS/GARDEN/PERSONAL", "lar:///ha.ka.ba/wikis/garden/personal/", "lar:///ha.ka.ba/wikis/Garden/Draft//"]) {
      expect(isPrivateBag(spelled), spelled).toBe(true);
    }
    const slots = crossFaceViewSlots({ wikiSlug: "daemon", libraryBags: [wikiSlotUri("garden", "draft"), "LAR:///ha.ka.ba/wikis/garden/personal/", "lar:///ha.ka.ba/bags/shared-lib"] });
    expect(slots).toContain("lar:///ha.ka.ba/bags/shared-lib");
    for (const out of [wikiSlotUri("garden", "draft"), "LAR:///ha.ka.ba/wikis/garden/personal/"]) expect(slots, out).not.toContain(out);
  });

  test("X6 RED: an unknown kind beneath a wiki's address reads private, and no view lays it", () => {
    for (const unknown of ["lar:///ha.ka.ba/wikis/garden/notes", "lar:///ha.ka.ba/wikis/garden/Scratch/", "lar:///ha.ka.ba/wikis/garden/drafts/did%3Akey%3Az6Mk", "lar:///ha.ka.ba/wikis/garden/working/sub"]) {
      expect(bagReachOf(unknown), unknown).toBe("private");
      expect(crossFacePrivateRefusal(unknown), unknown).toMatch(/^cross-face-private: /);
    }
    for (const visitable of [wikiSlotUri("garden", "working"), wikiSlotUri("garden", "temp"), wikiBagUri("garden"), "lar:///ha.ka.ba/bags/shared-lib"]) {
      expect(bagReachOf(visitable), visitable).toBe("visitable");
    }
    expect(crossFaceViewSlots({ wikiSlug: "daemon", libraryBags: ["lar:///ha.ka.ba/wikis/garden/notes"] })).not.toContain("lar:///ha.ka.ba/wikis/garden/notes");
  });
});
