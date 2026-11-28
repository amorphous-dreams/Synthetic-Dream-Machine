/**
 * kukulu-offer — the standing vessel rests what a kūkulu carries, and the next vessel offers it to the pūlama once: the line's
 * lei out of the vessel's own control records, the vouch it signs over the image the host named, one file in the config home.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { kukuluVouchDigest, verifyKukuluVouch } from "@lararium/mesh/kukulu-vouch";
import {
  signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiUnstrungTitle,
  type SignedSwarmAct, type SwarmLeiTerms, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh/swarm-tiddlers";
import { beginRite, pendingBegins } from "@lararium/mesh/swarm-tessera";
import type { CustodyHolder } from "../src/custody-holder.js";
import { kukuluGate, pulamaSignerOf, vouchKeyOf } from "../src/kukulu-gate.js";
import { pulamaAdmissions } from "../src/pulama-admit.js";
import { setHalfDown, supersedeBegins } from "../src/commands/rite.js";
import { kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { KUKULU_OFFER_FILE, consumeKukuluOffer, kukuluOfferBase, spendKukuluOffer, writeKukuluOffer, type KukuluOffer } from "../src/kukulu-offer.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaStandBy, readKukuluOffer } from "../src/pulama-seat.js";
import { pulamaRecords } from "../src/pulama-state.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { fixtureWard } from "./custody-seat-fixture.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-offer";
const BRANCH = "main";
const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const IMAGE = "sha256:" + "ab".repeat(32);
const HEAD2 = "c".repeat(40);
const IMAGE2 = "sha256:" + "cd".repeat(32);
const NO_COSIGN = { accepts: () => true };

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** The standing vessel's control records, in memory: where its lei and its unstringings rest. */
function controlWiki(): SwarmWikiPort {
  const rows = new Map<string, string>();
  return {
    read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); },
    writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)),
  };
}

