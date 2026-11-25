/**
 * pulama-keeper — THE KEEPER TALLY: the lit keeper names its successor's closure under the hand's route, vests the house's end of the
 * bond to the successor's one-handoff key where the successor's reported closure matches, and the successor lands par. Every
 * mismatch, replay and unnamed key refuses by name; no answer and no log line carries a route or a key; two keepers never both hold
 * the fire; the budget carries.
 */
import { linkSync, mkdtempSync, rmSync, statSync, unlinkSync } from "node:fs";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { signKukuluVouch } from "@lararium/mesh/kukulu-vouch";
import { keeperRiteOver, pulamaSignerOf, vouchSignerOf } from "../src/kukulu-gate.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { UNLOCK_ATTEMPTS_PER_BOOT, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaAdmissions, signPulamaRecord, verifiedPulamaRecord } from "../src/pulama-admit.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "../src/pulama-hand.js";
import { KEEPER_STRUCK_EVERY, keeperNameSuccessor, keeperEphemeral, keeperFold, keeperSuccessorStale, keeperSlotOpen, pulamaKeeperPrefix } from "../src/pulama-keeper.js";
import { servePulama } from "../src/pulama-server.js";
import { listenPulama, pulamaAnswers } from "../src/pulama-socket.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { handVerbExit, runHandVerb } from "../src/pulama-verbs.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { createHash } from "node:crypto";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
import { KEEPER_FACE, cosignedCommit, selfCosigned } from "../../lararium-mesh/tests/keeper-cosign-fixture.js";
import { SESSION_DERIVES, fixtureRoute, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const D = "sha256:" + "d0".repeat(32), D2 = "sha256:" + "94".repeat(32), D3 = "sha256:" + "33".repeat(32), IMAGE = "sha256:" + "1a".repeat(32);
let fx: PulamaFixture | null = null;
const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-keeper-")); dirs.push(d); return d; };
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** One house: the lit keeper (the fixture's holder, one face open) and a door over a shared state dir; `successor()` stands another beside it. */
async function house(label: string, opts: { readonly realRite?: true } = {}) {
  fx = await standPulama(label, () => openGate({ faces: lend(0), coldReads: [] }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(`group-${label}`), ordinal: 0, slots: fixtureSlots });
  const state = scratch(), records = pulamaRecords(state), image = pulamaImage(state);
  const lines: string[] = [], answers: PulamaHandAnswer[] = [];
  /** THE LIVE RITE, faked at its port (`keeperRiteOver` reads it for real below): an offer of "rite" begins one, at `riteDevices`. */
  const live = { devices: 1, begun: 0, faces: [] as { ordinal: number; group: string; devices: number }[], failGroup: null as string | null, absentGroup: null as string | null };
  const fakeRite = async (offer: unknown, keeper: { readonly to: string; readonly next: string }) => {
    if (offer !== "rite") return { ok: false as const, refusal: "vest-rite-absent", detail: "a vest rides a live kūkulu rite, and this frame carries no offer with a vouch" };
    const faces = live.faces.length > 0 ? live.faces : [{ ordinal: 0, group: `group-${label}`, devices: live.devices, branch: "main", head: "a".repeat(40), tree: "b".repeat(40) }];
    return { ok: true as const, devices: live.devices, faces,
      begin: async () => { live.begun++; return { ok: true as const, rite: [sha(`${keeper.to}${keeper.next}${live.begun}`)], leis: [{ lei: "11".repeat(32), n: live.begun }] }; } };
  };
  /** THE REAL RITE (`keeperRiteOver` over this keeper's own holder): its vouches verify for real; its begin, faked at the rite port,
   *  counts each lei return it would claim, so a refusal that spends none reads `begins` unmoved. */
  const begins: string[] = [];
  const ritePort = { begin: async (_o: unknown, at: { group: string }) => { if (at.group === live.failGroup) return { ok: false as const, refusal: "kukulu-lei-spent" }; if (at.group === live.absentGroup) return { ok: false as const, refusal: "swarm-lei-absent" }; begins.push(at.group); return { ok: true as const, tessera: sha(`begun-${at.group}-${begins.length}`), lei: "11".repeat(32), n: 1 }; }, land: async () => ({ par: true }) };
  const keeperRite = opts.realRite ? keeperRiteOver({ holder: fx.kept, hand: async () => "aa".repeat(32), rite: ritePort as never, image: () => image.raised() }) : fakeRite;
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
  const commit = (next = D2, devices: number | null = 1) => old({ op: "name-successor", next, ...(devices === null ? {} : { devices }), credentials: fixtureRoute });
  return { face, records, image, old, successor, commit, lines, answers, live, begins, keeperRite };
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

describe("RED name-successor names one successor under the hand's route", () => {
  test("a commit rests the guest half; a later one supersedes it; CONTROL: unlit, unreported, a malformed next and a wrong route each refuse and rest nothing", async () => {
    const h = await house("name-successor");
    const unlit = h.successor();
    expect(await unlit.door({ op: "name-successor", next: D2, credentials: fixtureRoute })).toMatchObject({ reading: "pulama-locked" });
    expect(await h.old({ op: "name-successor", next: "sha256:short", credentials: fixtureRoute })).toMatchObject({ reading: "next-malformed" });
    expect(await h.old({ op: "name-successor", next: D2, credentials: [{ kind: "passphrase", passphrase: "not-the-route" }] })).toMatchObject({ reading: "no-slot-opens" });
    expect(await h.records.list(pulamaKeeperPrefix())).toEqual([]);
    const first = await h.commit(D3);
    expect(first).toMatchObject({ reading: "named", v: 1, next: D3, supersedes: null });
    const second = await h.commit(D2);
    expect(second).toMatchObject({ reading: "named", v: 1, next: D2 });
    expect(second["supersedes"]).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { v: 0, successor: D2, fork: false }, vestReady: D2, closure: D });
  });

  test("the verb reads the door first and prompts with the successor closure; a refused commit exits 1", async () => {
    const h = await house("name-successor-verb");
    const labels: string[] = [];
    const frames: Array<Readonly<Record<string, unknown>>> = [];
    const answer = await runHandVerb("name-successor", [D2, "--devices", "1"], { ask: (f) => { frames.push(f); return h.old(f); }, route: async (label) => { labels.push(label); return FIXTURE_PASSPHRASE; } });
    expect(answer).toMatchObject({ reading: "named", next: D2 });
    expect(frames.at(-1)).toMatchObject({ op: "name-successor", devices: 1 });
    await expect(runHandVerb("name-successor", [D2, "--devices", "0"], { ask: (f) => h.old(f), route: async () => FIXTURE_PASSPHRASE })).rejects.toThrow(/usage/);
    expect(labels).toEqual([expect.stringContaining(D2)]);
    expect(handVerbExit("name-successor", answer)).toBe(0);
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
    expect(fold).toMatchObject({ v: 1, vestings: 1, struckDue: false, fork: false, successor: null });
    expect(fold.pairs).toEqual([expect.objectContaining({ par: true, vest: true })]);
    // THE OLD KEEPER PASSES THE FIRE: every write act refuses until the shim locks it.
    expect(await h.old({ op: "admit", credentials: fixtureRoute })).toMatchObject({ reading: "fire-passing" });
    for (const frame of [{ op: "name-successor", next: D3, credentials: fixtureRoute }, { op: "keeper-land" }, { op: "close", face: 0 }, { op: "rehive", face: 0, credentials: fixtureRoute }, { op: "unadmit", image: IMAGE, credentials: fixtureRoute }]) {
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
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "successor-absent" });
    // A new commit, ridden by a live rite, vests.
    await h.commit();
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("CONTROL: a vest with no committed D′ refuses `successor-absent`; a closure mismatch refuses `closure-differs`, the old fire still burns, and the commit lapses (one rite attempt per commit)", async () => {
    const h = await house("keeper-vest-controls");
    const none = await handoff(h, h.old);
    expect(none.vest).toMatchObject({ reading: "successor-absent", detail: expect.stringContaining("lares pulama name-successor") });
    await h.commit(D2);
    const wrong = await handoff(h, h.old, D3);
    expect(wrong.vest).toMatchObject({ reading: "closure-differs" });
    expect(wrong.landed).toBeNull();
    expect(fx!.kept.isUnlocked()).toBe(true);
    expect(h.live.begun).toBe(0);
    // THE COMMIT SPENT ITS ONE ATTEMPT: the right closure now finds no live commit, and a fresh commit vests.
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "successor-absent" });
    await h.commit(D2);
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED the co-sign fails closed: a commit or a rite's vouch naming a face of two devices refuses `vest-cosign-owed`, and a count read nowhere refuses `vest-devices-unread`; each names the struck fire; vestReady reads only a one-device commit", async () => {
    const h = await house("keeper-vest-cosign");
    await h.commit(D2, 2);
    expect(await h.old({ op: "status" })).not.toHaveProperty("vestReady");
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: "vest-cosign-owed", detail: expect.stringMatching(/lares pulama name-successor[\s\S]*lares rite kukulu/) });
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
    expect(await h.old({ op: "name-successor", next: D2, devices: 2, cosign: { nonce, faces: [cosign] }, credentials: fixtureRoute })).toMatchObject({ reading: "named", v: 1 });
    // A co-signed commit reads vest-ready, and the rite's vessel-signed vouch counts the same two devices the co-sign's roster binds.
    expect(await h.old({ op: "status" })).toMatchObject({ vestReady: D2 });
    h.live.devices = 2;
    h.live.faces = [{ ordinal: 0, group: KEEPER_FACE, devices: 2 }];
    const done = await handoff(h, h.old);
    expect(done.vest).toMatchObject({ reading: "vested" });
    expect(done.landed).toMatchObject({ reading: "landed" });
    // A rite's vouch that counts a device the co-signed roster lacks (one admitted after the co-sign) refuses and spends the commit.
    const moved = await house("keeper-vest-cosign-roster-moved");
    const n2 = "a2".repeat(32);
    await moved.old({ op: "name-successor", next: D2, devices: 2, cosign: { nonce: n2, faces: [await cosignedCommit({ next: D2, prev: null, nonce: n2 })] }, credentials: fixtureRoute });
    moved.live.devices = 3;
    moved.live.faces = [{ ordinal: 0, group: KEEPER_FACE, devices: 3 }];
    expect((await handoff(moved, moved.old)).vest).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringContaining("lares pulama name-successor") });
    expect((await handoff(moved, moved.old)).vest).toMatchObject({ reading: "successor-absent" });
    const one = await house("keeper-vest-one-device");
    await one.commit(D2, 1);
    expect((await handoff(one, one.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("RED a co-sign that does not answer THIS commit from ANOTHER device refuses and rests nothing: the same device, another digest, a short face, a replay", async () => {
    const h = await house("keeper-vest-cosign-reds");
    const nonce = "b2".repeat(32);
    const commit = (cosign: unknown, devices = 2) => h.old({ op: "name-successor", next: D2, devices, cosign, credentials: fixtureRoute });
    // The vessel answered its own ask: the keeper reads the approve's signer as the issuer.
    const self = await selfCosigned({ next: D2, prev: null, nonce });
    expect(await commit({ nonce, faces: [self] })).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringMatching(/same-device[\s\S]*lares pulama name-successor/) });
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
    expect(await commit({ nonce, faces: [good] })).toMatchObject({ reading: "named" });
    expect(await commit({ nonce, faces: [good] })).toMatchObject({ reading: "vest-cosign-spent", detail: expect.stringContaining("lares pulama name-successor") });
    h.live.devices = 2;
    h.live.faces = [{ ordinal: 0, group: KEEPER_FACE, devices: 2 }];
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
    // The spent commit never vests twice: the old keeper passed its fire, and no live commit stands.
    expect((await handoff(h, h.old)).vest).toMatchObject({ reading: expect.stringMatching(/^(successor-absent|vest-spent|pulama-locked|fire-passing)$/) });
  });

  test("RED the vessel's signed vouch maps each ordinal to its face's group: a co-sign over another face's group, or an ordinal no vouch names, refuses and spends the commit; CONTROL: the vouched group vests", async () => {
    const run = async (label: string, vouched: { ordinal: number; group: string; devices: number }[], group = KEEPER_FACE) => {
      const h = await house(label);
      const nonce = sha(label);
      expect(await h.old({ op: "name-successor", next: D2, devices: 2, cosign: { nonce, faces: [await cosignedCommit({ next: D2, prev: null, nonce }, 0, group)] }, credentials: fixtureRoute })).toMatchObject({ reading: "named" });
      h.live.devices = 2; h.live.faces = vouched;
      return handoff(h, h.old);
    };
    // A co-sign spent on ANOTHER face of the operator's (its own two devices, its own group) answers nothing for this ordinal.
    const other = await run("keeper-vest-cosign-other-face", [{ ordinal: 0, group: KEEPER_FACE, devices: 2 }], "another-face");
    expect(other.vest).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringMatching(/group[\s\S]*lares pulama name-successor/) });
    // The vouch names no face at the co-sign's ordinal.
    const unnamed = await run("keeper-vest-cosign-unvouched", [{ ordinal: 1, group: KEEPER_FACE, devices: 2 }]);
    expect(unnamed.vest).toMatchObject({ reading: "vest-cosign-refused", detail: expect.stringContaining("h0") });
    const control = await run("keeper-vest-cosign-vouched", [{ ordinal: 0, group: KEEPER_FACE, devices: 2 }]);
    expect(control.landed).toMatchObject({ reading: "landed" });
  });

  test("F4: a keeper that passed its fire names it at `light --admit` (never a silent skip); its lock spends the passing, so a struck relight admits and closes again", async () => {
    const h = await house("keeper-passing-clears");
    await h.commit(D2, 1);
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
    const lit = await h.old({ op: "light", credentials: fixtureRoute, admit: true });
    expect(lit).toMatchObject({ admit: "fire-passing", detail: expect.stringContaining("lares rite kukulu") });
    expect(await h.old({ op: "close", face: 0 })).toMatchObject({ reading: "fire-passing" });
    await h.old({ op: "lock" });
    expect(await h.old({ op: "status" })).not.toHaveProperty("passing");
    expect(await h.old({ op: "close", face: 0 })).toMatchObject({ reading: "pulama-locked" });
    const relit = await h.old({ op: "light", credentials: fixtureRoute, admit: true });
    expect(relit["admit"]).toEqual(expect.stringMatching(/^(admitted|already-admitted)$/));
  });

  test("F6: a fork of two live commits names its cure, and the cure runs: a fresh `lares pulama name-successor` settles both and stands alone", async () => {
    const h = await house("name-successor-fork");
    // Two commits at one link, each reading no live commit before it (two doors racing): neither supersedes the other.
    await h.commit(D3, 1);
    const by = await pulamaSignerOf(fx!.kept);
    const [first] = (await h.records.list(pulamaKeeperPrefix())).filter((t) => t.endsWith("/guest"));
    const body = verifiedPulamaRecord(await h.records.read(first!), by.key)!.body as unknown as Record<string, unknown>;
    const nonce = "99".repeat(16), tessera = sha(`racing-${nonce}`);
    const racer = await signPulamaRecord<"keeper-begun">({ ...body, tessera, next: D2, nonce, supersedes: null } as never, by);
    expect(await h.records.writeNew(`${pulamaKeeperPrefix()}${tessera}/guest`, JSON.stringify(racer))).toBe(true);
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { fork: true } });
    const next = h.successor(D2); await next.report();
    const offer = await next.door({ op: "keeper-offer" });
    expect(await h.old({ op: "keeper-vest", to: offer["to"], closure: D2, offer: "rite" })).toMatchObject({ reading: "fork", detail: expect.stringContaining("lares pulama name-successor") });
    expect(await h.commit(D2, 1)).toMatchObject({ reading: "named" });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { fork: false, successor: D2 } });
    expect((await handoff(h, h.old)).landed).toMatchObject({ reading: "landed" });
  });

  test("F8: the slot carries the keys as bytes, never hex strings: the opened payload hands Uint8Arrays the receiver zero-fills", async () => {
    const h = await house("keeper-slot-bytes");
    await h.commit(D2, 1);
    const next = h.successor(D2); await next.report();
    const e = keeperEphemeral();
    const vest = await h.old({ op: "keeper-vest", to: e.pub, closure: D2, offer: "rite" });
    expect(vest).toMatchObject({ reading: "vested" });
    const payload = e.open((vest["slot"] as { body: never }).body)!;
    expect(payload.node).toBeInstanceOf(Uint8Array);
    expect(payload.node).toHaveLength(32);
    expect(payload.faces).toHaveLength(1);
    expect(payload.faces[0]!.fck).toBeInstanceOf(Uint8Array);
    expect(payload.faces[0]).toMatchObject({ fcid: expect.any(String), ordinal: 0 });
  });

  test("L3 THE SLOT WIRE STANDS FROZEN: a v1 slot sealed under fixed keys (its plaintext packed by hand from the documented layout) opens under the current reader, byte for byte; a reader accepts every version an older image could write", () => {
    // GOLDEN v1: never regenerate this to make a reader pass; a new version adds its own golden beside this one.
    const golden = {
      secret: "5a".repeat(32),
      body: { act: "keeper-slot", tessera: "0".repeat(64), begun: "be".repeat(32), next: "sha256:" + "94".repeat(32), to: "b0d08f35b4683381489afb32825e59152d47d19bc9e050d6d5a954984c9d1e2c",
        box: { e: "a54040e08770832d33ce9e217733af2c396a779c79d4f0d26c3c18e6b59b6877", n: "34558478e83916a862a963df8b708caddda2220ccf0122d2",
          c: "78a87aec79839e8304a050dbcfd1b314f4dcd44533b4f48bc3ca46ac17e0495509a6dca8c33b3ac5bd2f495fb3dd1deefa7876af44771e8138ceebff889de9595e7fd314044d55eb00acdc7600f6269b3455bb095379bf57f25ba04525d083d778742a53d484d0f8868cc99dca60d7c6" } },
    };
    const secret = Uint8Array.from(Buffer.from(golden.secret, "hex"));
    const payload = keeperSlotOpen(secret, golden.body as never);
    expect(payload).not.toBeNull();
    expect(Buffer.from(payload!.node).toString("hex")).toBe("11".repeat(32));
    expect(payload!.spent).toBe(3);
    expect(payload!.worn).toBe(7);
    expect(payload!.faces).toHaveLength(1);
    expect(payload!.faces[0]).toMatchObject({ fcid: "fcid-golden", ordinal: 2, spent: 1 });
    expect(Buffer.from(payload!.faces[0]!.fck).toString("hex")).toBe("22".repeat(32));
    // CONTROL: the same slot under another key, or one byte of ciphertext moved, opens nothing.
    expect(keeperSlotOpen(new Uint8Array(32).fill(0x5b), golden.body as never)).toBeNull();
    const moved = { ...golden.body, box: { ...golden.body.box, c: golden.body.box.c.replace(/^78/, "79") } };
    expect(keeperSlotOpen(Uint8Array.from(Buffer.from(golden.secret, "hex")), moved as never)).toBeNull();
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
    expect(await first.next.door({ op: "keeper-vest", to: "ab".repeat(32), closure: D2, offer: "rite" })).toMatchObject({ reading: "successor-absent" });
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
    expect(await first.next.door({ op: "name-successor", next: D3, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "named", v: 2 });
    const struck = h.successor(D2);
    await struck.report();
    expect(await struck.door({ op: "light", credentials: fixtureRoute })).toMatchObject({ reading: "opens" });
    expect(await struck.door({ op: "keeper-land" })).toMatchObject({ reading: "red", red: "closure-differs" });
    const by = await pulamaSignerOf(struck.holder);
    expect(await keeperFold(h.records, by)).toMatchObject({ v: 1, vestings: 1, successor: null, fork: false });
    // The next commit links to v1's tip again, and a par vest extends the run to two.
    expect(await first.next.door({ op: "name-successor", next: D3, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "named", v: 2 });
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
      expect(await keeper({ op: "name-successor", next: D2, devices: 1, credentials: fixtureRoute })).toMatchObject({ reading: "named", v: n });
      const step = await handoff(h, keeper);
      expect(step.landed).toMatchObject({ reading: "landed", vestings: n });
      expect(step.next.holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT - 1);
      if (holder !== fx!.kept) await holder.lock();
      keeper = step.next.door; holder = step.next.holder;
    }
    expect(await keeper({ op: "status" })).toMatchObject({ keeper: { v: KEEPER_STRUCK_EVERY, vestings: KEEPER_STRUCK_EVERY, struckDue: true } });
    await keeper({ op: "name-successor", next: D2, devices: 1, credentials: fixtureRoute });
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

describe("RED the vest over the REAL rite: every face the keeper would seal stands vouched, and nothing begins before every check passes", () => {
  /** A real offer: one vouch per named face, signed by this house's vouch key over this keeper move. */
  const offerOf = async (to: string, faces: readonly { group: string; devices: number }[]) => {
    const signer = await vouchSignerOf(fx!.kept);
    const vouch = await Promise.all(faces.map((f) => signKukuluVouch({ group: f.group, branch: "main", head: "a".repeat(40), tree: "b".repeat(40), image: IMAGE, keeper: { to, next: D2, devices: f.devices } as never }, signer)));
    return { lei: [], unstrung: [], vouch };
  };
  const vestOver = async (h: Awaited<ReturnType<typeof house>>, faces: readonly { group: string; devices: number }[]) => {
    const next = h.successor(D2);
    await next.report();
    const offer = await next.door({ op: "keeper-offer" });
    const vest = await h.old({ op: "keeper-vest", to: offer["to"], closure: D2, offer: await offerOf(offer["to"] as string, faces) });
    return { vest, landed: vest["reading"] === "vested" ? await next.door({ op: "keeper-receive", slot: vest["slot"] }) : null };
  };

  test("F1: a second face the keeper holds open (two devices) that the vessel never vouched lapses `vest-devices-unread` and seals nothing; CONTROL: both faces vouched vest", async () => {
    const h = await house("keeper-real-unvouched", { realRite: true });
    await fx!.kept.foundFace({ group: personaGroupDigest("group-keeper-real-unvouched-h1"), ordinal: 1, slots: fixtureSlots });
    await h.commit(D2, 1);
    const out = await vestOver(h, [{ group: "group-keeper-real-unvouched", devices: 1 }]);
    expect(out.vest).toMatchObject({ reading: "vest-devices-unread", detail: expect.stringMatching(/h1[\s\S]*lares (pulama name-successor|rite kukulu)/) });
    expect(out.landed).toBeNull();
    // F3: the refusal spent no lei return and rested no begun half.
    expect(h.begins).toEqual([]);
    await h.commit(D2, 1);
    const both = await vestOver(h, [{ group: "group-keeper-real-unvouched", devices: 1 }, { group: "group-keeper-real-unvouched-h1", devices: 1 }]);
    expect(both.landed).toMatchObject({ reading: "landed" });
    expect(h.begins).toHaveLength(2);
  });

  test("L1: a begin that fails on a later face after an earlier face began names the halves it began, in the refusal and in the lapse it rests", async () => {
    const h = await house("keeper-real-partial", { realRite: true });
    await fx!.kept.foundFace({ group: personaGroupDigest("group-keeper-real-partial-h1"), ordinal: 1, slots: fixtureSlots });
    await h.commit(D2, 1);
    h.live.failGroup = "group-keeper-real-partial-h1";
    const out = await vestOver(h, [{ group: "group-keeper-real-partial", devices: 1 }, { group: "group-keeper-real-partial-h1", devices: 1 }]);
    expect(h.begins).toEqual(["group-keeper-real-partial"]);
    const half = sha("begun-group-keeper-real-partial-1");
    expect(out.vest).toMatchObject({ reading: "kukulu-lei-spent", detail: expect.stringMatching(new RegExp(`${half}[\\s\\S]*lares rite receipts --rite kukulu`)) });
    const by = await pulamaSignerOf(fx!.kept);
    const [mark] = (await h.records.list(pulamaKeeperPrefix())).filter((t) => t.endsWith("/vest"));
    expect(verifiedPulamaRecord(await h.records.read(mark!), by.key)!.body).toMatchObject({ act: "keeper-lapsed", reason: "kukulu-lei-spent", halves: [half] });
  });

  test("F3: a late refusal (the vouch counts two devices against a one-device commit with no co-sign) spends no lei and begins no rite", async () => {
    const h = await house("keeper-real-late", { realRite: true });
    await h.commit(D2, 1);
    const out = await vestOver(h, [{ group: "group-keeper-real-late", devices: 2 }]);
    expect(out.vest).toMatchObject({ reading: "vest-cosign-owed" });
    expect(h.begins).toEqual([]);
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
    const read = await over(await offer(await vouch({ to, next: D2, devices: 1 })), { to, next: D2 });
    expect(read).toMatchObject({ ok: true, devices: 1, faces: [{ ordinal: 0, group, devices: 1 }] });
    // NOTHING BEGINS AT THE READ: the rite begins only when the vest calls `begin`, after every check passed.
    expect(begun).toEqual([]);
    expect(read.ok && await read.begin()).toEqual({ ok: true, rite: ["ef".repeat(32)], leis: [{ lei: "11".repeat(32), n: 1 }] });
    expect(begun).toEqual(["x"]);
    expect(await over(await offer(await vouch({ to, next: D2, devices: 0 })), { to, next: D2 })).toMatchObject({ ok: true, devices: 0 });
  });
});

describe("RED the keeper lei: the kukulu lei licenses the handed fire (operator ruling, 2026-11-24: no count of its own)", () => {
  /** The host's testimony as `pulama name-successor --lei` sends it: the branch whose kukulu lei licenses, the revision, its tree, the recheck, the CI run (green). */
  const TESTIMONY = { branch: "main", rev: "a".repeat(40), tree: "b".repeat(40), recheck: "same", ci: "4242:success" };
  const spend = (door: (f: unknown) => Promise<PulamaHandAnswer>, next = D2, over: Record<string, unknown> = {}) => door({ op: "name-successor-lei", next, image: next, devices: 1, ...TESTIMONY, ...over });

  test("keeper-lei-licenses-with-no-route: a commit the kukulu lei licenses rests with no route and names its license; the vest's live rite spends that lei's return and names it; the successor's next commit asks no count", async () => {
    const h = await house("keeper-lei-licenses");
    expect(await h.old({ op: "status" })).toMatchObject({ keeperLei: { floor: true, licensed: [] }, leiReady: true });
    const first = await spend(h.old);
    expect(first).toMatchObject({ reading: "named", v: 1, next: D2, branch: "main" });
    const successor = (await keeperFold(h.records, await pulamaSignerOf(fx!.kept))).successor;
    expect(successor?.body).toMatchObject({ devices: 1, licensed: { by: "kukulu-lei", ...TESTIMONY, image: D2 } });
    expect(await h.old({ op: "status" })).toMatchObject({ keeperLei: { licensed: [{ v: 1, next: D2, branch: "main", rev: TESTIMONY.rev, ci: TESTIMONY.ci, vested: false, leis: [] }] }, vestReady: D2 });
    expect(await h.old({ op: "status" })).not.toHaveProperty("leiReady");
    const one = await handoff(h, h.old);
    expect(one.landed).toMatchObject({ reading: "landed", vestings: 1 });
    // THE VEST NAMES THE KUKULU LEI RETURN ITS RITE SPENT: the license, read back on status.
    await one.next.door({ op: "image", digest: IMAGE, closure: D2 });
    expect(await one.next.door({ op: "status" })).toMatchObject({ keeperLei: { licensed: [{ v: 1, vested: true, leis: [{ lei: "11".repeat(32), n: 1 }] }] }, leiReady: true });
    expect(await spend(one.next.door, D3)).toMatchObject({ reading: "named", v: 2 });
    expect((await handoff(h, one.next.door, D3)).landed).toMatchObject({ reading: "landed", vestings: 2 });
    expect(JSON.stringify([h.lines, h.answers])).not.toContain(FIXTURE_PASSPHRASE);
    await one.next.holder.lock();
  });

  test("keeper-lei-binds-at-the-vest: a licensed commit whose vest rides no live rite (no kukulu lei return to spend) lapses and hands nothing", async () => {
    const h = await house("keeper-lei-binds");
    await spend(h.old);
    const bare = await handoff(h, h.old, D2, null);
    expect(bare.vest).toMatchObject({ reading: "vest-rite-absent" });
    expect(bare.vest).not.toHaveProperty("slot");
    expect(h.live.begun).toBe(0);
    expect(await keeperFold(h.records, await pulamaSignerOf(fx!.kept))).toMatchObject({ successor: null, vested: null });
  });

  test("keeper-lei-never-supersedes: a live hand commit refuses `keeper-lei-successor-stands` and rests nothing; the hand's own commit still supersedes", async () => {
    const h = await house("keeper-lei-hand");
    expect(await h.commit(D3)).toMatchObject({ reading: "named" });
    expect(await spend(h.old)).toMatchObject({ reading: "keeper-lei-successor-stands", detail: expect.stringContaining("lares pulama name-successor") });
    expect(await h.old({ op: "status" })).not.toHaveProperty("leiReady");
    expect((await keeperFold(h.records, await pulamaSignerOf(fx!.kept))).successor?.next).toBe(D3);
    expect(await h.commit(D2)).toMatchObject({ reading: "named", supersedes: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  test("keeper-lei-supersedes-a-stale-self-successor (the 2026-11-24 shape): a hand commit at v1, prev null, whose next equals its own from-closure, reads stale; status reads `staleSuccessor` and leiReady; a licensed lei supersedes it", async () => {
    const h = await house("keeper-lei-stale-self");
    const self = await h.commit(D);
    expect(self).toMatchObject({ reading: "named", v: 1 });
    const by = await pulamaSignerOf(fx!.kept);
    const before = (await keeperFold(h.records, by)).successor;
    expect(before?.body).toMatchObject({ v: 1, prev: null, closure: D, next: D });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { successor: D, staleSuccessor: true, staleSuccessorWhy: "self-successor" }, leiReady: true });
    expect(await spend(h.old)).toMatchObject({ reading: "named", v: 1, next: D2 });
    const after = (await keeperFold(h.records, by)).successor;
    expect(after?.next).toBe(D2);
    expect(after?.body).toMatchObject({ supersedes: before!.begun, licensed: { by: "kukulu-lei" } });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { successor: D2, staleSuccessor: false } });
  });

  test("keeper-lei-supersedes-a-moved-keeper's-commit: a hand commit read under another closure than the keeper now runs reads stale; a live, current hand commit still refuses", async () => {
    const h = await house("keeper-lei-stale-moved");
    expect(await h.commit(D3)).toMatchObject({ reading: "named" });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { successor: D3, staleSuccessor: false } });
    expect(await h.old({ op: "status" })).not.toHaveProperty("leiReady");
    expect(await spend(h.old)).toMatchObject({ reading: "keeper-lei-successor-stands" });
    // THE KEEPER MOVED PAST IT: it now runs another closure than the one the commit handed from (and not the one it names).
    const moved = "sha256:" + "e7".repeat(32);
    await h.old({ op: "closure", digest: moved });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { successor: D3, staleSuccessor: true, staleSuccessorWhy: "keeper-moved" }, leiReady: true });
    expect(await spend(h.old)).toMatchObject({ reading: "named", next: D2 });
    expect((await keeperFold(h.records, await pulamaSignerOf(fx!.kept))).successor?.next).toBe(D2);
  });

  test("keeper-lei-arrival-stays-live: a keeper that now runs the very closure the commit names reads it live (its landing waits), never stale", async () => {
    const h = await house("keeper-lei-stale-arrival");
    await h.commit(D3);
    await h.old({ op: "closure", digest: D3 });
    expect(await h.old({ op: "status" })).toMatchObject({ keeper: { successor: D3, staleSuccessor: false } });
    expect(await spend(h.old)).toMatchObject({ reading: "keeper-lei-successor-stands" });
  });

  test("keeper-lei-red-refuses: a red last pair refuses `keeper-lei-red`; a face of two devices refuses `keeper-lei-cosign-owed` and none read `keeper-lei-devices-unread`; testimony that does not hold refuses by name; none rests a commit", async () => {
    const h = await house("keeper-lei-red");
    expect(await spend(h.old, D2, { devices: 2 })).toMatchObject({ reading: "keeper-lei-cosign-owed", detail: expect.stringContaining("lares pulama name-successor") });
    expect(await spend(h.old, D2, { devices: undefined })).toMatchObject({ reading: "keeper-lei-devices-unread" });
    expect(await spend(h.old, D2, { image: D3 })).toMatchObject({ reading: "keeper-lei-image-differs" });
    expect(await spend(h.old, D2, { ci: "4242:failure" })).toMatchObject({ reading: "keeper-lei-ci-red", detail: expect.stringContaining("gh run list --commit") });
    expect(await spend(h.old, D2, { recheck: "differs" })).toMatchObject({ reading: "keeper-lei-recheck-differs" });
    expect(await spend(h.old, D2, { branch: "" })).toMatchObject({ reading: "keeper-lei-testimony-malformed" });
    expect(await h.records.list(pulamaKeeperPrefix())).toEqual([]);
    // A RED LINK: the hand commits D2, and a keeper lit by hand on D3 lands it red (closure-differs).
    await h.commit(D2);
    const struck = h.successor(D3);
    await struck.report();
    await struck.door({ op: "light", credentials: fixtureRoute });
    expect(await struck.door({ op: "keeper-land" })).toMatchObject({ reading: "red", red: "closure-differs" });
    expect(await spend(struck.door, D2)).toMatchObject({ reading: "keeper-lei-red", detail: expect.stringContaining("lares rite kukulu on a terminal") });
    await struck.holder.lock();
  });

  test("keeper-lei-floor-and-passing: a passing keeper refuses `fire-passing`; the floor off refuses `keeper-lei-floor-off` and status reads it", async () => {
    const h = await house("keeper-lei-floor");
    await spend(h.old);
    const moved = await handoff(h, h.old);
    expect(moved.landed).toMatchObject({ reading: "landed" });
    expect(await spend(h.old, D3)).toMatchObject({ reading: "fire-passing" });
    await moved.next.holder.lock();
    const off = pulamaHandDoor({ holder: makeCustodyHolder({ io: new FsCustodyIo(fx!.seat.homes), homes: fx!.seat.homes }), server: fx!.server, image: h.image, records: h.records, keeperLeiStands: false });
    await off({ op: "light", credentials: fixtureRoute });
    await off({ op: "closure", digest: D2 });
    expect(await spend(off, D3)).toMatchObject({ reading: "keeper-lei-floor-off", detail: expect.stringContaining("lares pulama name-successor") });
    expect(await off({ op: "status" })).toMatchObject({ keeperLei: { floor: false } });
    expect(await off({ op: "status" })).not.toHaveProperty("leiReady");
    await off({ op: "lock" });
  });
});

