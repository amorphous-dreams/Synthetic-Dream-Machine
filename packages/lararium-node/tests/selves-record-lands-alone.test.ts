/**
 * selves-record-lands-alone — W1 (persona-selves-sealed#/witnesses): a written pet-name lands in the face's selves record
 * alone; the plane document and every byte the vessel rests carry no copy of it.
 *
 *   L1  the selves plane writes the name into the record (the record's own document holds it, opened in memory), reads it
 *       back, and the plane document gains no `persona/selves` row and no byte of the name.
 *   L2  every byte the vessel rests, across every document its Repo rests and every shelf of its seat, spells no name.
 *       CONTROL: the plane's public row rests verbatim, so the measure reads a clear rest and finds what one holds.
 */
import { afterEach, describe, expect, test } from "vitest";
import { PERSONA_SELVES_PREFIX } from "@lararium/mesh/lar-uris";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FLEET_NEXUS, fleet } from "../../lararium-keyhive/tests/content-key-fleet.js";
import { drain, everyByte, islandOf, spells, vessel } from "./sealed-crossing-fixture.js";
import { PUBLIC_SIGNER, RECORD, bagMapOf, selvesOver, standPlane } from "./selves-record-fixture.js";

const NAME = "SEARCH-ME-the-heron-face";
afterEach(drain);

describe("W1 — a pet-name lands in the selves record alone", () => {
  test("L1/L2 — the record holds the name; the plane and every resting byte carry no copy", async () => {
    const { devices: [a] } = await fleet(0xa4, ["vessel-a"], { bags: [RECORD.bagId], chainFor: async (name) => chain(`${name}-0xa4`, FLEET_NEXUS) });
    const face = faceProofSubjectRef(a!.chain.scope);
    const A = vessel("a", islandOf(a!), face, bagMapOf(face));
    const plane = await standPlane(A.repo);
    const selves = selvesOver(A.repo, plane.url, bagMapOf(face));

    expect(await selves.write(0, "petname", NAME)).toEqual({ written: true, plane: true });
    expect(await selves.read()).toEqual([{ handleIndex: 0, petname: NAME }]);
    // THE RECORD HOLDS IT, opened in this vessel's memory.
    const record = await A.repo.find<LarDoc>(RECORD.url as never);
    expect(JSON.stringify(record.doc()).includes(NAME), "the selves record holds the name").toBe(true);
    // THE PLANE HOLDS NO COPY.
    expect(Object.keys(plane.doc().tiddlers).some((t) => t.startsWith(`${PERSONA_SELVES_PREFIX}/`)), "the plane gains no selves row").toBe(false);
    expect(JSON.stringify(plane.doc()).includes(NAME)).toBe(false);
    await A.settle();
    // NO RESTING BYTE SPELLS IT.
    expect(A.resting.values.size, "the seat sealed the record's values").toBeGreaterThan(0);
    expect(spells(await everyByte(A.resting), NAME), "a byte the vessel rests spells the name").toBe(false);
    // CONTROL: the plane rests clear, and its public row reads in the same measure.
    expect(spells(await everyByte(A.resting, plane.documentId), PUBLIC_SIGNER), "the control row reads nowhere").toBe(true);
  }, 120_000);
});
