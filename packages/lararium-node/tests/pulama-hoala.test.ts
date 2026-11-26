/**
 * pulama-hoala — THE HOʻĀLA LEI: the hand strings one lei of counted returns under its route; a keeper that restarts on the same
 * code closure spends ONE return with no route and stands lit with the faces lit at the stringing, leaving one receipt; returns
 * spent, an unstring, a moved closure, a missing device key and a slot brought back from an older copy each stop at the locked
 * floor and name the cure; the route never rests, and no answer or log line carries a key.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { UNLOCK_ATTEMPTS_PER_BOOT, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { pulamaSignerOf } from "../src/kukulu-gate.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaAdmissions, verifiedPulamaRecord } from "../src/pulama-admit.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "../src/pulama-hand.js";
import { HOALA_HAND_CURE, hoalaDevice, hoalaDeviceDir, hoalaReceiptTitle, hoalaSlotTitle, hoalaUnstrungTitle, pulamaHoalaPrefix } from "../src/pulama-hoala.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { handVerbExit, runHandVerb } from "../src/pulama-verbs.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureRoute, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const D = "sha256:" + "d0".repeat(32), D2 = "sha256:" + "94".repeat(32), IMAGE = "sha256:" + "1a".repeat(32);
const CURE = /lares pulama light.*lares lei kui --rite hoala --returns <n>/;
let fx: PulamaFixture | null = null;
const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-hoala-")); dirs.push(d); return d; };
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/**
 * One house: the lit keeper (the fixture's holder, one face open) over a state dir and its sibling device dir, as the compose
 * file mounts them. `restart()` stands the keeper a host restart leaves: a fresh, unlit holder over the same custody, state
 * and device directories, with the closure the host reports for it.
 */
async function house(label: string, opts: { readonly device?: false } = {}) {
  fx = await standPulama(label, () => openGate({ faces: lend(0), coldReads: [] }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(`group-${label}`), ordinal: 0, slots: fixtureSlots });
  const root = scratch(), state = join(root, "state"), deviceDir = hoalaDeviceDir(state);
  mkdirSync(state, { recursive: true });
  if (opts.device !== false) mkdirSync(deviceDir, { recursive: true });
  const records = pulamaRecords(state), image = pulamaImage(state), lines: string[] = [], answers: PulamaHandAnswer[] = [];
  const watch = (door: (f: unknown) => Promise<PulamaHandAnswer>) => async (frame: unknown) => { const a = await door(frame); answers.push(a); return a; };
  const lit = watch(pulamaHandDoor({ holder: fx.kept, server: fx.server, image, records, admissions: pulamaAdmissions(records), hoala: hoalaDevice(deviceDir), worn: () => 0, onLog: (l) => lines.push(l) }));
  await lit({ op: "image", digest: IMAGE, closure: D });
  const restart = async (closure: string | null = D) => {
    const holder: CustodyHolder = makeCustodyHolder({ io: new FsCustodyIo(fx!.seat.homes), homes: fx!.seat.homes });
    const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
    const door = watch(pulamaHandDoor({ holder, server, image, records, admissions: pulamaAdmissions(records), hoala: hoalaDevice(deviceDir), onLog: (l) => lines.push(l) }));
    if (closure !== null) await door({ op: "closure", digest: closure });
    return { holder, door };
  };
  const string = (returns: number, extra: Record<string, unknown> = {}) => lit({ op: "hoala-string", returns, credentials: fixtureRoute, ...extra });
  const keys = (): string[] => { try { return readdirSync(deviceDir).filter((n) => n.endsWith(".key")); } catch { return []; } };
  return { face, state, deviceDir, records, lit, restart, string, keys, lines, answers };
}

