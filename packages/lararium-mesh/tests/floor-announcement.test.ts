/**
 * floor-announcement — the floor's signed hint to its peers, read only against a pin the reader already holds.
 *
 * Proven here, each with its control:
 *   · the floor bundle signs one canonical body (version, Nexus, floor pin digest, standing, position) under
 *     `waking-floor-announce`, and the reader holding that same pin reads it back;
 *   · an announcement never authenticates its own first pin: a self-consistent announcement from another floor
 *     key refuses against the pin the reader holds, and the reader takes no announcement without a pin;
 *   · another Nexus, another tier, another route, a stale or equal position, a moved byte, a verdict signature
 *     and every malformed shape refuse by name;
 *   · the image is frozen against fixed bytes.
 */
import { describe, expect, test } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { DOMAIN_ROOT, GATE_VERDICT_DOMAIN, WAKING_FLOOR_ANNOUNCE_DOMAIN } from "../src/domains.js";
import {
  FLOOR_ANNOUNCEMENT_REFUSALS, FLOOR_ANNOUNCEMENT_VERSION, FLOOR_ANNOUNCE_ROUTE, FLOOR_STANDINGS,
  gateAnnouncementImage, readFloorAnnouncement, signFloorAnnouncement, type FloorAnnouncementBody,
} from "../src/floor-announcement.js";
import {
  GATE_SIGNING_PURPOSES, GateBundleRefused, custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute,
  gateBundleDigest, gateFields, sovereignGateRoot, sovereignRoute,
} from "../src/gate-bundle.js";

const floorDoor = (fill: number) => floorKeyDoor({ derive: () => new Uint8Array(32).fill(fill) });
const floorBundle = (nexus = "nexus-a.synthetic", fill = 19, path = FLOOR_ANNOUNCE_ROUTE) =>
  deriveGateBundle(floorGateRoot(floorDoor(fill)), utf8Bytes(nexus), floorRoute(path));
const refusalOf = (r: ReturnType<typeof readFloorAnnouncement>): string | null => ("refusal" in r ? r.refusal : null);

