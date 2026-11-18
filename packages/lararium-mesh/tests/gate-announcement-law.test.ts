/** The floor's announcement must be signed by the same pin a dial checks. */
import { describe, expect, test } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { GATE_VERDICT_DOMAIN, WAKING_FLOOR_ANNOUNCE_DOMAIN } from "../src/domains.js";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, gateFields, readGateSignature } from "../src/gate-bundle.js";

const bundle = () => deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(19) })), utf8Bytes("announcement-nexus"), floorRoute("/announce"));

describe("the floor announcement and gate pin", () => {
  test("CONTROL: the floor signing key signs and verifies its registered verdict purpose", async () => {
    const b = bundle();
    const image = gateFields(GATE_VERDICT_DOMAIN, utf8Bytes("pin-control"));
    const signature = await b.sign(image);
    expect(readGateSignature(b.pin, image, signature)).toBe(true);
  });

  test("ANNOUNCEMENT_AND_GATE_SHARE_PIN: the floor signs an announcement under its published pin", async () => {
    const b = bundle();
    const image = gateFields(WAKING_FLOOR_ANNOUNCE_DOMAIN, utf8Bytes("same-nexus-and-pin"));
    const signature = await b.sign(image);
    expect(readGateSignature(b.pin, image, signature)).toBe(true);
  });
});
