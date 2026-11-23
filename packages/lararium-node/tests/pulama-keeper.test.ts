/**
 * pulama-keeper — THE KEEPER TALLY: the lit keeper names its successor's closure under the hand's route, vests the house's end of the
 * bond to the successor's one-handoff key where the successor's reported closure matches, and the successor lands par. Every
 * mismatch, replay and unnamed key refuses by name; no answer and no log line carries a route or a key; two keepers never both hold
 * the fire; the budget carries.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { UNLOCK_ATTEMPTS_PER_BOOT, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { pulamaSignerOf } from "../src/kukulu-gate.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaAdmissions } from "../src/pulama-admit.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "../src/pulama-hand.js";
import { KEEPER_STRUCK_EVERY, keeperFold, pulamaKeeperPrefix } from "../src/pulama-keeper.js";
import { servePulama } from "../src/pulama-server.js";
import { listenPulama, pulamaAnswers } from "../src/pulama-socket.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { handVerbExit, runHandVerb } from "../src/pulama-verbs.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
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
  const watch = (door: (f: unknown) => Promise<PulamaHandAnswer>) => async (frame: unknown) => { const a = await door(frame); answers.push(a); return a; };
  const old = watch(pulamaHandDoor({ holder: fx.kept, server: fx.server, image, records, admissions: pulamaAdmissions(records), worn: () => 0, onLog: (l) => lines.push(l) }));
  await old({ op: "image", digest: IMAGE, closure: D });
  const successor = (closure = D2) => {
    const holder: CustodyHolder = makeCustodyHolder({ io: new FsCustodyIo(fx!.seat.homes), homes: fx!.seat.homes });
    const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
    const door = watch(pulamaHandDoor({ holder, server, image, records, admissions: pulamaAdmissions(records), onLog: (l) => lines.push(l) }));
    return { holder, door, report: () => door({ op: "closure", digest: closure }) };
  };
  /** A commit as the shim sends it: the device count the vessel read, or (null) none read. */
  const commit = (next = D2, devices: number | null = 1) => old({ op: "keeper-commit", next, ...(devices === null ? {} : { devices }), credentials: fixtureRoute });
  return { face, records, old, successor, commit, lines, answers };
}

/** Offer, vest and receive: the whole unattended handoff over one successor. */
async function handoff(h: Awaited<ReturnType<typeof house>>, from: (f: unknown) => Promise<PulamaHandAnswer>, closure = D2) {
  const next = h.successor(closure);
  await next.report();
  const offer = await next.door({ op: "keeper-offer" });
  const vest = await from({ op: "keeper-vest", to: offer["to"], closure });
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
    expect(await h.old({ op: "keeper-commit", next: D3, credentials: fixtureRoute })).toMatchObject({ reading: "fire-passing" });
    // NO SECRET IN ANY LOG OR ANSWER: the route, the node key and the face key never appear; the slot carries only ciphertext.
    const said = JSON.stringify([h.lines, h.answers]);
    for (const secret of [FIXTURE_PASSPHRASE, ...secrets]) expect(said).not.toContain(secret);
  });

  test("CONTROL: a vest with no committed D′ refuses `commit-absent`; a closure mismatch refuses `closure-differs` and spends nothing; the old fire still burns", async () => {
    const h = await house("keeper-vest-controls");
    const none = await handoff(h, h.old);
    expect(none.vest).toMatchObject({ reading: "commit-absent" });
    await h.commit(D2);
    const wrong = await handoff(h, h.old, D3);
    expect(wrong.vest).toMatchObject({ reading: "closure-differs" });
    expect(wrong.landed).toBeNull();
    expect(fx!.kept.isUnlocked()).toBe(true);
    expect((await h.records.list(pulamaKeeperPrefix())).filter((t) => t.endsWith("/vest"))).toEqual([]);
    // The match then vests: nothing the refusals did spent the commit.
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED the co-sign fails closed: a commit naming a face of two devices refuses `vest-cosign-owed`, and one whose vessel read no count refuses `vest-devices-unread`; each names the struck fire and spends nothing", async () => {
    const h = await house("keeper-vest-cosign");
    await h.commit(D2, 2);
    const two = await handoff(h, h.old);
    expect(two.vest).toMatchObject({ reading: "vest-cosign-owed", detail: expect.stringContaining("lares rite kukulu") });
    await h.commit(D2, null);
    const unread = await handoff(h, h.old);
    expect(unread.vest).toMatchObject({ reading: "vest-devices-unread", detail: expect.stringContaining("lares pulama keeper-commit") });
    expect((await h.records.list(pulamaKeeperPrefix())).filter((t) => t.endsWith("/vest"))).toEqual([]);
    await h.commit(D2, 1);
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
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
    expect(await h.old({ op: "keeper-vest", to: "ab".repeat(32), closure: D2 })).toMatchObject({ reading: "fire-passing" });
    expect(await first.next.door({ op: "keeper-vest", to: "ab".repeat(32), closure: D2 })).toMatchObject({ reading: "commit-absent" });
    expect(await first.next.door({ op: "keeper-land" })).toMatchObject({ reading: "begun-absent" });
  });

  test("CONTROL: a slot opens once: a second receive on the same offer refuses `offer-spent`, and a tampered slot locks the successor", async () => {
    const h = await house("keeper-vest-tamper");
    await h.commit();
    const next = h.successor();
    await next.report();
    const offer = await next.door({ op: "keeper-offer" });
    const vest = await h.old({ op: "keeper-vest", to: offer["to"], closure: D2 });
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
});
