/**
 * pulama-admit — admission binds to the image digest: a kūkulu that lands par admits the image its vouch walked, the hand admits
 * at the pūlama's own door on a real terminal, an admitted image serves again with no lei spent, and any other image with no
 * offer stays at the floor.
 */
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  canonicalJsonBytes, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, signKukuluVouch, signSwarmAct, swarmActCid, swarmLeiReturnedPrefix, verifyEd25519,
  PULAMA_TESSERA_DOMAIN, type SignedSwarmAct, type SwarmSignerPort, type SwarmWikiPort,
} from "@lararium/mesh";
import type { CustodyHolder } from "../src/custody-holder.js";
import { kukuluGate, pulamaSignerOf, vouchSignerOf } from "../src/kukulu-gate.js";
import { kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import * as admitModule from "../src/pulama-admit.js";
import { pulamaAdmissions, pulamaAdmitTesseraTitle, pulamaAdmittedTitle, pulamaReservedPrefix, type SignedPulamaAdmit } from "../src/pulama-admit.js";
/** The tombstone title, read off the module so this file loads before the cure lands. */
const pulamaUnadmittedTitle = (image: string, tessera: string): string => (admitModule as unknown as { pulamaUnadmittedTitle: (i: string, t: string) => string }).pulamaUnadmittedTitle(image, tessera);
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { PulamaVerbUsage, RouteNeedsTerminal, readRoute, runHandVerb, type RouteTerminal } from "../src/pulama-verbs.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { FIXTURE_PASSPHRASE, fixtureWard } from "./custody-seat-fixture.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-admit";
const BRANCH = "main";
const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const IMAGE = "sha256:" + "ab".repeat(32);
const OTHER = "sha256:" + "cd".repeat(32);
const HOT = ".persona-admissions.json";

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function stand() {
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-admit-"));
  dirs.push(dir);
  const records: SwarmWikiPort = pulamaRecords(dir), image = pulamaImage(dir), admissions = pulamaAdmissions(records);
  fx = await standPulama("pulama-admit", (kept: CustodyHolder) => kukuluGate({
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => image.raised(), admissions,
  }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  expect((await fx.local.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
  const root = await generateOrLoadPersonaGroupRoot(0, fixtureWard());
  const hand: SwarmSignerPort = { key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(0, fixtureWard(), "a swarm control")).sign(bytes) };
  const lei: SignedSwarmAct = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, hand);
  const vouch = async (img = IMAGE) => signKukuluVouch({ group: GROUP, branch: BRANCH, head: HEAD, tree: TREE, image: img }, await vouchSignerOf(fx!.local));
  const hello = async (offer: unknown): Promise<string> => {
    try { return (await fx!.vessel(offer).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  const lines: string[] = [];
  const door = pulamaHandDoor({ holder: fx.kept, server: fx.server, image, records, admissions, onLog: (l) => lines.push(l) });
  const pulamaKey = (await pulamaSignerOf(fx.kept)).key;
  const returns = async (): Promise<number> => (await records.list(swarmLeiReturnedPrefix(swarmActCid(lei)))).length;
  const reserved = async (img: string): Promise<number> => (await records.list(pulamaReservedPrefix(img))).length;
  return { fx, face, records, image, admissions, lei, vouch, hello, door, lines, pulamaKey, returns, reserved };
}

describe("RED pulama-reserves-an-admitted-image", () => {
  test("a kūkulu that lands par admits the image its vouch walked; a later hello with no offer wakes served, spends no lei and rests a re-service row", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    // Before any kūkulu: nothing stands admitted.
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    const vessel = s.fx.vessel({ lei: [s.lei], vouch: [await s.vouch()] });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(await s.returns()).toBe(1);
    // CONTROL: served, yet not landed: the image stays unadmitted until the kūkulu composed and its halves read par.
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    expect(await vessel.landRite()).toEqual({ par: true });

    // THE ADMISSION rests under the pūlama's own key, naming the image, the face and the rite's tessera.
    const row = JSON.parse((await s.records.read(pulamaAdmittedTitle(IMAGE)))!) as SignedPulamaAdmit;
    expect(row.signer).toBe(s.pulamaKey);
    expect(row.body).toMatchObject({ kind: PULAMA_TESSERA_DOMAIN, act: "image-admitted", image: IMAGE, faces: [{ fcid: s.face.fcid, ordinal: 0 }], by: "rite" });
    expect(verifyEd25519(row.sig, canonicalJsonBytes(row.body), row.signer)).toBe(true);

    // A RESTART WITH NO REBUILD: the vessel carries no offer, the host reports the same image, and the pūlama serves it again.
    const again = s.fx.vessel({});
    expect((await again.unlock([])).reading).toBe("opens");
    expect(again.lends()).toEqual([0]);
    await again.writeRecord("identity", HOT, Uint8Array.from([7]));
    expect(await again.readRecord("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([7]) });
    expect(await s.returns()).toBe(1);                     // no lei spent
    expect(await s.reserved(IMAGE)).toBe(1);
    const audit = JSON.parse((await s.records.read(`${pulamaReservedPrefix(IMAGE)}1`))!) as SignedPulamaAdmit;
    expect(audit.signer).toBe(s.pulamaKey);
    expect(audit.body).toMatchObject({ act: "image-reserved", image: IMAGE, faces: [{ fcid: s.face.fcid, ordinal: 0 }], n: 1 });
    // A session served on the admitted image began under no rite, so it lands no tessera.
    await expect(again.landRite()).rejects.toMatchObject({ reading: "rite-not-begun" });
    // Each further wake rests its own row, and still spends nothing.
    expect(await s.hello({})).toBe("opens");
    expect(await s.reserved(IMAGE)).toBe(2);
    expect(await s.returns()).toBe(1);
    // The pūlama relit after a host reboot reads the same admission: it rests on disk, signed, and no key rests with it.
    expect((await s.door({ op: "tessera" }))["admitted"]).toEqual([{ image: IMAGE, faces: [{ fcid: s.face.fcid, ordinal: 0 }], by: "rite", tessera: row.body.act === "image-admitted" ? row.body.tessera : "", tesserae: row.body.act === "image-admitted" ? row.body.tesserae : [], reserved: 2 }]);
  });
});

describe("RED pulama-keeps-an-unadmitted-image-at-the-floor", () => {
  test("another image, no image report, a forged admission row and a locked face each keep an offerless vessel at the floor; the refusal names both cures", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const vessel = s.fx.vessel({ lei: [s.lei], vouch: [await s.vouch()] });
    await vessel.unlock([]);
    await vessel.landRite();
    expect(await s.hello({})).toBe("opens");
    // THE HOST REPORTS ANOTHER IMAGE (a rebuild raised with no rite): the admitted one no longer stands behind this vessel.
    s.image.report(OTHER);
    const refused = await s.fx.vessel({}).unlock([]).catch((e: unknown) => e as { reading: string; message: string });
    expect(refused).toMatchObject({ reading: "pulama-image-unadmitted" });
    expect((refused as { message: string }).message).toMatch(/pulama admit/);
    expect((refused as { message: string }).message).toMatch(/lares rite kukulu/);
    expect(await s.reserved(OTHER)).toBe(0);
    // A row planted in the state directory under a key the custody root never yielded admits nothing.
    const seed = new Uint8Array(32).fill(5);
    const body = { kind: PULAMA_TESSERA_DOMAIN, act: "image-admitted", image: OTHER, fcid: s.face.fcid, ordinal: 0, by: "hand", tessera: "0".repeat(64) };
    await s.records.write(pulamaAdmittedTitle(OTHER), JSON.stringify({ body, signer: await ed25519VerifyingKeyFromSeed(seed), sig: await ed25519SignerFromSeed(seed)(canonicalJsonBytes(body)) }));
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    // The real admission of IMAGE, copied to OTHER's title, names another image than the one asked for.
    await s.records.write(pulamaAdmittedTitle(OTHER), (await s.records.read(pulamaAdmittedTitle(IMAGE)))!);
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    // An offer that carries a lei and no vouch never falls back to the image.
    s.image.report(IMAGE);
    expect(await s.hello({ lei: [s.lei] })).toBe("kukulu-unvouched");
    // The admitted face rests locked at the pūlama: the image admits, the face does not open.
    await s.fx.kept.lockFace(s.face.fcid);
    expect(await s.hello({})).toBe("kukulu-face-locked");
    expect(await s.reserved(IMAGE)).toBe(1);
    // CONTROL: a gate with no admitted set serves no offerless vessel at all.
    const bare = kukuluGate({ holder: s.fx.kept, hand: async () => null, rite: kukuluRiteOver(s.records), image: () => IMAGE });
    expect(await bare.admit({})).toMatchObject({ ok: false, reading: "pulama-image-unadmitted" });
  });
});

/** A fake terminal: `type` feeds keystrokes; `raw` records the echo-off switches; `said` what the reader wrote. */
function terminal(isTTY: boolean) {
  const input = Object.assign(new EventEmitter(), { isTTY, raw: [] as boolean[], setRawMode(on: boolean) { input.raw.push(on); return input; }, resume() { return input; }, pause() { return input; }, setEncoding() { return input; } });
  const said: string[] = [];
  return { input, said, port: { input, output: { write: (text: string) => { said.push(text); } } } as unknown as RouteTerminal, type: (text: string) => { input.emit("data", text); } };
}

describe("RED pulama-admit-asks-the-route-on-a-terminal", () => {
  test("the verb reads the door first, then the route on the terminal with no echo, and the route proves against the lit holder and opens nothing", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const t = terminal(true);
    const frames: Array<Record<string, unknown>> = [];
    const asked: string[] = [];
    const run = runHandVerb("admit", undefined, {
      ask: (frame) => { frames.push({ ...frame }); return s.door(frame); },
      route: (label, what) => { asked.push(label); return readRoute(label, what, t.port); },
    });
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    // The label names the image about to be admitted, and the terminal reads with echo off.
    expect(asked[0]).toContain(IMAGE);
    expect(t.input.raw).toEqual([true]);
    t.type(`${FIXTURE_PASSPHRASE}x\u007f\r`);
    const answer = await run;
    expect(t.input.raw).toEqual([true, false]);
    expect(t.said.join("")).not.toContain(FIXTURE_PASSPHRASE);
    expect(frames.map((f) => f["op"])).toEqual(["status", "admit"]);
    expect(answer).toMatchObject({ op: "admit", reading: "admitted", admitted: IMAGE, lent: [0], faces: 1, lit: true });
    // THE ROUTE OPENED NOTHING: the holder stood lit before and holds the same faces after; no attempt spent.
    expect(s.fx.kept.unlockedFaces()).toEqual([s.face.fcid]);
    expect(answer["attemptsLeft"]).toBe(3);
    // THE HAND'S OWN TESSERA: both halves rest from this one act, the host half naming the guest half, under the pūlama's key.
    const tessera = String(answer["tessera"]);
    const guest = JSON.parse((await s.records.read(pulamaAdmitTesseraTitle(tessera, "guest")))!) as SignedPulamaAdmit;
    const host = JSON.parse((await s.records.read(pulamaAdmitTesseraTitle(tessera, "host")))!) as SignedPulamaAdmit;
    expect(guest.body).toMatchObject({ act: "admit-begun", image: IMAGE, faces: [{ fcid: s.face.fcid, ordinal: 0 }], tessera });
    expect(host.body).toMatchObject({ act: "admit-landed", image: IMAGE, tessera });
    expect([guest.signer, host.signer]).toEqual([s.pulamaKey, s.pulamaKey]);
    expect((JSON.parse((await s.records.read(pulamaAdmittedTitle(IMAGE)))!) as SignedPulamaAdmit).body).toMatchObject({ act: "image-admitted", by: "hand", tessera });
    // The route rests nowhere: no record, no log line, no answer.
    const everything = JSON.stringify([answer, s.lines, await Promise.all((await s.records.list("$:/")).map((title) => s.records.read(title)))]);
    expect(everything).not.toContain(FIXTURE_PASSPHRASE);
    // AND THE IMAGE NOW SERVES: a vessel with no offer and no lei wakes standing.
    expect(await s.hello({})).toBe("opens");
    expect(await s.returns()).toBe(0);
    expect(await s.reserved(IMAGE)).toBe(1);
  });

  test("a route that opens no slot admits nothing and spends an attempt; a face must stand open; CONTROL: light and the routeless verbs still run", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const wrong = await s.door({ op: "admit", credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] });
    expect(wrong).toMatchObject({ op: "admit", reading: "no-slot-opens", attemptsLeft: 2 });
    expect(await s.records.read(pulamaAdmittedTitle(IMAGE))).toBeNull();
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    expect(await s.door({ op: "admit" })).toMatchObject({ reading: "malformed" });
    expect(await s.door({ op: "admit", credentials: fixtureRoute, faces: [3] })).toMatchObject({ reading: "face-locked", openFaces: [0] });
    await s.fx.kept.lockFace(s.face.fcid);
    expect(await s.door({ op: "admit", credentials: fixtureRoute })).toMatchObject({ reading: "face-locked", openFaces: [] });
    expect(JSON.stringify(s.lines)).not.toContain("a-wrong-route");
    // The verb line: a face rides as a whole number; anything else reads as usage.
    const ports = { ask: (frame: Readonly<Record<string, unknown>>) => s.door(frame), route: async () => FIXTURE_PASSPHRASE };
    await expect(runHandVerb("admit", "h0", ports)).rejects.toBeInstanceOf(PulamaVerbUsage);
    await expect(runHandVerb("unlock-everything", undefined, ports)).rejects.toBeInstanceOf(PulamaVerbUsage);
    expect(await runHandVerb("status", undefined, ports)).toMatchObject({ op: "status", lit: true, image: IMAGE });
    expect(await runHandVerb("image", OTHER, ports)).toMatchObject({ reading: "reported", image: OTHER });
  });
});

describe("RED pulama-admit-lends-a-set", () => {
  test("no face named admits every lit face; named faces admit as a set; a named unlit face refuses by name; a twice-named or non-ordinal face refuses; the verb takes several ordinals", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const one = await s.fx.kept.foundFace({ group: personaGroupDigest(`${GROUP}-1`), ordinal: 1, slots: fixtureSlots });
    await s.fx.kept.foundFace({ group: personaGroupDigest(`${GROUP}-2`), ordinal: 2, slots: fixtureSlots });
    await s.fx.kept.lockFace(one.fcid);
    const witness = await pulamaSignerOf(s.fx.kept);
    const lent = async () => { const a = await s.admissions.admitted(IMAGE, witness); return a !== null && "faces" in a ? a.faces.map((f) => f.ordinal) : undefined; };
    // NONE NAMED: every lit face (h1 rests dark).
    expect(await s.door({ op: "admit", credentials: fixtureRoute })).toMatchObject({ reading: "admitted", admitted: IMAGE, lent: [0, 2] });
    expect(await lent()).toEqual([0, 2]);
    // NAMED: the set named, and a later admission writes over the row.
    expect(await s.door({ op: "admit", credentials: fixtureRoute, faces: [2] })).toMatchObject({ reading: "admitted", lent: [2] });
    expect(await lent()).toEqual([2]);
    // A NAMED DARK FACE refuses by name, and the row stays as it stood.
    expect(await s.door({ op: "admit", credentials: fixtureRoute, faces: [0, 1] })).toMatchObject({ reading: "face-locked", face: 1, openFaces: [0, 2] });
    expect(await lent()).toEqual([2]);
    expect(await s.door({ op: "admit", credentials: fixtureRoute, faces: [0, 0] })).toMatchObject({ reading: "lent-faces-duplicate" });
    expect(await s.door({ op: "admit", credentials: fixtureRoute, faces: ["0"] })).toMatchObject({ reading: "lent-faces-malformed" });
    expect(await s.door({ op: "admit", credentials: fixtureRoute, face: 0 })).toMatchObject({ reading: "lent-faces-malformed" });
    // THE VERB: several ordinals ride one line, sorted in the answer.
    const ports = { ask: (frame: Readonly<Record<string, unknown>>) => s.door(frame), route: async () => FIXTURE_PASSPHRASE };
    expect(await runHandVerb("admit", ["2", "0"], ports)).toMatchObject({ reading: "admitted", lent: [0, 2] });
    await expect(runHandVerb("admit", ["0", "h2"], ports)).rejects.toBeInstanceOf(PulamaVerbUsage);
    expect(await lent()).toEqual([0, 2]);
  });
});

describe("RED pulama-admit-refuses-without-a-terminal", () => {
  test("with no terminal the verb refuses by name, sends no admit frame and admits nothing; the same reader refuses light", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const t = terminal(false);
    const frames: string[] = [];
    const ports = { ask: (frame: Readonly<Record<string, unknown>>) => { frames.push(String(frame["op"])); return s.door(frame); }, route: (label: string, what: string) => readRoute(label, what, t.port) };
    const refusal = await runHandVerb("admit", undefined, ports).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(RouteNeedsTerminal);
    expect((refusal as RouteNeedsTerminal).reading).toBe("route-needs-a-terminal");
    expect((refusal as Error).message).toMatch(/no pipe, no flag, no argument and no environment/);
    expect(frames).toEqual(["status"]);
    expect(t.input.raw).toEqual([]);
    expect(t.said).toEqual([]);
    expect(await s.records.read(pulamaAdmittedTitle(IMAGE))).toBeNull();
    await expect(runHandVerb("light", undefined, ports)).rejects.toBeInstanceOf(RouteNeedsTerminal);
    expect(frames).toEqual(["status"]);
  });
});

describe("RED pulama-admit-refuses-unlit-or-unreported", () => {
  test("no image reported: the verb refuses before any prompt and the door refuses before the route reads; unlit: the same, and no attempt spends", async () => {
    const s = await stand();
    let prompts = 0;
    const ports = { ask: (frame: Readonly<Record<string, unknown>>) => s.door(frame), route: async () => { prompts += 1; return FIXTURE_PASSPHRASE; } };
    // LIT, and the host reported nothing.
    expect(await runHandVerb("admit", undefined, ports)).toMatchObject({ op: "admit", reading: "image-unreported" });
    expect(prompts).toBe(0);
    expect(await s.door({ op: "admit", credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] })).toMatchObject({ reading: "image-unreported", attemptsLeft: 3 });
    // UNLIT, with an image reported.
    s.image.report(IMAGE);
    await s.fx.server.lock();
    expect(await runHandVerb("admit", undefined, ports)).toMatchObject({ op: "admit", reading: "pulama-locked" });
    expect(prompts).toBe(0);
    expect(await s.door({ op: "admit", credentials: fixtureRoute })).toMatchObject({ reading: "pulama-locked", lit: false });
    expect(await s.records.list("$:/lares/pulama/")).toEqual([]);
    // An unlit pūlama lists no admitted image: the set reads only under its key.
    expect((await s.door({ op: "tessera" }))["admitted"]).toEqual([]);
    // CONTROL: lit again with the image reported, the same verb admits.
    await s.fx.kept.adopt(s.fx.treeKey);
    expect((await s.fx.kept.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
    expect(await runHandVerb("admit", undefined, ports)).toMatchObject({ reading: "admitted", admitted: IMAGE });
    expect(prompts).toBe(1);
  });
});

describe("RED pulama-route-reading-names-what-it-heard", () => {
  test("a stop before Enter over a typed route says the route went nowhere and spent no attempt; only an empty reading says no route was given", async () => {
    const s = await stand();
    await s.fx.server.lock();
    const frames: string[] = [];
    const light = (t: ReturnType<typeof terminal>) => runHandVerb("light", undefined, {
      ask: (frame) => { frames.push(String(frame["op"])); return s.door(frame); },
      route: (label, what) => readRoute(label, what, t.port),
    }).catch((e: unknown) => e as Error);
    // A TYPED ROUTE, then Ctrl-D before Enter: the pūlama hears nothing, and the answer says so.
    const typed = terminal(true);
    const stopped = light(typed);
    typed.type("a-wrong-route\u0004");
    const typedRefusal = await stopped;
    expect((typedRefusal as Error).message).not.toMatch(/no route was given/);
    expect((typedRefusal as Error).message).toMatch(/opened nothing/);
    expect((typedRefusal as Error).message).toMatch(/no attempt/);
    expect((typedRefusal as Error).message).not.toContain("a-wrong-route");
    // NOTHING TYPED, then Ctrl-C: the one case that reads "no route was given", and it still names the unspent attempt.
    const empty = terminal(true);
    const nothing = light(empty);
    empty.type("\u0003");
    const emptyRefusal = await nothing;
    expect((emptyRefusal as Error).message).toMatch(/no route was given/);
    expect((emptyRefusal as Error).message).toMatch(/no attempt/);
    // A BARE ENTER sends no empty route to the door: it reads as no route, and spends nothing.
    const bare = terminal(true);
    const blank = light(bare);
    bare.type("\r");
    expect(((await blank) as Error).message).toMatch(/no route was given/);
    expect(frames).toEqual([]);
    expect((await s.door({ op: "status" }))["attemptsLeft"]).toBe(3);
  });
});

describe("RED pulama-unadmit-ends-an-admission by a signed tombstone", () => {
  test("unadmit rests `unadmitted/<image>/<tessera>` under the pūlama's key naming the tessera it ends; the gate then reads pulama-image-unadmitted; status names the ended digest; a re-admit writes a new tessera and serves again", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const first = await s.door({ op: "admit", credentials: fixtureRoute });
    const tessera = String(first["tessera"]);
    expect(await s.hello({})).toBe("opens");
    // NEEDS A ROUTE: a frame with none refuses as malformed; a wrong one proves nothing and spends an attempt.
    expect(await s.door({ op: "unadmit", image: IMAGE })).toMatchObject({ op: "unadmit", reading: "malformed" });
    expect(await s.door({ op: "unadmit", image: IMAGE, credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] })).toMatchObject({ op: "unadmit", reading: "no-slot-opens", attemptsLeft: 2 });
    // AN UNKNOWN DIGEST answers a reading and rests nothing.
    expect(await s.door({ op: "unadmit", image: OTHER, credentials: fixtureRoute })).toMatchObject({ op: "unadmit", reading: "image-not-admitted", digest: OTHER });
    const ended = await s.door({ op: "unadmit", image: IMAGE, credentials: fixtureRoute });
    expect(ended).toMatchObject({ op: "unadmit", reading: "unadmitted", digest: IMAGE, ends: tessera });
    const tomb = JSON.parse((await s.records.read(pulamaUnadmittedTitle(IMAGE, tessera)))!) as SignedPulamaAdmit;
    expect(tomb.signer).toBe(s.pulamaKey);
    expect(tomb.body).toMatchObject({ kind: PULAMA_TESSERA_DOMAIN, act: "image-unadmitted", image: IMAGE, ends: tessera });
    // THE ADMISSION ROW STAYS (a keep copy carries it the same): it reads ended while a tombstone names its tessera.
    expect(await s.records.read(pulamaAdmittedTitle(IMAGE))).not.toBeNull();
    expect(await s.admissions.admitted(IMAGE, await pulamaSignerOf(s.fx.kept))).toBeNull();
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    expect(await s.door({ op: "status" })).toMatchObject({ admitted: [], ended: [IMAGE] });
    expect((await s.door({ op: "tessera" }))["admitted"]).toEqual([]);
    // A second unadmit of the ended image answers the same reading as an unknown one.
    expect(await s.door({ op: "unadmit", image: IMAGE, credentials: fixtureRoute })).toMatchObject({ reading: "image-not-admitted" });
    // RE-ADMIT writes a new tessera, which no tombstone names: the image serves again.
    const again = await s.door({ op: "admit", credentials: fixtureRoute });
    expect(again).toMatchObject({ reading: "admitted" });
    expect(again["tessera"]).not.toBe(tessera);
    expect(await s.hello({})).toBe("opens");
    expect(await s.door({ op: "status" })).toMatchObject({ admitted: [IMAGE], ended: [] });
  });

  test("a tombstone planted under another key ends nothing; the verb reads the door first and names the image in the route's label; unlit refuses before the route reads", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const first = await s.door({ op: "admit", credentials: fixtureRoute });
    const tessera = String(first["tessera"]);
    const seed = new Uint8Array(32).fill(9);
    const body = { kind: PULAMA_TESSERA_DOMAIN, act: "image-unadmitted", image: IMAGE, ends: tessera };
    await s.records.write(pulamaUnadmittedTitle(IMAGE, tessera), JSON.stringify({ body, signer: await ed25519VerifyingKeyFromSeed(seed), sig: await ed25519SignerFromSeed(seed)(canonicalJsonBytes(body)) }));
    expect(await s.hello({})).toBe("opens");
    // The verb line: status first, then the route under a label naming the image, then the frame.
    const frames: Array<Record<string, unknown>> = [];
    const asked: string[] = [];
    const answer = await runHandVerb("unadmit", IMAGE, {
      ask: (frame) => { frames.push({ ...frame }); return s.door(frame); },
      route: async (label) => { asked.push(label); return FIXTURE_PASSPHRASE; },
    });
    expect(frames.map((f) => f["op"])).toEqual(["status", "unadmit"]);
    expect(asked[0]).toContain(IMAGE);
    // The forged row holds the slot, so no signed tombstone can rest there: the answer names it and the admission still stands.
    expect(answer).toMatchObject({ reading: "unadmit-slot-occupied", slot: pulamaUnadmittedTitle(IMAGE, tessera) });
    expect(await s.hello({})).toBe("opens");
    await expect(runHandVerb("unadmit", undefined, { ask: (f) => s.door(f), route: async () => FIXTURE_PASSPHRASE })).rejects.toBeInstanceOf(PulamaVerbUsage);
    await s.fx.server.lock();
    const unlit: string[] = [];
    expect(await runHandVerb("unadmit", IMAGE, { ask: (f) => s.door(f), route: async (l) => { unlit.push(l); return FIXTURE_PASSPHRASE; } })).toMatchObject({ reading: "pulama-locked" });
    expect(unlit).toEqual([]);
  });

  test("CONTROL: an admission no tombstone names keeps serving, and reads admitted", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    await s.door({ op: "admit", credentials: fixtureRoute });
    expect(await s.hello({})).toBe("opens");
    expect(await s.admissions.admitted(IMAGE, await pulamaSignerOf(s.fx.kept))).toMatchObject({ by: "hand" });
  });
});

