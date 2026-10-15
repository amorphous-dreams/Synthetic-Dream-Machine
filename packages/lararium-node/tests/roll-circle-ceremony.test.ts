/**
 * roll-circle-ceremony — a joint Nexus rolls across its vaults: each holder contributes its own chair, each signs the
 * one image, and each files the rolled charter. Every vault stands under its own scratch root and custody; every
 * file crosses as JSON text; every step runs through the custody door's rows, as the command drives them.
 *
 *   W1  ROLL WITH FRESH SUCCESSORS: A and B found 2-of-2; A opens the circle with its card, B joins with its card,
 *       both sign, both file. Both hold one head; the closed seats retire; and the roll anchor crosses after it.
 *   W2  A THIRD CHAIR: C carries the charter in, joins the next circle with a key no head committed, and signs it
 *       (possession). A, B and C file one head at two of three.
 *   W3  A PASSED CHAIR AND A DORMANT ROOT: B sits the third roll out; A and C reveal, D takes the chair B leaves.
 *       B then catches up along the one lineage by importing the newest charter.
 *   W5  RED: a courier slips a chair of its own into the circle and lowers the rule; the holders, having typed what
 *       they heard, sign nothing; a second circle from one head refuses, and abandon frees it and retires its seat.
 *   W4  RED: a card the head never committed, a successor already spent, a chair swapped in transit, a join after a
 *       signature, a circle off a moved head, a vault that contributed nothing, a file short of the quorum, and the
 *       household seed each refuse by name, and nothing moves.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

/** A count of every seat signature, so a refusal can show no seat signed. */
const signing = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../src/seat-key-store.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/seat-key-store.js")>();
  return { ...real, signAsSeat: async (key: string, image: Uint8Array): Promise<Uint8Array> => { signing.calls += 1; return real.signAsSeat(key, image); } };
});
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cidV1Sha256, foundingRoster, hex, mintColdKey, seatFingerprint, type CofoundOffer, type ColdKey,
} from "@lararium/mesh";
import { charterHomeFor, importCarriedCharter, primaryNexusAid } from "../src/carried-set.js";
import { runNexusRollAnchorOpen, runNexusRollAnchorPartial } from "../src/commands/nexus-contract.js";
import { nexusCharterDocRelPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { heldSeatKey, listSeatKeys } from "../src/seat-key-store.js";
import { readRollCircleRecord } from "../src/roll-circle-record.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { restEvery, restingRepo, type RestingRepo } from "./resting-repo.js";

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: SeatedScratchCustody[] = [];
afterEach(async () => {
  await restEvery();
  for (const c of drops.splice(0).reverse()) await c.drop();
});

const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";
const courier = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
const act = (name: string, args: Record<string, unknown>) => runSealedAct(name, args, ctx) as Promise<Record<string, any>>;
const refusal = (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof SealedActRefused ? e.message : `${(e as Error).constructor.name}: ${(e as Error).message}`));

interface Vault { readonly c: SeatedScratchCustody; readonly repo: RestingRepo }
async function vault(label: string): Promise<Vault> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  return { c, repo: restingRepo(larDataDir()) };
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.c.root; };
const card = (k: ColdKey): string[] => [hex(k.seed)];
/**
 * Sign as the holder whose own chair carries `ownNext`, typing what that person heard from the other holders: the
 * circle's rule, and every other chair's seat fingerprint.
 */
const signAs = (circle: { threshold: number; chairs: Array<{ seat: string; next: string }> }, ownNext: string, over: Record<string, unknown> = {}) =>
  act("roll-circle.sign", {
    circle: courier(circle), heardThreshold: circle.threshold,
    heard: circle.chairs.filter((c) => c.next !== ownNext).map((c) => seatFingerprint(c.seat)), ...over,
  });

/** Found A and B's joint Nexus, keeping each founder's cold successor card. */
async function founders(): Promise<{ A: Vault; B: Vault; aid: string; aCard: ColdKey; bCard: ColdKey }> {
  const A = await vault("roll-a"), B = await vault("roll-b");
  const aCard = await mintColdKey(), bCard = await mintColdKey();
  at(A);
  const opened = await act("cofound.open", { face: 0, next: aCard.digest, charterLaw: LAW, manifest: MANIFEST }) as { offer: CofoundOffer };
  at(B);
  const joined = await act("cofound.join", { face: 0, offer: courier(opened.offer), heard: seatFingerprint(opened.offer.seat), next: bCard.digest });
  at(A);
  const sealed = await act("cofound.seal", { join: courier(joined["join"]), heard: seatFingerprint(joined["join"].seat) });
  at(B);
  await act("cofound.accept", { inception: courier(sealed["inception"]) });
  return { A, B, aid: sealed["charter"].aid as string, aCard, bCard };
}

