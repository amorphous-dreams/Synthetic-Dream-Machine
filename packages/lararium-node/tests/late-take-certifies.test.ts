/**
 * late-take-certifies — a take's ward route that finds no hearth to dial still issues the founder's certificate it carries
 * (`standLateTake`, open-node-vessel.ts).
 *
 * The founder's certificate at a new scope reads the root, so it is a ward act (seat-harness#/the-ward, "the bound acts").
 * A lararium that takes its OWN admit at its OWN Nexus keeps a bundle naming no sync url: it dials no hearth there, so the
 * late dial stood nothing and the take's route went unspent. The carriage pull then presented at that Nexus with no route,
 * the certificate refused `ward-needs-fresh-unlock`, and the hearth dialed nothing (held-out run 42244363320, nexus cell:
 * "carriage: no presentation at nexus-… — this vessel dials nothing there").
 *
 * Proven:
 *   · RED: a take carrying a route, with no hearth to dial, certifies the kept Nexuses under that route, and dials nothing;
 *   · CONTROL: with a hearth to dial, the dial carries the route and the take certifies nothing beside it;
 *   · CONTROL: an ask with no route and no hearth certifies nothing and dials nothing; a stand that reads `live` false
 *     does neither.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { standLateTake } from "../src/open-node-vessel.js";
import { wardCredential, type WardCredential } from "../src/ward-credential.js";

const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");

function rig(syncUrl: string | null, live = true) {
  const dials: (WardCredential | undefined)[] = [];
  const certified: WardCredential[] = [];
  const stand = (ward?: WardCredential) => standLateTake({
    choose: () => ({ syncUrl }),
    live: () => live,
    dial: async (_choice, w) => { dials.push(w); },
    certify: async (w) => { certified.push(w); },
  }, ward);
  return { stand, dials, certified };
}

describe("a take's route with no hearth to dial", () => {
  test("RED: the route certifies the founder at the kept Nexuses, and nothing dials", async () => {
    const r = rig(null);
    const ward = wardCredential([{ kind: "passphrase", passphrase: "take-route" }]);
    await r.stand(ward);
    expect(r.certified).toEqual([ward]);
    expect(r.dials).toEqual([]);
  });

  test("CONTROL: with a hearth to dial, the dial carries the route and nothing certifies beside it", async () => {
    const r = rig("ws://hearth.synthetic:8080");
    const ward = wardCredential([{ kind: "passphrase", passphrase: "take-route" }]);
    await r.stand(ward);
    expect(r.dials).toEqual([ward]);
    expect(r.certified).toEqual([]);
  });

  test("CONTROL: no route and no hearth certifies nothing; a stand no longer live does nothing", async () => {
    const bare = rig(null);
    await bare.stand();
    expect(bare.certified).toEqual([]);
    expect(bare.dials).toEqual([]);
    const gone = rig(null, false);
    await gone.stand(wardCredential([{ kind: "passphrase", passphrase: "take-route" }]));
    expect(gone.certified).toEqual([]);
  });

  test("the vessel's late dial stands through this one helper", () => {
    expect(SRC).toMatch(/representIfMoved = lateDialOnce\(\{[\s\S]{0,200}standLateTake\(/);
  });
});
