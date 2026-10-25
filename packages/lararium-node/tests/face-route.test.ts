/**
 * The seam a new face asks its own route through, and the founding order it serves: custody before the first row, the
 * ask's rows moving under the group, the ask retiring from the floor index.
 */
import { readFileSync, existsSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { FaceRouteAbsent, ensureFaceCustodyOfAsk, ensureFaceCustodyOfGroup, seatFaceRoute, settleFaceCustody } from "../src/face-route.js";
import { faceAtomGroupFile, foundingAskDigest, keepAndRetireFoundingSeed, loadFaceAtomOfGroup, pendingFoundingFile, standPendingFoundingSeed, type FoundingAtomAsk } from "../src/face-atom-store.js";
import { faceIndexPath } from "../src/face-index.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { seatedCustody } from "../src/custody-seat.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const ask: FoundingAtomAsk = { hearthTrueName: "hearth-x", bindingMode: "self-stood", personaKelPrefix: null, mount: true, handleIndex: 0 };
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; seatFaceRoute(null); });

describe("a face founds under the route it asks for", () => {
  test("RED: with no route seated a founding refuses by name and writes no index, no tree, no row", async () => {
    seat = await seatScratchCustody("face-route");
    seatFaceRoute(null);
    await expect(standPendingFoundingSeed(ask)).rejects.toBeInstanceOf(FaceRouteAbsent);
    expect(existsSync(faceIndexPath(seat.homes.identity))).toBe(false);
    expect(existsSync(`${seat.homes.identity}/faces`)).toBe(false);
  });

  test("CONTROL: with a route seated the ask founds one face and a second ask of the same digest founds none", async () => {
    seat = await seatScratchCustody("face-route");
    seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: "face-h0" }] }]);
    const fcid = await ensureFaceCustodyOfAsk(foundingAskDigest(ask), "h0");
    expect(await ensureFaceCustodyOfAsk(foundingAskDigest(ask), "h0")).toBe(fcid);
    const index = JSON.parse(readFileSync(faceIndexPath(seat.homes.identity), "utf8")) as { faces: unknown[] };
    expect(index.faces).toHaveLength(1);
  });

  test("the ask's seed rests in the face, moves under the group, and the ask retires from the index", async () => {
    seat = await seatScratchCustody("face-route");
    seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: "face-h0" }] }]);
    const seed = await standPendingFoundingSeed(ask);
    const group = "group-order-test";
    await settleFaceCustody(foundingAskDigest(ask), group, () => keepAndRetireFoundingSeed(group, ask, seed));
    expect(await loadFaceAtomOfGroup(group)).toEqual(seed);
    const holder = seatedCustody()!;
    expect((await holder.readRow("identity", pendingFoundingFile(ask))).reading).toBe("absent");
    expect(await holder.faceStanding({ group: personaGroupDigest(group) })).toMatchObject({ ask: null, group: personaGroupDigest(group), unlocked: true });
    expect(faceAtomGroupFile(group)).toMatch(/^face-atom-g[0-9a-f]{64}\.bin$/);
    // the same settle again moves nothing and refuses nothing
    await settleFaceCustody(foundingAskDigest(ask), group, async () => { throw new Error("must not move twice"); });
  });

  test("a group's custody founds once for a joinee, under the route the face asks for", async () => {
    seat = await seatScratchCustody("face-route");
    seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: "face-b" }] }]);
    await ensureFaceCustodyOfGroup("group-joinee");
    await ensureFaceCustodyOfGroup("group-joinee");
    const index = JSON.parse(readFileSync(faceIndexPath(seat.homes.identity), "utf8")) as { faces: Array<{ group: string }> };
    expect(index.faces).toHaveLength(1);
    expect(index.faces[0]!.group).toBe(personaGroupDigest("group-joinee"));
  });
});
