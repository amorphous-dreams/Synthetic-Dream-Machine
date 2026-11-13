/**
 * floor-announcement — the floor's signed hint to its peers, read only against a pin the reader already holds.
 *
 * Proven here, each with its control:
 *   · the floor bundle signs one canonical body (kind, Nexus, floor pin digest, standing, prior link) under
 *     `waking-floor-announce`, and the reader holding that same pin reads it back;
 *   · an announcement never authenticates its own first pin: a self-consistent announcement from another floor
 *     key refuses against the pin the reader holds, and the reader takes no announcement without a pin;
 *   · another Nexus, another tier, another route, the held announcement again or one linked elsewhere, a moved byte, a verdict signature
 *     and every malformed shape refuse by name;
 *   · the image is frozen against fixed bytes.
 */
import { describe, expect, test } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { DOMAIN_ROOT, GATE_VERDICT_DOMAIN, WAKING_FLOOR_ANNOUNCE_DOMAIN } from "../src/domains.js";
import {
  FLOOR_ANNOUNCEMENT_KIND, FLOOR_ANNOUNCEMENT_REFUSALS, FLOOR_ANNOUNCE_ROUTE, FLOOR_STANDINGS,
  floorAnnouncementDigest, foldFloorAnnouncements, gateAnnouncementImage, readFloorAnnouncement, signFloorAnnouncement, type FloorAnnouncementBody,
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
    expect(FLOOR_ANNOUNCEMENT_KIND).toBe("floor-announcement");
  });

  test("CONTROL: the floor signs, and the reader holding that pin reads the body back whole", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    expect(signed.body).toEqual({ kind: "floor-announcement", nexus: hex(utf8Bytes("nexus-a.synthetic")), floorPin: gateBundleDigest(b.pin), standing: "resting", prior: null });
    const read = readFloorAnnouncement(JSON.parse(JSON.stringify(signed)), { pin: b.pin });
    expect(refusalOf(read)).toBeNull();
    expect("announcement" in read && read.announcement).toEqual(signed.body);
    expect("announcement" in read && Object.isFrozen(read.announcement)).toBe(true);
    // and as the successor of the one held: the next announcement names the held one's digest as its prior
    const next = await signFloorAnnouncement(b, { standing: "raised", prior: floorAnnouncementDigest(signed.body) });
    expect(refusalOf(readFloorAnnouncement(next, { pin: b.pin, held: floorAnnouncementDigest(signed.body) }))).toBeNull();
    for (const standing of FLOOR_STANDINGS) {
      expect(refusalOf(readFloorAnnouncement(await signFloorAnnouncement(b, { standing, prior: null }), { pin: b.pin }))).toBeNull();
    }
  });

  test("the image is the registered domain over the body's fields, frozen", () => {
    const body: FloorAnnouncementBody = { kind: "floor-announcement", nexus: "6e", floorPin: "ab".repeat(32), standing: "raised", prior: "cd".repeat(32) };
    const image = gateAnnouncementImage(body);
    expect(hex(image)).toBe(hex(gateFields(
      WAKING_FLOOR_ANNOUNCE_DOMAIN, utf8Bytes("floor-announcement"), hexToBytes("6e"), hexToBytes("ab".repeat(32)), utf8Bytes("raised"),
      hexToBytes("cd".repeat(32)),
    )));
    expect(hex(image).slice(0, 8)).toBe(hex(Uint8Array.of(0, 0, 0, WAKING_FLOOR_ANNOUNCE_DOMAIN.length)));
    // The first announcement links nothing: its prior field frames empty, apart from every 32-byte link.
    expect(hex(gateAnnouncementImage({ ...body, prior: null }))).toBe(hex(gateFields(
      WAKING_FLOOR_ANNOUNCE_DOMAIN, utf8Bytes("floor-announcement"), hexToBytes("6e"), hexToBytes("ab".repeat(32)), utf8Bytes("raised"),
      new Uint8Array(0),
    )));
    expect(floorAnnouncementDigest(body)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("RED: an announcement never authenticates its own first pin — another floor's self-consistent announcement refuses pin-other", async () => {
    const held = floorBundle("nexus-a.synthetic", 19);
    const stranger = floorBundle("nexus-a.synthetic", 23);
    const signed = await signFloorAnnouncement(stranger, { standing: "resting", prior: null });
    expect(refusalOf(readFloorAnnouncement(signed, { pin: stranger.pin }))).toBeNull();          // CONTROL: it is sound against its own pin
    expect(refusalOf(readFloorAnnouncement(signed, { pin: held.pin }))).toBe("pin-other");
    // The same body with its pin digest rewritten to the held pin still carries the stranger's signature.
    const forged = { ...signed, body: { ...signed.body, floorPin: gateBundleDigest(held.pin) } };
    expect(refusalOf(readFloorAnnouncement(forged, { pin: held.pin }))).toBe("signature-refused");
  });

  test("RED: the reader takes no announcement without a held floor pin", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    for (const expectation of [undefined, {}, { pin: null }, { pin: { ...b.pin, extra: 1 } }, { pin: "pin" }]) {
      expect(refusalOf(readFloorAnnouncement(signed, expectation as never))).toBe("pin-unread");
    }
  });

  test("RED: cross-Nexus replay refuses nexus-other", async () => {
    const a = floorBundle("nexus-a.synthetic");
    const bOther = floorBundle("nexus-b.synthetic");
    const signed = await signFloorAnnouncement(a, { standing: "resting", prior: null });
    expect(refusalOf(readFloorAnnouncement(signed, { pin: bOther.pin }))).toBe("nexus-other");
  });

  test("RED: a sovereign pin, or a floor pin on another route, refuses; a sovereign bundle signs no announcement", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const sovereign = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(19) })), utf8Bytes("nexus-a.synthetic"), sovereignRoute(FLOOR_ANNOUNCE_ROUTE));
    expect(refusalOf(readFloorAnnouncement(signed, { pin: sovereign.pin }))).toBe("pin-other-tier");
    const shelf = floorBundle("nexus-a.synthetic", 19, "/shelf");
    expect(refusalOf(readFloorAnnouncement(signed, { pin: shelf.pin }))).toBe("pin-other-route");
    await expect(signFloorAnnouncement(sovereign, { standing: "resting", prior: null })).rejects.toMatchObject({ refusal: "pin-other-tier" });
    await expect(signFloorAnnouncement(shelf, { standing: "resting", prior: null })).rejects.toMatchObject({ refusal: "pin-other-route" });
  });

  test("ORDER RIDES THE CAUSAL LINK: the held one again refuses announcement-held, one linked elsewhere prior-unlinked; CONTROL: its successor reads", async () => {
    const b = floorBundle();
    const first = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const held = floorAnnouncementDigest(first.body);
    const second = await signFloorAnnouncement(b, { standing: "raised", prior: held });
    const third = await signFloorAnnouncement(b, { standing: "resting", prior: floorAnnouncementDigest(second.body) });
    expect(refusalOf(readFloorAnnouncement(second, { pin: b.pin, held }))).toBeNull();
    expect(refusalOf(readFloorAnnouncement(first, { pin: b.pin, held }))).toBe("announcement-held");
    // A replay of the first, or a later one that skips the link, names no link to the held announcement.
    expect(refusalOf(readFloorAnnouncement(first, { pin: b.pin, held: floorAnnouncementDigest(second.body) }))).toBe("prior-unlinked");
    expect(refusalOf(readFloorAnnouncement(third, { pin: b.pin, held }))).toBe("prior-unlinked");
    expect(() => readFloorAnnouncement(second, { pin: b.pin, held: "1" })).toThrow(RangeError);
  });

  test("RED: a moved byte, a moved field, or a verdict signature over the same fields refuses signature-refused", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", prior: "ef".repeat(32) });
    for (const body of [{ ...signed.body, prior: "ee".repeat(32) }, { ...signed.body, prior: null }, { ...signed.body, standing: "raised" }]) {
      expect(refusalOf(readFloorAnnouncement({ ...signed, body }, { pin: b.pin }))).toBe("signature-refused");
    }
    const flipped = hexToBytes(signed.signature); flipped[0]! ^= 1;
    expect(refusalOf(readFloorAnnouncement({ ...signed, signature: hex(flipped) }, { pin: b.pin }))).toBe("signature-refused");
    // The same key over the same fields under the verdict's name: a verdict never reads as an announcement.
    const { body } = signed;
    const verdictSig = await b.sign(gateFields(
      GATE_VERDICT_DOMAIN, utf8Bytes(body.kind), hexToBytes(body.nexus), hexToBytes(body.floorPin), utf8Bytes(body.standing),
      hexToBytes(body.prior!),
    ));
    expect(refusalOf(readFloorAnnouncement({ ...signed, signature: hex(verdictSig) }, { pin: b.pin }))).toBe("signature-refused");
  });

  test("NONSENSE: every malformed shape refuses by name", async () => {
    const b = floorBundle();
    const signed = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const pin = b.pin;
    const at = (v: unknown) => refusalOf(readFloorAnnouncement(v, { pin }));
    for (const v of [null, 7, "x", [], {}, { body: signed.body }, { ...signed, extra: 1 }]) expect(at(v)).toBe("announcement-malformed");
    for (const body of [null, [], { ...signed.body, extra: 1 }, (({ prior: _p, ...rest }) => rest)(signed.body)]) {
      expect(at({ ...signed, body })).toBe("announcement-malformed");
    }
    expect(at({ ...signed, body: { ...signed.body, kind: "floor-verdict" } })).toBe("kind-other");
    // A body that counts a version and a position in place of a kind and a link lacks the shape: it reads as no announcement.
    const counted = (({ kind: _k, prior: _p, ...rest }) => ({ ...rest, version: 1, position: 1 }))(signed.body);
    expect(at({ ...signed, body: counted })).toBe("announcement-malformed");
    expect(at({ ...signed, body: { ...signed.body, nexus: "XY" } })).toBe("nexus-malformed");
    expect(at({ ...signed, body: { ...signed.body, floorPin: "ab" } })).toBe("pin-malformed");
    expect(at({ ...signed, body: { ...signed.body, standing: "degraded" } })).toBe("standing-malformed");
    for (const prior of [-1, 7, "ab", "AB".repeat(32), ""]) expect(at({ ...signed, body: { ...signed.body, prior } })).toBe("prior-malformed");
    for (const signature of ["ab", "zz".repeat(64), 7]) expect(at({ ...signed, signature })).toBe("signature-refused");
    await expect(signFloorAnnouncement(b, { standing: "degraded" as never, prior: null })).rejects.toMatchObject({ refusal: "standing-malformed" });
    await expect(signFloorAnnouncement(b, { standing: "resting", prior: "ab" })).rejects.toMatchObject({ refusal: "prior-malformed" });
    expect(FLOOR_ANNOUNCEMENT_REFUSALS).toEqual([
      "pin-unread", "pin-other-tier", "pin-other-route", "announcement-malformed", "kind-other", "nexus-malformed",
      "pin-malformed", "standing-malformed", "prior-malformed", "nexus-other", "pin-other", "signature-refused",
      "announcement-held", "prior-unlinked",
    ]);
  });

  test("a dropped bundle signs no announcement", async () => {
    const b = floorBundle();
    b.drop();
    await expect(signFloorAnnouncement(b, { standing: "resting", prior: null })).rejects.toBeInstanceOf(GateBundleRefused);
  });
});

