/**
 * pulama-keeper — THE KEEPER TALLY: the lit keeper names its successor's closure under the hand's route, vests the house's end of the
 * bond to the successor's one-handoff key where the successor's reported closure matches, and the successor lands par. Every
 * mismatch, replay and unnamed key refuses by name; no answer and no log line carries a route or a key; two keepers never both hold
 * the fire; the budget carries.
 */
import { linkSync, mkdtempSync, rmSync, statSync, unlinkSync } from "node:fs";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, signKukuluVouch } from "@lararium/mesh";
import { keeperRiteOver, pulamaSignerOf, vouchSignerOf } from "../src/kukulu-gate.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { UNLOCK_ATTEMPTS_PER_BOOT, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaAdmissions } from "../src/pulama-admit.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "../src/pulama-hand.js";
import { KEEPER_STRUCK_EVERY, keeperFold, pulamaKeeperPrefix } from "../src/pulama-keeper.js";
import { servePulama } from "../src/pulama-server.js";
import { listenPulama, pulamaAnswers } from "../src/pulama-socket.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { handVerbExit, runHandVerb } from "../src/pulama-verbs.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { createHash } from "node:crypto";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
import { cosignedCommit, selfCosigned } from "../../lararium-mesh/tests/keeper-cosign-fixture.js";
import { SESSION_DERIVES, fixtureRoute, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const D = "sha256:" + "d0".repeat(32), D2 = "sha256:" + "94".repeat(32), D3 = "sha256:" + "33".repeat(32), IMAGE = "sha256:" + "1a".repeat(32);
let fx: PulamaFixture | null = null;
const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-keeper-")); dirs.push(d); return d; };
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** One house: the lit keeper (the fixture's holder, one face open) and a door over a shared state dir; `successor()` stands another beside it. */
async function house(label: string) {
  fx = await standPulama(label, () => openGate({ faces: lend(0), coldReads: [] }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(`group-${label}`), ordinal: 0, slots: fixtureSlots });
  const state = scratch(), records = pulamaRecords(state), image = pulamaImage(state);
  const lines: string[] = [], answers: PulamaHandAnswer[] = [];
  /** THE LIVE RITE, faked at its port (`keeperRiteOver` reads it for real below): an offer of "rite" begins one, at `riteDevices`. */
  const live = { devices: 1, begun: 0 };
  const keeperRite = async (offer: unknown, keeper: { readonly to: string; readonly next: string }) => {
    if (offer !== "rite") return { ok: false as const, refusal: "vest-rite-absent", detail: "a vest rides a live kūkulu rite, and this frame carries no offer with a vouch" };
    live.begun++;
    return { ok: true as const, rite: [sha(`${keeper.to}${keeper.next}${live.begun}`)], devices: live.devices };
  };
  const watch = (door: (f: unknown) => Promise<PulamaHandAnswer>) => async (frame: unknown) => { const a = await door(frame); answers.push(a); return a; };
  const old = watch(pulamaHandDoor({ holder: fx.kept, server: fx.server, image, records, admissions: pulamaAdmissions(records), keeperRite, worn: () => 0, onLog: (l) => lines.push(l) }));
  await old({ op: "image", digest: IMAGE, closure: D });
  const successor = (closure = D2) => {
    const holder: CustodyHolder = makeCustodyHolder({ io: new FsCustodyIo(fx!.seat.homes), homes: fx!.seat.homes });
    const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
    const door = watch(pulamaHandDoor({ holder, server, image, records, admissions: pulamaAdmissions(records), keeperRite, onLog: (l) => lines.push(l) }));
    return { holder, door, report: () => door({ op: "closure", digest: closure }) };
  };
  /** A commit as the shim sends it: the device count the vessel read, or (null) none read. */
  const commit = (next = D2, devices: number | null = 1) => old({ op: "keeper-commit", next, ...(devices === null ? {} : { devices }), credentials: fixtureRoute });
  return { face, records, image, old, successor, commit, lines, answers, live };
}

/** Offer, vest and receive: the whole unattended handoff over one successor. */
async function handoff(h: Awaited<ReturnType<typeof house>>, from: (f: unknown) => Promise<PulamaHandAnswer>, closure = D2, riteOffer: unknown = "rite") {
  const next = h.successor(closure);
  await next.report();
  const offer = await next.door({ op: "keeper-offer" });
  const vest = await from({ op: "keeper-vest", to: offer["to"], closure, offer: riteOffer });
  const landed = vest["reading"] === "vested" ? await next.door({ op: "keeper-receive", slot: vest["slot"] }) : null;
  return { next, offer, vest, landed };
}

describe("RED keeper-commit names one successor under the hand's route", () => {
  test("a commit rests the guest half; a later one supersedes it; CONTROL: unlit, unreported, a malformed next and a wrong route each refuse and rest nothing", async () => {
    const h = await house("keeper-commit");
    const unlit = h.successor();
    expect(await unlit.door({ op: "keeper-commit", next: D2, credentials: fixtureRoute })).toMatchObject({ reading: "pulama-locked" });
    expect(await h.old({ op: "keeper-commit", next: "sha256:short", credentials: fixtureRoute })).toMatchObject({ reading: "next-malformed" });
    expect(await h.old({ op: "keeper-commit", next: D2, credentials: [{ kind: "passphrase", passphrase: "not-the-route" }] })).toMatchObject({ reading: "no-slot-opens" });
    expect(await h.records.list(pulamaKeeperPrefix())).toEqual([]);
    const first = await h.commit(D3);
    expect(first).toMatchObject({ reading: "committed", v: 1, next: D3, supersedes: null });
    const second = await h.commit(D2);
    expect(second).toMatchObject({ reading: "committed", v: 1, next: D2 });
    expect(second["supersedes"]).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { v: 0, pending: D2, fork: false }, vestReady: D2, closure: D });
  });

  test("the verb reads the door first and prompts with the successor closure; a refused commit exits 1", async () => {
    const h = await house("keeper-commit-verb");
    const labels: string[] = [];
    const frames: Array<Readonly<Record<string, unknown>>> = [];
    const answer = await runHandVerb("keeper-commit", [D2, "--devices", "1"], { ask: (f) => { frames.push(f); return h.old(f); }, route: async (label) => { labels.push(label); return FIXTURE_PASSPHRASE; } });
    expect(answer).toMatchObject({ reading: "committed", next: D2 });
    expect(frames.at(-1)).toMatchObject({ op: "keeper-commit", devices: 1 });
    await expect(runHandVerb("keeper-commit", [D2, "--devices", "0"], { ask: (f) => h.old(f), route: async () => FIXTURE_PASSPHRASE })).rejects.toThrow(/usage/);
    expect(labels).toEqual([expect.stringContaining(D2)]);
    expect(handVerbExit("keeper-commit", answer)).toBe(0);
    expect(handVerbExit("keeper-vest", { op: "keeper-vest", reading: "closure-differs" })).toBe(1);
  });
});