describe("RED a hoʻāla lei wakes a restarted keeper: lit, one return spent, one receipt left", () => {
  test("the hand strings under its route; a restart spends ONE return with no route, lights the face and rests a signed receipt", async () => {
    const h = await house("wake");
    const strung = await h.string(2);
    expect(strung).toMatchObject({ op: "hoala-string", reading: "strung", returns: 2, faces: [0] });
    expect(strung["lei"]).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(h.keys()).toHaveLength(1);
    expect(await h.lit({ op: "status" })).toMatchObject({ hoala: { lei: strung["lei"], returns: 2, left: 2, closure: D, faces: [0], verified: true } });

    const woken = await h.restart();
    expect(await woken.door({ op: "status" })).toMatchObject({ lit: false, hoala: { returns: 2, left: 2, verified: false } });
    const woke = await woken.door({ op: "hoala" });
    expect(woke).toMatchObject({ op: "hoala", reading: "woke", lei: strung["lei"], n: 1, of: 2, left: 1, woke: [0], lit: true, faces: 1 });
    expect(woken.holder.isUnlocked()).toBe(true);
    // A RESTART STARTS A FRESH BUDGET, by the standing ruling: no route was presented, so no try reads spent.
    expect(woken.holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT);
    // THE RECEIPT rests signed under the pūlama's key, naming the lei, the return and the faces lit.
    const by = await pulamaSignerOf(woken.holder);
    const receipt = verifiedPulamaRecord(await h.records.read(hoalaReceiptTitle(String(strung["lei"]), 1)), by.key);
    expect(receipt?.body).toMatchObject({ act: "hoala-woke", lei: strung["lei"], n: 1, of: 2, closure: D, image: IMAGE, faces: [{ fcid: h.face.fcid, ordinal: 0 }] });
    // THE RATCHET: the slot moved to the next return under a fresh device key, and the key before it stands destroyed.
    expect(await woken.door({ op: "status" })).toMatchObject({ lit: true, litBy: "hoala", hoala: { returns: 2, left: 1, verified: true } });
    expect(h.keys()).toHaveLength(1);
    await woken.holder.lock();
  });

  test("the last return wakes the keeper and leaves NOTHING at rest; the restart after it stops at the locked floor naming the re-string cure", async () => {
    const h = await house("spent");
    await h.string(1);
    const first = await h.restart();
    expect(await first.door({ op: "hoala" })).toMatchObject({ reading: "woke", n: 1, of: 1, left: 0 });
    expect(h.keys()).toEqual([]);
    expect((await h.records.read(hoalaSlotTitle()))).not.toMatch(/"box"/);
    await first.holder.lock();
    const second = await h.restart();
    const refused = await second.door({ op: "hoala" });
    expect(refused).toMatchObject({ op: "hoala", reading: "hoala-returns-spent", lit: false });
    expect(String(refused["detail"])).toMatch(CURE);
    expect(String(refused["detail"])).toContain(HOALA_HAND_CURE);
    expect(second.holder.isUnlocked()).toBe(false);
    // CONTROL: the hand's own light still opens it, and a fresh stringing stands again.
    expect(await second.door({ op: "light", credentials: fixtureRoute })).toMatchObject({ reading: "opens" });
    await second.holder.lock();
  });

  test("the verb exits 1 on every reading but `woke`, so the host shim never takes a refusal for a waking", async () => {
    const h = await house("verb-exit");
    const unlit = await h.restart();
    const answer = await runHandVerb("hoala", undefined, { ask: (f) => unlit.door(f), route: async () => FIXTURE_PASSPHRASE });
    expect(answer).toMatchObject({ reading: "hoala-lei-absent" });
    expect(handVerbExit("hoala", answer)).toBe(1);
    expect(handVerbExit("hoala", { op: "hoala", reading: "woke" })).toBe(0);
  });
});

describe("RED unstring revokes at once: revoke wins, lit or unlit, and the sealed proof stands destroyed", () => {
  test("an unstring by the lit keeper destroys the device key and the slot; the restart after it stays locked and names the cure", async () => {
    const h = await house("unstring-lit");
    const strung = await h.string(3);
    expect(await h.lit({ op: "hoala-unstring" })).toMatchObject({ reading: "unstrung", lei: strung["lei"], keys: 1 });
    expect(h.keys()).toEqual([]);
    expect(await h.records.read(hoalaUnstrungTitle(String(strung["lei"])))).not.toBeNull();
    expect((await h.lit({ op: "status" }))["hoala"]).toBeUndefined();
    const woken = await h.restart();
    const refused = await woken.door({ op: "hoala" });
    expect(refused).toMatchObject({ reading: "hoala-lei-unstrung", lit: false });
    expect(String(refused["detail"])).toMatch(CURE);
  });

  test("an UNLIT keeper unstrings with no route (a destruction lowers power alone), and a second unstring names none standing", async () => {
    const h = await house("unstring-unlit");
    await h.string(3);
    const woken = await h.restart();
    expect(await woken.door({ op: "hoala-unstring" })).toMatchObject({ reading: "unstrung", keys: 1 });
    expect(h.keys()).toEqual([]);
    expect(await woken.door({ op: "hoala" })).toMatchObject({ reading: "hoala-lei-unstrung", lit: false });
    expect(await woken.door({ op: "hoala-unstring" })).toMatchObject({ reading: "hoala-lei-absent" });
    expect(handVerbExit("hoala-unstring", { op: "hoala-unstring", reading: "hoala-lei-absent" })).toBe(1);
  });

  test("a slot whose unstring word rests refuses even where the slot and its key came back from a copy", async () => {
    const h = await house("unstring-copy");
    const strung = await h.string(3);
    const slot = await h.records.read(hoalaSlotTitle());
    const [key] = h.keys();
    const saved = readFileSync(join(h.deviceDir, key!));
    await h.lit({ op: "hoala-unstring" });
    await h.records.write(hoalaSlotTitle(), slot!);
    writeFileSync(join(h.deviceDir, key!), saved, { mode: 0o600 });
    const woken = await h.restart();
    expect(await woken.door({ op: "hoala" })).toMatchObject({ reading: "hoala-lei-unstrung", lit: false });
    expect(h.keys()).toEqual([]);
    expect(strung["lei"]).toBeDefined();
  });
});

