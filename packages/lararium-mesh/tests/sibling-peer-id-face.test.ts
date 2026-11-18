/**
 * sibling-peer-id-face.test — the sibling channel's peer id scopes to the FACE (the veil's second cut, road `C1`).
 *
 * A sibling stands under the repo peer id its proven device key derives. Derived from the key alone, one key's peer id
 * read the same under every face it proves, so a peer that met the key under two faces joined them by that id. The
 * derivation takes the face the channel proves under: the persona KEL's prefix, which both ends of a session hold and
 * every event of that KEL carries.
 *
 *   · RED: one device key under two faces derives two peer ids;
 *   · CONTROL: one device key under one face derives one peer id, whatever the key's letter case;
 *   · RED (live): a proven sibling stands under the id its key derives under THIS face, and under no id the key derives
 *     under another face.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect } from "vitest";
import type { PeerId } from "@automerge/automerge-repo";
import { siblingPeerIdOf } from "../src/sibling-channel.js";
import { SEEDS, founded, enrol, leafOf, memoryRelay, standLeaf, until, peersOf, shutdown } from "./fixtures/sibling-fleet.js";

/** The derivation as the cut hands it: a device key and the face (the persona KEL prefix) it proves under. */
const idOf = siblingPeerIdOf as (deviceKey: string, face: string) => PeerId;

const KEY = "ab".repeat(32);
const FACE_A = "persona-kel-prefix-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FACE_B = "persona-kel-prefix-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("the sibling channel's peer id scopes to the face", () => {
  test("RED: one device key under two faces derives two peer ids", () => {
    expect(idOf(KEY, FACE_B), "one key reads one peer id under two faces").not.toBe(idOf(KEY, FACE_A));
  });

  test("CONTROL: one device key under one face derives one peer id", () => {
    expect(idOf(KEY, FACE_A)).toBe(idOf(KEY, FACE_A));
    expect(idOf(KEY.toUpperCase(), FACE_A)).toBe(idOf(KEY, FACE_A));
    expect(idOf(KEY, FACE_A)).toMatch(/^sibling-[0-9a-f]{64}$/);
  });

  test("RED (live): a proven sibling stands under the id its key derives under this face alone", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair");
      expect(peersOf(x)).toEqual([idOf(y.self.deviceKey, inception.prefix)]);
      expect(peersOf(y)).toEqual([idOf(x.self.deviceKey, inception.prefix)]);
      expect(peersOf(x), "the sibling stands under an id its key derives under another face").not.toContain(idOf(y.self.deviceKey, FACE_B));
      expect(x.refusals).toEqual([]);
      expect(y.refusals).toEqual([]);
    } finally { await shutdown(x, y); }
  });
});
