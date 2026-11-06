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
 *   · RED (one ward answer, one act): the route certifies the TAKEN Nexus alone: a take at X beside a second own no-url
 *     bundle Y certifies X and never Y; a take naming no Nexus certifies nothing. CONTROL: X certifies.
 *   · RED: a teardown between the choice and the certificate stops the stand (`live` reads again before the await).
 *   · RED: the take's Nexus threads from the after-roll pass (its holder) through `lateDialOnce` into the stand.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { lateDialOnce, standLateTake } from "../src/open-node-vessel.js";
import { createAfterRoll } from "../src/after-roll-chain.js";
import { wardCredential, type WardCredential } from "../src/ward-credential.js";

const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
const X = "4e65787573582d61696420746865207461";
const Y = "4e65787573592d6f74686572206f776e00";

function rig(syncUrl: string | null, opts: { live?: () => boolean; kept?: ReadonlyArray<{ aid: string; syncUrl?: string }> } = {}) {
  const dials: (WardCredential | undefined)[] = [];
  const certified: Array<[string, WardCredential]> = [];
  const stand = (ward?: WardCredential, aid?: string) => standLateTake({
    choose: () => ({ syncUrl }),
    live: opts.live ?? (() => true),
    dial: async (_choice, w) => { dials.push(w); },
    kept: () => opts.kept ?? [{ aid: X }],
    certify: async (at, w) => { certified.push([at, w]); },
  }, ward, aid);
  return { stand, dials, certified };
}
const route = () => wardCredential([{ kind: "passphrase", passphrase: "take-route" }]);

describe("a take's route with no hearth to dial", () => {
  test("RED: the route certifies the founder at the taken Nexus, and nothing dials", async () => {
    const r = rig(null);
    const ward = route();
    await r.stand(ward, X);
    expect(r.certified).toEqual([[X, ward]]);
    expect(r.dials).toEqual([]);
  });

  test("CONTROL: with a hearth to dial, the dial carries the route and nothing certifies beside it", async () => {
    const r = rig("ws://hearth.synthetic:8080");
    const ward = route();
    await r.stand(ward, X);
    expect(r.dials).toEqual([ward]);
    expect(r.certified).toEqual([]);
  });

  test("CONTROL: no route and no hearth certifies nothing; a stand no longer live does nothing", async () => {
    const bare = rig(null);
    await bare.stand(undefined, X);
    expect(bare.certified).toEqual([]);
    expect(bare.dials).toEqual([]);
    const gone = rig(null, { live: () => false });
    await gone.stand(route(), X);
    expect(gone.certified).toEqual([]);
  });

  test("the vessel's late dial stands through this one helper", () => {
    expect(SRC).toMatch(/representIfMoved = lateDialOnce\(\{[\s\S]{0,200}standLateTake\(/);
  });
});

describe("one ward answer, one act: the route certifies the taken Nexus alone", () => {
  test("RED: a take at X beside a second own no-url bundle Y certifies X, never Y — CONTROL: X certifies", async () => {
    const r = rig(null, { kept: [{ aid: X }, { aid: Y }, { aid: "4e657875735a2d6469616c6564", syncUrl: "ws://hearth.synthetic:8080" }] });
    const ward = route();
    await r.stand(ward, X);
    expect(r.certified).toEqual([[X, ward]]);
  });

  test("RED: a route naming no Nexus certifies nothing; a Nexus no kept no-url bundle names certifies nothing", async () => {
    const none = rig(null, { kept: [{ aid: X }, { aid: Y }] });
    await none.stand(route());
    expect(none.certified).toEqual([]);
    const elsewhere = rig(null, { kept: [{ aid: Y, syncUrl: "ws://hearth.synthetic:8080" }] });
    await elsewhere.stand(route(), Y);
    expect(elsewhere.certified).toEqual([]);
  });

  test("RED: a teardown between the choice and the certificate stops the stand", async () => {
    let reads = 0;
    const r = rig(null, { live: () => ++reads === 1 });
    await r.stand(route(), X);
    expect(reads, "live reads again before the certificate's await").toBeGreaterThan(1);
    expect(r.certified).toEqual([]);
  });

  test("RED: the take's Nexus threads from the after-roll pass through the one flight into the stand", async () => {
    const stood: Array<[WardCredential | undefined, string | undefined]> = [];
    const ask = lateDialOnce({ standing: () => false, tornDown: () => false, stand: async (_live, w, aid) => { stood.push([w, aid]); } });
    const roll = createAfterRoll({ refoldAntigen: async () => {}, refoldMembership: async () => {}, reverdict: () => {}, log: () => {}, representIfMoved: (w, aid) => ask(w, aid) });
    const ward = route();
    await roll(X, ward);
    expect(stood).toEqual([[ward, X]]);
  });
});
