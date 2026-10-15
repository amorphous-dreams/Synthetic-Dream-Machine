/**
 * realm-index — a realm resolves its own substrate from its id, per face (L85).
 *
 * A founding ceremony returns a CabalRealm carrying its `substrateUrl`, and nothing keeps it: a daemon
 * realm verb handed a realm id can find no board. This index keeps the mapping the holder already owns —
 * RESOLUTION-ONLY (it opens a doc the holder keyed, names no realm they hold no key to, so it stands apart
 * from the roster 'a roster IS a global now' forbids) and FACE-SCOPED (one persona at a time takes the
 * blame; a compromise yields one face's realms, not a multitude's — the persona planes' own blast radius).
 */
import { describe, test, expect } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { faceScopedRealmIndex, recordFaceRealm, resolveFaceRealm } from "../src/realm-index.js";

const REALM_A = "a".repeat(64);
const REALM_B = "b".repeat(64);
const SUB_A = "automerge:abcdef";
const SUB_B = "automerge:123456";
const FACE_1 = "persona-1";
const FACE_2 = "persona-2";

describe("faceScopedRealmIndex — a realm resolves its substrate from its id, per face", () => {
  test("★ record then resolve — the id opens the substrate the holder keyed ★", () => {
    const doc = emptyLarDoc() as LarDoc;
    recordFaceRealm(doc, FACE_1, REALM_A, SUB_A);
    expect(resolveFaceRealm(doc, FACE_1, REALM_A)).toBe(SUB_A);
    expect(faceScopedRealmIndex(doc, FACE_1).resolve(REALM_A)).toBe(SUB_A);
  });

  test("★ RESOLUTION-ONLY — an unrecorded id resolves null, never a fabricated address ★", () => {
    const doc = emptyLarDoc() as LarDoc;
    recordFaceRealm(doc, FACE_1, REALM_A, SUB_A);
    expect(resolveFaceRealm(doc, FACE_1, REALM_B)).toBeNull();
  });

  test("★ FACE-scoped — a second face resolves none of the first's realms ★", () => {
    const doc = emptyLarDoc() as LarDoc;
    recordFaceRealm(doc, FACE_1, REALM_A, SUB_A);
    recordFaceRealm(doc, FACE_2, REALM_B, SUB_B);
    expect(resolveFaceRealm(doc, FACE_2, REALM_A), "face 2 cannot resolve face 1's realm").toBeNull();
    expect(faceScopedRealmIndex(doc, FACE_1).held()).toEqual([REALM_A]);
    expect(faceScopedRealmIndex(doc, FACE_2).held()).toEqual([REALM_B]);
  });
});
