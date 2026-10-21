/**
 * kahu-reach-verifier — the verify-then-delegate gate carries the Kahu predicate. A verb routed into a wiki island
 * (`lares act --in-wiki`) clears its cap at the keyholder island before main delegates it, and the wiki island then
 * answers by worker trust, so the daemon's verifier is the one place that door can ask the cabal.
 *
 * Proven: an `admin` ask on a system canon bag draws `kahu-reach` from a stranger and from a vessel that composed no
 * source (fail closed), and reaches the inner verifier for a Kahu hand. CONTROLS: a `read` ask on canon and an `admin`
 * ask on a user bag never consult the source.
 */
import { describe, test, expect } from "vitest";
import { BAG_IDS, bagUri, type CapabilityVerifier } from "@lararium/mesh";
import { withKahuReach } from "../src/kahu-reach-source.js";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";

const inner: CapabilityVerifier = { verify: async () => ({ ok: true, reason: "inner" }) };
const ask = (gate: CapabilityVerifier, bagUrl: string, access: "read" | "admin") => gate.verify({ presenter: "did:key:z", bagUrl, access });

describe("the cap verifier carries the Kahu predicate", () => {
  test.each([BAG_IDS.lares, BAG_IDS.lararium])("admin on %s: a stranger and a missing source refuse; a Kahu hand reaches the inner verifier", async (bag) => {
    const stranger = withKahuReach(inner, await strangerHand("admitted-not-joined"));
    expect(await ask(stranger, bag, "admin")).toMatchObject({ ok: false, reason: expect.stringContaining("kahu-reach") });
    expect(await ask(withKahuReach(inner, undefined), bag, "admin")).toMatchObject({ ok: false });
    expect(await ask(withKahuReach(inner, await kahuHand()), bag, "admin")).toEqual({ ok: true, reason: "inner" });
  });

  test("CONTROLS: a read on canon and an admin on a user bag never consult the source", async () => {
    const closed = withKahuReach(inner, undefined);
    expect(await ask(closed, BAG_IDS.lares, "read")).toEqual({ ok: true, reason: "inner" });
    expect(await ask(closed, bagUri("garden"), "admin")).toEqual({ ok: true, reason: "inner" });
  });
});