describe("RED the vest hands the living fire, and the successor lands par", () => {
  test("offer, vest, receive: the successor stands lit with the face open, the pair reads par, the old keeper passes the fire; no route and no key in any answer or log", async () => {
    const h = await house("keeper-vest");
    await h.commit();
    const held = fx!.kept.handOver!()!;
    const secrets = [Buffer.from(held.treeKey).toString("hex"), ...held.faces.map((f) => Buffer.from(f.fck).toString("hex"))];
    held.treeKey.fill(0); for (const f of held.faces) f.fck.fill(0);
    const { next, vest, landed } = await handoff(h, h.old);
    expect(vest).toMatchObject({ reading: "vested", faces: [0] });
    expect(landed).toMatchObject({ reading: "landed", pair: { v: 1, par: true, vest: true }, vestings: 1, lit: true, faces: 1 });
    expect(next.holder.isUnlocked()).toBe(true);
    expect(await next.holder.isFaceUnlocked({ ordinal: 0 })).toBe(true);
    const fold = await keeperFold(h.records, await pulamaSignerOf(next.holder));
    expect(fold).toMatchObject({ v: 1, vestings: 1, struckDue: false, fork: false, pending: null });
    expect(fold.pairs).toEqual([expect.objectContaining({ par: true, vest: true })]);
    // THE OLD KEEPER PASSES THE FIRE: every write act refuses until the shim locks it.
    expect(await h.old({ op: "admit", credentials: fixtureRoute })).toMatchObject({ reading: "fire-passing" });
    for (const frame of [{ op: "keeper-commit", next: D3, credentials: fixtureRoute }, { op: "keeper-land" }, { op: "close", face: 0 }, { op: "rehive", face: 0, credentials: fixtureRoute }, { op: "unadmit", image: IMAGE, credentials: fixtureRoute }]) {
      expect(await h.old(frame), JSON.stringify(frame.op)).toMatchObject({ reading: "fire-passing", detail: expect.stringContaining("lares rite kukulu") });
    }
    // NO SECRET IN ANY LOG OR ANSWER: the route, the node key and the face key never appear; the slot carries only ciphertext.
    const said = JSON.stringify([h.lines, h.answers]);
    for (const secret of [FIXTURE_PASSPHRASE, ...secrets]) expect(said).not.toContain(secret);
  });

  test("RED a bare frame vests nothing: a vest with no live rite's offer refuses `vest-rite-absent`, sends no key, and spends the commit; a retry with the rite then finds no live commit", async () => {
    const h = await house("keeper-vest-bare");
    await h.commit();
    const bare = await handoff(h, h.old, D2, null);
    expect(bare.vest).toMatchObject({ reading: "vest-rite-absent" });
    expect(bare.vest).not.toHaveProperty("slot");
    expect(bare.next.holder.isUnlocked()).toBe(false);
    expect(await h.old({ op: "status" })).not.toHaveProperty("vestReady");
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "commit-absent" });
    // A new commit, ridden by a live rite, vests.
    await h.commit();
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("CONTROL: a vest with no committed D′ refuses `commit-absent`; a closure mismatch refuses `closure-differs`, the old fire still burns, and the commit lapses (one rite attempt per commit)", async () => {
    const h = await house("keeper-vest-controls");
    const none = await handoff(h, h.old);
    expect(none.vest).toMatchObject({ reading: "commit-absent", detail: expect.stringContaining("lares pulama keeper-commit") });
    await h.commit(D2);
    const wrong = await handoff(h, h.old, D3);
    expect(wrong.vest).toMatchObject({ reading: "closure-differs" });
    expect(wrong.landed).toBeNull();
    expect(fx!.kept.isUnlocked()).toBe(true);
    expect(h.live.begun).toBe(0);
    // THE COMMIT SPENT ITS ONE ATTEMPT: the right closure now finds no live commit, and a fresh commit vests.
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "commit-absent" });
    await h.commit(D2);
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED the co-sign fails closed: a commit or a rite's vouch naming a face of two devices refuses `vest-cosign-owed`, and a count read nowhere refuses `vest-devices-unread`; each names the struck fire; vestReady reads only a one-device commit", async () => {
    const h = await house("keeper-vest-cosign");
    await h.commit(D2, 2);
    expect(await h.old({ op: "status" })).not.toHaveProperty("vestReady");
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "vest-cosign-owed", detail: expect.stringMatching(/lares pulama keeper-commit[\s\S]*lares rite kukulu/) });
    await h.commit(D2, null);
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "vest-devices-unread", detail: expect.stringContaining("lares rite kukulu") });
    await h.commit(D2, 1);
    expect(await h.old({ op: "status" })).toMatchObject({ vestReady: D2 });
    h.live.devices = 2;
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "vest-cosign-owed", detail: expect.stringContaining("the rite's vouch") });
    expect((await h.records.list(pulamaKeeperPrefix())).filter((t) => t.endsWith("/vest"))).toHaveLength(3);
    h.live.devices = 1;
    await h.commit(D2, 1);
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED the carried co-sign: a two-device commit carrying a second device's spent `ward-keeper-vest` vests and lands par; CONTROL: a one-device face vests with none", async () => {
    const h = await house("keeper-vest-cosigned");
    const nonce = "a1".repeat(32);
    const cosign = await cosignedCommit({ next: D2, prev: null, nonce });
    expect(await h.old({ op: "keeper-commit", next: D2, devices: 2, cosign: { nonce, faces: [cosign] }, credentials: fixtureRoute })).toMatchObject({ reading: "committed", v: 1 });
    // A co-signed commit reads vest-ready, and the rite's vessel-signed vouch counts the same two devices the co-sign's roster binds.
    expect(await h.old({ op: "status" })).toMatchObject({ vestReady: D2 });
    h.live.devices = 2;
    const done = await handoff(h, h.old);
    expect(done.vest).toMatchObject({ reading: "vested" });
    expect(done.landed).toMatchObject({ reading: "landed" });
    // A rite's vouch that counts a device the co-signed roster lacks (one admitted after the co-sign) refuses and spends the commit.
    const moved = await house("keeper-vest-cosign-roster-moved");
    const n2 = "a2".repeat(32);
    await moved.old({ op: "keeper-commit", next: D2, devices: 2, cosign: { nonce: n2, faces: [await cosignedCommit({ next: D2, prev: null, nonce: n2 })] }, credentials: fixtureRoute });
    moved.live.devices = 3;
    expect((await handoff(moved, moved.old)).vest).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringContaining("lares pulama keeper-commit") });
    expect((await handoff(moved, moved.old)).vest).toMatchObject({ reading: "commit-absent" });
    const one = await house("keeper-vest-one-device");
    await one.commit(D2, 1);
    expect((await handoff(one, one.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED a co-sign that does not answer THIS commit from ANOTHER device refuses and rests nothing: the same device, another digest, a short face, a replay", async () => {
    const h = await house("keeper-vest-cosign-reds");
    const nonce = "b2".repeat(32);
    const commit = (cosign: unknown, devices = 2) => h.old({ op: "keeper-commit", next: D2, devices, cosign, credentials: fixtureRoute });
    // The vessel answered its own ask: the keeper reads the approve's signer as the issuer.
    const self = await selfCosigned({ next: D2, prev: null, nonce });
    expect(await commit({ nonce, faces: [self] })).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringMatching(/same-device[\s\S]*lares pulama keeper-commit/) });
    // A co-sign over another commit: another successor closure, and another nonce than the one it rides with.
    const other = await cosignedCommit({ next: D3, prev: null, nonce });
    expect(await commit({ nonce, faces: [other] })).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringContaining("digest-mismatch") });
    const good = await cosignedCommit({ next: D2, prev: null, nonce });
    expect(await commit({ nonce: "c3".repeat(32), faces: [good] })).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringContaining("digest-mismatch") });
    // The committed face carries no co-sign of its own, or the count disagrees with the rosters.
    expect(await commit({ nonce, faces: [{ ...good, ordinal: 1 }] })).toMatchObject({ reading: "vest-cosign-refused" });
    expect(await commit({ nonce, faces: [good] }, 3)).toMatchObject({ reading: "vest-cosign-refused" });
    expect(await h.records.list(pulamaKeeperPrefix())).toEqual([]);
    // A SPENT CO-SIGN NEVER RE-SPENDS: it rode one commit; a second commit under it refuses, and so does a second vest.
    expect(await commit({ nonce, faces: [good] })).toMatchObject({ reading: "committed" });
    expect(await commit({ nonce, faces: [good] })).toMatchObject({ reading: "vest-cosign-spent", detail: expect.stringContaining("lares pulama keeper-commit") });
    h.live.devices = 2;
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
    // The spent commit never vests twice: the old keeper passed its fire, and no live commit stands.
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: expect.stringMatching(/^(commit-absent|vest-spent|pulama-locked|fire-passing)$/) });
  });

  test("CONTROL: a replayed vest refuses `vest-spent`; a replayed slot refuses at the successor; a slot to another key refuses; a replayed land refuses", async () => {
    const h = await house("keeper-vest-replays");
    await h.commit();
    const first = await handoff(h, h.old);
    expect(first.landed).toMatchObject({ reading: "landed" });
    // The successor already lit: the same slot again refuses.
    expect(await first.next.door({ op: "keeper-receive", slot: first.vest["slot"] })).toMatchObject({ reading: "keeper-lit" });
    // A fresh unlit successor offered its own key: the replayed slot names another key.
    const other = h.successor();
    await other.report();
    await other.door({ op: "keeper-offer" });
    expect(await other.door({ op: "keeper-receive", slot: first.vest["slot"] })).toMatchObject({ reading: "slot-names-another" });
    expect(other.holder.isUnlocked()).toBe(false);
    // A second vest from the old keeper refuses (it passes the fire), and a new lit keeper vesting the landed commit finds none live.
    expect(await h.old({ op: "keeper-vest", to: "ab".repeat(32), closure: D2, offer: "rite" })).toMatchObject({ reading: "fire-passing" });
    expect(await first.next.door({ op: "keeper-vest", to: "ab".repeat(32), closure: D2, offer: "rite" })).toMatchObject({ reading: "commit-absent" });
    // A REPLAYED LAND NEVER SPENDS A SUCCESSOR'S LANDING: a keeper lit by a vest lands nothing struck.
    expect(await first.next.door({ op: "keeper-land" })).toMatchObject({ reading: "keeper-not-struck" });
  });

  test("CONTROL: a slot opens once: a second receive on the same offer refuses `offer-spent`, and a tampered slot locks the successor", async () => {
    const h = await house("keeper-vest-tamper");
    await h.commit();
    const next = h.successor();
    await next.report();
    const offer = await next.door({ op: "keeper-offer" });
    const vest = await h.old({ op: "keeper-vest", to: offer["to"], closure: D2, offer: "rite" });
    const slot = vest["slot"] as { body: { box: { c: string } } };
    const tampered = { ...slot, body: { ...slot.body, box: { ...slot.body.box, c: (slot.body.box.c[0] === "0" ? "1" : "0") + slot.body.box.c.slice(1) } } };
    expect(await next.door({ op: "keeper-receive", slot: tampered })).toMatchObject({ reading: "slot-unopened" });
    expect(await next.door({ op: "keeper-receive", slot })).toMatchObject({ reading: "offer-spent" });
    expect(next.holder.isUnlocked()).toBe(false);
  });
});