describe("RED unadmit-never-answers-unadmitted-with-no-tombstone-resting", () => {
  test("a junk row planted at `unadmitted/<image>/<tessera>` refuses `unadmit-slot-occupied`, naming the slot and that the admission still stands; the image keeps serving", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    const first = await s.door({ op: "admit", credentials: fixtureRoute });
    const tessera = String(first["tessera"]);
    await s.records.write(pulamaUnadmittedTitle(IMAGE, tessera), "not a signed row");
    const a = await s.door({ op: "unadmit", image: IMAGE, credentials: fixtureRoute });
    expect(a).toMatchObject({ op: "unadmit", reading: "unadmit-slot-occupied", digest: IMAGE, slot: pulamaUnadmittedTitle(IMAGE, tessera) });
    expect(String(a["detail"])).toMatch(/still stands/);
    expect(await s.admissions.admitted(IMAGE, await pulamaSignerOf(s.fx.kept))).toMatchObject({ by: "hand", tessera });
    expect(await s.hello({})).toBe("opens");
  });

  test("a signed tombstone that landed first (a race) answers already ended, never a second write", async () => {
    const s = await stand();
    s.image.report(IMAGE);
    await s.door({ op: "admit", credentials: fixtureRoute });
    const by = await pulamaSignerOf(s.fx.kept);
    // Two unadmits read the same standing admission; the second finds the first's signed tombstone in the slot.
    const [one, two] = await Promise.all([s.admissions.unadmit(IMAGE, by), s.admissions.unadmit(IMAGE, by)]);
    expect([one, two].filter((r) => r !== null && "already" in r && r.already === true)).toHaveLength(1);
    expect(await s.admissions.admitted(IMAGE, by)).toBeNull();
  });
});