/** This vault's joint charter: its head and roster. */
function charterAt(v: Vault, aid: string) {
  at(v);
  const doc = readNexusDoc(charterHomeFor(larSealHome(), aid)!);
  return { head: foundingRoster(doc).sealEpochCid, roster: foundingRoster(doc), depth: doc?.sealLineage?.length ?? 0 };
}
/** The joint charter's text on this vault, as a person would carry the file. */
const charterText = (v: Vault, aid: string): string => { at(v); return readFileSync(join(charterHomeFor(larSealHome(), aid)!, nexusCharterDocRelPath()), "utf8"); };

/** One whole roll: the opener and joiners contribute in order, every contributor signs, and every vault files. */
async function roll(aid: string, threshold: number, chairs: ReadonlyArray<{ v: Vault; card?: ColdKey; next: ColdKey }>, filers: readonly Vault[]) {
  const [first, ...rest] = chairs;
  at(first!.v);
  let circle = (await act("roll-circle.open", { aid, face: 0, next: first!.next.digest, threshold, ...(first!.card ? { cards: card(first!.card) } : {}) }))["circle"];
  for (const c of rest) {
    at(c.v);
    circle = (await act("roll-circle.join", { circle: courier(circle), face: 0, next: c.next.digest, ...(c.card ? { cards: card(c.card) } : {}) }))["circle"];
  }
  let last: Record<string, any> = {};
  for (const c of chairs) { at(c.v); last = await signAs(circle, c.next.digest); circle = last["circle"]; }
  const filed = [];
  for (const v of filers) { at(v); filed.push(await act("roll-circle.file", { circle: courier(circle) })); }
  return { circle, verdict: last["verdict"] as string, filed };
}

