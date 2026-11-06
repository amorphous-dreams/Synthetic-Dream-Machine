/**
 * admit-take-ward-in-flight — a take whose route meets a wardless late dial in flight answers the refusal BY NAME.
 *
 * `lateDialOnce` refuses `ward-dial-in-flight` when a take carrying a route joins a dial that stands in flight with none
 * (that dial cannot issue the founder's certificate the take's route would). The after-roll chain carries that refusal to
 * the take's own answer as `reason`, still failing closed: `represented` reads false, and the take never rides the
 * wardless dial. The composition here stands the real door row, the real chain and the real flight.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/admit-bundle.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/admit-bundle.js")>();
  return {
    ...actual,
    takeAdmitBundle: vi.fn(async () => ({
      aid: "a".repeat(64), nym: "n".repeat(64), admitCid: "c".repeat(64), gatePubKey: "g".repeat(64),
      lineage: 1, path: "/tmp/fake-admit.json",
    })),
  };
});

import { storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";
import { createAfterRoll } from "../src/after-roll-chain.js";
import { lateDialOnce } from "../src/open-node-vessel.js";
import { parkWardTicket, wardCredential, type WardCredential } from "../src/ward-credential.js";

function compose() {
  let release: () => void = () => {};
  const carried: (WardCredential | undefined)[] = [];
  let standing = false;
  const dial = lateDialOnce({ standing: () => standing, tornDown: () => false, stand: async (_live, ward) => {
    carried.push(ward);
    if (ward === undefined) await new Promise<void>((r) => { release = r; });
    standing = true;
  } });
  const roll = createAfterRoll({
    refoldAntigen: async () => {}, refoldMembership: async () => {}, reverdict: () => {},
    representIfMoved: (ward) => dial(ward), log: () => {},
  });
  const deps: StoreDoorDeps = { storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal", repo: {} as StoreDoorDeps["repo"], onRolled: roll };
  const rows = storeDoorReactors(deps);
  const take = async () => {
    const args = { raw: "{}" };
    const wardRef = parkWardTicket(wardCredential([{ kind: "passphrase", passphrase: "route" }]), { verb: "nexus-admit-take", args });
    return rows["nexus-admit-take"]({ ...args, wardRef }, {} as never);
  };
  return { dial, take, carried, release: () => release() };
}

describe("nexus-admit-take meets a wardless dial in flight", () => {
  it("RED: the take's answer names `ward-dial-in-flight`, represented stays false, and no route reaches the wardless dial", async () => {
    const c = compose();
    const flight = c.dial();                       // a board change stands the late dial with no route
    const out = await c.take();
    expect(out["represented"]).toBe(false);
    expect(out["reason"]).toBe("ward-dial-in-flight");
    expect(c.carried).toEqual([undefined]);        // fails closed: the take's route never joined the wardless flight
    c.release(); await flight;
  });

  it("CONTROL: a take with no flight in progress answers as before (represented, no reason), its route carried to the stand", async () => {
    const c = compose();
    const out = await c.take();
    expect(out["represented"]).toBe(true);
    expect(out).not.toHaveProperty("reason");
    expect(c.carried).toHaveLength(1);
    expect(c.carried[0]).toBeDefined();
  });
});