async function stand(o: { readonly admissions?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "lar-kukulu-offer-"));
  dirs.push(dir);
  const path = join(dir, "config", KUKULU_OFFER_FILE);
  let raised: string | null = IMAGE;
  const records = pulamaRecords(join(dir, "pulama-state"));
  // THE ADMITTED SET, where a test asks it: the pūlama's own records, so an image the hand admitted enters with no offer.
  const admissions = o.admissions ? pulamaAdmissions(records) : undefined;
  fx = await standPulama("kukulu-offer", (kept: CustodyHolder) => kukuluGate({
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => raised,
    ...(admissions ? { admissions } : {}),
  }));
  const founded = await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  expect((await fx.local.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
  const root = await generateOrLoadPersonaGroupRoot(0, fixtureWard());
  const hand: SwarmSignerPort = { key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(0, fixtureWard(), "a swarm control")).sign(bytes) };
  // THE STANDING VESSEL'S OWN WITNESS: its device atom signs the returns and halves in its control records.
  const seed = new Uint8Array(32).fill(4);
  const atom: SwarmSignerPort = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const trust: SwarmTrust = { hand: (k) => k === root.verifyingKey, vessel: (k) => k === atom.key, lead: () => false };
  const wiki = controlWiki();
  const string = async (terms: SwarmLeiTerms, after: string | null = null): Promise<SignedSwarmAct> => {
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after, ...terms }, hand);
    await wiki.write(swarmLeiRecordTitle("kukulu", BRANCH, swarmActCid(lei)), JSON.stringify(lei));
    return lei;
  };
  // THE RITE'S BEGIN, as the standing vessel rests it: the lei's return and the guest half, naming the head and the image.
  const begin = (image: string | undefined = IMAGE, head = HEAD) => beginRite(wiki, { rite: "kukulu", branch: BRANCH, head, tree: TREE, ...(image === undefined ? {} : { image }) }, trust, GROUP, atom, NO_COSIGN);
  /** The offer over the resting file: its base reads the hash of the file this caller last read (none where none rests). */
  const offer = (image = IMAGE, o: { head?: string; base?: string | null } = {}) => writeKukuluOffer({ wiki, faces: [{ group: GROUP, trust, ward: NO_COSIGN }], branch: BRANCH, head: o.head ?? HEAD, tree: TREE, image, holder: fx!.local, path,
    base: o.base === undefined ? kukuluOfferBase(path) : o.base });
  const hello = async (offered: unknown): Promise<string> => {
    try { return (await fx!.vessel(offered).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  /** The hand's admission of `image` at the pūlama, for the one face (`pulama admit`). */
  const admit = async (image: string): Promise<void> => { await admissions!.admitByHand(image, [{ fcid: founded.fcid, ordinal: founded.ordinal }], await pulamaSignerOf(fx!.kept)); };
  return { fx, path, wiki, hand, trust, atom, string, begin, offer, hello, admit, raise: (d: string | null) => { raised = d; } };
}

describe("RED kukulu-offer-reaches-the-new-vessel", () => {
  test("the standing vessel's offer file carries the line's lei and its vouch; the next vessel reads it, the pūlama serves it, and the file goes after that one session", async () => {
    const s = await stand();
    const first = await s.string({ reach: "wide", returns: 1 });
    const lei = await s.string({ reach: "wide", returns: 3 }, swarmActCid(first));
    await s.begin();
    const wrote = await s.offer();
    expect(wrote).toMatchObject({ path: s.path, lei: 2 });
    expect(statSync(s.path).mode & 0o777).toBe(0o600);

    // THE FILE: the whole line, and a vouch this vessel's custody root signed over the image the host named.
    const file = JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer;
    expect(file.lei.map((l) => swarmActCid(l)).sort()).toEqual([swarmActCid(first), swarmActCid(lei)].sort());
    expect(file.unstrung).toEqual([]);
    // ONE VOUCH PER LENT FACE, each naming its own face's group.
    expect(file.vouch).toHaveLength(1);
    const vouched = verifyKukuluVouch(file.vouch[0], await vouchKeyOf(s.fx.kept));
    expect(vouched).toMatchObject({ ok: true, digest: wrote.vouch[0] });
    expect(file.vouch[0]!.body).toMatchObject({ group: GROUP, branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE });
    expect(kukuluVouchDigest(file.vouch[0]!)).toBe(wrote.vouch[0]);
    // Nothing secret rests in the file: no route, no key the holder holds.
    expect(readFileSync(s.path, "utf8")).not.toContain(Buffer.from(s.fx.treeKey).toString("hex"));

    // THE NEW VESSEL wakes holding nothing, reads the file its environment names, and stands by the pūlama.
    const composed: boolean[] = [], lines: string[] = [];
    const vessel = s.fx.vessel(readKukuluOffer(s.path));
    const by = pulamaStandBy({
      holder: vessel, recompose: async (sovereign) => { composed.push(sovereign); return { standing: sovereign ? "hearth" : "floor" }; },
      onLog: (l) => lines.push(l), consumeOffer: () => consumeKukuluOffer(s.path),
    });
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(composed).toEqual([true]);
    expect(lines.join("\n")).toMatch(/the tessera reads par/);
    // ONE KŪKULU, ONE OFFER: the file left with the session, so a plain restart afterwards wears nothing.
    expect(existsSync(s.path)).toBe(false);
    expect(readKukuluOffer(s.path)).toEqual({});
    expect(await s.hello(readKukuluOffer(s.path))).toBe("pulama-image-unadmitted");
    // CONTROL: the lei still holds returns; a fresh rite writes a fresh offer, and that one serves.
    await s.offer();
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
  });

  test("a later offer supersedes the last; an unstringing rides the offer; a hello the pūlama refuses leaves the file for the next dial", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 3 });
    await s.begin();
    const one = await s.offer();
    // A LATER RITE begins over another image, and its offer (over the base it read) supersedes the first.
    await s.begin(IMAGE2);
    const two = await s.offer("sha256:" + "cd".repeat(32));
    expect(two.vouch).not.toEqual(one.vouch);
    expect((JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer).vouch[0]!.body.image).toBe("sha256:" + "cd".repeat(32));
    // The host raises another image than the newest offer names: the offer reads as none, the unadmitted image refuses, and the
    // file stays.
    const vessel = s.fx.vessel(readKukuluOffer(s.path));
    const by = pulamaStandBy({ holder: vessel, recompose: async () => ({ standing: "floor" }), onLog: () => {}, consumeOffer: () => consumeKukuluOffer(s.path) });
    expect(await by.dial()).toEqual({ session: false, waits: "pulama-image-unadmitted" });
    expect(existsSync(s.path)).toBe(true);
    // The host's report moves to the image the offer names: the SAME vessel dials again with the same file and stands.
    s.raise("sha256:" + "cd".repeat(32));
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(existsSync(s.path)).toBe(false);

    // THE HAND UNSTRINGS the lei and strings a fresh one after it: the next offer carries the unstringing beside the fresh lei.
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(lei) }, s.hand);
    await s.wiki.write(swarmLeiUnstrungTitle(swarmActCid(lei)), JSON.stringify(unstrung));
    await s.string({ reach: "wide", returns: 2 }, swarmActCid(lei));
    await s.begin(IMAGE2);
    await s.offer("sha256:" + "cd".repeat(32));
    const carried = JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer;
    expect(carried.unstrung).toHaveLength(1);
    expect(carried.lei).toHaveLength(2);
  });

  test("RED every lent face's line rides the offer: one vouch per face, each over its own group; a face whose line carries no lei rides its vouch and waits by name", async () => {
    const s = await stand();
    await s.string({ reach: "wide", returns: 2 });
    await s.begin();
    const trust: SwarmTrust = { hand: () => false, vessel: () => false, lead: () => false };
    const wrote = await writeKukuluOffer({
      wiki: s.wiki, faces: [{ group: GROUP, trust: { hand: () => true, vessel: () => true, lead: () => false }, ward: NO_COSIGN, name: "h0" }, { group: "group-two", trust, ward: NO_COSIGN, name: "h1" }],
      branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, holder: s.fx.local, path: s.path, base: null,
    });
    expect(wrote).toMatchObject({ lei: 1, faces: ["h0", "h1"], waits: ["h1"] });
    const file = JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer;
    expect(file.vouch.map((v) => v.body.group)).toEqual([GROUP, "group-two"]);
    // CONTROL: one face with its lei waits for nothing.
    expect((await s.offer()).waits).toEqual([]);
  });

  test("an offer with no lei or no image digest writes nothing; with a lei and no receipt standing the offer writes and the pūlama serves it", async () => {
    const s = await stand();
    await expect(s.offer()).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await s.string({ reach: "wide", returns: 2 });
    await expect(s.offer("lares-surface:local")).rejects.toMatchObject({ code: "rite-offer-malformed" });
    expect(existsSync(s.path)).toBe(false);
    // A LEI WHOSE RETURN NO BEGIN SPENT names no head this vessel ran: the offer writes nothing until the rite begins.
    await expect(s.offer()).rejects.toMatchObject({ code: "rite-begun-absent" });
    expect(existsSync(s.path)).toBe(false);
    await s.begin();
    await s.offer();
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
    expect(consumeKukuluOffer(s.path)).toBe(true);
    expect(consumeKukuluOffer(s.path)).toBe(false);
    expect(consumeKukuluOffer(undefined)).toBe(false);
  });
});