describe("RED the keeper lei's cold read (F1, F3, F5, F6): a licensed commit vests for every face on the vessel, over the very revision it names, under a standing floor, never superseding the hand", () => {
  /** The testimony the vouches below agree with: the branch, head and tree each vouch names. */
  const LICENSED = { branch: "main", rev: "a".repeat(40), tree: "b".repeat(40), recheck: "same", ci: "9:success" };
  const offerOf = async (to: string, faces: readonly { group: string; devices: number }[], head = "a".repeat(40)) => {
    const signer = await vouchSignerOf(fx!.kept);
    const vouch = await Promise.all(faces.map((f) => signKukuluVouch({ group: f.group, branch: "main", head, tree: "b".repeat(40), image: IMAGE, keeper: { to, next: D2, devices: f.devices } as never }, signer)));
    return { lei: [], unstrung: [], vouch };
  };
  const vestOver = async (h: Awaited<ReturnType<typeof house>>, from: (f: unknown) => Promise<PulamaHandAnswer>, faces: readonly { group: string; devices: number }[], head?: string) => {
    const next = h.successor(D2);
    await next.report();
    const offer = await next.door({ op: "keeper-offer" });
    return from({ op: "keeper-vest", to: offer["to"], closure: D2, offer: await offerOf(offer["to"] as string, faces, head) });
  };
  const licensed = (h: Awaited<ReturnType<typeof house>>) => h.old({ op: "name-successor-lei", next: D2, image: D2, devices: 1, ...LICENSED });

  test("F1 (operator ruling: the license reads the vessel's faces alone): a standing lei among the lent faces licenses the vest for every face the vessel holds, so a lei on h0 alone carries h1, whose begin reads absent and spends nothing", async () => {
    const h = await house("keeper-lei-f1", { realRite: true });
    const h1 = await fx!.kept.foundFace({ group: personaGroupDigest("group-keeper-lei-f1-h1"), ordinal: 1, slots: fixtureSlots });
    const both = [{ group: "group-keeper-lei-f1", devices: 1 }, { group: "group-keeper-lei-f1-h1", devices: 1 }];
    h.live.absentGroup = "group-keeper-lei-f1-h1";
    expect(await licensed(h)).toMatchObject({ reading: "named" });
    expect(await vestOver(h, h.old, both)).toMatchObject({ reading: "vested" });
    expect(h.begins).toEqual(["group-keeper-lei-f1"]);
    void h1;
  });

  test("F3: a licensed commit vests only over vouches naming its branch, revision and tree: another head lapses `keeper-lei-vouch-differs` and begins nothing", async () => {
    const h = await house("keeper-lei-f3", { realRite: true });
    expect(await licensed(h)).toMatchObject({ reading: "named" });
    expect(await vestOver(h, h.old, [{ group: "group-keeper-lei-f3", devices: 1 }], "c".repeat(40))).toMatchObject({ reading: "keeper-lei-vouch-differs", detail: expect.stringContaining("lares rite kukulu") });
    expect(h.begins).toEqual([]);
  });

  test("F6: the floor off lapses a licensed commit at the vest (`keeper-lei-floor-off`); CONTROL: a routed commit vests under the same floor", async () => {
    const h = await house("keeper-lei-f6", { realRite: true });
    expect(await licensed(h)).toMatchObject({ reading: "named" });
    const off = pulamaHandDoor({ holder: fx!.kept, server: fx!.server, image: h.image, records: h.records, keeperRite: h.keeperRite, keeperLeiStands: false });
    await off({ op: "closure", digest: D });
    expect(await vestOver(h, off, [{ group: "group-keeper-lei-f6", devices: 1 }])).toMatchObject({ reading: "keeper-lei-floor-off" });
    expect(h.begins).toEqual([]);
    await off({ op: "name-successor", next: D2, devices: 1, credentials: fixtureRoute });
    expect(await vestOver(h, off, [{ group: "group-keeper-lei-f6", devices: 1 }])).toMatchObject({ reading: "vested" });
  });

  test("F5: a commit that must not supersede refuses on the very fold it rests by, never superseding a live hand commit", async () => {
    const h = await house("keeper-lei-f5");
    await h.commit(D3);
    const by = await pulamaSignerOf(fx!.kept);
    const out = await keeperNameSuccessor(h.records, by, { closure: D, image: IMAGE, faces: [], worn: 0, spent: 0, next: D2, devices: 1, noSupersede: true } as never);
    expect(out).toMatchObject({ refusal: "keeper-lei-successor-stands" });
    expect((await keeperFold(h.records, by)).successor?.next).toBe(D3);
    // A STALE commit (the standing reads another closure than the commit handed from) yields on that very fold, superseding it.
    const past = await keeperNameSuccessor(h.records, by, { closure: D2, image: IMAGE, faces: [], worn: 0, spent: 0, next: D2, devices: 1, noSupersede: true } as never);
    expect(past).toMatchObject({ next: D2, supersedes: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  test("keeperSuccessorStale reads closures and rows alone: self-successor, keeper-moved, arrival, unreported", () => {
    const at = (closure: string, next: string) => ({ tessera: "t", v: 1, next, begun: "c", devices: 1, body: { closure, next } as never });
    expect(keeperSuccessorStale(null, D)).toBeNull();
    expect(keeperSuccessorStale(at(D, D), D)).toBe("self-successor");
    expect(keeperSuccessorStale(at(D, D), null)).toBe("self-successor");
    expect(keeperSuccessorStale(at(D, D3), D)).toBeNull();
    expect(keeperSuccessorStale(at(D, D3), D2)).toBe("keeper-moved");
    expect(keeperSuccessorStale(at(D, D3), D3)).toBeNull();
    expect(keeperSuccessorStale(at(D, D3), null)).toBeNull();
  });
});