describe("RED the stringing belongs to the hand's route, and each refusal lands before a key rests", () => {
  test("a wrong route strings nothing and spends one try; an unlit keeper, no device directory, no count and a count above twelve refuse before the route reads", async () => {
    const h = await house("string-refusals");
    expect(await h.string(2, { credentials: [{ kind: "passphrase", passphrase: "not-the-route" }] })).toMatchObject({ reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - 1 });
    expect(await h.records.list(pulamaHoalaPrefix())).toEqual([]);
    expect(h.keys()).toEqual([]);
    expect(await h.lit({ op: "hoala-string", credentials: fixtureRoute })).toMatchObject({ reading: "hoala-malformed" });
    expect(await h.string(13)).toMatchObject({ reading: "hoala-returns-unconfirmed" });
    expect(await h.string(13, { confirm: true })).toMatchObject({ reading: "strung", returns: 13 });
    const unlit = await h.restart();
    await unlit.door({ op: "hoala-unstring" });
    expect(await unlit.door({ op: "hoala-string", returns: 2, credentials: fixtureRoute })).toMatchObject({ reading: "pulama-locked" });
  });

  test("a keeper that mounts no device directory strings nothing and names the cure; `check` answers ready with no route read", async () => {
    const bare = await house("no-device", { device: false });
    const refused = await bare.string(2);
    expect(refused).toMatchObject({ reading: "hoala-device-unseated" });
    expect(String(refused["detail"])).toMatch(/lares rite kukulu/);
    expect(await bare.records.list(pulamaHoalaPrefix())).toEqual([]);
    await fx!.drop(); fx = null;
    const h = await house("check");
    expect(await h.lit({ op: "hoala-string", returns: 2, check: true })).toEqual({ op: "hoala-string", reading: "ready", returns: 2 });
    expect(h.keys()).toEqual([]);
  });

  test("the verb reads the door first and asks the route once; a later stringing supersedes the one before it and its key dies", async () => {
    const h = await house("verb-string");
    let asked = 0;
    const ports = { ask: (f: Readonly<Record<string, unknown>>) => h.lit(f), route: async () => { asked++; return FIXTURE_PASSPHRASE; } };
    const first = await runHandVerb("hoala-string", ["2"], ports);
    expect(first).toMatchObject({ reading: "strung", returns: 2 });
    expect(asked).toBe(1);
    const second = await runHandVerb("hoala-string", ["3"], ports);
    expect(second).toMatchObject({ reading: "strung", returns: 3, supersedes: first["lei"] });
    expect(h.keys()).toHaveLength(1);
    expect(await h.records.read(hoalaUnstrungTitle(String(first["lei"])))).not.toBeNull();
    await expect(runHandVerb("hoala-string", ["0"], ports)).rejects.toThrow();
    await expect(runHandVerb("hoala-string", ["2", "--force"], ports)).rejects.toThrow();
  });
});

