/**
 * K15 Wave D, slice 2: the address secret, the pending join and the join record of a face rest in that face, named by its group's
 * digest. A sibling's key opens none of them.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { FaceLocked } from "../src/custody-holder.js";
import { faceAddressSecretFile, faceJoinRecordFile, fleetJoinPendingFile, mintFaceAddressSecret, readFaceAddressSecret } from "../src/fleet-join-custody.js";
import { faceDir } from "../src/face-index.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const A = "aa".repeat(16), B = "bb".repeat(16);
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

describe("a face's join rows rest in that face", () => {
  test("RED: B's address secret refuses to open or mint while B rests locked; CONTROL: A's own opens and rests in A's directory", async () => {
    seat = await seatScratchCustody("join-rows");
    const a = await ensureFaceCustodyOfGroup(A);
    const b = await ensureFaceCustodyOfGroup(B);
    await mintFaceAddressSecret(B);
    await mintFaceAddressSecret(A);
    await seat.holder.lockFace(b.fcid);
    await expect(readFaceAddressSecret(B)).rejects.toBeInstanceOf(FaceLocked);
    await expect(mintFaceAddressSecret(B)).rejects.toBeInstanceOf(FaceLocked);
    const own = await readFaceAddressSecret(A);
    expect(own).toHaveLength(32);
    expect(existsSync(join(faceDir(seat.homes.identity, a.fcid), faceAddressSecretFile(A)))).toBe(true);
    expect(existsSync(join(seat.homes.identity, faceAddressSecretFile(A)))).toBe(false);
    expect(faceAddressSecretFile(A)).toContain(personaGroupDigest(A));
    expect(fleetJoinPendingFile(A)).toContain(personaGroupDigest(A));
    expect(faceJoinRecordFile(A)).toContain(personaGroupDigest(A));
  });
});
