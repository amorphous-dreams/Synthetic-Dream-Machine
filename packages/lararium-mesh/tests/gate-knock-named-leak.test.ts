/**
 * gate-knock-named-leak — the knock's offline test, pinned AS NAMED (lar:///ha.ka.ba/lares/api/pono/face-proof#/named-leaks,
 * the reading at lar:///ha.ka.ba/lares/docs/pono/w28-gate-lane#/the-knock-reading).
 *
 * The leak stands named, so a silent change to the knock reads red here:
 *   · a reader holding the candidate sovereign pins of K gates behind one address and route maps an observed path to
 *     its Nexus offline: at most log2(K) bits per dial;
 *   · with ONE gate on the address and route the candidate set holds one gate, and the knock adds no selector beyond
 *     the route (CONTROL, the known positive of the mapping instrument);
 *   · the knock is a per-gate value: sibling faces of one vessel dialing one Nexus produce the same path, so it
 *     carries no face tag (`gateKnock` reads a pin alone);
 *   · a floor pin maps its public floor route (control);
 *   · an unknown path and a flight that decrypts under no bundle draw no 101: `face-gate-server.test.ts` ("RED: an
 *     unknown path stays unclaimed, and a knock path with no flight or a forged one dies before any 101").
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, test } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import {
  custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, gateKnock, sovereignGateRoot, sovereignRoute,
  type GateBundlePin, type GateRootDoor,
} from "../src/gate-bundle.js";

const doorOf = (fill: number): GateRootDoor => {
  const bytes = new Uint8Array(32).fill(fill);
  return { derive: (domain) => hkdf(sha256, bytes, new Uint8Array(0), utf8Bytes(domain), 32) };
};
const sovereign = (fill: number, nexus: string, route = "/ws") =>
  deriveGateBundle(sovereignGateRoot(custodyRootDoor(doorOf(fill))), utf8Bytes(nexus), sovereignRoute(route));

/** What a reader holding candidate pins does with an observed path: the Nexus indices whose gate stands there. */
const mapPath = (observed: string, candidates: readonly GateBundlePin[]): number[] =>
  candidates.flatMap((pin, at) => (observed === `${pin.route}/${gateKnock(pin)}` ? [at] : []));

describe("the knock stands as the named leak", () => {
  test("a reader holding two candidate sovereign pins on one /ws maps an observed path to its Nexus offline", () => {
    const a = sovereign(1, "nexus-a.synthetic");
    const b = sovereign(1, "nexus-b.synthetic");
    const candidates = [a.pin, b.pin];
    expect(mapPath(`/ws/${a.knock}`, candidates)).toEqual([0]);
    expect(mapPath(`/ws/${b.knock}`, candidates)).toEqual([1]);
    // CONTROL: a path no candidate stands maps to none, and a reader holding only the wrong pin maps nothing.
    expect(mapPath(`/ws/${"0".repeat(32)}`, candidates)).toEqual([]);
    expect(mapPath(`/ws/${a.knock}`, [b.pin])).toEqual([]);
  });

  test("KNOWN POSITIVE: one sovereign gate on the address and route leaves a candidate set of one", () => {
    const a = sovereign(2, "nexus-a.synthetic");
    const candidates = [a.pin];
    expect(candidates.length).toBe(1);                              // log2(1) = 0 bits
    expect(mapPath(`/ws/${a.knock}`, candidates)).toEqual([0]);
    expect(mapPath(`/ws/${a.knock}`, [])).toEqual([]);              // the instrument reads none where no candidate stands
  });

  test("sibling faces of one vessel dialing one Nexus produce the same knock: it carries no face tag", () => {
    expect(gateKnock.length).toBe(1);                               // a pin alone: no face, session or key rides it
    const first = sovereign(3, "nexus-a.synthetic");
    const second = sovereign(3, "nexus-a.synthetic");
    expect(second.knock).toBe(first.knock);
    expect(gateKnock(first.pin)).toBe(first.knock);
    // CONTROL: another vessel's root, or another Nexus, moves it.
    expect(sovereign(4, "nexus-a.synthetic").knock).not.toBe(first.knock);
    expect(sovereign(3, "nexus-b.synthetic").knock).not.toBe(first.knock);
  });

  test("a floor pin maps its public floor route (control)", () => {
    const floor = deriveGateBundle(floorGateRoot(floorKeyDoor(doorOf(5))), utf8Bytes("nexus-a.synthetic"), floorRoute("/floor"));
    expect(mapPath(`/floor/${floor.knock}`, [floor.pin])).toEqual([0]);
    expect(floor.pin.route).toBe("/floor");
    expect(mapPath(`/ws/${floor.knock}`, [floor.pin])).toEqual([]);
  });
});