describe("RED the struck fire and the budget", () => {
  test("the hand's light lands with no vest and starts the run over; a mismatched closure reads red `closure-differs` and locks nothing", async () => {
    const h = await house("keeper-struck");
    await h.commit(D2);
    const lit = h.successor(D3);
    await lit.report();
    expect(await lit.door({ op: "light", credentials: fixtureRoute })).toMatchObject({ reading: "opens" });
    expect(await lit.door({ op: "keeper-land" })).toMatchObject({ reading: "red", red: "closure-differs", pair: { par: false, vest: false } });
    expect(lit.holder.isUnlocked()).toBe(true);
    expect(await lit.door({ op: "keeper-land" })).toMatchObject({ reading: "begun-absent" });
  });

  test("RED a red link never becomes the tip: after a vest (v1, one handed link) a struck land that reads red leaves the tip and the handed count where they stood, and the next commit links past it", async () => {
    const h = await house("keeper-red-link");
    await h.commit();
    const first = await handoff(h, h.old);
    expect(first.landed).toMatchObject({ reading: "landed", vestings: 1 });
    await first.next.door({ op: "image", digest: IMAGE, closure: D2 });
    expect(await first.next.door({ op: "keeper-commit", next: D3, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "committed", v: 2 });
    const struck = h.successor(D2);
    await struck.report();
    expect(await struck.door({ op: "light", credentials: fixtureRoute })).toMatchObject({ reading: "opens" });
    expect(await struck.door({ op: "keeper-land" })).toMatchObject({ reading: "red", red: "closure-differs" });
    const by = await pulamaSignerOf(struck.holder);
    expect(await keeperFold(h.records, by)).toMatchObject({ v: 1, vestings: 1, pending: null, fork: false });
    // The next commit links to v1's tip again, and a par vest extends the run to two.
    expect(await first.next.door({ op: "keeper-commit", next: D3, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "committed", v: 2 });
    expect((await handoff(h, first.next.door, D3)).landed).toMatchObject({ reading: "landed", vestings: 2 });
    await struck.holder.lock();
  });

  test("RED a keeper not lit by the hand lands nothing struck (`keeper-not-struck`); each face's spent budget carries with the vest", async () => {
    const h = await house("keeper-land-struck-only");
    await h.commit();
    const [face] = fx!.kept.handOver!()!.faces;
    fx!.kept.seedSpent!(1, [{ fcid: face!.fcid, spent: 2 }]);
    const moved = await handoff(h, h.old);
    expect(moved.landed).toMatchObject({ reading: "landed" });
    const carried = moved.next.holder.handOver!()!;
    expect(carried.faces).toEqual([expect.objectContaining({ fcid: face!.fcid, spent: 2 })]);
    expect(moved.next.holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT - 1);
    carried.treeKey.fill(0); for (const f of carried.faces) f.fck.fill(0);
    expect(await moved.next.door({ op: "keeper-land" })).toMatchObject({ reading: "keeper-not-struck" });
  });

  test("RED the struck fire is ONE proof: `light --admit` lights and admits the reported image under one route; CONTROL: an admitted image stays as it stands", async () => {
    const h = await house("keeper-light-admit");
    const lit = h.successor(D3);
    const routes: string[] = [];
    const ask = (f: Readonly<Record<string, unknown>>) => lit.door(f);
    const answer = await runHandVerb("light", "--admit", { ask, route: async (label) => { routes.push(label); return FIXTURE_PASSPHRASE; } });
    expect(routes).toHaveLength(1);
    expect(answer).toMatchObject({ op: "light", reading: "opens", admit: "admitted", admitted: IMAGE, lit: true });
    const again = h.successor(D3);
    expect(await again.door({ op: "light", credentials: fixtureRoute, admit: true })).toMatchObject({ admit: "already-admitted" });
    await again.holder.lock();
  });

  test(`after ${KEEPER_STRUCK_EVERY} handed links the vest refuses \`struck-due\`; the budget a keeper spent carries to its successor`, async () => {
    const h = await house("keeper-struck-due");
    // A miss at the old keeper spends one attempt; the vest carries it.
    expect(await h.old({ op: "admit", credentials: [{ kind: "passphrase", passphrase: "a-miss" }] })).toMatchObject({ reading: "no-slot-opens" });
    let keeper = h.old, holder: CustodyHolder = fx!.kept;
    for (let n = 1; n <= KEEPER_STRUCK_EVERY; n++) {
      await keeper({ op: "image", digest: IMAGE, closure: n === 1 ? D : D2 });
      expect(await keeper({ op: "keeper-commit", next: D2, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "committed", v: n });
      const step = await handoff(h, keeper);
      expect(step.landed).toMatchObject({ reading: "landed", vestings: n });
      expect(step.next.holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT - 1);
      if (holder !== fx!.kept) await holder.lock();
      keeper = step.next.door; holder = step.next.holder;
    }
    expect(await keeper({ op: "status" })).toMatchObject({ keeper: { v: KEEPER_STRUCK_EVERY, vestings: KEEPER_STRUCK_EVERY, struckDue: true } });
    await keeper({ op: "keeper-commit", next: D2, devices: 1, credentials: fixtureRoute });
    expect((await handoff(h, keeper)).vest).toMatchObject({ reading: "struck-due" });
    await holder.lock();
  });
});

describe("RED two keepers never both hold the fire", () => {
  test("a second claim on a held socket refuses; once the holder lets go the successor takes it; the door's take-fire names the hold", async () => {
    const dir = scratch(), path = join(dir, "p.sock");
    const first = await listenPulama(path, () => {});
    expect(await pulamaAnswers(path)).toBe(true);
    await expect(listenPulama(path, () => {})).rejects.toMatchObject({ reading: "pulama-already-stands" });
    const h = await house("keeper-fire");
    let held: { close(): Promise<void> } | null = null;
    const fire = { holds: () => held !== null, take: async () => { try { held = await listenPulama(path, () => {}); return { taken: true as const }; } catch (e) { return { refusal: "fire-held", detail: String(e) }; } } };
    const door = pulamaHandDoor({ holder: fx!.kept, server: fx!.server, image: pulamaImage(dir), records: h.records, fire });
    expect(await door({ op: "take-fire" })).toMatchObject({ reading: "fire-held" });
    await first.close();
    expect(await door({ op: "take-fire" })).toMatchObject({ reading: "taken", fire: true });
    expect(await door({ op: "take-fire" })).toMatchObject({ reading: "fire-held-here" });
    await (held as { close(): Promise<void> } | null)?.close();
  });

  test("RED the claim links then checks: a dead leftover gives way, a live keeper keeps its claim, and a claim another keeper displaced reads `owns` false", async () => {
    const dir = scratch(), path = join(dir, "q.sock");
    // A DEAD LEFTOVER: a socket whose listener left without its file going.
    const dead = await listenPulama(path, () => {});
    const leftover = join(dir, "left.sock");
    linkSync(path, leftover);
    await dead.close();
    linkSync(leftover, path);
    expect(await pulamaAnswers(path)).toBe(false);
    const live = await listenPulama(path, () => {});
    expect(live.owns()).toBe(true);
    await expect(listenPulama(path, () => {})).rejects.toMatchObject({ reading: "pulama-already-stands" });
    // DISPLACED: the path now names another file; this claim reads it holds no fire, and its close leaves the other file standing.
    unlinkSync(path); linkSync(leftover, path);
    expect(live.owns()).toBe(false);
    await live.close();
    expect(statSync(path).ino).toBe(statSync(leftover).ino);
  });
});

describe("RED the live rite a vest rides (`keeperRiteOver`)", () => {
  test("a vouch under the house's key naming this keeper move begins the rite; CONTROL: no vouch, another key, another closure, no keeper move, another image, or another signer each refuse and begin nothing", async () => {
    const h = await house("keeper-rite-over");
    const group = "group-keeper-rite-over", to = "cd".repeat(32);
    const begun: string[] = [];
    const rite = { begin: async () => { begun.push("x"); return { ok: true as const, tessera: "ef".repeat(32), lei: "11".repeat(32), n: 1 }; }, land: async () => ({ par: true }) };
    const over = keeperRiteOver({ holder: fx!.kept, hand: async () => "aa".repeat(32), rite, image: () => h.image.raised() });
    const signer = await vouchSignerOf(fx!.kept);
    const vouch = (keeper: Record<string, unknown> | undefined, image = IMAGE, by = signer) => signKukuluVouch({ group, branch: "main", head: "a".repeat(40), tree: "b".repeat(40), image, ...(keeper === undefined ? {} : { keeper: keeper as never }) }, by);
    const offer = async (v: unknown) => ({ lei: [], unstrung: [], vouch: [v] });
    const stranger = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(7)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(7)) };
    for (const [why, raw, reading] of [
      ["no offer", null, "vest-rite-absent"],
      ["another key", await offer(await vouch({ to: "ee".repeat(32), next: D2, devices: 1 })), "vest-rite-unbound"],
      ["another closure", await offer(await vouch({ to, next: D3, devices: 1 })), "vest-rite-unbound"],
      ["no keeper move", await offer(await vouch(undefined)), "vest-rite-unbound"],
      ["another image", await offer(await vouch({ to, next: D2, devices: 1 }, "sha256:" + "77".repeat(32))), "kukulu-image-mismatch"],
      ["another signer", await offer(await vouch({ to, next: D2, devices: 1 }, IMAGE, stranger)), "kukulu-vouch-signer"],
    ] as const) {
      expect(await over(raw, { to, next: D2 }), why).toMatchObject({ ok: false, refusal: reading, detail: expect.stringContaining("lares rite kukulu") });
    }
    expect(begun).toEqual([]);
    expect(await over(await offer(await vouch({ to, next: D2, devices: 1 })), { to, next: D2 })).toEqual({ ok: true, rite: ["ef".repeat(32)], devices: 1 });
    expect(await over(await offer(await vouch({ to, next: D2, devices: 0 })), { to, next: D2 })).toMatchObject({ ok: true, devices: 0 });
  });
});