describe("the fold: announcements ordered by their links alone", () => {
  test("a line reads its head and its order, oldest first, whatever order the values arrive in", async () => {
    const b = floorBundle();
    const a1 = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const a2 = await signFloorAnnouncement(b, { standing: "raised", prior: floorAnnouncementDigest(a1.body) });
    const a3 = await signFloorAnnouncement(b, { standing: "resting", prior: floorAnnouncementDigest(a2.body) });
    const folded = foldFloorAnnouncements([a3, a1, a2, a2], { pin: b.pin });
    expect(folded).toMatchObject({ standing: "linear", head: floorAnnouncementDigest(a3.body) });
    expect(folded.standing === "linear" && folded.order).toEqual([a1, a2, a3].map((a) => floorAnnouncementDigest(a.body)));
    expect(folded.setAside).toEqual([]);
  });

  test("RED: two announcements on one prior read FORKED, both heads named; recency never settles it", async () => {
    const b = floorBundle();
    const a1 = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const left = await signFloorAnnouncement(b, { standing: "raised", prior: floorAnnouncementDigest(a1.body) });
    const right = await signFloorAnnouncement(b, { standing: "resting", prior: floorAnnouncementDigest(a1.body) });
    const heads = [left, right].map((a) => floorAnnouncementDigest(a.body)).sort();
    expect(foldFloorAnnouncements([a1, left, right], { pin: b.pin })).toMatchObject({ standing: "forked", heads });
    expect(foldFloorAnnouncements([right, a1, left], { pin: b.pin })).toMatchObject({ standing: "forked", heads });
  });

  test("an announcement whose prior reaches neither the opening nor the held one sets aside as prior-unseen; a foreign floor's sets aside by its refusal", async () => {
    const b = floorBundle();
    const a1 = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const orphan = await signFloorAnnouncement(b, { standing: "raised", prior: "ef".repeat(32) });
    const foreign = await signFloorAnnouncement(floorBundle("nexus-a.synthetic", 23), { standing: "resting", prior: null });
    const folded = foldFloorAnnouncements([a1, orphan, foreign], { pin: b.pin });
    expect(folded).toMatchObject({ standing: "linear", head: floorAnnouncementDigest(a1.body) });
    expect(folded.setAside).toEqual(expect.arrayContaining([{ index: 1, refusal: "prior-unseen" }, { index: 2, refusal: "pin-other" }]));
  });

  test("from a held announcement, only its successors count; with none read the fold reads absent", async () => {
    const b = floorBundle();
    const a1 = await signFloorAnnouncement(b, { standing: "resting", prior: null });
    const a2 = await signFloorAnnouncement(b, { standing: "raised", prior: floorAnnouncementDigest(a1.body) });
    const held = floorAnnouncementDigest(a1.body);
    expect(foldFloorAnnouncements([a1, a2], { pin: b.pin, held })).toMatchObject({ standing: "linear", head: floorAnnouncementDigest(a2.body), order: [floorAnnouncementDigest(a2.body)] });
    expect(foldFloorAnnouncements([a1], { pin: b.pin, held })).toMatchObject({ standing: "absent" });
  });
});
