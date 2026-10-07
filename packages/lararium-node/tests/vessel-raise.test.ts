/**
 * The live door — what a vessel stands as, and how a recogniser moves it.
 *
 * Recognition is the VERIFIER's: a grant carries its recogniser's presented admit and is signed by that
 * admit's leaf, and every answer re-reads the Nexuses the door carries. The starred tests carry the
 * properties that make the door safe rather than merely functional: one challenge answers once, the fence
 * gets re-read rather than remembered, and so do the readings an admit is judged against.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";

import {
  hex, genesisSealEpochCid, signCarriageQuorum, signCarriageContract, signCarrierContract, carriageEntryActCid,
  signRaiseGrant, emptyLarDoc, writeCarriageEntry, carriageDocUrl, NEXUS_DOC_DOMAIN,
  type RaiseChallenge, type RaiseNexusReading, type CarriageEntry, type KahuRoster, type LarDoc, type NexusDoc,
} from "@lararium/mesh";
import {
  standRaiseDoor, placeCarriedNexuses, unionReadings, verifyNymSignature, type RaiseDoorOptions,
} from "../src/vessel-raise.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";

const VESSEL = "vessel-key";
const NEXUS  = "aid-of-nexus-n";

const KAHU_SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const LEAF_SEED  = new Uint8Array(32).fill(5);
const ROOT_SEED  = new Uint8Array(32).fill(6);
const OTHER_SEED = new Uint8Array(32).fill(9);
const PLACE_SEED = new Uint8Array(32).fill(11);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);

async function roster(): Promise<KahuRoster> {
  const keys = await Promise.all(KAHU_SEEDS.map(pubOf));
  return { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
}
async function quorum() {
  return Promise.all([KAHU_SEEDS[0]!, KAHU_SEEDS[1]!].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
}
/** A quorum-signed member act on `subject` (an admit carries the subject's own contract-in). */
async function act(action: "admit" | "revoke", parents: readonly string[] = [], subject = LEAF_SEED): Promise<CarriageEntry> {
  const epoch = (await roster()).sealEpochCid;
  const nym = await pubOf(subject);
  const seal = action === "admit" ? await signCarriageContract(nym, epoch, signerOf(subject)) : undefined;
  return signCarriageQuorum({ nym, action, parents, sealEpochCid: epoch }, await quorum(), seal);
}
/** A place's counted carry on the board. */
async function carry(place: Uint8Array): Promise<CarriageEntry> {
  const epoch = (await roster()).sealEpochCid;
  const nym = await pubOf(place);
  return signCarriageQuorum({ nym, action: "carry", parents: [], sealEpochCid: epoch }, await quorum(),
    await signCarrierContract(nym, epoch, signerOf(place)));
}

/** A door whose lease epoch and deny board a test can move under it, with nonces in a readable sequence. */
async function door(over: Partial<RaiseDoorOptions> = {}) {
  let epoch = 7;
  let n = 0;
  const admit = await act("admit");
  const r = await roster();
  let denyBoard: CarriageEntry[] = [admit];
  const readings = (): RaiseNexusReading[] => [{ aid: NEXUS, roster: r, denyBoard, antigen: [], antigenRoster: r }];
  const d = standRaiseDoor({
    vesselId:   VESSEL,
    nexus:      NEXUS,
    floor:      "herm",
    leaseEpoch: () => epoch,
    readings,
    verify:     verifyNymSignature,
    nonce:      () => `nonce-${++n}`,
    ...over,
  });
  return {
    d, admit,
    roll: (to: number) => { epoch = to; },
    land: (e: CarriageEntry) => { denyBoard = [...denyBoard, e]; },
  };
}

/** The honest answer: the leaf signs, carrying its admit. `signer` swaps the key for a CONTROL. */
const answerWith = async (c: RaiseChallenge, admit: CarriageEntry, signer = LEAF_SEED) =>
  signRaiseGrant({ challenge: c, byNym: await pubOf(signer), presentedAdmit: { admit, lineage: [] }, sign: signerOf(signer) });

