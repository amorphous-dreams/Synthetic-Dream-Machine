/**
 * face-issued-book — the root holder's issued book, kept in the face's record under sealed custody.
 *
 *   I1  a note on a face with no record stands one holding the book alone; the record reads it back
 *   I2  a later write of the record that names no book keeps it (the founder's self-certificate rewrites the
 *       record) / RED: a write that names its own book replaces it
 *   I3  a re-answered request notes once; a second device's certificates join the book
 *   I4  RED: a record under another root key refuses the note, and the record stands as it was
 *   I5  RED: a malformed entry never lands
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { keepFaceJoinRecord, noteIssuedFaceKeys, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const GROUP = "0x" + "b7f1c2a9d4e60381";
const ROOT = "ee".repeat(32);
const NEXUS = "nexus-a.synthetic";
const FACE = "fa".repeat(32);
const JOINEE = "10".repeat(32), SECOND = "20".repeat(32);
const cert = (vesselFaceKey: string) => ({ scope: { faceKey: FACE, nexus: NEXUS }, vesselFaceKey, signature: "00".repeat(64) });
const entry = (vesselFaceKey: string, device: string) => ({ nexus: NEXUS, faceKey: FACE, vesselFaceKey, device });

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("face-issued-book"); });
afterEach(async () => { await c.drop(); });

describe("the root holder's issued book", () => {
  test("I1–I3: noted, kept across a record rewrite, noted once per request, joined by a second device", async () => {
    await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: JOINEE.toUpperCase(), certificates: [cert("b2".repeat(32))] });
    const first = await readFaceJoinRecord(GROUP);
    expect(first).toMatchObject({ rootKey: ROOT, certificates: [], grants: [], issued: [entry("b2".repeat(32), JOINEE)] });

    // I2: the founder's self-certificate rewrites the record and names no book: the book stands.
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: ROOT, certificates: [cert("a1".repeat(32))], grants: [] });
    expect((await readFaceJoinRecord(GROUP))?.issued).toEqual([entry("b2".repeat(32), JOINEE)]);
    expect((await readFaceJoinRecord(GROUP))?.certificates).toHaveLength(1);

    // I3: the same answer again notes once; a second joinee's certificate joins the book.
    await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: JOINEE, certificates: [cert("b2".repeat(32))] });
    await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: SECOND, certificates: [cert("c3".repeat(32))] });
    const book = (await readFaceJoinRecord(GROUP))?.issued;
    expect(book).toEqual([entry("b2".repeat(32), JOINEE), entry("c3".repeat(32), SECOND)]);
    expect((await readFaceJoinRecord(GROUP))?.certificates).toHaveLength(1);       // the note kept the certificates

    // RED (I2): a write that names its own book replaces it.
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: ROOT, certificates: [], grants: [], issued: [] });
    expect((await readFaceJoinRecord(GROUP))?.issued).toEqual([]);
  });

  test("I4 RED: a record under another root refuses the note and stands as it was", async () => {
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: "dd".repeat(32), certificates: [], grants: [] });
    await expect(noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: JOINEE, certificates: [cert("b2".repeat(32))] })).rejects.toThrow();
    expect(await readFaceJoinRecord(GROUP)).toMatchObject({ rootKey: "dd".repeat(32), issued: [] });
  });

  test("I5 RED: a malformed entry never lands", async () => {
    await expect(noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: "not-a-key", certificates: [cert("b2".repeat(32))] })).rejects.toThrow();
    await expect(noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT, device: JOINEE, certificates: [cert("short")] })).rejects.toThrow();
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
  });
});
