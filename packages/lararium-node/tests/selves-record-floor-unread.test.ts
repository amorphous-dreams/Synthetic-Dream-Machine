/**
 * selves-record-floor-unread — W2 (persona-selves-sealed#/witnesses): a locked floor folds the plane's public acts with no
 * key while the selves record stays unread.
 *
 *   F1  the vessel restarted as a floor (no face lit, no session) reads the plane's public row from its own rest, and its
 *       seat opens nothing; the selves plane names the record `shut`, answers no name, and still opens nothing; a write
 *       refuses by name.
 *   F2  CONTROL: the same rest restarted with the face lit reads the name back through its seat.
 */
import { afterEach, describe, expect, test } from "vitest";
import { tiddlerText, type LarDoc } from "@lararium/mesh/base-doc";
import { SIGNER_DID_TIDDLER } from "@lararium/mesh/lar-uris";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FLEET_NEXUS, fleet } from "../../lararium-keyhive/tests/content-key-fleet.js";
import { drain, islandOf, readWithin, vessel } from "./sealed-crossing-fixture.js";
import { PUBLIC_SIGNER, RECORD, bagMapOf, selvesOver, standPlane } from "./selves-record-fixture.js";

const NAME = "SEARCH-ME-the-floor-never-reads";
afterEach(drain);

describe("W2 — the locked floor folds the plane with the selves record unread", () => {
  test("F1/F2 — the floor reads the public act and opens nothing; the lit face reads the name", async () => {
    const { devices: [a] } = await fleet(0xb4, ["vessel-a"], { bags: [RECORD.bagId], chainFor: async (name) => chain(`${name}-0xb4`, FLEET_NEXUS) });
    const face = faceProofSubjectRef(a!.chain.scope);
    const lit = vessel("a", islandOf(a!), face, bagMapOf(face));
    const plane = await standPlane(lit.repo);
    expect(await selvesOver(lit.repo, plane.url, bagMapOf(face)).write(0, "petname", NAME)).toEqual({ written: true, plane: true });
    await lit.settle();
    await lit.repo.shutdown();

    // F1: THE FLOOR. No face lights, no session stands; the map names the record under no face.
    const floor = vessel("a-floor", islandOf(a!), face, bagMapOf(null), { inner: lit.inner, sessionFace: null });
    const signer = await readWithin<LarDoc, string>(floor.repo, plane.url, (doc) => tiddlerText(doc?.tiddlers?.[SIGNER_DID_TIDDLER]) ?? null);
    expect(signer, "the floor folds the plane's public act").toBe(PUBLIC_SIGNER);
    const selves = selvesOver(floor.repo, plane.url, bagMapOf(null));
    expect(selves.rest).toBe("shut");
    expect(await selves.read(), "the floor reads no name").toEqual([]);
    await expect(selves.write(0, "petname", "a-floor-write")).rejects.toThrow(/until its face lifts/);
    expect(floor.opens, "the floor opened nothing through the seat").toEqual([]);
    expect((floor.repo.handles as Record<string, unknown>)[RECORD.url.slice("automerge:".length)], "the floor never asked for the record").toBeUndefined();
    await floor.repo.shutdown();

    // F2: CONTROL. The lift: the same rest, the face lit, reads the name through its own seat.
    const again = vessel("a-again", islandOf(a!), face, bagMapOf(face), { inner: lit.inner });
    expect(await selvesOver(again.repo, plane.url, bagMapOf(face)).read()).toEqual([{ handleIndex: 0, petname: NAME }]);
    expect(again.opens.length).toBeGreaterThan(0);
    expect(again.opens.every((o) => o.ok), JSON.stringify(again.opens)).toBe(true);
  }, 120_000);
});
