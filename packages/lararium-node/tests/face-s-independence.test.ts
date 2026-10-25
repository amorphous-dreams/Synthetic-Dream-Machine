/**
 * K15 Wave D, slice 3: the node (S) tree and a face tree stand independent, even when ONE typed credential opens both. They
 * hold separate wrapped keys, separate KDF salts and separate slot ids. A rotation or unbind on one leaves the other opening.
 */
import { afterEach, describe, expect, test } from "vitest";
import { decodeSlotTree, type SlotSpec } from "@lararium/mesh";
import { rotateCustody, unlockCustody } from "../src/custody-session.js";
import { bindFaceSlot, unbindFaceSlot } from "../src/face-slot-ops.js";
import { openFaceTree } from "../src/face-custody.js";
import { faceTreePath } from "../src/face-index.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

async function sharedRoute() {
  seat = await seatScratchCustody("independence");
  const { holder, homes, io } = seat;
  const { fcid } = await holder.foundFace({ group: "1".repeat(64), slots: [slot(FIXTURE_PASSPHRASE)] });
  const sOpens = async (pw: string) => (await unlockCustody({ io, homes, credentials: cred(pw) })).reading === "opens";
  const faceOpens = async (pw: string) => (await openFaceTree({ io, homes, fcid, credentials: cred(pw) })).reading === "opens";
  return { seat, fcid, sOpens, faceOpens };
}

describe("the S tree and a face tree stand independent under one typed route", () => {
  test("CONTROL: one credential opens both trees, and they share no wrapped key, salt or slot id", async () => {
    const v = await sharedRoute();
    expect(await v.sOpens(FIXTURE_PASSPHRASE)).toBe(true);
    expect(await v.faceOpens(FIXTURE_PASSPHRASE)).toBe(true);
    const s = decodeSlotTree(await v.seat.io.read(`${v.seat.homes.identity}/s-slots.bin`));
    const f = decodeSlotTree(await v.seat.io.read(faceTreePath(v.seat.homes.identity, v.fcid)));
    expect(s.reading === "readable" && f.reading === "readable").toBe(true);
    if (s.reading !== "readable" || f.reading !== "readable") return;
    const ids = new Set(s.tree.slots.map((x) => x.id));
    expect(f.tree.slots.some((x) => ids.has(x.id))).toBe(false);
    expect(JSON.stringify(s.tree)).not.toContain(JSON.stringify(f.tree.slots[0]));
  });

  test("RED: a rotation on the face tree (unbind the shared route, keep another) leaves the S tree opening", async () => {
    const v = await sharedRoute();
    const opened = await openFaceTree({ io: v.seat.io, homes: v.seat.homes, fcid: v.fcid, credentials: cred(FIXTURE_PASSPHRASE) });
    if (opened.reading !== "opens") throw new Error("face tree did not open");
    const bound = await bindFaceSlot({ io: v.seat.io, homes: v.seat.homes, fcid: v.fcid, fck: opened.fck, spec: slot("a-face-only-route") });
    const gone = bound.tree.slots.find((x) => x.id !== bound.slotId)!;
    const out = await unbindFaceSlot({ io: v.seat.io, homes: v.seat.homes, fcid: v.fcid, fck: opened.fck, slotId: gone.id, rotate: [slot("a-face-only-route")] });
    expect(out.rotated).toBe(true);
    expect(await v.faceOpens(FIXTURE_PASSPHRASE)).toBe(false);
    expect(await v.faceOpens("a-face-only-route")).toBe(true);
    expect(await v.sOpens(FIXTURE_PASSPHRASE)).toBe(true);                       // the S tree stands
  });

  test("RED: a rotation on the S tree leaves the face tree opening under the old route", async () => {
    const v = await sharedRoute();
    await rotateCustody({ io: v.seat.io, homes: v.seat.homes, oldVk: v.seat.vk, slots: [slot("an-s-only-route")] });
    expect(await v.sOpens(FIXTURE_PASSPHRASE)).toBe(false);
    expect(await v.sOpens("an-s-only-route")).toBe(true);
    expect(await v.faceOpens(FIXTURE_PASSPHRASE)).toBe(true);                    // the face tree stands
  });
});
