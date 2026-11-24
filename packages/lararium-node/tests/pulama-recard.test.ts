/**
 * pulama-recard — the pūlama's hand door proves a stale face's OWN route where its keys rest, and the vessel's recard spends
 * that proof once to arm the face's next light (`face-recard` under a pūlama).
 *
 *   Q1  an unlit pūlama refuses `pulama-locked` before the route reads; a face shut at the pūlama refuses `face-shut`, naming
 *       `pulama light`; a face no index names refuses `face-not-standing`. None of them grants.
 *   Q2  a route that opens no slot of the face refuses `no-slot-opens`, naming the attempts left; nothing grants.
 *   Q3  the face's own route grants ONE recard: the answer names the vessel's next act (`lares vault recard --face N`), and
 *       no answer or log line carries the route. The vessel's session spends the grant once (`face.recard`): the second ask reads
 *       none. A face outside the session's lend refuses `outside-the-lei`.
 *   Q4  the lock forgets every grant, as it forgets the worn face.
 *   Q5  the hand verb's exit: a recard that granted exits 0, any other reading 1.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { handVerbExit } from "../src/pulama-verbs.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

let fx: PulamaFixture | null = null;
let vessel: PulamaHolder | null = null;
const dirs: string[] = [];
afterEach(async () => {
  await vessel?.lock(); vessel = null;
  await fx?.drop(); fx = null;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const GROUPS = ["group-recard-steward", "group-recard-engineer"] as const;
const ROUTE = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];

/** A pūlama holding two faces lit (h0 lent to the vessel, h1 not), its hand door, and a vessel seated over one session. */
async function stalePulama(opts: { readonly shut?: boolean } = {}) {
  fx = await standPulama("pulama-recard", () => openGate({ faces: lend(0), coldReads: [] }));
  const faces = [];
  for (const [ordinal, group] of GROUPS.entries()) {
    faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal, slots: fixtureSlots }));
    await fx.kept.writeRecord("identity", `anchors-h${ordinal}.json`, new TextEncoder().encode(JSON.stringify({ personaGroupId: group, meshCabalDocIdHex: "ab" })));
  }
  if (opts.shut) await fx.kept.lockFace(faces[0]!.fcid);
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-recard-")); dirs.push(dir);
  const lines: string[] = [];
  const door = pulamaHandDoor({ holder: fx.kept, server: fx.server, image: pulamaImage(dir), records: pulamaRecords(dir), onLog: (l) => lines.push(l) });
  vessel = fx.vessel();
  await vessel.unlock([]);
  return { door, lines, vessel };
}

describe("the pūlama's hand door proves a stale face's own route for its recard", () => {
  test("Q1 unlit, shut and absent faces refuse before anything grants", async () => {
    const shut = await stalePulama({ shut: true });
    const a = await shut.door({ op: "recard", face: 0, credentials: ROUTE });
    expect(a).toMatchObject({ op: "recard", reading: "face-shut", face: 0 });
    expect(String(a["detail"])).toContain("tools/lares-container.sh pulama light");
    expect(await shut.door({ op: "recard", face: 7, credentials: ROUTE })).toMatchObject({ op: "recard", reading: "face-not-standing", face: 7 });
    expect(await shut.vessel.takeRecard(0)).toBe(false);
    await shut.door({ op: "lock" });
    expect(await shut.door({ op: "recard", face: 0, credentials: ROUTE })).toMatchObject({ op: "recard", reading: "pulama-locked" });
    expect(await shut.door({ op: "recard", face: "0", credentials: ROUTE })).toMatchObject({ op: "recard", reading: "malformed" });
  });

  test("Q2 a route that opens no slot of the face refuses and grants nothing", async () => {
    const p = await stalePulama();
    const a = await p.door({ op: "recard", face: 0, credentials: [{ kind: "passphrase", passphrase: "not-this-face's-route" }] });
    expect(a).toMatchObject({ op: "recard", reading: "no-slot-opens", face: 0 });
    expect(typeof a["attemptsLeft"]).toBe("number");
    expect(String(a["detail"])).toMatch(/attempt\(s\) left this boot for this face/);
    expect(await p.vessel.takeRecard(0)).toBe(false);
  });

  test("Q3 the face's own route grants one recard, the vessel's session spends it once, and no line carries the route", async () => {
    const p = await stalePulama();
    const a = await p.door({ op: "recard", face: 0, credentials: ROUTE });
    expect(a).toMatchObject({ op: "recard", reading: "granted", face: 0 });
    expect((a["lines"] as string[]).join("\n")).toContain("lares vault recard --face 0");
    expect(JSON.stringify([a, p.lines, fx!.lines])).not.toContain(FIXTURE_PASSPHRASE);
    expect(fx!.kept.unlockedFaces(), "the proof leaves the face's key as it stood").toHaveLength(2);
    // h1 stands lit at the pūlama but outside this session's lend: the session never spends its grant.
    expect(await p.door({ op: "recard", face: 1, credentials: ROUTE })).toMatchObject({ reading: "granted", face: 1 });
    await expect(p.vessel.takeRecard(1)).rejects.toMatchObject({ reading: "outside-the-lei" });
    expect(await p.vessel.takeRecard(0)).toBe(true);
    expect(await p.vessel.takeRecard(0), "a grant spends once").toBe(false);
  });

  test("Q4 the lock forgets every grant", async () => {
    const p = await stalePulama();
    expect(await p.door({ op: "recard", face: 0, credentials: ROUTE })).toMatchObject({ reading: "granted" });
    await p.door({ op: "lock" });
    await p.door({ op: "light", credentials: ROUTE });
    vessel = fx!.vessel();
    await vessel.unlock([]);
    expect(await vessel.takeRecard(0)).toBe(false);
  });

  test("Q5 a recard that granted exits 0, any other reading 1", () => {
    expect(handVerbExit("recard", { op: "recard", reading: "granted" })).toBe(0);
    for (const reading of ["face-shut", "no-slot-opens", "pulama-locked", "hand-act-only", "hand-unattested"]) expect(handVerbExit("recard", { op: "recard", reading })).toBe(1);
  });
});
