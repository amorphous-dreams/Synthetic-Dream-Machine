/**
 * selves-record-one-face — each face's selves record stands as its own bag and its own document, and no record names
 * two faces (persona-selves-sealed#/design items 2 and 6, #/witnesses W5).
 *
 *   S1  the record's bag derives off the face's group (the plane's own tag), stands beside the plane and never under its
 *       bag path, and its address carries no pet-name and no group id.
 *   S2  the record's document derives off the same group, so every vessel of the face computes it alike; another
 *       face's record names another bag and another document.
 *   S3  each membership registers its face's record with the capability ring, and never another face's (a catalog row
 *       naming a stranger's record registers nothing).
 *   S4  W5: no record names two faces. Across a multitude, each record's document maps to exactly one face, sealed under
 *       that face's subject while it stands lit and under no face while it stands shut; a document no carried face's
 *       record holds maps nothing.
 */
import { describe, expect, test } from "vitest";
import { deriveRegisterBags } from "../src/register-bags.js";
import { isFaceScopedBag, faceTagOfBag, personaBagIdFor, personaScopeTag, personaSelvesBagIdFor } from "../src/persona-scope.js";
import { selvesRecordBagOf, selvesRecordOf, selvesRestOf } from "../src/persona-planes.js";
import { documentIdOfUrl } from "../src/sealed-rest.js";

const WORK = "a0".repeat(16), PLAY = "b1".repeat(16), QUIET = "c2".repeat(16);
const PETNAME = "the-quiet-face";

describe("each face's selves record, its own bag and document", () => {
  test("S1 — the record's bag derives off the face's group, beside the plane and never under its path", () => {
    const bag = personaSelvesBagIdFor(WORK);
    expect(bag).toMatch(/\/selves-[0-9a-f]{16}$/);
    expect(faceTagOfBag(bag), "the record carries the plane's own tag").toBe(personaScopeTag(WORK));
    expect(isFaceScopedBag(bag), "the record reads as face-scoped, so no disk mirror, island pool or sibling view takes it").toBe(true);
    expect(bag.startsWith(`${personaBagIdFor(WORK)}/`), "the record never rests under the plane's bag path").toBe(false);
    expect(bag).not.toBe(personaBagIdFor(WORK));
    expect(bag.includes(WORK) || bag.includes(PETNAME), "the address names no one").toBe(false);
    expect(personaSelvesBagIdFor(WORK)).toBe(bag);                                             // control: one group, one name
  });

  test("S2 — every vessel of the face computes the record's document alike; another face's names another", () => {
    const record = selvesRecordOf(WORK);
    expect(record).toEqual({ personaGroupId: WORK, bagId: personaSelvesBagIdFor(WORK), url: selvesRecordOf(WORK).url });
    expect(record.url).toMatch(/^automerge:/);
    expect(record.url.includes(WORK)).toBe(false);
    const other = selvesRecordOf(PLAY);
    expect(other.bagId).not.toBe(record.bagId);
    expect(other.url).not.toBe(record.url);
  });

  test("S3 — each membership registers its own face's record with the ring, never another face's", () => {
    const bags = deriveRegisterBags({ fleets: [{ personaGroupId: WORK, catalogNamed: [personaSelvesBagIdFor(QUIET)] }, { personaGroupId: PLAY }] });
    expect(bags).toContain(personaSelvesBagIdFor(WORK));
    expect(bags).toContain(personaSelvesBagIdFor(PLAY));
    expect(bags, "a catalog row naming a stranger's record registers nothing").not.toContain(personaSelvesBagIdFor(QUIET));
    expect(bags).toContain(personaBagIdFor(WORK));                                             // control: the plane still registers
  });

  test("S4 — W5: no record names two faces; each maps under its own face alone, and under none while shut", () => {
    const carried = [WORK, PLAY, QUIET];
    const lit = [{ group: WORK, face: "subject-work" }, { group: PLAY, face: "subject-play" }];   // QUIET stands shut
    const docs = carried.map((g) => documentIdOfUrl(selvesRecordOf(g).url)!);
    expect(new Set(docs).size, "each face's record stands its own document").toBe(carried.length);
    for (const [i, group] of carried.entries()) {
      const bag = selvesRecordBagOf(docs[i]!, carried, lit);
      expect(bag?.bagId).toBe(personaSelvesBagIdFor(group));
      const owners = carried.filter((g) => selvesRecordBagOf(docs[i]!, [g], lit) !== null);
      expect(owners, "one record, one face").toEqual([group]);
    }
    expect(selvesRecordBagOf(docs[0]!, carried, lit)).toEqual({ bagId: personaSelvesBagIdFor(WORK), face: "subject-work" });
    expect(selvesRecordBagOf(docs[1]!, carried, lit)).toEqual({ bagId: personaSelvesBagIdFor(PLAY), face: "subject-play" });
    expect(selvesRecordBagOf(docs[2]!, carried, lit), "a shut face's record maps under no face: it neither loads nor rests clear").toEqual({ bagId: personaSelvesBagIdFor(QUIET), face: null });
    expect(selvesRecordBagOf(docs[2]!, [WORK, PLAY], lit), "a face this vessel does not carry maps nothing").toBeNull();
    expect(selvesRecordBagOf("2j9knpCseyhnK8izDmLpGP5WMdZQ", carried, lit)).toBeNull();
    // The rest each mapping answers the plane: sealed under a lit face, shut under none, clear where nothing maps.
    expect(selvesRestOf(selvesRecordBagOf(docs[0]!, carried, lit))).toBe("sealed");
    expect(selvesRestOf(selvesRecordBagOf(docs[2]!, carried, lit))).toBe("shut");
    expect(selvesRestOf(null)).toBe("clear");
  });
});
