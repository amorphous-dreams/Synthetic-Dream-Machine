/**
 * pulama-sign-hand — ONE SIGNING DOOR FOR EVERY WARD ACT UNDER A PŪLAMA (gate-unifier: `lares kahua lift … --face 1` refused
 * `kahua-act-refused: operator-grant-absent … needs-the-human` after asking the passphrase).
 *
 * Under a pūlama the vessel holds no face root, so a ward act that signs as the face found no door. The hand door's `sign` act
 * carries them all in the lei pattern: the vessel reads the terms (the face, the record's KIND, the one unsigned record), the face
 * root opens fresh under the operator's route in the pūlama, signs that ONE record and zeroes, and the vessel lands it. CUSTODY:
 * the root signs only a registered kind's own domain-tagged preimage of a record that passed that kind's closed shape, never bytes
 * a frame names; every check the door holds refuses BEFORE the route reads, and `check` answers `ready` there with no route.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { KAHUA_ACT_DOMAIN } from "@lararium/mesh/domains";
import { computePluginsCid } from "@lararium/mesh/genesis-doc";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { kahuaActBody, kahuaActBytes, readKahuaAct, type KahuaActBody } from "@lararium/mesh/kahua-stage";
import { pluginOfferingBytes, verifyPluginOffering, type OfferedBlob } from "@lararium/mesh/plugin-offering";
import { WardRefused } from "@lararium/mesh/ward-slots";
import { type Credential } from "@lararium/mesh/keyslot-door";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { PULAMA_SIGN_KINDS } from "../src/pulama-sign.js";
import { runHandVerb } from "../src/pulama-verbs.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const route = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
const SEED = new Uint8Array(32).fill(7);
const GROUP = "kahua-sign-hand-face";
const PROVENANCE = { source: "https://example.test/relink", commit: "a".repeat(40), path: "plugins/relink", licence: "BSD-3-Clause" };
const BLOBS: readonly OfferedBlob[] = [{ id: "$:/plugins/flibbles/relink", version: "2.5.0", sha256: "b".repeat(64), provenance: PROVENANCE }];

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function liftBody(over: Partial<Record<string, unknown>> = {}): Promise<KahuaActBody> {
  const key = (await ed25519VerifyingKeyFromSeed(SEED)).toLowerCase();
  return kahuaActBody({
    group: GROUP, act: "lift", epoch: 0, title: "lar:///ha.ka.ba/kahua/memory/note", text: "a note", fields: {}, parent: null,
    origin: { seat: key, device: "d".repeat(64), session: "cli:sign-hand" }, taint: [], sources: [{ title: "lar:///ha.ka.ba/kahua/memory/note", revision: "r" }],
    ...over,
  } as Parameters<typeof kahuaActBody>[0]);
}

async function stand(opts: { readonly sign?: boolean } = {}) {
  fx = await standPulama("pulama-sign-hand", () => openGate({ faces: lend(0), coldReads: [] }));
  await fx.kept.foundFace({ group: personaGroupDigest("group-sign-hand"), ordinal: 0, slots: fixtureSlots });
  const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
  const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-sign-")); dirs.push(dir);
  const key = await ed25519VerifyingKeyFromSeed(SEED);
  const opened: number[] = [], signed: Uint8Array[] = [];
  const sign = {
    key: async (ordinal: number) => (ordinal === 0 ? key : undefined),
    group: async (ordinal: number) => (ordinal === 0 ? GROUP : null),
    signer: async (ordinal: number, credentials: readonly Credential[]) => {
      opened.push(ordinal);
      if (credentials.some((c) => c.kind !== "passphrase" || c.passphrase !== FIXTURE_PASSPHRASE)) throw new WardRefused("ward-no-slot-opens", "the route opens no slot of this face's ward (2 attempt(s) left)");
      return { key, sign: async (bytes: Uint8Array) => { signed.push(bytes); return ed25519SignerFromSeed(SEED)(bytes); } };
    },
  };
  const lines: string[] = [];
  const records = pulamaRecords(dir);
  const door = pulamaHandDoor({ holder, server, image: pulamaImage(dir), records, onLog: (l) => lines.push(l), ...(opts.sign === false ? {} : { sign }) } as Parameters<typeof pulamaHandDoor>[0]);
  const light = () => door({ op: "light", credentials: route });
  return { door, light, opened, signed, lines, records, key: key.toLowerCase() };
}

describe("the hand signs ONE record of the closed set at the pūlama's hand door", () => {
  test("RED: a lit pūlama signs a kahua lift under the face's route: the root signs exactly the act's own bytes, the stage's reader seats it, nothing rests, and no answer carries the route", async () => {
    const s = await stand();
    await s.light();
    const body = await liftBody();
    const answer = await s.door({ op: "sign", face: 0, kind: "kahua-act", record: body, credentials: route });
    expect(answer).toMatchObject({ op: "sign", reading: "signed", face: 0, kind: "kahua-act" });
    const record = answer["record"];
    expect(readKahuaAct(record, { group: GROUP, grant: (k) => k === s.key })).toMatchObject({ ok: true, cid: answer["cid"] });
    expect(s.signed).toHaveLength(1);
    expect(Buffer.from(s.signed[0]!).equals(Buffer.from(kahuaActBytes(body)))).toBe(true);
    expect(s.opened).toEqual([0]);
    expect(await s.records.list("$:/")).toEqual([]);
    expect(JSON.stringify([answer, s.lines])).not.toContain(FIXTURE_PASSPHRASE);
  });

  test("RED: a withdraw and a carry sign by the same kind, and a plugin offering by its own; CONTROL: each record reads back under its own reader", async () => {
    const s = await stand();
    await s.light();
    for (const body of [kahuaActBody({ group: GROUP, act: "withdraw", epoch: 0, target: "c".repeat(64) }), kahuaActBody({ group: GROUP, act: "carry", epoch: 1, carries: ["c".repeat(64)] })]) {
      const answer = await s.door({ op: "sign", face: 0, kind: "kahua-act", record: body, credentials: route });
      expect(answer).toMatchObject({ reading: "signed" });
      expect(readKahuaAct(answer["record"], { group: GROUP, grant: (k) => k === s.key }).ok).toBe(true);
    }
    const terms = { offeror: s.key, pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS };
    const offered = await s.door({ op: "sign", face: 0, kind: "plugin-offering", record: terms, credentials: route });
    expect(offered).toMatchObject({ reading: "signed", kind: "plugin-offering" });
    expect(await verifyPluginOffering(offered["record"] as Parameters<typeof verifyPluginOffering>[0])).toEqual({ ok: true });
    expect(Buffer.from(s.signed.at(-1)!).equals(Buffer.from(pluginOfferingBytes(terms)))).toBe(true);
  });

  test("RED: unlit, an unopened face, a kind outside the closed set, arbitrary bytes, a record outside its kind's shape, another group, a lift seated by another key and an offering naming another root each refuse BEFORE the route reads; CONTROL: the whole record signs", async () => {
    const s = await stand();
    const body = await liftBody();
    const frame = { op: "sign", face: 0, kind: "kahua-act", record: body, credentials: route };
    expect(await s.door(frame)).toMatchObject({ op: "sign", reading: "pulama-locked" });
    await s.light();
    const other = (await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(9))).toLowerCase();
    for (const [f, reading] of [
      [{ ...frame, face: 3 }, "face-locked"],
      [{ ...frame, face: "0" }, "sign-malformed"],
      [{ ...frame, kind: "raw-bytes" }, "sign-kind-unknown"],
      [{ ...frame, kind: "__proto__" }, "sign-kind-unknown"],
      [{ ...frame, record: "arbitrary bytes the root must never sign" }, "sign-malformed"],
      [{ ...frame, record: { ...body, kind: "lar:something-else" } }, "sign-malformed"],
      [{ ...frame, record: { ...body, act: "mint" } }, "sign-malformed"],
      [{ ...frame, record: { ...body, fields: { "kahua-stamp": "x" } } }, "sign-malformed"],
      [{ ...frame, record: { ...body, rider: "an unsigned rider" } }, "sign-malformed"],
      [{ ...frame, record: { ...body, origin: { ...(body as { origin: object }).origin, rider: "x" } } }, "sign-malformed"],
      [{ ...frame, record: { ...body, sources: [{ title: "s", revision: "r", rider: "x" }] } }, "sign-malformed"],
      [{ ...frame, record: { ...body, group: "another-face" } }, "sign-key-mismatch"],
      [{ ...frame, record: await liftBody({ origin: { seat: other, device: "d".repeat(64), session: "s" } }) }, "sign-key-mismatch"],
      [{ ...frame, kind: "plugin-offering", record: { offeror: other, pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS } }, "sign-key-mismatch"],
      [{ ...frame, kind: "plugin-offering", record: body }, "sign-malformed"],
      [{ ...frame, credentials: undefined }, "malformed"],
    ] as const) expect(await s.door(f), JSON.stringify(f).slice(0, 160)).toMatchObject({ op: "sign", reading });
    expect(s.opened).toEqual([]);
    expect(s.signed).toEqual([]);
    expect(await s.door(frame)).toMatchObject({ reading: "signed" });
  });

  test("RED: `check` answers `ready` naming what the root would sign, opens no root and asks for no route; CONTROL: a refusal reads the same with or without `check`", async () => {
    const s = await stand();
    await s.light();
    const body = await liftBody();
    expect(await s.door({ op: "sign", face: 0, kind: "kahua-act", record: body, check: true })).toMatchObject({ op: "sign", reading: "ready", face: 0, describe: expect.stringContaining("kahua lift") });
    expect(await s.door({ op: "sign", face: 3, kind: "kahua-act", record: body, check: true })).toMatchObject({ reading: "face-locked" });
    expect(s.opened).toEqual([]);
    expect(s.signed).toEqual([]);
  });

  test("RED: a wrong route signs nothing and answers the ward's reading, and a pūlama seated with no sign hand answers `sign-unavailable`; CONTROL: the closed set names its kinds", async () => {
    const s = await stand();
    await s.light();
    const wrong = await s.door({ op: "sign", face: 0, kind: "kahua-act", record: await liftBody(), credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] });
    expect(wrong).toMatchObject({ op: "sign", reading: "ward-no-slot-opens", face: 0 });
    expect(wrong["record"]).toBeUndefined();
    expect(JSON.stringify(wrong)).not.toContain("a-wrong-route");
    expect(s.signed).toEqual([]);
    expect(Object.keys(PULAMA_SIGN_KINDS).sort()).toEqual(["kahua-act", "plugin-offering"]);
    expect(PULAMA_SIGN_KINDS["kahua-act"]!.domain).toBe(KAHUA_ACT_DOMAIN);
    await fx!.drop(); fx = null;
    const bare = await stand({ sign: false });
    await bare.light();
    expect(await bare.door({ op: "sign", face: 0, kind: "kahua-act", record: await liftBody(), credentials: route })).toEqual({ op: "sign", reading: "sign-unavailable" });
  });
});

describe("the route's prompt names what the root signs (cold read F4)", () => {
  test("RED: a lift's words name its title scrubbed of control characters, its text length, fields, sources, taint and parent; CONTROL: a withdraw names its target", async () => {
    const body = await liftBody({ title: "note\u001b[2Jfake\u202e", text: "x".repeat(42), fields: { type: "text/plain" }, taint: ["web:example"] });
    const words = PULAMA_SIGN_KINDS["kahua-act"]!.describe(body);
    expect(words).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/);
    for (const part of ["42", "type", "1 source", "web:example", "parent none"]) expect(words, part).toContain(part);
    expect(PULAMA_SIGN_KINDS["kahua-act"]!.describe(kahuaActBody({ group: GROUP, act: "withdraw", epoch: 0, target: "c".repeat(64) }))).toContain("c".repeat(64));
  });

  test("RED (cold re-read R1): a lift's words name the session and device its origin carries, so the root never signs a session label the person never saw; the Arabic letter mark and the soft hyphen print as `?`", async () => {
    const words = PULAMA_SIGN_KINDS["kahua-act"]!.describe(await liftBody({ origin: { seat: (await ed25519VerifyingKeyFromSeed(SEED)).toLowerCase(), device: "d".repeat(64), session: "cli:the\u061csess\u00adion" } }));
    expect(words).toContain("session cli:the?sess?ion");
    expect(words).toContain(`device ${"d".repeat(64)}`);
    expect(words).not.toMatch(/[\u061c\u00ad]/);
  });
});

describe("the hand's sign verb at the pūlama checks before it asks", () => {
  function ports(ready: Record<string, unknown>) {
    const frames: Array<Record<string, unknown>> = [], asked: string[] = [];
    return {
      frames, asked,
      ask: async (frame: Readonly<Record<string, unknown>>) => { frames.push({ ...frame }); return frame["check"] === true ? { op: String(frame["op"]), ...ready } : { op: String(frame["op"]), reading: "signed" }; },
      route: async (label: string) => { asked.push(label); return "the-route"; },
    };
  }

  test("RED: `sign '<terms>'` asks the door's check first, then the route naming what the root signs, then hands ONE sign frame with the record and the route", async () => {
    const p = ports({ reading: "ready", describe: "a kahua lift of \"note\" (epoch 0)" });
    const body = await liftBody();
    expect(await runHandVerb("sign", JSON.stringify({ face: 1, kind: "kahua-act", record: body }), p)).toEqual({ op: "sign", reading: "signed" });
    expect(p.frames).toEqual([
      { op: "sign", face: 1, kind: "kahua-act", record: body, check: true },
      { op: "sign", face: 1, kind: "kahua-act", record: body, credentials: [{ kind: "passphrase", passphrase: "the-route" }] },
    ]);
    expect(p.asked).toHaveLength(1);
    expect(p.asked[0]).toContain("kahua lift");
    expect(p.asked[0]).toContain("h1");
  });

  test("RED: any refusal the check reads (unlit, an unopened face, a mismatched root) returns before any route is asked; a line carrying a route or another field refuses by usage", async () => {
    const body = await liftBody();
    for (const reading of ["pulama-locked", "face-locked", "sign-key-mismatch", "sign-kind-unknown"]) {
      const p = ports({ reading });
      expect(await runHandVerb("sign", JSON.stringify({ face: 1, kind: "kahua-act", record: body }), p)).toMatchObject({ reading });
      expect(p.asked).toEqual([]);
      expect(p.frames).toHaveLength(1);
    }
    const p = ports({ reading: "ready" });
    for (const line of [JSON.stringify({ face: 1, kind: "kahua-act", record: body, credentials: route }), JSON.stringify({ face: -1, kind: "kahua-act", record: body }), JSON.stringify({ face: 1, record: body }), "not json"]) {
      await expect(runHandVerb("sign", line, p), line).rejects.toThrow(/usage/);
    }
    expect(p.asked).toEqual([]);
  });

  test("RED (#576 follow-up): `publish '<terms>'` asks the door's check before the route too, so an unopened face or another offeror refuses before anyone types", async () => {
    const terms = { offeror: (await ed25519VerifyingKeyFromSeed(SEED)).toLowerCase(), pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS };
    const p = ports({ reading: "publish-offeror-mismatch" });
    expect(await runHandVerb("publish", JSON.stringify({ face: 0, offering: terms }), p)).toMatchObject({ reading: "publish-offeror-mismatch" });
    expect(p.asked).toEqual([]);
    expect(p.frames).toEqual([{ op: "publish", face: 0, offering: terms, check: true }]);
  });
});