describe("the honest path", () => {
  test("a vessel stands at its FLOOR until somebody raises it", async () => {
    const { d, admit } = await door();
    expect(await d.standing()).toBe("herm");
    expect(await d.raised()).toBeNull();
  });

  test("a recognised answer raises it, and names who carries the caps", async () => {
    const { d, admit } = await door();
    const r = await d.answer(await answerWith(await d.ask(), admit));
    expect(r.ok).toBe(true);
    expect(await d.standing()).toBe("hearth");
    expect((await d.raised())?.byNym).toBe(await pubOf(LEAF_SEED));
  });

  test("a refused answer leaves the vessel exactly where it stood", async () => {
    const { d, admit } = await door();
    const r = await d.answer(await answerWith(await d.ask(), admit, OTHER_SEED));
    expect(r).toMatchObject({ ok: false, why: "rejected", detail: "signer-is-not-the-admit-leaf" });
    expect(await d.standing()).toBe("herm");
  });
});

describe("★ one challenge, one answer ★", () => {
  test("★ the SAME grant replayed a second time refuses ★", async () => {
    // A challenge surviving its success would let one captured grant raise the vessel again and again.
    const { d, admit } = await door();
    const grant = await answerWith(await d.ask(), admit);
    expect((await d.answer(grant)).ok).toBe(true);
    expect(await d.answer(grant)).toMatchObject({ ok: false, why: "stale-challenge" });
  });

  test("★ a REFUSAL also burns the challenge — no grinding against one nonce ★", async () => {
    const { d, admit } = await door();
    const c = await d.ask();
    expect((await d.answer(await answerWith(c, admit, OTHER_SEED))).ok).toBe(false);
    // The honest holder now answers the SAME challenge — and finds it already spent.
    expect(await d.answer(await answerWith(c, admit))).toMatchObject({ ok: false, why: "stale-challenge" });
  });

  test("asking again mints a FRESH nonce, so the old answer no longer fits", async () => {
    const { d, admit } = await door();
    const first = await d.ask();
    const second = await d.ask();
    expect(second.nonce).not.toBe(first.nonce);
    expect(await d.answer(await answerWith(first, admit))).toMatchObject({ ok: false, why: "stale-challenge" });
  });
});

describe("★ the fence is re-read, never remembered ★", () => {
  test("★ a raise falls back to the floor when the epoch rolls past it — nobody lowers it ★", async () => {
    // The whole non-renewal ruling, measured: no lowering act runs anywhere, and the reading simply
    // stops coming back raised. A cached epoch here would keep a stale vessel raised forever.
    const { d, roll, admit } = await door();
    await d.answer(await answerWith(await d.ask(), admit));
    expect(await d.standing()).toBe("hearth");
    roll(8);
    expect(await d.standing()).toBe("herm");
    expect(await d.raised()).toBeNull();
  });

  test("★ a challenge binds to the epoch standing when it was ASKED ★", async () => {
    // Ask under 7, roll to 8, then answer: the grant consented to a fence that has moved.
    const { d, roll, admit } = await door();
    const c = await d.ask();
    expect(c.epoch).toBe(7);
    roll(8);
    expect(await d.answer(await answerWith(c, admit))).toMatchObject({ ok: false, why: "stale-challenge" });
  });

  test("a hearth floor stays a hearth — a raise adds caps, it never removes them", async () => {
    const { d, roll } = await door({ floor: "hearth" });
    roll(9);
    expect(await d.standing()).toBe("hearth");
  });
});

describe("★ nothing is written, so nothing survives ★", () => {
  test("★ a fresh door over the same vessel stands at the floor — a raise is PRESENCE ★", async () => {
    // The reboot case. If a raise could be resumed from anywhere, a stolen disk would carry it.
    const first = await door();
    await first.d.answer(await answerWith(await first.d.ask(), first.admit));
    expect(await first.d.standing()).toBe("hearth");

    const second = await door();                     // same vessel id, same nexus, new process
    expect(await second.d.standing()).toBe("herm");
    expect(await second.d.raised()).toBeNull();
  });
});

// ── THE VERIFIER ROUTE (O9) ─────────────────────────────────────────────────────────────────────────
// The door raises on a presented admit the verifier reads HELD, signed by that admit's leaf — never on a
// nym, never by a root.