describe("RED the lei wakes the SAME keeper on THIS device in ONE life, and nothing else", () => {
  test("a keeper whose closure moved, or reported none, refuses and stays locked; the lei still stands for the keeper it licensed", async () => {
    const h = await house("closure");
    await h.string(2);
    const moved = await h.restart(D2);
    const refused = await moved.door({ op: "hoala" });
    expect(refused).toMatchObject({ reading: "hoala-closure-moved", lit: false });
    expect(String(refused["detail"])).toMatch(CURE);
    const unreported = await h.restart(null);
    expect(await unreported.door({ op: "hoala" })).toMatchObject({ reading: "closure-unreported", lit: false });
    const same = await h.restart();
    expect(await same.door({ op: "hoala" })).toMatchObject({ reading: "woke", n: 1 });
    await same.holder.lock();
  });

  test("a house copied without its device key (the slot alone) opens nothing: `hoala-device-key-absent`, locked, cure named", async () => {
    const h = await house("device-absent");
    await h.string(2);
    for (const k of h.keys()) rmSync(join(h.deviceDir, k));
    const woken = await h.restart();
    const refused = await woken.door({ op: "hoala" });
    expect(refused).toMatchObject({ reading: "hoala-device-key-absent", lit: false });
    expect(String(refused["detail"])).toMatch(CURE);
  });

  test("a tampered slot opens nothing (`hoala-slot-unopened`); a slot no keeper of this house signed stands destroyed once the key seats", async () => {
    const h = await house("tamper");
    await h.string(2);
    const row = JSON.parse((await h.records.read(hoalaSlotTitle()))!) as { body: { box: { c: string }; returns: number }; signer: string; sig: string };
    const flipped = { ...row, body: { ...row.body, box: { ...row.body.box, c: (row.body.box.c[0] === "0" ? "1" : "0") + row.body.box.c.slice(1) } } };
    await h.records.write(hoalaSlotTitle(), JSON.stringify(flipped));
    const a = await h.restart();
    expect(await a.door({ op: "hoala" })).toMatchObject({ reading: "hoala-slot-unopened", lit: false });
    // The box still opens (its salt binds the lei, the closure and the count), and the body's count of returns was raised by hand:
    // the signature no longer answers, so the keeper locks and what rests dies.
    await h.records.write(hoalaSlotTitle(), JSON.stringify({ ...row, body: { ...row.body, returns: 99 } }));
    const b = await h.restart();
    const refused = await b.door({ op: "hoala" });
    expect(refused).toMatchObject({ reading: "hoala-slot-unsigned", lit: false });
    expect(b.holder.isUnlocked()).toBe(false);
    expect(h.keys()).toEqual([]);
  });

  test("a slot and key brought back from an older copy find the receipt standing: `hoala-return-respent`, locked, both destroyed", async () => {
    const h = await house("rollback");
    await h.string(3);
    const slot = await h.records.read(hoalaSlotTitle());
    const [key] = h.keys();
    const kept = join(scratch(), "key");
    copyFileSync(join(h.deviceDir, key!), kept);
    const first = await h.restart();
    expect(await first.door({ op: "hoala" })).toMatchObject({ reading: "woke", n: 1, left: 2 });
    await first.holder.lock();
    // THE OLDER COPY comes back whole: the slot at count 0 and the key that opens it.
    for (const k of h.keys()) rmSync(join(h.deviceDir, k));
    copyFileSync(kept, join(h.deviceDir, key!));
    await h.records.write(hoalaSlotTitle(), slot!);
    const again = await h.restart();
    const refused = await again.door({ op: "hoala" });
    expect(refused).toMatchObject({ reading: "hoala-return-respent", lit: false });
    expect(again.holder.isUnlocked()).toBe(false);
    expect(h.keys()).toEqual([]);
  });

  test("a keeper the hand lit and locked in this life stays locked (`hoala-keeper-lived`); a lit keeper spends no return", async () => {
    const h = await house("one-life");
    await h.string(2);
    expect(await h.lit({ op: "hoala" })).toMatchObject({ reading: "keeper-lit" });
    const woken = await h.restart();
    expect(await woken.door({ op: "light", credentials: fixtureRoute })).toMatchObject({ reading: "opens" });
    await woken.door({ op: "lock" });
    expect(await woken.door({ op: "hoala" })).toMatchObject({ reading: "hoala-keeper-lived", lit: false });
    expect(await h.lit({ op: "status" })).toMatchObject({ hoala: { left: 2 } });
  });
});

describe("RED no route and no key rides an answer, a log line or a resting row", () => {
  test("the route, the node key and the face key appear in no answer, no log line and no file the lei rests", async () => {
    const h = await house("no-leak");
    await h.string(2);
    const woken = await h.restart();
    await woken.door({ op: "hoala" });
    const held = woken.holder.handOver!()!;
    const secrets = [FIXTURE_PASSPHRASE, Buffer.from(held.treeKey).toString("hex"), ...held.faces.map((f) => Buffer.from(f.fck).toString("hex"))];
    held.treeKey.fill(0); for (const f of held.faces) f.fck.fill(0);
    const rows = (await Promise.all((await h.records.list(pulamaHoalaPrefix())).map((t) => h.records.read(t)))).join("\n");
    const said = `${JSON.stringify(h.answers)}\n${h.lines.join("\n")}\n${rows}`;
    for (const secret of secrets) expect(said).not.toContain(secret);
    await woken.holder.lock();
  });
});
