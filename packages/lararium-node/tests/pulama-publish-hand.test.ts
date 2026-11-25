/**
 * pulama-publish-hand — THE OFFERING'S SIGNATURE AT THE PŪLAMA'S HAND DOOR (gate-unifier: `nexus publish plugins --apply` under a pūlama).
 *
 * Under a pūlama the vessel holds no face root, so `lares nexus publish plugins … --apply` refused `needs-the-human` with no door to
 * ask at. The hand door's `publish` act signs in the lei pattern: the face root opens fresh under the operator's route (a ward act,
 * in the pūlama, where the key rests), signs ONE offering descriptor, and answers the signed offering; the vessel lands it. CUSTODY:
 * the root signs only the CLOSED descriptor shape (offeror · pluginsCid · blobs, the `signPluginOffering` preimage), never bytes a
 * frame names, and everything the door can judge without the route refuses before the route reads. No answer carries the route.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  computePluginsCid, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, pluginOfferingBytes, pluginOfferingCid, verifyPluginOffering, WardRefused,
  type Credential, type OfferedBlob,
} from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { offeringTermsOf, pulamaHandDoor } from "../src/pulama-hand.js";
import { runHandVerb } from "../src/pulama-verbs.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const route = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
const SEED = new Uint8Array(32).fill(7);
const PROVENANCE = { source: "https://example.test/relink", commit: "a".repeat(40), path: "plugins/relink", licence: "BSD-3-Clause" };
const BLOBS: readonly OfferedBlob[] = [{ id: "$:/plugins/flibbles/relink", version: "2.5.0", sha256: "b".repeat(64), provenance: PROVENANCE }];

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function termsFor(blobs: readonly OfferedBlob[] = BLOBS) {
  return { offeror: (await ed25519VerifyingKeyFromSeed(SEED)).toLowerCase(), pluginsCid: computePluginsCid(blobs), blobs };
}

async function stand(opts: { readonly publish?: boolean } = {}) {
  fx = await standPulama("pulama-publish-hand", () => openGate({ faces: lend(0), coldReads: [] }));
  await fx.kept.foundFace({ group: personaGroupDigest("group-publish-hand"), ordinal: 0, slots: fixtureSlots });
  const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
  const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-publish-")); dirs.push(dir);
  const key = await ed25519VerifyingKeyFromSeed(SEED);
  // THE FACE ROOT, as a ward act opens it: only the face's own route opens it, and each opening signs one act. `signed` keeps
  // every byte string the root signed, so the test reads exactly what the custody widened to.
  const opened: number[] = [], signed: Uint8Array[] = [];
  const publish = {
    key: async (ordinal: number) => (ordinal === 0 ? key : undefined),
    signer: async (ordinal: number, credentials: readonly Credential[]) => {
      opened.push(ordinal);
      if (credentials.some((c) => c.kind !== "passphrase" || c.passphrase !== FIXTURE_PASSPHRASE)) throw new WardRefused("ward-no-slot-opens", "the route opens no slot of this face's ward (2 attempt(s) left)");
      return { key, sign: async (bytes: Uint8Array) => { signed.push(bytes); return ed25519SignerFromSeed(SEED)(bytes); } };
    },
  };
  const lines: string[] = [];
  const records = pulamaRecords(dir);
  const door = pulamaHandDoor({ holder, server, image: pulamaImage(dir), records, onLog: (l) => lines.push(l), ...(opts.publish === false ? {} : { publish }) } as Parameters<typeof pulamaHandDoor>[0]);
  const light = () => door({ op: "light", credentials: route });
  return { door, light, opened, signed, lines, records, key };
}

describe("the hand signs one plugin offering at the pūlama's hand door", () => {
  test("RED: a lit pūlama signs the closed descriptor under the face's route, the root signs exactly its offering preimage, the offering verifies, nothing rests, and no answer carries the route", async () => {
    const s = await stand();
    await s.light();
    const terms = await termsFor();
    const answer = await s.door({ op: "publish", face: 0, offering: terms, credentials: route });
    expect(answer).toMatchObject({ op: "publish", reading: "signed", face: 0, offering: { offeror: terms.offeror, pluginsCid: terms.pluginsCid } });
    const offering = answer["offering"] as Parameters<typeof verifyPluginOffering>[0];
    expect(await verifyPluginOffering(offering)).toEqual({ ok: true });
    expect(answer["cid"]).toBe(pluginOfferingCid(offering));
    // CUSTODY: ONE signature, over the descriptor's offering preimage and nothing else.
    expect(s.signed).toHaveLength(1);
    expect(Buffer.from(s.signed[0]!).equals(Buffer.from(pluginOfferingBytes(terms)))).toBe(true);
    expect(s.opened).toEqual([0]);
    // SIGN-ONLY: the vessel lands the offering; the pūlama rests nothing of it.
    expect(await s.records.list("$:/")).toEqual([]);
    expect(JSON.stringify([answer, s.lines])).not.toContain(FIXTURE_PASSPHRASE);
  });

  test("RED: an unlit pūlama, an unopened face, a malformed face, a descriptor outside the closed shape and an offeror naming another key each refuse before the route reads; CONTROL: the whole descriptor signs", async () => {
    const s = await stand();
    const terms = await termsFor();
    const frame = { op: "publish", face: 0, offering: terms, credentials: route };
    expect(await s.door(frame)).toMatchObject({ op: "publish", reading: "pulama-locked" });
    await s.light();
    const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(9));
    const blob = BLOBS[0]!;
    for (const [f, reading] of [
      [{ ...frame, face: 3 }, "face-locked"],
      [{ ...frame, face: "0" }, "publish-malformed"],
      [{ ...frame, offering: undefined }, "publish-malformed"],
      [{ ...frame, offering: "arbitrary bytes the root must never sign" }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, kind: "lar:something-else" } }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, sig: "0".repeat(128) } }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, note: "an unsigned rider" } }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, offeror: terms.offeror.toUpperCase() } }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, blobs: [] } }, "publish-malformed"],
      [{ ...frame, offering: await termsFor([{ id: blob.id, version: blob.version, sha256: blob.sha256 }]) }, "publish-malformed"],
      [{ ...frame, offering: await termsFor([{ ...blob, provenance: { ...PROVENANCE, extra: "x" } as typeof PROVENANCE }]) }, "publish-malformed"],
      [{ ...frame, offering: await termsFor([{ ...blob, rider: "x" } as OfferedBlob]) }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, pluginsCid: computePluginsCid([]) } }, "publish-malformed"],
      [{ ...frame, offering: { ...terms, offeror: other.toLowerCase() } }, "publish-offeror-mismatch"],
      [{ ...frame, credentials: undefined }, "malformed"],
    ] as const) expect(await s.door(f), JSON.stringify(f).slice(0, 160)).toMatchObject({ op: "publish", reading });
    expect(s.opened).toEqual([]);
    expect(s.signed).toEqual([]);
    expect(await s.door(frame)).toMatchObject({ reading: "signed" });
  });

  test("RED: a wrong route signs nothing and answers the ward's reading, and a pūlama seated with no publish hand answers `publish-unavailable`; CONTROL: the right route signs", async () => {
    const s = await stand();
    await s.light();
    const terms = await termsFor();
    const wrong = await s.door({ op: "publish", face: 0, offering: terms, credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] });
    expect(wrong).toMatchObject({ op: "publish", reading: "ward-no-slot-opens", face: 0 });
    expect(wrong["offering"]).toBeUndefined();
    expect(JSON.stringify(wrong)).not.toContain("a-wrong-route");
    expect(s.signed).toEqual([]);
    expect(await s.door({ op: "publish", face: 0, offering: terms, credentials: route })).toMatchObject({ reading: "signed" });
    await fx!.drop(); fx = null;
    const bare = await stand({ publish: false });
    await bare.light();
    expect(await bare.door({ op: "publish", face: 0, offering: terms, credentials: route })).toEqual({ op: "publish", reading: "publish-unavailable" });
  });
});

describe("`offeringTermsOf` holds the descriptor the root signs CLOSED", () => {
  test("RED: every field outside offeror · pluginsCid · blobs refuses, and the terms it answers carry those three alone; CONTROL: the whole descriptor reads", async () => {
    const terms = await termsFor();
    expect(await offeringTermsOf(terms)).toEqual({ terms });
    for (const bad of [null, [], "bytes", { ...terms, extra: 1 }, { offeror: terms.offeror, blobs: terms.blobs }]) {
      expect(await offeringTermsOf(bad), JSON.stringify(bad)).toMatchObject({ reading: "publish-malformed" });
    }
  });
});

describe("the hand's publish verb at the pūlama", () => {
  function ports(lit: boolean) {
    const frames: Array<Record<string, unknown>> = [], asked: string[] = [];
    return {
      frames, asked,
      ask: async (frame: Readonly<Record<string, unknown>>) => { frames.push({ ...frame }); return frame["op"] === "status" ? { op: "status", lit } : { op: String(frame["op"]), reading: "signed" }; },
      route: async (label: string) => { asked.push(label); return "the-route"; },
    };
  }

  test("RED: `publish '<terms>'` reads the descriptor, then the door, asks the route naming the region, its blobs and the face, and hands one publish frame with the descriptor and the route", async () => {
    const p = ports(true);
    const terms = await termsFor();
    expect(await runHandVerb("publish", JSON.stringify({ face: 0, offering: terms }), p)).toEqual({ op: "publish", reading: "signed" });
    expect(p.frames).toEqual([{ op: "status" }, { op: "publish", face: 0, offering: terms, credentials: [{ kind: "passphrase", passphrase: "the-route" }] }]);
    expect(p.asked).toHaveLength(1);
    expect(p.asked[0]).toContain(terms.pluginsCid);
    expect(p.asked[0]).toContain("h0");
  });

  test("RED: an unlit pūlama and a malformed descriptor each refuse before any route is asked; a line carrying a route or another field refuses by usage", async () => {
    const terms = await termsFor();
    const unlit = ports(false);
    expect(await runHandVerb("publish", JSON.stringify({ face: 0, offering: terms }), unlit)).toMatchObject({ op: "publish", reading: "pulama-locked" });
    expect(unlit.asked).toEqual([]);
    const lit = ports(true);
    expect(await runHandVerb("publish", JSON.stringify({ face: 0, offering: { ...terms, sig: "0".repeat(128) } }), lit)).toMatchObject({ op: "publish", reading: "publish-malformed" });
    expect(lit.frames).toEqual([]);
    expect(lit.asked).toEqual([]);
    for (const line of [JSON.stringify({ face: 0, offering: terms, credentials: route }), JSON.stringify({ face: -1, offering: terms }), "not json"]) {
      await expect(runHandVerb("publish", line, lit), line).rejects.toThrow(/usage/);
    }
    expect(lit.asked).toEqual([]);
  });
});
