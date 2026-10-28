/**
 * session-presents-the-lit-face — who a verb presents as (`presenterFor`).
 *
 * A session over the vessel's presence channel wears the face the island mounts; authority comes from the channel,
 * never from the unsigned `requestedBy`. Each control pins one way a claim could borrow more than the channel gives.
 */
import { describe, test, expect } from "vitest";
import { presenterFor } from "../src/operator-daemon-behavior.js";
import { faceOwnerVerifier } from "../src/face-bag-door.js";

const PLACE = "ab".repeat(32);
const ATOM = "cd".repeat(32);
const lit = { placeVerifyingKey: PLACE, atom: { seed: "00".repeat(32), key: ATOM }, personaGroupId: "group-x", deviceEdge: {} as never };
const floor = { placeVerifyingKey: PLACE };
const ask = (requestedBy: string, args: Record<string, unknown> = {}) => ({ requestedBy, args });

describe("presenterFor", () => {
  test("RED: a local verb naming the place presents as the lit face's atom", () => {
    expect(presenterFor({ invocation: ask(`0x${PLACE}`), local: true, auth: lit })).toBe(`0x${ATOM}`);
    expect(presenterFor({ invocation: ask(PLACE.toUpperCase()), local: true, auth: lit })).toBe(`0x${ATOM}`);
  });
  test("CONTROL: at the floor the place presents as itself", () => {
    expect(presenterFor({ invocation: ask(`0x${PLACE}`), local: true, auth: floor })).toBe(`0x${PLACE}`);
  });
  test("CONTROL: a claim naming any other DID stays that DID", () => {
    expect(presenterFor({ invocation: ask(`0x${"11".repeat(32)}`), local: true, auth: lit })).toBe(`0x${"11".repeat(32)}`);
  });
  test("CONTROL: a synced summons borrows nothing from the local channel", () => {
    expect(presenterFor({ invocation: ask(`0x${PLACE}`), local: false, auth: lit })).toBe(`0x${PLACE}`);
  });
  test("CONTROL: a verb naming another face refuses by name; the mounted face or none presents", () => {
    expect(() => presenterFor({ invocation: ask(`0x${PLACE}`, { personaGroup: "group-y" }), local: true, auth: lit }))
      .toThrow("this vessel wears group-x; name it or wear group-y first");
    expect(presenterFor({ invocation: ask(`0x${PLACE}`, { personaGroup: "group-x" }), local: true, auth: lit })).toBe(`0x${ATOM}`);
  });
});

describe("faceOwnerVerifier with one face provider", () => {
  const face = { verify: async ({ presenter }: { presenter: string }) => ({ ok: presenter === `0x${ATOM}` }) };
  const verifier = () => faceOwnerVerifier({ face: face as never, mount: { atomKey: ATOM, placeKey: PLACE } });
  test("RED: the public place key never receives a Keyhive grant", async () => {
    expect((await verifier().verify({ presenter: `0x${PLACE}`, bagUrl: "lar:///daemon", access: "admin", channel: "local" })).ok).toBe(false);
  });
  test("CONTROL: the selected atom receives its face grant", async () => {
    expect((await verifier().verify({ presenter: `0x${ATOM}`, bagUrl: "lar:///wikis/x", access: "read" })).ok).toBe(true);
  });
});
