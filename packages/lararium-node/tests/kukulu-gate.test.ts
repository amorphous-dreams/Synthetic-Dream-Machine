/**
 * kukulu-gate — the pūlama serves a kūkulu only beside a strung lei and a vouch, over the swarm's own lei family: the lei the
 * face's hand strung under its ward, the family's reader and return in the pūlama's record store, and the tessera's two halves.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  conferre, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, signKukuluVouch, signSwarmAct, swarmActCid,
  swarmLeiReturnedPrefix, swarmLeiRecordTitle, swarmTesseraPrefix, verifySwarmRecord,
  type KukuluVouchParts, type SignedKukuluVouch, type SignedSwarmAct, type SwarmLeiTerms, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import type { CustodyHolder } from "../src/custody-holder.js";
import { KUKULU_COLD_READS, kukuluGate, pulamaSignerOf, vouchSignerOf } from "../src/kukulu-gate.js";
import { kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaRecords } from "../src/pulama-state.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { fixtureWard } from "./custody-seat-fixture.js";
import { pulamaAdmissions, pulamaAdmittedTitle, type PulamaAdmissions, type SignedPulamaAdmit } from "../src/pulama-admit.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-kukulu";
const BRANCH = "feature/kukulu";
const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const IMAGE = "sha256:" + "ab".repeat(32);
const HOT = ".persona-admissions.json";

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function stand() {
  const dir = mkdtempSync(join(tmpdir(), "lar-kukulu-records-"));
  dirs.push(dir);
  const records: SwarmWikiPort = pulamaRecords(dir);
  let raised: string | null = IMAGE;
  fx = await standPulama("kukulu-gate", (kept: CustodyHolder) => kukuluGate({
    // The product's own reading of the hand: the face's root key, off its roster row, through the seated holder.
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => raised,
  }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  // The vessel's own holder opens the face and founds its root under the ward, as a founding does.
  expect((await fx.local.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
  const root = await generateOrLoadPersonaGroupRoot(0, fixtureWard());
  // THE HAND strings a lei as the swarm door does: the root signs once, opened fresh under the ward's route.
  const hand: SwarmSignerPort = { key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(0, fixtureWard(), "a swarm control")).sign(bytes) };
  const string = (terms: SwarmLeiTerms, more: { after?: string | null; branch?: string; signer?: SwarmSignerPort } = {}): Promise<SignedSwarmAct> =>
    signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: more.branch ?? BRANCH, after: more.after ?? null, ...terms }, more.signer ?? hand);
  // THE STANDING VESSEL vouches under the custody root's vouch child, which its in-process holder derives as the pūlama does.
  const vouch = async (parts: Partial<KukuluVouchParts> = {}): Promise<SignedKukuluVouch> =>
    signKukuluVouch({ group: GROUP, branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, ...parts }, await vouchSignerOf(fx!.local));
  const hello = async (offer: unknown): Promise<string> => {
    try { return (await fx!.vessel(offer).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  const pulamaKey = (await pulamaSignerOf(fx.kept)).key;
  const trust: SwarmTrust = { hand: (k) => k === root.verifyingKey, vessel: (k) => k === pulamaKey, lead: () => false };
  const returns = async (lei: SignedSwarmAct): Promise<number> => (await records.list(swarmLeiReturnedPrefix(swarmActCid(lei)))).length;
  return { fx, face, records, string, vouch, hello, hand, trust, pulamaKey, returns, raise: (digest: string | null) => { raised = digest; } };
}

describe("RED pulama-serves-a-strung-vouched-kukulu", () => {
  test("a wide kukulu lei the hand strung, beside a vouch at the image the host raises, opens a session; its return and both tessera halves rest under the pūlama's key", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 2 });
    const v = await s.vouch();
    const cid = swarmActCid(lei);
    const vessel = s.fx.vessel({ lei: [lei], vouch: [v] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.lends()).toEqual([0]);
    await vessel.writeRecord("identity", HOT, Uint8Array.from([1]));
    expect(await vessel.readRecord("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
    expect(KUKULU_COLD_READS).toEqual(["face-proof-key", "intent-relay-key"]);
    await expect(vessel.updateColdRecord("identity", "intent-relay-key.bin", () => ({ plaintext: new Uint8Array(32), value: null }))).rejects.toMatchObject({ reading: "needs-the-human" });

    // The offered lei landed at the family's own title and reads there as the hand's.
    const leiTitle = swarmLeiRecordTitle("kukulu", BRANCH, cid);
    expect(verifySwarmRecord(await s.records.read(leiTitle), leiTitle, s.trust, GROUP)).toMatchObject({ ok: true, cid });
    // THE RETURN and the guest half each carry the pūlama's own key: no key a vessel holds signed them.
    const returned = JSON.parse((await s.records.read(`${swarmLeiReturnedPrefix(cid)}1`))!) as SignedSwarmAct;
    expect(returned.signer).toBe(s.pulamaKey);
    expect(returned.body).toMatchObject({ act: "lei-returned", lei: cid, n: 1, head: HEAD, tree: TREE, branch: BRANCH });
    // The lei the hand strung stands as the consent, and the tessera par reads the verdict after.
    expect((await vouchSignerOf(s.fx.kept)).key).not.toBe(s.pulamaKey);

    // CONFERRE before the vessel composed: the guest half stands alone and reads red. After `landRite`, the pair reads par.
    expect(await conferre(s.records, s.trust, GROUP)).toMatchObject({ par: [], red: [{ rite: "kukulu", red: "landed-absent" }] });
    expect(await vessel.landRite()).toEqual({ par: true });
    const matched = await conferre(s.records, s.trust, GROUP);
    expect(matched.red).toEqual([]);
    expect(matched.par).toHaveLength(1);
    expect((await s.records.list(swarmTesseraPrefix())).map((t) => t.split("/").pop()).sort()).toEqual(["guest", "host"]);
    // A landing rests once.
    await expect(vessel.landRite()).rejects.toMatchObject({ name: "SwarmRefused" });

    // THE COUNT: the wide lei holds two returns. A second kūkulu spends the last; a third finds none.
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("opens");
    expect(await s.returns(lei)).toBe(2);
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("swarm-lei-returns-spent");
    expect(await s.returns(lei)).toBe(2);
    expect(s.fx.server.sessions()).toBe(2);
  });

  test("a head lei serves the head its vouch names, once; a session with no rite begun lands nothing", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "head", head: HEAD });
    expect(await s.hello({ lei: [lei], vouch: [await s.vouch()] })).toBe("opens");
    expect(await s.returns(lei)).toBe(1);
    // CONTROL: the lei pins its head. A vouch walked at another head never spends it.
    const other = await s.string({ reach: "head", head: "c".repeat(40) }, { after: swarmActCid(lei) });
    expect(await s.hello({ lei: [lei, other], vouch: [await s.vouch()] })).toBe("swarm-lei-head-mismatch");
    expect(await s.returns(other)).toBe(0);
  });
});

describe("RED pulama-refuses-an-unvouched-kukulu", () => {
  test("no vouch, a lone lei, unstrung row or vouch outside an array, a forged vouch, a vouch another key signed, a lei a stranger strung and a lei for another branch each open no session and claim no return", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 3 });
    const v = await s.vouch();
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    expect(await s.hello({ lei: [lei] })).toBe("kukulu-unvouched");
    // The offer's lei and unstrung rows ride arrays: a lone row outside one refuses by the offer's shape.
    expect(await s.hello({ lei, vouch: [v] })).toBe("kukulu-lei-shape");
    expect(await s.hello({ lei: null, vouch: [v] })).toBe("kukulu-lei-shape");
    expect(await s.hello({ lei: [lei], unstrung: lei, vouch: [v] })).toBe("kukulu-unstrung-shape");
    expect(await s.hello({ lei: [lei], vouch: [{ ...v, body: { ...v.body, image: "sha256:" + "cd".repeat(32) } }] })).toBe("kukulu-vouch-signature");
    expect(await s.hello({ lei: [lei], vouch: "not-a-vouch" })).toBe("kukulu-vouch-shape");
    // A vouch rides an array, one per lent face: a lone vouch outside one refuses by the offer's shape.
    expect(await s.hello({ lei: [lei], vouch: v })).toBe("kukulu-vouch-shape");
    expect(await s.hello({ lei: [lei], vouch: ["not-a-vouch"] })).toBe("kukulu-vouch-shape");
    // A null vouch reads as no array, never as no offer.
    expect(await s.hello({ lei: [lei], vouch: null })).toBe("kukulu-vouch-shape");
    expect(await s.hello({ vouch: null })).toBe("kukulu-vouch-shape");
    // A key the custody root never yielded signs a well-formed vouch: the pūlama derives the vouch key itself and refuses it.
    const seed = new Uint8Array(32).fill(7);
    const stranger: SwarmSignerPort = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
    expect(await s.hello({ lei: [lei], vouch: [await signKukuluVouch(v.body, stranger)] })).toBe("kukulu-vouch-signer");
    // A vouched hello with no lei, a lei a stranger strung, a lei for another branch, a push lei: none reads as this face's kukulu lei.
    expect(await s.hello({ vouch: [v] })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: [await s.string({ reach: "wide", returns: 3 }, { signer: stranger })], vouch: [v] })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: [await s.string({ reach: "wide", returns: 3 }, { branch: "main" })], vouch: [v] })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: [await signSwarmAct({ act: "lei", group: GROUP, rite: "push", branch: BRANCH, after: null, reach: "wide", returns: 3 }, s.hand)], vouch: [v] })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: [{ body: "junk" }], vouch: [v] })).toBe("swarm-lei-absent");
    // THE HOST REPORTS THE IMAGE: none reported, or another than the vouch walked, refuses before the lei reads.
    s.raise(null);
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("kukulu-image-unreported");
    s.raise("sha256:" + "ee".repeat(32));
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("kukulu-image-mismatch");
    // A locked face and an unlit pūlama refuse too.
    s.raise(IMAGE);
    await s.fx.kept.lockFace(s.face.fcid);
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("kukulu-face-locked");
    expect(await s.returns(lei)).toBe(0);
    expect(await s.records.list(swarmTesseraPrefix())).toEqual([]);
    expect(s.fx.server.sessions()).toBe(0);
    await s.fx.server.lock();
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("pulama-locked");
  });
});

describe("RED pulama-refuses-a-returned-lei", () => {
  test("a head lei returned once serves no second kūkulu; an unstrung lei serves none; CONTROL: the lei served the first", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "head", head: HEAD });
    const v = await s.vouch();
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("opens");
    expect(await s.hello({ lei: [lei], vouch: [v] })).toBe("swarm-lei-returned");
    expect(await s.hello({ lei: [lei], vouch: [await s.vouch({ tree: "d".repeat(40) })] })).toBe("swarm-lei-returned");
    expect(await s.returns(lei)).toBe(1);
    expect(s.fx.server.sessions()).toBe(1);
    // A vessel that offers nothing still meets the return the pūlama's own records hold.
    expect(await s.hello({ vouch: [v] })).toBe("swarm-lei-returned");

    // THE HAND UNSTRINGS a lei that still holds returns: the offered unstringing lands, and the lei serves nothing after.
    const wide = await s.string({ reach: "wide", returns: 5 }, { after: swarmActCid(lei) });
    expect(await s.hello({ lei: [wide], vouch: [v] })).toBe("opens");
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(wide) }, s.hand);
    expect(await s.hello({ lei: [wide], unstrung: [unstrung], vouch: [v] })).toBe("swarm-lei-unstrung");
    expect(await s.hello({ lei: [wide], vouch: [v] })).toBe("swarm-lei-unstrung");
    expect(await s.returns(wide)).toBe(1);
    // An unstringing a stranger signed lands nowhere: only the hand ends its own lei.
    const next = await s.string({ reach: "wide", returns: 2 }, { after: swarmActCid(wide) });
    const seed = new Uint8Array(32).fill(9);
    const forged = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(next) }, { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) });
    expect(await s.hello({ lei: [next], unstrung: [forged], vouch: [v] })).toBe("opens");
  });
});

const GROUPS = ["group-lend-steward", "group-lend-engineer", "group-lend-referee"] as const;

/** Three faces at one pūlama, each with its own hand (its root under the ward); the gate over the product's lei family. */
async function standLend(admissions?: PulamaAdmissions) {
  const dir = mkdtempSync(join(tmpdir(), "lar-kukulu-lend-"));
  dirs.push(dir);
  const records: SwarmWikiPort = pulamaRecords(dir);
  fx = await standPulama("kukulu-lend", (kept: CustodyHolder) => kukuluGate({
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => IMAGE, ...(admissions ? { admissions } : {}),
  }));
  const faces = [], hands: SwarmSignerPort[] = [];
  for (const [i, group] of GROUPS.entries()) {
    faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal: i, slots: fixtureSlots }));
    expect((await fx.local.unlockFace({ ordinal: i }, fixtureRoute)).reading).toBe("opens");
    const root = await generateOrLoadPersonaGroupRoot(i, fixtureWard());
    hands.push({ key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(i, fixtureWard(), "a swarm control")).sign(bytes) });
    await fx.kept.writeRecord("identity", faceAtomGroupFile(group), Uint8Array.from([i]));
  }
  /** A kukulu lei for the face at `ordinal`, strung by `by`'s hand (its own, unless a test names another). */
  const string = (ordinal: number, by = ordinal): Promise<SignedSwarmAct> =>
    signSwarmAct({ act: "lei", group: GROUPS[ordinal]!, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, hands[by]!);
  const vouch = async (ordinal: number): Promise<SignedKukuluVouch> =>
    signKukuluVouch({ group: GROUPS[ordinal]!, branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE }, await vouchSignerOf(fx!.local));
  const returns = async (lei: SignedSwarmAct): Promise<number> => (await records.list(swarmLeiReturnedPrefix(swarmActCid(lei)))).length;
  const sessionScope = (): unknown => fx!.lines.fromPulama.map((l) => JSON.parse(l) as Record<string, unknown>).filter((f) => f["t"] === "session").at(-1)?.["scope"];
  const hello = async (offer: unknown): Promise<string> => {
    try { return (await fx!.vessel(offer).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  return { fx, faces, hands, records, string, vouch, returns, sessionScope, hello };
}

describe("RED the lend draws one kūkulu lei per lent face", () => {
  test("two faces' leis, each strung by its own hand beside its own vouch, lend both; each lei returns once; a face outside the lend still refuses; both halves land par", async () => {
    const s = await standLend();
    const l0 = await s.string(0), l2 = await s.string(2);
    const vessel = s.fx.vessel({ lei: [l0, l2], vouch: [await s.vouch(0), await s.vouch(2)] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.lends()).toEqual([0, 2]);
    expect(vessel.unlockedFaces()).toEqual([s.faces[0]!.fcid, s.faces[2]!.fcid]);
    expect([await s.returns(l0), await s.returns(l2)]).toEqual([1, 1]);
    expect(await vessel.readRecord("identity", faceAtomGroupFile(GROUPS[2]))).toEqual({ reading: "opens", plaintext: Uint8Array.from([2]) });
    // THE WIDENING KEEPS THE WALL: the face no lei lent refuses, naming the lend.
    await expect(vessel.readRecord("identity", faceAtomGroupFile(GROUPS[1]))).rejects.toMatchObject({ reading: "outside-the-lei", message: expect.stringContaining("h0, h2") });
    expect(s.sessionScope()).toMatchObject({ faces: [{ fcid: s.faces[0]!.fcid, ordinal: 0 }, { fcid: s.faces[2]!.fcid, ordinal: 2 }] });
    expect(await vessel.landRite()).toEqual({ par: true });
    expect((await s.records.list(swarmTesseraPrefix())).length).toBe(4);
  });

  test("RED a par kūkulu over two faces admits the image on every lent face's tessera pair, each face naming its own rite's tessera; CONTROL: the admitted set lends both faces again", async () => {
    let records: SwarmWikiPort | null = null;
    const admissions: PulamaAdmissions = {
      admitted: (image, by) => pulamaAdmissions(records!).admitted(image, by), admitByRite: (image, rites, by) => pulamaAdmissions(records!).admitByRite(image, rites, by),
      admitByHand: (image, faces, by) => pulamaAdmissions(records!).admitByHand(image, faces, by), reserved: (image, faces, by) => pulamaAdmissions(records!).reserved(image, faces, by),
      list: (by) => pulamaAdmissions(records!).list(by),
      unadmit: (image, by) => pulamaAdmissions(records!).unadmit(image, by), ended: (by) => pulamaAdmissions(records!).ended(by),
    };
    const s = await standLend(admissions);
    records = s.records;
    const vessel = s.fx.vessel({ lei: [await s.string(0), await s.string(2)], vouch: [await s.vouch(0), await s.vouch(2)] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(await vessel.landRite()).toEqual({ par: true });
    const halves = await s.records.list(swarmTesseraPrefix());
    const tesserae = [...new Set(halves.map((t) => t.slice(swarmTesseraPrefix().length).split("/")[0]!))].sort();
    expect(tesserae).toHaveLength(2);
    const row = JSON.parse((await s.records.read(pulamaAdmittedTitle(IMAGE)))!) as SignedPulamaAdmit;
    expect(row.body).toMatchObject({ act: "image-admitted", by: "rite", faces: [{ ordinal: 0 }, { ordinal: 2 }] });
    const named = (row.body as { tesserae?: ReadonlyArray<{ ordinal: number; tessera: string }> }).tesserae ?? [];
    expect(named.map((t) => t.ordinal)).toEqual([0, 2]);
    expect(named.map((t) => t.tessera).sort()).toEqual(tesserae);
    await vessel.lock();
    const again = s.fx.vessel({});
    expect((await again.unlock([])).reading).toBe("opens");
    expect(again.lends()).toEqual([0, 2]);
  });

  test("a vouched face whose lei is missing waits by name and the lend stands for the rest; a lei one face's hand strung for another face lends nothing", async () => {
    const s = await standLend();
    const l0 = await s.string(0);
    const vessel = s.fx.vessel({ lei: [l0], vouch: [await s.vouch(0), await s.vouch(2)] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.lends()).toEqual([0]);
    expect(s.sessionScope()).toMatchObject({ faces: [{ ordinal: 0 }], unlent: [{ ordinal: 2, reading: "swarm-lei-absent" }] });
    await vessel.lock();
    // NO FACE LENDS ANOTHER: face 0's hand strings a lei naming face 2's group; it verifies as no hand of face 2, so face 2 waits.
    const forged = await s.string(2, 0);
    const l0b = await s.string(0);
    const again = s.fx.vessel({ lei: [l0b, forged], vouch: [await s.vouch(0), await s.vouch(2)] });
    expect((await again.unlock([])).reading).toBe("opens");
    expect(again.lends()).toEqual([0]);
    expect(await s.returns(forged)).toBe(0);
    // Every vouched face waiting refuses the hello by the first face's reading.
    expect(await s.hello({ lei: [], vouch: [await s.vouch(1), await s.vouch(2)] })).toBe("swarm-lei-absent");
  });

  test("a dark face waits and its lei spends nothing; a vouch set naming one face twice refuses", async () => {
    const s = await standLend();
    await s.fx.kept.lockFace(s.faces[2]!.fcid);
    const l0 = await s.string(0), l2 = await s.string(2);
    const vessel = s.fx.vessel({ lei: [l0, l2], vouch: [await s.vouch(0), await s.vouch(2)] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.lends()).toEqual([0]);
    expect(s.sessionScope()).toMatchObject({ unlent: [{ ordinal: 2, reading: "kukulu-face-locked" }] });
    expect([await s.returns(l0), await s.returns(l2)]).toEqual([1, 0]);
    expect(await s.hello({ lei: [l0], vouch: [await s.vouch(0), await s.vouch(0)] })).toBe("kukulu-vouch-duplicate");
  });
});

describe("RED the admitted image lends its set (L4)", () => {
  /** An admitted set stub: the row names `faces`, as the admission records carry a lend. */
  const admittedSet = (faces: () => ReadonlyArray<{ fcid: string; ordinal: number }>) => {
    const reserved: unknown[] = [];
    const admissions = {
      admitted: async () => ({ ...faces()[0]!, faces: faces(), by: "hand" as const, tessera: "0".repeat(64) }),
      reserved: async (_image: string, face: unknown) => { reserved.push(face); return reserved.length; },
      admitByRite: async () => {}, admitByHand: async () => ({ tessera: "0".repeat(64) }), list: async () => [],
    } as unknown as PulamaAdmissions;
    return { admissions, reserved };
  };

  test("an image admitted for {h0, h2} serves a scope of both; a dark h2 waits and h0 serves; every lent face dark refuses by name; h1 stays outside", async () => {
    let lent: Array<{ fcid: string; ordinal: number }> = [];
    const { admissions, reserved } = admittedSet(() => lent);
    const s = await standLend(admissions);
    lent = [{ fcid: s.faces[0]!.fcid, ordinal: 0 }, { fcid: s.faces[2]!.fcid, ordinal: 2 }];
    const vessel = s.fx.vessel({});
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.lends()).toEqual([0, 2]);
    expect(vessel.waiting()).toEqual([]);
    await expect(vessel.readRecord("identity", faceAtomGroupFile(GROUPS[1]))).rejects.toMatchObject({ reading: "outside-the-lei" });
    expect(reserved).toHaveLength(1);
    await vessel.lock();
    await s.fx.kept.lockFace(s.faces[2]!.fcid);
    const partial = s.fx.vessel({});
    expect((await partial.unlock([])).reading).toBe("opens");
    expect(partial.lends()).toEqual([0, 2]);
    expect(partial.waiting()).toEqual([2]);
    await partial.lock();
    await s.fx.kept.lockFace(s.faces[0]!.fcid);
    expect(await s.hello({})).toBe("kukulu-face-locked");
  });

  test("an admission row whose faces read no lent set refuses the hello by the set's own reading and rests no re-service", async () => {
    const reserved: unknown[] = [];
    const admissions = {
      admitted: async () => ({ refusal: "lent-faces-empty", message: "lent-faces-empty: a lend names at least one face" }),
      reserved: async (_image: string, face: unknown) => { reserved.push(face); return reserved.length; },
      admitByRite: async () => {}, admitByHand: async () => ({ tessera: "0".repeat(64) }), list: async () => [],
    } as unknown as PulamaAdmissions;
    const s = await standLend(admissions);
    expect(await s.hello({})).toBe("lent-faces-empty");
    expect(reserved).toHaveLength(0);
  });
});