describe("the floor announcement", () => {
  test("the domain mints the house way and the gate's signing key signs under it", () => {
    expect(WAKING_FLOOR_ANNOUNCE_DOMAIN).toBe(`${DOMAIN_ROOT}/waking-floor-announce`);
    expect(GATE_SIGNING_PURPOSES).toContain(WAKING_FLOOR_ANNOUNCE_DOMAIN);
    expect(FLOOR_ANNOUNCE_ROUTE).toBe("/announce");
    expect(FLOOR_ANNOUNCEMENT_VERSION).toBe(1);
  });

  test("CONTROL: the floor signs, and the reader holding that pin reads the body back whole", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", position: 3 });
    expect(signed.body).toEqual({ version: 1, nexus: hex(utf8Bytes("nexus-a.synthetic")), floorPin: gateBundleDigest(b.pin), standing: "resting", position: 3 });
    const read = readFloorAnnouncement(JSON.parse(JSON.stringify(signed)), { pin: b.pin });
    expect(refusalOf(read)).toBeNull();
    expect("announcement" in read && read.announcement).toEqual(signed.body);
    expect("announcement" in read && Object.isFrozen(read.announcement)).toBe(true);
    // and past a held position
    expect(refusalOf(readFloorAnnouncement(signed, { pin: b.pin, after: 2 }))).toBeNull();
    for (const standing of FLOOR_STANDINGS) {
      expect(refusalOf(readFloorAnnouncement(await signFloorAnnouncement(b, { standing, position: 0 }), { pin: b.pin }))).toBeNull();
    }
  });

  test("the image is the registered domain over the body's fields, frozen", () => {
    const body: FloorAnnouncementBody = { version: 1, nexus: "6e", floorPin: "ab".repeat(32), standing: "raised", position: 258 };
    const image = gateAnnouncementImage(body);
    expect(hex(image)).toBe(hex(gateFields(
      WAKING_FLOOR_ANNOUNCE_DOMAIN, Uint8Array.of(1), hexToBytes("6e"), hexToBytes("ab".repeat(32)), utf8Bytes("raised"),
      Uint8Array.of(0, 0, 0, 0, 0, 0, 1, 2),
    )));
    expect(hex(image).slice(0, 8)).toBe(hex(Uint8Array.of(0, 0, 0, WAKING_FLOOR_ANNOUNCE_DOMAIN.length)));
  });

  test("RED: an announcement never authenticates its own first pin — another floor's self-consistent announcement refuses pin-other", async () => {
    const held = floorBundle("nexus-a.synthetic", 19);
    const stranger = floorBundle("nexus-a.synthetic", 23);
    const signed = await signFloorAnnouncement(stranger, { standing: "resting", position: 1 });
    expect(refusalOf(readFloorAnnouncement(signed, { pin: stranger.pin }))).toBeNull();          // CONTROL: it is sound against its own pin
    expect(refusalOf(readFloorAnnouncement(signed, { pin: held.pin }))).toBe("pin-other");
    // The same body with its pin digest rewritten to the held pin still carries the stranger's signature.
    const forged = { ...signed, body: { ...signed.body, floorPin: gateBundleDigest(held.pin) } };
    expect(refusalOf(readFloorAnnouncement(forged, { pin: held.pin }))).toBe("signature-refused");
  });

  test("RED: the reader takes no announcement without a held floor pin", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", position: 1 });
    for (const expectation of [undefined, {}, { pin: null }, { pin: { ...b.pin, extra: 1 } }, { pin: "pin" }]) {
      expect(refusalOf(readFloorAnnouncement(signed, expectation as never))).toBe("pin-unread");
    }
  });

  test("RED: cross-Nexus replay refuses nexus-other", async () => {
    const a = floorBundle("nexus-a.synthetic");
    const bOther = floorBundle("nexus-b.synthetic");
    const signed = await signFloorAnnouncement(a, { standing: "resting", position: 1 });
    expect(refusalOf(readFloorAnnouncement(signed, { pin: bOther.pin }))).toBe("nexus-other");
  });

  test("RED: a sovereign pin, or a floor pin on another route, refuses; a sovereign bundle signs no announcement", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", position: 1 });
    const sovereign = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(19) })), utf8Bytes("nexus-a.synthetic"), sovereignRoute(FLOOR_ANNOUNCE_ROUTE));
    expect(refusalOf(readFloorAnnouncement(signed, { pin: sovereign.pin }))).toBe("pin-other-tier");
    const shelf = floorBundle("nexus-a.synthetic", 19, "/shelf");
    expect(refusalOf(readFloorAnnouncement(signed, { pin: shelf.pin }))).toBe("pin-other-route");
    await expect(signFloorAnnouncement(sovereign, { standing: "resting", position: 1 })).rejects.toMatchObject({ refusal: "pin-other-tier" });
    await expect(signFloorAnnouncement(shelf, { standing: "resting", position: 1 })).rejects.toMatchObject({ refusal: "pin-other-route" });
  });

  test("RED: a position at or below the one held refuses position-stale; CONTROL: one past it reads", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "raised", position: 5 });
    expect(refusalOf(readFloorAnnouncement(signed, { pin: b.pin, after: 4 }))).toBeNull();
    expect(refusalOf(readFloorAnnouncement(signed, { pin: b.pin, after: 5 }))).toBe("position-stale");
    expect(refusalOf(readFloorAnnouncement(signed, { pin: b.pin, after: 9 }))).toBe("position-stale");
  });

  test("RED: a moved byte, a moved field, or a verdict signature over the same fields refuses signature-refused", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", position: 7 });
    for (const body of [{ ...signed.body, position: 8 }, { ...signed.body, standing: "raised" }]) {
      expect(refusalOf(readFloorAnnouncement({ ...signed, body }, { pin: b.pin }))).toBe("signature-refused");
    }
    const flipped = hexToBytes(signed.signature); flipped[0]! ^= 1;
    expect(refusalOf(readFloorAnnouncement({ ...signed, signature: hex(flipped) }, { pin: b.pin }))).toBe("signature-refused");
    // The same key over the same fields under the verdict's name: a verdict never reads as an announcement.
    const { body } = signed;
    const verdictSig = await b.sign(gateFields(
      GATE_VERDICT_DOMAIN, Uint8Array.of(body.version), hexToBytes(body.nexus), hexToBytes(body.floorPin), utf8Bytes(body.standing),
      Uint8Array.of(0, 0, 0, 0, 0, 0, 0, body.position),
    ));
    expect(refusalOf(readFloorAnnouncement({ ...signed, signature: hex(verdictSig) }, { pin: b.pin }))).toBe("signature-refused");
  });

  test("NONSENSE: every malformed shape refuses by name", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", position: 1 });
    const pin = b.pin;
    const at = (v: unknown) => refusalOf(readFloorAnnouncement(v, { pin }));
    for (const v of [null, 7, "x", [], {}, { body: signed.body }, { ...signed, extra: 1 }]) expect(at(v)).toBe("announcement-malformed");
    for (const body of [null, [], { ...signed.body, extra: 1 }, (({ position: _p, ...rest }) => rest)(signed.body)]) {
      expect(at({ ...signed, body })).toBe("announcement-malformed");
    }
    expect(at({ ...signed, body: { ...signed.body, version: 2 } })).toBe("version-unknown");
    expect(at({ ...signed, body: { ...signed.body, nexus: "XY" } })).toBe("nexus-malformed");
    expect(at({ ...signed, body: { ...signed.body, floorPin: "ab" } })).toBe("pin-malformed");
    expect(at({ ...signed, body: { ...signed.body, standing: "degraded" } })).toBe("standing-malformed");
    for (const position of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) expect(at({ ...signed, body: { ...signed.body, position } })).toBe("position-malformed");
    for (const signature of ["ab", "zz".repeat(64), 7]) expect(at({ ...signed, signature })).toBe("signature-refused");
    await expect(signFloorAnnouncement(b, { standing: "degraded" as never, position: 1 })).rejects.toMatchObject({ refusal: "standing-malformed" });
    await expect(signFloorAnnouncement(b, { standing: "resting", position: -1 })).rejects.toMatchObject({ refusal: "position-malformed" });
    expect(FLOOR_ANNOUNCEMENT_REFUSALS).toEqual([
      "pin-unread", "pin-other-tier", "pin-other-route", "announcement-malformed", "version-unknown", "nexus-malformed",
      "pin-malformed", "standing-malformed", "position-malformed", "nexus-other", "pin-other", "signature-refused", "position-stale",
    ]);
  });

  test("a dropped bundle signs no announcement", async () => {
    const b = floorBundle();
    b.drop();
    await expect(signFloorAnnouncement(b, { standing: "resting", position: 1 })).rejects.toBeInstanceOf(GateBundleRefused);
  });
});
