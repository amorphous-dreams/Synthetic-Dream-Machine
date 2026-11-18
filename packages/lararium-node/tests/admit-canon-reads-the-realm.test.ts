/**
 * admit-canon-reads-the-realm — THE CANON A HEARTH NAMES TO A JOINEE COMES FROM THE KAHU REALM (walk R4, catalog half).
 *
 * `@lares` and `@lararium` are REALM bags: the Kahu realm's registry names their documents (`standKahuCanon`, the one
 * read the keel mounts them by). A vessel's catalog never carries them (measured on walk root w1: eighteen catalog
 * tiddlers, user bags alone, no `bags/lares`, no `bags/lararium`), so a canon list read off the catalog by those titles
 * named nothing on every hearth, and every joined leaf read `the admit names no hearth canon`. One owner per registry:
 * the admit's canon derives from the realm's own reading, keyed by the face the hearth wears.
 *
 *   C1  RED: with the realm standing both documents for the hearth's face, the canon names both by their bag title.
 *   C2  CONTROL: a face whose realm stands neither names none; no face names none and reads no realm.
 */
import { describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ standing: {} as { lares?: string; lararium?: string }, asked: [] as unknown[], atom: true }));
vi.mock("../src/commands/nexus-cabal.js", () => ({ NexusCabalError: class extends Error {}, cabalCore: () => ({}), readKahuCabalBoard: async () => null }));
vi.mock("../src/face-atom-store.js", () => ({ loadFaceAtomOfGroup: async () => (seam.atom ? new Uint8Array(32).fill(7) : null) }));
vi.mock("../src/nexus-leaf.js", () => ({ mintNexusLeaf: async () => ({ verifyingKey: "k", seed: new Uint8Array(32) }) }));
vi.mock("@lararium/mesh", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  faceAtomKeyFromSeed: () => ({ key: "atom-key" }),
}));

import * as realm from "../src/kahu-realm.js";
import { LARARIUM_DOC_URI, LARES_DOC_URI } from "@lararium/mesh";

type Stand = (opts: { repo: unknown; sealHome: string; vesselKey: string; personaGroupId: string | null }) => Promise<{ lares?: string; lararium?: string }>;
const read = () => (realm as unknown as { admitCanonDocs: (repo: unknown, sealHome: string, group: string | null, stand?: Stand) => Promise<Record<string, string>> }).admitCanonDocs;

describe("the admit's canon reads the Kahu realm", () => {
  test("C1 — the realm standing both documents names both by bag title", async () => {
    const stand: Stand = async (opts) => { seam.asked.push(opts); return { lares: "automerge:3UQRlares", lararium: "automerge:3UQRlararium" }; };
    const canon = await read()({}, "/seal", "group-1", stand);
    expect(canon).toEqual({ [LARES_DOC_URI]: "automerge:3UQRlares", [LARARIUM_DOC_URI]: "automerge:3UQRlararium" });
    expect(seam.asked[0]).toMatchObject({ sealHome: "/seal", personaGroupId: "group-1", vesselKey: "atom-key" });
  });

  test("C2 — CONTROL: a realm standing neither names none; no face reads no realm; the default reader is the keel's own", async () => {
    let asked = 0;
    const none: Stand = async () => { asked++; return {}; };
    expect(await read()({}, "/seal", "group-1", none)).toEqual({});
    expect(await read()({}, "/seal", null, none)).toEqual({});
    expect(asked).toBe(1);
    // The keel's reader (a cabal board that reads null here) names none, through the real road.
    expect(await read()({}, "/seal", "group-1")).toEqual({});
  });
});
