/**
 * selves-record-crossing — W3 (persona-selves-sealed#/witnesses): a second vessel of the same face reads the name after its
 * lift; a vessel of another face opens nothing. It rides the cross-vessel sealed-bag witness's fixture
 * (`sealed-crossing-vessel`): two vessels of one face, each seated in the face's key group on its own Keyhive identity,
 * synced live.
 *
 *   C1  A's selves plane writes a pet-name; B's selves plane, over B's own Repo and its own bag map (its face lit), reads it;
 *       every byte B rests stays free of the name.
 *   C2  a vessel of another face, handed every byte B rests and naming the record in its map, reads no name: its seat
 *       opens nothing. CONTROL: its own face's record stands at another address.
 */
import { afterEach, describe, expect, test } from "vitest";
import { selvesRecordOf, type LarDoc } from "@lararium/mesh";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, siblingChain } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FLEET_NEXUS, fleet } from "../../lararium-keyhive/tests/content-key-fleet.js";
import { drain, everyByte, islandOf, link, memoryAdapter, readWithin, spells, vessel } from "./sealed-crossing-fixture.js";
import { RECORD, bagMapOf, selvesOver, standPlane } from "./selves-record-fixture.js";

const NAME = "SEARCH-ME-the-otter-face";
afterEach(drain);

describe("W3 — the selves record crosses between two vessels of one face", () => {
  test("C1/C2 — B reads the name after its lift; another face opens nothing", async () => {
    const base = 0xc4;
    const { devices: [a, b] } = await fleet(base, ["vessel-a", "vessel-b"], {
      bags: [RECORD.bagId],
      chainFor: async (name, founder) => (founder ? siblingChain(founder, `${name}-${base}`) : chain(`${name}-${base}`, FLEET_NEXUS)),
    });
    const face = faceProofSubjectRef(a!.chain.scope);
    expect(faceProofSubjectRef(b!.chain.scope), "SETUP: both vessels wear one face").toBe(face);
    const [toB, toA] = link();
    const A = vessel("a", islandOf(a!), face, bagMapOf(face), { network: [toB] });
    const B = vessel("b", islandOf(b!), face, bagMapOf(face), { network: [toA] });
    const plane = await standPlane(A.repo);
    expect(await selvesOver(A.repo, plane.url, bagMapOf(face)).write(0, "petname", NAME)).toEqual({ written: true, plane: true });
    await A.settle();

    // C1: B READS IT, over its own Repo and its own map, its face lit.
    const planeOnB = await B.repo.find<LarDoc>(plane.url);
    expect(await selvesOver(B.repo, planeOnB.url, bagMapOf(face)).read()).toEqual([{ handleIndex: 0, petname: NAME }]);
    await B.settle();
    expect(B.resting.values.size, "B's seat sealed the record").toBeGreaterThan(0);
    expect(spells(await everyByte(B.resting), NAME), "a byte B rests spells the name").toBe(false);
    await A.repo.shutdown();
    await B.repo.shutdown();

    // C2: ANOTHER FACE, handed every byte B rests, its map naming the record under its own face, opens nothing.
    const { devices: [y] } = await fleet(0xe4, ["other-face"], { bags: [RECORD.bagId] });
    const otherFace = faceProofSubjectRef(y!.chain.scope);
    expect(otherFace).not.toBe(face);
    for (const [address, bytes] of b!.values) y!.values.set(address, Uint8Array.from(bytes));
    const inner = memoryAdapter();
    for (const [k, v] of B.inner.bytes) inner.bytes.set(k, Uint8Array.from(v));
    const stranger = vessel("stranger", islandOf(y!), otherFace, bagMapOf(otherFace), { inner });
    const read = await readWithin<LarDoc, string>(stranger.repo, RECORD.url as never, (doc) => JSON.stringify(doc ?? null), 4_000);
    expect(read?.includes(NAME) ?? false, "another face reads the name").toBe(false);
    expect(stranger.opens.length, "the stranger's store asked its seat to open").toBeGreaterThan(0);
    expect(stranger.opens.some((o) => o.ok), JSON.stringify(stranger.opens)).toBe(false);
    // CONTROL: another face's own record stands at another address, so no vessel of it ever names this one.
    expect(selvesRecordOf("e5".repeat(16)).url).not.toBe(RECORD.url);
  }, 120_000);
});
