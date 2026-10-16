/**
 * nexus-cabal.test.ts — R-KAHU's first half witnessed: a Kahu-cabal admission whose seats rest on two
 * different vessels, carried between them as a partial, counts at the seat quorum and lands.
 *
 * Two vessels under two scratch roots, one seat each, one shared charter at two of two. Vessel A opens the
 * admission and signs with the one seat it holds: one of two, so nothing lands. Vessel B reads the partial,
 * confirms its CID, adds its seat and lands the act on its own board. Controls: the opening vessel cannot
 * finish its own partial; a wrong confirmation refuses; a partial at another epoch refuses; a record of
 * another kind (a vouch) admits nobody.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Repo } from "@automerge/automerge-repo";
import { CABAL_INVITE_DOMAIN, kahuCabalActCid } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalAct, runCabalCosign, runCabalStanding, NexusCabalError } from "../src/commands/nexus-cabal.js";
import { chairKey, seatChairs } from "./seat-fixture.js";

let roots: string[];
let priorLarRoot: string | undefined;
let seatB: string;
const GROUP = "c0".repeat(32);

async function withRepo<T>(index: number, run: (repo: Repo) => Promise<T>): Promise<T> {
  process.env["LAR_ROOT"] = roots[index]!;
  return ownedStore(larDataDir(), run);
}

beforeEach(async () => {
  priorLarRoot = process.env["LAR_ROOT"];
  roots = [mkdtempSync(join(tmpdir(), "lares-cabal-a-")), mkdtempSync(join(tmpdir(), "lares-cabal-b-"))];
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(0);
  const chairA = (await seatChairs([0])).keys[0]!;
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(1);
  const chairB = (await seatChairs([1])).keys[0]!;
  seatB = chairB;
  const charter = heldCharter({ keys: [chairA, chairB], threshold: 2, successors: { keys: [await chairKey(0, 1), await chairKey(1, 1)], threshold: 2 } });
  for (const root of roots) { process.env["LAR_ROOT"] = root; writeNexusDoc(larSealHome(), charter.doc()); }
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const open = (index: number) => withRepo(index, (repo) => runCabalAct({ repo, sealHome: larSealHome(), group: GROUP, action: "admit" }));
const cosign = (index: number, partial: unknown, confirm: string) =>
  withRepo(index, (repo) => runCabalCosign({ repo, sealHome: larSealHome(), partial: JSON.parse(JSON.stringify(partial)), confirmActCid: confirm }));
const standing = (index: number) => withRepo(index, (repo) => runCabalStanding({ repo, sealHome: larSealHome(), group: GROUP }));

describe("a Kahu-cabal admission across two vessels (R-KAHU, seats on different vessels)", () => {
  it("one seat opens a partial that lands nowhere; the second vessel's seat completes it and it lands", async () => {
    const a = await open(0);
    expect(a).toMatchObject({ landed: false, seated: 1, threshold: 2 });
    expect(a.signedHere).toHaveLength(1);
    expect((await standing(0)).standing).toBe("absent");

    const b = await cosign(1, a.act, a.actCid);
    expect(b).toMatchObject({ landed: true, seated: 2, threshold: 2 });
    expect(b.signedHere).toHaveLength(1);
    expect(b.signedHere[0]).not.toBe(a.signedHere[0]);
    expect((await standing(1))).toMatchObject({ standing: "admitted", heads: [b.actCid] });
    // CONTROL: the opening vessel's own board never received the act; the record crosses by sync, never by this door.
    expect((await standing(0)).standing).toBe("absent");
  });

  it("the opening vessel cannot finish its own partial: no seat signs twice", async () => {
    const a = await open(0);
    expect(await cosign(0, a.act, a.actCid)).toMatchObject({ landed: false, seated: 1 });
  });

  it("a confirmation naming another act refuses, and signs nothing", async () => {
    const a = await open(0);
    await expect(cosign(1, a.act, "00".repeat(32))).rejects.toThrow(/confirmation names another act/);
    expect((await standing(1)).standing).toBe("absent");
  });

  it("a partial rooted on another epoch refuses at the cosigning vessel", async () => {
    const a = await open(0);
    const moved = { ...a.act, sealEpochCid: "elsewhere" };
    await expect(cosign(1, moved, kahuCabalActCid(moved))).rejects.toThrow(/another charter epoch/);
  });

  it("a forged signature under the cosigning vessel's seat never locks that seat out", async () => {
    const a = await open(0);
    const wedged = { ...a.act, signatures: [...a.act.signatures, { signer: seatB, sig: "00".repeat(64) }] };
    const b = await cosign(1, wedged, kahuCabalActCid(wedged));
    expect(b).toMatchObject({ landed: true, seated: 2, signedHere: [seatB] });
  });

  it("a vouch carried as a partial admits nobody", async () => {
    const vouch = { kind: CABAL_INVITE_DOMAIN, group: GROUP, action: "admit" };
    await expect(cosign(1, vouch, "x")).rejects.toThrow(NexusCabalError);
  });
});