/**
 * THE OFFER BINDS TO THE LEI (operator ruling 2026-11-25, lar:///ha.ka.ba/kahua/memory/ruling/2026-11-25-offer-binds-and-census):
 * the vessel signs its vouch over the head and image the face's live lei and its begun half name, never over what the caller
 * picks, and refuses by the gate's own names before it writes; an overwrite of a resting offer names the base it read.
 */
describe("RED rite-offer-binds-its-vouch-to-the-lei", () => {
  test("RED an offer whose lei the hand unstrung refuses swarm-lei-unstrung and writes nothing; a forked line refuses swarm-lei-forked", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 2 });
    await s.begin();
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(lei) }, s.hand);
    await s.wiki.write(swarmLeiUnstrungTitle(swarmActCid(lei)), JSON.stringify(unstrung));
    await expect(s.offer()).rejects.toMatchObject({ code: "swarm-lei-unstrung", message: expect.stringMatching(/lares lei kui rite=kukulu branch=main/) });
    expect(existsSync(s.path)).toBe(false);
    const t = await stand();
    await t.string({ reach: "wide", returns: 2 });
    await t.string({ reach: "wide", returns: 3 });
    await expect(t.offer()).rejects.toMatchObject({ code: "swarm-lei-forked" });
    expect(existsSync(t.path)).toBe(false);
  });

  test("RED an offer naming a head the lei pins otherwise refuses swarm-lei-head-mismatch; a head the begun half never named refuses rite-offer-differs; an image it never named refuses kukulu-image-mismatch", async () => {
    const s = await stand();
    await s.string({ reach: "head", head: HEAD });
    await s.begin();
    await expect(s.offer(IMAGE, { head: HEAD2 })).rejects.toMatchObject({ code: "swarm-lei-head-mismatch" });
    expect(existsSync(s.path)).toBe(false);
    const t = await stand();
    await t.string({ reach: "wide", returns: 2 });
    await t.begin();
    await expect(t.offer(IMAGE, { head: HEAD2 })).rejects.toMatchObject({ code: "rite-offer-differs", message: expect.stringMatching(/lares rite kukulu/) });
    await expect(t.offer(IMAGE2)).rejects.toMatchObject({ code: "kukulu-image-mismatch" });
    expect(existsSync(t.path)).toBe(false);
    // CONTROL: the head and image the begun half names write the offer.
    expect((await t.offer()).lei).toBe(1);
  });

  test("RED an overwrite of a resting offer with a stale base, or none, refuses conflict and leaves the resting file; CONTROL: the base just read overwrites", async () => {
    const s = await stand();
    await s.string({ reach: "wide", returns: 3 });
    await s.begin();
    await s.offer();
    const stale = kukuluOfferBase(s.path)!;
    expect(stale).toMatch(/^sha256:[0-9a-f]{64}$/);
    await s.begin(IMAGE2);
    await s.offer(IMAGE2);
    const resting = readFileSync(s.path, "utf8");
    await expect(s.offer(IMAGE2, { base: stale })).rejects.toMatchObject({ code: "conflict", message: expect.stringMatching(/lares rite receipts rite=kukulu/) });
    await expect(s.offer(IMAGE2, { base: null })).rejects.toMatchObject({ code: "conflict" });
    expect(readFileSync(s.path, "utf8")).toBe(resting);
    await s.offer(IMAGE2, { base: kukuluOfferBase(s.path) });
    // THE TRUE PATH still serves: the pūlama opens on the offer.
    s.raise(IMAGE2);
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
  });
});