describe("RED pulama-admit-names-the-seed-the-image-offers (D1)", () => {
  const SEED = "seed (offered) " + "5".repeat(64) + ": a newer seed waits: engine same · grammar moved · plugins same · floor same";

  test("the host's report carries the seed line beside the image; status and the admission answer name it before and after the route; the admitted row carries none of it", async () => {
    const s = await stand();
    expect(await s.door({ op: "image", digest: IMAGE, seed: SEED })).toMatchObject({ reading: "reported", image: IMAGE, seed: SEED });
    expect(await s.door({ op: "status" })).toMatchObject({ image: IMAGE, seed: SEED });
    // THE VERB: the route's prompt names the seed line beside the image, so the hand reads what waits before it admits.
    const asked: string[] = [];
    const answer = await runHandVerb("admit", undefined, { ask: (frame) => s.door(frame), route: async (label) => { asked.push(label); return FIXTURE_PASSPHRASE; } });
    expect(asked[0]).toContain(IMAGE);
    expect(asked[0]).toContain(SEED);
    expect(answer).toMatchObject({ op: "admit", reading: "admitted", admitted: IMAGE, seed: SEED });
    // ADMISSION MOVES NOTHING: the admitted row and both tessera halves carry no seed field.
    const row = JSON.parse((await s.records.read(pulamaAdmittedTitle(IMAGE)))!) as SignedPulamaAdmit;
    expect(JSON.stringify(row)).not.toContain("seed");
    const tessera = String(answer["tessera"]);
    for (const half of ["guest", "host"] as const) expect(await s.records.read(pulamaAdmitTesseraTitle(tessera, half))).not.toContain("seed");
    // The verb line: the seed rides a structured frame `{ digest, seed }`, never trailing words; a bare digest stays valid.
    const ports = { ask: (frame: Readonly<Record<string, unknown>>) => s.door(frame), route: async () => FIXTURE_PASSPHRASE };
    expect(await runHandVerb("image", JSON.stringify({ digest: OTHER, seed: SEED }), ports)).toMatchObject({ reading: "reported", image: OTHER, seed: SEED });
    await expect(runHandVerb("image", [OTHER, ...SEED.split(" ")], ports)).rejects.toBeInstanceOf(PulamaVerbUsage);
    await expect(runHandVerb("image", JSON.stringify({ digest: OTHER, seed: 7 }), ports)).rejects.toBeInstanceOf(PulamaVerbUsage);
    const bare = await runHandVerb("image", IMAGE, ports);
    expect(bare).toMatchObject({ reading: "reported", image: IMAGE });
    expect(bare["seed"]).toBeUndefined();
  });

  test("CONTROL: a report with no seed line clears the earlier one; status and the answer then name no seed", async () => {
    const s = await stand();
    await s.door({ op: "image", digest: IMAGE, seed: SEED });
    await s.door({ op: "image", digest: OTHER });
    const status = await s.door({ op: "status" });
    expect(status["seed"]).toBeUndefined();
    expect(status).toMatchObject({ image: OTHER });
  });
});