describe("a joint Nexus rolls across its vaults as a circle", () => {
  test("W1 — a 2-of-2 roll with fresh successors on both roots, then its anchor", async () => {
    const { A, B, aid, aCard, bCard } = await founders();
    const before = charterAt(A, aid);
    const [a0, b0] = [before.roster.keys, charterAt(B, aid).roster.keys];
    expect(a0).toEqual(b0);
    const aNext = await mintColdKey(), bNext = await mintColdKey();

    at(A);
    const opened = await act("roll-circle.open", { aid, face: 0, cards: card(aCard), next: aNext.digest, threshold: 2 });
    expect(opened["verdict"]).toBe("ready");
    at(B);
    const joined = await act("roll-circle.join", { circle: courier(opened["circle"]), face: 0, cards: card(bCard), next: bNext.digest });
    expect(joined["circle"].chairs).toHaveLength(2);
    const bSigned = await signAs(joined["circle"], bNext.digest);
    expect(bSigned).toMatchObject({ verdict: "ready", why: "roll-short-of-revealed-quorum" });
    at(A);
    const aSigned = await signAs(bSigned["circle"], aNext.digest);
    expect(aSigned["verdict"]).toBe("complete");

    for (const v of [A, B]) { at(v); expect((await act("roll-circle.file", { circle: courier(aSigned["circle"]) }))["outcome"]).toBe("extended"); }
    const a1 = charterAt(A, aid), b1 = charterAt(B, aid);
    expect(a1.head).toBe(b1.head);
    expect(a1.depth).toBe(2);
    expect(a1.roster.threshold).toBe(2);
    expect(a1.roster.keys.some((k) => a0.includes(k))).toBe(false);
    // The closed seats retire on each vault; the revealed successor stands as each vault's seat.
    at(A); expect(a0.filter((k) => heldSeatKey(k) !== null)).toEqual([]);
    expect(a1.roster.keys.filter((k) => heldSeatKey(k) !== null)).toHaveLength(1);
    at(B); expect(b1.roster.keys.filter((k) => heldSeatKey(k) !== null)).toHaveLength(1);

    // THE ANCHOR follows the filed head across the same two vaults.
    at(A);
    const anchor = await runNexusRollAnchorOpen({ sealHome: larSealHome(), repo: A.repo, aid });
    at(B);
    expect((await runNexusRollAnchorPartial({ partial: courier(anchor.partial), sealHome: larSealHome(), repo: B.repo })).verdict).toBe("complete");
  });

  test("W2 + W3 — a third chair joins, a later roll passes B's chair to D, and B catches up along the lineage", async () => {
    const { A, B, aid, aCard, bCard } = await founders();
    const C = await vault("roll-c"), D = await vault("roll-d");
    const [a1, b1, a2, b2, c1, a3, c2, d1] = await Promise.all(Array.from({ length: 8 }, () => mintColdKey()));
    await roll(aid, 2, [{ v: A, card: aCard, next: a1! }, { v: B, card: bCard, next: b1! }], [A, B]);

    // C carries the rolled charter in, and joins the next circle with a key no head committed.
    at(C); importCarriedCharter(larSealHome(), charterText(A, aid));
    const second = await roll(aid, 2, [{ v: A, card: a1!, next: a2! }, { v: B, card: b1!, next: b2! }, { v: C, next: c1! }], [A, B, C]);
    expect(second.verdict).toBe("complete");
    const three = charterAt(C, aid);
    expect(three.roster.keys).toHaveLength(3);
    expect(three.roster.threshold).toBe(2);
    expect(charterAt(A, aid).head).toBe(three.head);
    expect(charterAt(B, aid).head).toBe(three.head);

    // D carries the charter in; B sits the roll out; A and C reveal, and D takes the third chair.
    at(D); importCarriedCharter(larSealHome(), charterText(A, aid));
    const third = await roll(aid, 2, [{ v: A, card: a2!, next: a3! }, { v: C, card: c1!, next: c2! }, { v: D, next: d1! }], [A, C, D]);
    expect(third.verdict).toBe("complete");
    const passed = charterAt(D, aid);
    expect(passed.depth).toBe(4);
    expect(passed.roster.keys).toHaveLength(3);
    expect(charterAt(A, aid).head).toBe(passed.head);
    // B dormant: its head stands one roll behind until the newest charter arrives along the same lineage.
    expect(charterAt(B, aid).head).toBe(three.head);
    at(B);
    expect(importCarriedCharter(larSealHome(), charterText(A, aid)).outcome).toBe("extended");
    expect(charterAt(B, aid).head).toBe(passed.head);
    // B's own successor never revealed: B holds no seat of the head it caught up to.
    expect(passed.roster.keys.filter((k) => heldSeatKey(k) !== null)).toEqual([]);
  });

  test("W4 — RED: every refusal names itself, and nothing moves", async () => {
    const { A, B, aid, aCard, bCard } = await founders();
    const [aNext, bNext, stray] = await Promise.all([mintColdKey(), mintColdKey(), mintColdKey()]);
    const head0 = charterAt(A, aid).head;

    at(A);
    const rowsBefore = listSeatKeys().length;
    // A card the head never committed; a successor the founding already spent; the household seed.
    expect(await refusal(act("roll-circle.open", { aid, face: 0, cards: card(stray), next: aNext.digest, threshold: 2 }))).toMatch(/card answers no successor the head committed/);
    expect(await refusal(act("roll-circle.open", { aid, face: 0, cards: card(aCard), next: bCard.digest, threshold: 2 }))).toMatch(/already stands in a charter or a circle/);
    // A household seed stands as A's primary charter: it rolls by its own rotate, never by a circle.
    writeNexusDoc(larSealHome(), (await seatedCharter({ seats: 1, threshold: 1, seed: 7 })).doc());
    const seed = primaryNexusAid(larSealHome());
    expect(seed).toMatch(/^nexus-/);
    expect(await refusal(act("roll-circle.open", { aid: seed, face: 0, next: aNext.digest, threshold: 1 }))).toMatch(/rolls by `lares nexus seal rotate`/);
    // CENSUS: no refusal above stored a seat row or recorded a circle.
    expect(listSeatKeys().length).toBe(rowsBefore);
    expect(readRollCircleRecord(aid)).toBeNull();

    const opened = await act("roll-circle.open", { aid, face: 0, cards: card(aCard), next: aNext.digest, threshold: 2 });
    at(B);
    // B never contributed: its hands sign nothing.
    expect(await refusal(signAs(opened["circle"], bNext.digest))).toMatch(/contributed no chair/);
    const joined = await act("roll-circle.join", { circle: courier(opened["circle"]), face: 0, cards: card(bCard), next: bNext.digest });
    // A courier swaps B's successor for one it holds: B's hands refuse the moved chair.
    const swapped = courier(joined["circle"]);
    const bSeat = joined["circle"].chairs.find((c: { next: string }) => c.next === bNext.digest).seat as string;
    (swapped["chairs"] as Array<{ seat: string; next: string }>).find((c) => c.seat === bSeat)!.next = stray.digest;
    expect(await refusal(signAs(swapped as never, bNext.digest))).toMatch(/arms this vault's chair with another successor/);
    // A file short of the quorum files nothing.
    expect(await refusal(act("roll-circle.file", { circle: courier(joined["circle"]) }))).toMatch(/reads ready here/);
    const bSigned = await signAs(joined["circle"], bNext.digest);
    // No chair joins a signed circle.
    at(A);
    expect(await refusal(act("roll-circle.join", { circle: courier(bSigned["circle"]), face: 0, next: stray.digest }))).toMatch(/already signed this circle/);
    expect(charterAt(A, aid).head).toBe(head0);
    const done = await signAs(bSigned["circle"], aNext.digest);
    expect(done["verdict"]).toBe("complete");
    at(A); await act("roll-circle.file", { circle: courier(done["circle"]) });
    // The head moved on A: the same circle reads stale there now, and signs nothing more.
    expect(await refusal(signAs(done["circle"], aNext.digest))).toMatch(/reads stale here/);
    // CONTROL: B, whose head has not moved, files the same circle.
    at(B);
    expect((await act("roll-circle.file", { circle: courier(done["circle"]) }))["outcome"]).toBe("extended");
  });

  test("W5 — RED: a courier's injected chair or lowered rule signs nowhere; abandon frees the head; one circle per head", async () => {
    const { A, B, aid, aCard, bCard } = await founders();
    const [aNext, bNext, xNext, aAgain, xSeat] = await Promise.all([mintColdKey(), mintColdKey(), mintColdKey(), mintColdKey(), mintColdKey()]);
    at(A);
    const opened = await act("roll-circle.open", { aid, face: 0, cards: card(aCard), next: aNext.digest, threshold: 2 });
    at(B);
    const joined = (await act("roll-circle.join", { circle: courier(opened["circle"]), face: 0, cards: card(bCard), next: bNext.digest }))["circle"];
    // THE COURIER'S MOVE: a chair of its own slipped in, and the rule lowered to one.
    const injected = courier(joined) as { threshold: number; chairs: Array<{ seat: string; next: string }> };
    injected.chairs = [...injected.chairs, { seat: xSeat.verifyingKey, next: xNext.digest }].sort((a, b) => (a.seat < b.seat ? -1 : 1));
    injected.threshold = 1;
    const before = signing.calls;
    // B heard two chairs at two: the circle carries three at one, and B's hands sign nothing.
    expect(await refusal(act("roll-circle.sign", { circle: injected, heardThreshold: 2, heard: [seatFingerprint(joined.chairs.find((c: { next: string }) => c.next === aNext.digest).seat)] })))
      .toMatch(/another rule than the one this vault read/);
    const lowered = { ...injected, threshold: 2 };
    expect(await refusal(act("roll-circle.sign", { circle: lowered, heardThreshold: 2, heard: [seatFingerprint(joined.chairs.find((c: { next: string }) => c.next === aNext.digest).seat)] })))
      .toMatch(/type every other chair's seat fingerprint/);
    // A rule misheard refuses too; CONTROL: the circle as both heard it signs.
    expect(await refusal(signAs(joined, bNext.digest, { heardThreshold: 1 }))).toMatch(/rule typed as heard differs/);
    expect(signing.calls).toBe(before);
    expect((await signAs(joined, bNext.digest))["verdict"]).toBe("ready");

    // One circle per head: A cannot open a second; abandon drops A's record and retires the seat it adopted.
    at(A);
    expect(await refusal(act("roll-circle.open", { aid, face: 0, next: aAgain.digest, threshold: 2 }))).toMatch(/already contributed to a circle from this head/);
    const aSeat = joined.chairs.find((c: { next: string }) => c.next === aNext.digest).seat as string;
    expect(heldSeatKey(aSeat)).not.toBeNull();
    const dropped = await act("roll-circle.abandon", { aid });
    expect(dropped).toMatchObject({ abandoned: true, retired: [aSeat] });
    expect(heldSeatKey(aSeat)).toBeNull();
    // The abandoned circle signs nothing on A now.
    expect(await refusal(signAs(joined, aNext.digest))).toMatch(/contributed no chair/);
  });
});