/** The cold read's findings on 4837a7480 (F2, F3, F5): the honest paths the binding must not stick. */
describe("RED rite-offer-keeps-the-honest-paths", () => {
  test("RED F2 (b) a lei restrung after an interrupted begin moves the tip past the lei that paid: the offer binds the begun half that lei's return paid for", async () => {
    const s = await stand();
    const paid = await s.string({ reach: "wide", returns: 2 });
    await s.begin();
    await s.string({ reach: "wide", returns: 2 }, swarmActCid(paid));
    expect((await s.offer()).lei).toBe(2);
  });

  test("RED kapae (a) an unstring tombstones the rite its lei paid for: a fresh lei never resurrects the stopped half, the offer binds nothing until the face begins afresh, and the raw debt hides it so the fresh begin stands", async () => {
    const t = await stand();
    const ended = await t.string({ reach: "wide", returns: 2 });
    await t.begin();
    await t.wiki.write(swarmLeiUnstrungTitle(swarmActCid(ended)), JSON.stringify(await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(ended) }, t.hand)));
    await t.string({ reach: "wide", returns: 2 }, swarmActCid(ended));
    await expect(t.offer()).rejects.toMatchObject({ code: "rite-begun-absent" });
    expect(existsSync(t.path)).toBe(false);
    expect(await pendingBegins(t.wiki, "kukulu", BRANCH)).toEqual([]);
    // THE FRESH RITE under the fresh lei binds, and the unstringing still rides.
    await t.begin();
    expect((await t.offer()).lei).toBe(2);
    expect((JSON.parse(readFileSync(t.path, "utf8")) as KukuluOffer).unstrung).toHaveLength(1);
  });

  test("RED F5 a face whose lei rows stand on no chain from the line's root waits by name, as the begin waits it; CONTROL: the other face's lend stands", async () => {
    const s = await stand();
    await s.string({ reach: "wide", returns: 2 });
    await s.begin();
    const orphan = await signSwarmAct({ act: "lei", group: "group-two", rite: "kukulu", branch: BRANCH, after: "f".repeat(64), reach: "wide", returns: 2 }, s.hand);
    await s.wiki.write(swarmLeiRecordTitle("kukulu", BRANCH, swarmActCid(orphan)), JSON.stringify(orphan));
    const all: SwarmTrust = { hand: () => true, vessel: () => true, lead: () => false };
    const wrote = await writeKukuluOffer({ wiki: s.wiki, faces: [{ group: GROUP, trust: all, ward: NO_COSIGN, name: "h0" }, { group: "group-two", trust: all, ward: NO_COSIGN, name: "h1" }],
      branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, holder: s.fx.local, path: s.path, base: null });
    expect(wrote).toMatchObject({ lei: 1, faces: ["h0", "h1"], waits: ["h1"] });
  });

  test("RED F3 an offer some other hand rests while this one signs is never written over: the base re-reads just before the rename and refuses conflict", async () => {
    const s = await stand();
    await s.string({ reach: "wide", returns: 2 });
    await s.begin();
    let raced = false;
    const holder = { derive: (domain: Parameters<typeof s.fx.local.derive>[0]) => {
      if (!raced) { raced = true; mkdirSync(dirname(s.path), { recursive: true }); writeFileSync(s.path, "another hand's offer"); }
      return s.fx.local.derive(domain);
    } };
    await expect(writeKukuluOffer({ wiki: s.wiki, faces: [{ group: GROUP, trust: { hand: () => true, vessel: () => true, lead: () => false }, ward: NO_COSIGN }],
      branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, holder, path: s.path, base: null })).rejects.toMatchObject({ code: "conflict" });
    expect(readFileSync(s.path, "utf8")).toBe("another hand's offer");
  });
});

