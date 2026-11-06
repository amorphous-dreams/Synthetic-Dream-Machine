/**
 * ward-key-pop-node — A NODE'S ADMISSION PROVES ITS WARD KEY (row 7, S3b; seat-harness#/the-swarm-slices).
 *
 * The tag door answers, beside the face's ward key, `wardPop`: the ward key's own signature over (group, device atom, ward key),
 * signed inside a fresh unlock of that face's ward on this vessel (opened from the act's own route, zeroed after). A door asked
 * with no route and no person at the terminal refuses `ward-needs-fresh-unlock` before it answers anything; a wrong route opens
 * no slot. The founding door holds the same law under the founding's own route.
 *
 * No suite person is seated here: a door that forgets its route reads red.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { ed25519VerifyingKeyFromSeed, wardKeyPopHolds } from "@lararium/mesh";
import { vesselFaceTagDoor } from "../src/vessel-face-tag-store.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { seatWardGatherer } from "../src/ward-credential.js";
import { fixtureWard, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const GROUP = "ward-key-pop-face";
let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("ward-key-pop"); seatWardGatherer(null); });
afterEach(async () => { await c.drop(); });

const codeOf = (p: Promise<unknown>): Promise<string | undefined> =>
  p.then(() => undefined, (e: { reading?: string; message: string }) => e.reading ?? /^[a-z-]+/.exec(e.message)?.[0] ?? e.message);

test("RED: the node's tag door answers a ward key it proves nothing of, and answers with no fresh unlock; CONTROL: under the face's own route its pop verifies under the key it names, and a wrong route opens no slot", async () => {
  await ensureFaceCustodyOfGroup(GROUP);
  const atom = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(61));
  expect(await codeOf((vesselFaceTagDoor as (w?: unknown) => ReturnType<typeof vesselFaceTagDoor>)()(GROUP, atom))).toBe("ward-needs-fresh-unlock");
  expect(await codeOf(vesselFaceTagDoor(fixtureWard("not the route"))(GROUP, atom))).toBe("ward-no-slot-opens");
  const fields = await vesselFaceTagDoor(fixtureWard())(GROUP, atom);
  expect(fields.wardKey).toMatch(/^[0-9a-f]{64}$/);
  expect(wardKeyPopHolds(GROUP, atom, fields)).toBe(true);
  // the nonsense control: the pop vouches for this atom in this face alone
  const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(62));
  expect(wardKeyPopHolds(GROUP, other, fields)).toBe(false);
  expect(wardKeyPopHolds("another-face", atom, fields)).toBe(false);
});