describe("★ the door raises through the presented admit, and re-reads it every answer ★", () => {
  test("★ a ROOT-signed grant beside the leaf's held admit refuses, and the vessel stays at its floor ★", async () => {
    const { d, admit } = await door();
    const r = await d.answer(await answerWith(await d.ask(), admit, ROOT_SEED));
    expect(r).toMatchObject({ ok: false, why: "rejected", detail: "signer-is-not-the-admit-leaf" });
    expect(await d.standing()).toBe("herm");
  });

  test("★ a revoke reaching the replica between the ask and the answer closes it ★", async () => {
    const { d, admit, land } = await door();
    const c = await d.ask();
    land(await act("revoke", [carriageEntryActCid(admit)]));
    expect(await d.answer(await answerWith(c, admit))).toMatchObject({ ok: false, why: "denied" });
    expect(await d.standing()).toBe("herm");
  });

  test("CONTROL: the same ask and answer with no revoke landed raises", async () => {
    const { d, admit } = await door();
    const c = await d.ask();
    expect((await d.answer(await answerWith(c, admit))).ok).toBe(true);
  });

  test("★ the readings are not read for a grant that answers no live challenge ★", async () => {
    let reads = 0;
    const { d, admit } = await door({ readings: () => { reads += 1; return []; } });
    const c = await d.ask();
    await d.answer(await answerWith(c, admit));
    expect(reads).toBe(1);
    await d.answer(await answerWith(c, admit));               // the challenge is spent
    expect(reads).toBe(1);
  });
});

describe("★ a PLACE carries a Nexus by its own counted carrier seal ★", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-raise-place-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
  afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

  /** A held charter at the primary path, and a board opener serving `entries` at that charter's island. */
  async function held(entries: readonly CarriageEntry[]) {
    const keys = await Promise.all(KAHU_SEEDS.map(pubOf));
    const doc: NexusDoc = {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
      kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })),
    };
    const sealHome = join(root, "nexus");
    writeNexusDoc(sealHome, doc);
    const place = await pubOf(PLACE_SEED);
    const island = nodeNexusIsland({ ownVesselKey: place, sealHome });
    const board: LarDoc = emptyLarDoc();
    for (const e of entries) writeCarriageEntry(board, e);
    const open = async (url: string) => (url === carriageDocUrl(island) ? board : undefined);
    return { sealHome, place, open };
  }

  test("★ a held charter whose board counts THIS place's carry reads as carried, with the board as its deny board ★", async () => {
    const admit = await act("admit");
    const { sealHome, place, open } = await held([await carry(PLACE_SEED), admit]);
    const readings = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(readings).toHaveLength(1);
    expect(readings[0]!.via).toBe("carrier-seal");
    expect(readings[0]!.roster.sealEpochCid).toBe((await roster()).sealEpochCid);
    expect(readings[0]!.denyBoard.map(carriageEntryActCid)).toContain(carriageEntryActCid(admit));
  });

  test("CONTROL: the same charter with no carry for this place reads nothing", async () => {
    const { sealHome, place, open } = await held([await act("admit")]);
    expect(await placeCarriedNexuses({ sealHome, ownVesselKey: place, open })).toEqual([]);
  });

  test("CONTROL: another place's carry does not carry THIS place", async () => {
    const { sealHome, place, open } = await held([await carry(OTHER_SEED)]);
    expect(await placeCarriedNexuses({ sealHome, ownVesselKey: place, open })).toEqual([]);
  });

  test("CONTROL: no charter held reads nothing, and opens no board", async () => {
    let opened = 0;
    const readings = await placeCarriedNexuses({
      sealHome: join(root, "nexus"), ownVesselKey: await pubOf(PLACE_SEED), open: async () => { opened += 1; return undefined; },
    });
    expect(readings).toEqual([]);
    expect(opened).toBe(0);
  });
});

describe("unionReadings", () => {
  test("a Nexus carried both ways reads once, first set first", async () => {
    const r = await roster();
    const a: CarriedNexusReading = { aid: "n", via: "consent", island: "i-1", roster: r, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: r };
    const b: CarriedNexusReading = { ...a, via: "carrier-seal", island: "i-2" };
    const c: CarriedNexusReading = { ...a, via: "carrier-seal", aid: "q" };
    expect(unionReadings([a], [b, c]).map((x) => [x.aid, x.island, x.via])).toEqual([["n", "i-1", "consent"], ["q", "i-1", "carrier-seal"]]);
  });
});