/**
 * RESTAND-FILES-SMOOTH (1) A STALE OFFER NEVER HOLDS THE DOOR: a set-down half leaves the offer resting with vouches over an
 * image that never ran; the next vessel offers it, and the pūlama reads an offer for another image as no offer, opening by the
 * admitted image. Setting the half down still spends the offer its vouch names.
 */
describe("RED a half set down spends the offer its vouches name", () => {
  test("RED begin → offer rests → a vessel on an admitted image opens with no hand, stale offer and all; abandon spends the offer; a half no vouch names leaves it", async () => {
    const s = await stand({ admissions: true });
    await s.string({ reach: "wide", returns: 3 });
    // THE STALE BEGIN: a kūkulu at HEAD2 over IMAGE2, an image no vessel ever ran; its offer rests.
    const stale = await s.begin(IMAGE2, HEAD2);
    await s.offer(IMAGE2, { head: HEAD2 });
    // THE HOST RAISES THE ADMITTED IMAGE: the vessel the hand admitted earlier.
    await s.admit(IMAGE);
    s.raise(IMAGE);
    // THE STALE OFFER owns nothing for the raised image: the next vessel offers it, and the pūlama opens by the admitted image.
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
    // CONTROL: a half no vouch names (another head, another group) spends nothing.
    expect(spendKukuluOffer(s.path, { group: GROUP, branch: BRANCH, head: HEAD, image: IMAGE2 })).toBe(false);
    expect(spendKukuluOffer(s.path, { group: "group-other", branch: BRANCH, head: HEAD2, image: IMAGE2 })).toBe(false);
    expect(existsSync(s.path)).toBe(true);
    // THE HAND SETS THE STALE HALF DOWN: the offer its vouch named goes with it.
    const down = await setHalfDown(s.wiki, { tessera: stale.tessera }, s.trust, GROUP, s.atom, s.path);
    expect(down).toMatchObject({ tessera: stale.tessera, by: "hand", offerSpent: true });
    expect(existsSync(s.path)).toBe(false);
    // THE NEXT VESSEL carries no offer and enters by the admitted image, with no hand.
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
  });

  test("RED a kūkulu's supersede spends the offer its vouch names, as the hand's abandon does", async () => {
    const s = await stand();
    await s.string({ reach: "wide", returns: 3 });
    const stale = await s.begin(IMAGE2, HEAD2);
    await s.offer(IMAGE2, { head: HEAD2 });
    const down = await supersedeBegins(s.wiki, [stale.tessera], HEAD, BRANCH, new Map([[GROUP, "h0"]]),
      async () => ({ trust: s.trust, group: GROUP, vessel: s.atom }), s.path);
    expect(down).toEqual([{ face: "h0", tessera: stale.tessera, head: HEAD2, offerSpent: true }]);
    expect(existsSync(s.path)).toBe(false);
    expect(await pendingBegins(s.wiki, "kukulu", BRANCH)).toEqual([]);
  });
});
