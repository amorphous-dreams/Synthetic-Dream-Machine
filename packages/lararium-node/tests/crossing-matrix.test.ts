/**
 * THE CROSSING MATRIX, IN-PROCESS — the four roles of `tools/crossing-witness.sh` run against a live sealed gate on
 * loopback, so the probes' logic (`probes/crossing-roles.ts`) is witnessed without a container. Held-out CI runs the same
 * roles across a real container boundary; this suite is what a change reads red on first.
 *
 *   admitted    crosses, reads the seeded doc, writes back and the daemon sees the reply.
 *   anon        a gate that admits nobody turns the same face away.
 *   impostor    the admitted face's certificate and admit under ANOTHER face's session signer: refused.
 *   wrong-bind  an audience the gate did not arm: refused.
 */
import { afterEach, describe, expect, test } from "vitest";
import { crossRole, standCrossingDaemon, type CrossingDaemon, type CrossRole } from "../probes/crossing-roles.js";

const GREET = "the DreamNet breathes";
const stood: CrossingDaemon[] = [];
afterEach(async () => { while (stood.length) await stood.pop()!.close(); });

async function cross(role: CrossRole, admit: "from-file" | "none") {
  const daemon = await standCrossingDaemon({ port: 0, host: "127.0.0.1", greet: GREET, admit });
  stood.push(daemon);
  const verdict = await crossRole(role, { host: "127.0.0.1", coordinates: daemon.coordinates }, { greet: GREET, windowMs: 3_000 });
  return { daemon, verdict };
}

describe("the crossing matrix over the sealed gate", () => {
  test("admitted: crosses, reads the seeded doc and the daemon sees the write-back", async () => {
    const { daemon, verdict } = await cross("admitted", "from-file");
    expect(verdict, verdict.detail).toMatchObject({ outcome: "synced", ok: true });
    await expect(Promise.race([daemon.sawReply.then(() => "saw"), new Promise((r) => setTimeout(() => r("never"), 3_000))])).resolves.toBe("saw");
  }, 30_000);

  test("anon: a gate that admits nobody turns the face away, and nothing syncs", async () => {
    const { verdict } = await cross("anon", "none");
    expect(verdict, verdict.detail).toMatchObject({ outcome: "denied", ok: true });
  }, 30_000);

  test("impostor: another face's session signer under the admitted face's chain is refused", async () => {
    const { daemon, verdict } = await cross("impostor", "from-file");
    expect(verdict, verdict.detail).toMatchObject({ outcome: "denied", ok: true });
    expect(daemon.seated()).toBe(0);
  }, 30_000);

  test("wrong-bind: a presentation bound to another audience is refused", async () => {
    const { daemon, verdict } = await cross("wrong-bind", "from-file");
    expect(verdict, verdict.detail).toMatchObject({ outcome: "denied", ok: true });
    expect(daemon.seated()).toBe(0);
  }, 30_000);

  test("CONTROL: the denial roles bite only because the same gate crosses the admitted face", async () => {
    // The impostor's and the wrong-bind's gate is the admitted gate: the same daemon crosses the honest face.
    const daemon = await standCrossingDaemon({ port: 0, host: "127.0.0.1", greet: GREET, admit: "from-file" });
    stood.push(daemon);
    const at = { host: "127.0.0.1", coordinates: daemon.coordinates };
    expect((await crossRole("impostor", at, { greet: GREET, windowMs: 2_000 })).outcome).toBe("denied");
    expect((await crossRole("admitted", at, { greet: GREET, windowMs: 5_000 })).outcome).toBe("synced");
  }, 30_000);
});
