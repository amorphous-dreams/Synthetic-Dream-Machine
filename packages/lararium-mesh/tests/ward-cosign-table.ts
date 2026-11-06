/**
 * ward-cosign-table — row 7's S3b reds and controls, one table every vessel composition runs (seat-harness#/the-swarm-slices).
 *
 * Each row drives a ward act through its real door (`promoteBoardDoor` for a kāpae lower, `swarmCommand` for the house cap and a
 * push go) over a real intent document, with the gate port the vessel composes. A second device's answer lands as that device
 * signs it. No clock rides anywhere: the thousand retries loop over the gate itself.
 *
 * Reds: a self-answer never approves; a digest mismatch, an aside answerer and a contested pair refuse; a replay after the
 * outcome refuses `spent`; two devices and a peer that never answers stay `ward-awaiting-cosign` across a thousand retries.
 * Controls: a second device's approval lands the act; a one-device fleet lands on the unlock alone.
 *
 * The gate's own causes, each by name: a fleet frontier that does not read `known` refuses `ward-cosign-frontier-unknown` on one
 * device and on two (an admission may not have synced); a second device admitted after the port stood counts at the act; a requester
 * whose own standing reads `unknown` refuses `ward-cosign-requester-unknown` once the answer landed; a plane that drops the act's
 * intent refuses `ward-cosign-intent-dropped` and writes nothing more on a retry.
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage, type HandLineage } from "../src/hand-lineage.js";
import { buildAnswer, buildAsks, buildIntent, faceIntentVerbs } from "../src/index.js";
import { intentEntryCid, intentEntryRecordsOfGroup, writeIntentEntry, type SignedIntentEntry } from "../src/intent-entry.js";
import { kapaeLowerHead, promoteBoardDoor } from "../src/promote-board-door.js";
import { readPromoteBoard, type SignedPromoteAct } from "../src/promote-board.js";
import { swarmCommand } from "../src/swarm-door.js";
import { readSwarmBoard, swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { swarmGoTitle, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import { intentPlaneCosignPort, wardCosignGate, wardCosignIntentId, type WardCosignAct, type WardCosignPort } from "../src/ward-cosign-gate.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "../src/crypto.js";

export type Signer = { readonly key: string; sign(bytes: Uint8Array): Promise<string> };
export const keyed = async (n: number): Promise<Signer> => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

/** What a vessel composition hands the table: its own port over the plane, and the root signer its lower opens. */
export interface CosignVessel {
  readonly name: string;
  readonly acts: readonly ("lower" | "cap" | "go")[];
  port(input: {
    readonly group: string; readonly atom: Signer; readonly plane: { doc(): LarDoc; change(fn: (d: LarDoc) => void): void };
    readonly devices: readonly string[]; readonly lineage: HandLineage; readonly aside: ReadonlySet<string>;
    /** Atoms whose standing reads `unknown` (a raise owed a roll). */
    readonly unknown: ReadonlySet<string>;
    /** The fleet's signed frontier as the vessel reads it now. */
    readonly frontier: { readonly known: boolean };
  }): WardCosignPort;
  /** The face root as this vessel holds it: its key (the grant the fixture names) and a signer opened fresh for one lower. */
  root(fallback: Signer): Promise<{ readonly key: string; signer(): Promise<Signer> }>;
}

const GROUP = "cosign-face", D = "d".repeat(64), BRANCH = "feature/lane", HEAD = "a".repeat(40);

async function stand(vessel: CosignVessel, kind: "lower" | "cap" | "go", devicesN: 1 | 2 | 3) {
  const a = await keyed(41), b = await keyed(42), c = await keyed(43), held = await vessel.root(await keyed(44));
  const root = { key: held.key, sign: async (bytes: Uint8Array) => (await held.signer()).sign(bytes) };
  const devices = [a.key, b.key, c.key].slice(0, devicesN);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const planeDoc = { tiddlers: {} } as LarDoc;
  const plane = { doc: () => planeDoc, change: (fn: (d: LarDoc) => void) => fn(planeDoc) };
  const aside = new Set<string>(), unknown = new Set<string>(), frontier = { known: true };
  const port = vessel.port({ group: GROUP, atom: a, plane, devices, lineage, aside, unknown, frontier });
  const entries = () => intentEntryRecordsOfGroup(planeDoc, GROUP) as SignedIntentEntry[];
  const write = (e: SignedIntentEntry) => writeIntentEntry(planeDoc, e);
  const hand = { kind: "hand" as const, id: a.key };
  // the kāpae board
  const acts: SignedPromoteAct[] = [];
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => devices.includes(k) };
  const board = promoteBoardDoor({ group: GROUP, face, atom: a, epoch: () => 0, rootSigner: () => held.signer(),
    board: { records: async () => acts, land: async (x) => { acts.push(x); } }, projection: () => ({ planes: {} }), cosign: () => port });
  // the swarm board and wiki
  const swarmDoc = { tiddlers: {} } as LarDoc, rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)) };
  const swarmFace = { group: GROUP, grant: (k: string) => k === root.key };
  const swarmDeps = { group: GROUP, face: swarmFace, signer: root, trust: { hand: (k: string) => k === root.key, vessel: () => false, lead: () => false }, epoch: () => 0, wiki,
    board: { records: async () => swarmBoardRecords(swarmDoc, GROUP), land: async (x: Parameters<typeof writeSwarmBoardAct>[1]) => { writeSwarmBoardAct(swarmDoc, x); } },
    who: { kind: "hand" as const, id: root.key }, cosign: () => port };
  if (kind === "lower") await board.kapae({ action: "raise", wiki: "daemon", digest: D, who: hand });
  const run = (): Promise<unknown> => kind === "lower" ? board.kapae({ action: "lower", wiki: "daemon", digest: D, who: hand })
    : kind === "cap" ? swarmCommand({ action: "cap-set", value: 7 }, swarmDeps)
    : swarmCommand({ action: "go-issue", branch: BRANCH, head: HEAD }, swarmDeps);
  const landed = (): boolean => kind === "lower" ? readPromoteBoard(acts, face).kapae("daemon", D) === "withdrawn"
    : kind === "cap" ? readSwarmBoard(swarmBoardRecords(swarmDoc, GROUP), swarmFace).cap === 7
    : rows.has(swarmGoTitle(BRANCH));
  /** The act the door gates, as the gate names it. */
  const act = (): WardCosignAct => kind === "lower"
    ? { verb: "ward-kapae-lower", wiki: "daemon", head: kapaeLowerHead(D, readPromoteBoard(acts, face).kapaeHeads("daemon", D)) }
    : kind === "cap" ? { verb: "ward-house-cap", wiki: "daemon", head: sha256HexBytesSync(canonicalJsonBytes({ value: 7, parents: [], supersede: false })) }
    : { verb: "ward-push-go", wiki: "daemon", head: sha256HexBytesSync(canonicalJsonBytes({ branch: BRANCH, head: HEAD })) };
  const answer = async (by: Signer, ask: string, verdict: "approve" | "deny" = "approve") =>
    write(await buildAnswer({ group: GROUP, signer: by, ask, verdict, executor: a.key, refs: [ask] }));
  /** The first reach: the gate writes the intent and the ask and refuses; hands back the ask cid it named. */
  const firstAsk = async (): Promise<string> => {
    const err = await run().then(() => null, (e: unknown) => e as { code?: string; message: string });
    expect(err?.code).toBe("ward-awaiting-cosign");
    return /ward-awaiting-cosign: ([0-9a-f]{64})/.exec(err!.message)![1]!;
  };
  return { a, b, c, root, port, entries, write, run, landed, act, answer, firstAsk, aside, unknown, frontier, devices, rows };
}

const codeOf = async (p: Promise<unknown>): Promise<string | undefined> => p.then(() => undefined, (e: { code?: string; reading?: string }) => e.code ?? e.reading ?? String(e));

/** A one-device face's gate port: the judge answers `none`, so a door's other tests run their act on the unlock alone. */
export function soloCosign(group: string, atom: Signer): WardCosignPort {
  const doc = { tiddlers: {} } as LarDoc;
  const lineage = makeHandLineage([{ epoch: 0, signers: [atom.key], threshold: 1 }])!;
  return intentPlaneCosignPort({ group, requester: atom, verbs: faceIntentVerbs(), plane: { doc: () => doc, change: (fn) => fn(doc) },
    face: () => ({ devices: [atom.key], rosterCids: ["admit"], admittedAt: new Map([[atom.key, "admit"]]), lineage }), standing: () => "stands", frontier: () => "known" });
}

export function wardCosignTable(vessel: CosignVessel): void {
  describe(`the ward act's co-sign gate on a ${vessel.name} vessel (row 7, S3b)`, () => {
    for (const kind of vessel.acts) {
      describe(`${kind}`, () => {
        test("CONTROL: a one-device fleet lands on the unlock alone, and the plane takes no entry", async () => {
          const s = await stand(vessel, kind, 1);
          await s.run();
          expect(s.landed()).toBe(true);
          expect(s.entries()).toHaveLength(0);
        });

        test("RED: two devices and a peer that never answers: a thousand retries over the real gate stay `ward-awaiting-cosign` on one ask, and the act never lands", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          const asked = s.entries().find((e) => intentEntryCid(e) === ask)!;
          expect(asked.body).toMatchObject({ entry: "asks", detail: wardCosignIntentId(s.port, s.act()).digest });
          expect(asked.signer).toBe(s.a.key.toLowerCase());
          for (let i = 0; i < 1000; i++) {
            const err = await s.run().then(() => null, (e: { code?: string; message: string }) => e);
            expect(err?.code).toBe("ward-awaiting-cosign");
            expect(err!.message).toContain(ask);
          }
          expect(s.landed()).toBe(false);
          expect(s.entries()).toHaveLength(2);   // the intent and its one ask; a retry writes nothing
        }, 120_000);

        test("CONTROL: a second device's approval lands the act and the outcome spends the intent", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          const { id } = wardCosignIntentId(s.port, s.act());
          await s.answer(s.b, ask);
          expect(s.landed()).toBe(false);
          await s.run();
          expect(s.landed()).toBe(true);
          const outcomes = s.entries().filter((e) => e.body.entry === "outcome");
          expect(outcomes).toHaveLength(1);
          expect(outcomes[0]!.body).toMatchObject({ cause: id, result: { status: "done", cosigner: s.b.key.toLowerCase() } });
        });

        test("RED: a replay of the same act after the outcome refuses `ward-cosign-spent` and runs nothing", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          const act = s.act();   // the act as the gate named it before it ran
          await s.answer(s.b, ask);
          await s.run();
          let ran = false;
          expect(await codeOf(wardCosignGate(s.port, act, async () => { ran = true; }))).toBe("ward-cosign-spent");
          expect(ran).toBe(false);
        });

        test("RED: a self-answer never approves; CONTROL: the second device's answer beside it does", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          await s.answer(s.a, ask);
          expect(await codeOf(s.run())).toBe("ward-cosign-self-answer");
          expect(s.landed()).toBe(false);
          await s.answer(s.b, ask);
          await s.run();
          expect(s.landed()).toBe(true);
        });

        test("RED: a digest mismatch refuses: the issuer's ask names another act, and the second device answered it", async () => {
          const s = await stand(vessel, kind, 2);
          const { id, args, digest } = wardCosignIntentId(s.port, s.act());
          s.write(await buildIntent({ group: GROUP, signer: s.a, verb: s.act().verb, args, nonce: digest, audience: { mode: "asks" }, verbs: faceIntentVerbs() }));
          const wrong = await buildAsks({ group: GROUP, signer: s.a, intent: id, needs: "approval", detail: "f".repeat(64) });
          s.write(wrong);
          await s.answer(s.b, intentEntryCid(wrong));
          expect(await codeOf(s.run())).toBe("ward-cosign-digest-mismatch");
          expect(s.landed()).toBe(false);
        });

        test("RED: an aside answerer never co-signs", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          await s.answer(s.b, ask);
          s.aside.add(s.b.key);
          expect(await codeOf(s.run())).toBe("ward-cosign-answerer-aside");
          expect(s.landed()).toBe(false);
        });

        test("RED: a fleet frontier that does not read `known` refuses `ward-cosign-frontier-unknown` on one device and on two, running and writing nothing; CONTROL: the frontier read known lowers one device on the unlock alone", async () => {
          for (const n of [1, 2] as const) {
            const s = await stand(vessel, kind, n);
            s.frontier.known = false;
            expect(await codeOf(s.run())).toBe("ward-cosign-frontier-unknown");
            expect(s.landed()).toBe(false);
            expect(s.entries()).toHaveLength(0);
          }
          const s = await stand(vessel, kind, 1);
          await s.run();
          expect(s.landed()).toBe(true);
        });

        test("RED: a face that stood with one device and admits a second before the act waits on `ward-awaiting-cosign`; CONTROL: before the admission the act lands alone", async () => {
          const s = await stand(vessel, kind, 1);
          (s.devices as string[]).push(s.b.key);
          await s.firstAsk();
          expect(s.landed()).toBe(false);
          const solo = await stand(vessel, kind, 1);
          await solo.run();
          expect(solo.landed()).toBe(true);
        });

        test("RED: the second device approved, and the requester's own standing reads `unknown`: the gate names `ward-cosign-requester-unknown`, never a wait; CONTROL: standing again, the act lands", async () => {
          const s = await stand(vessel, kind, 2);
          const ask = await s.firstAsk();
          await s.answer(s.b, ask);
          s.unknown.add(s.a.key);
          expect(await codeOf(s.run())).toBe("ward-cosign-requester-unknown");
          expect(s.landed()).toBe(false);
          s.unknown.delete(s.a.key);
          await s.run();
          expect(s.landed()).toBe(true);
        });

        test("RED: a plane that drops the act's intent (two bodies under its id) refuses `ward-cosign-intent-dropped` and writes nothing, retry after retry; CONTROL: the plane without the copy asks", async () => {
          const s = await stand(vessel, kind, 2);
          const { args, digest } = wardCosignIntentId(s.port, s.act());
          for (const ref of ["e", "f"]) s.write(await buildIntent({ group: GROUP, signer: s.a, verb: s.act().verb, args, nonce: digest, audience: { mode: "asks" }, verbs: faceIntentVerbs(), refs: [ref.repeat(64)] }));
          const before = s.entries().length;
          for (let i = 0; i < 3; i++) expect(await codeOf(s.run())).toBe("ward-cosign-intent-dropped");
          expect(s.entries()).toHaveLength(before);
          expect(s.landed()).toBe(false);
          const control = await stand(vessel, kind, 2);
          await control.firstAsk();
        });

        test("RED: a contested pair refuses: one device approves, another denies", async () => {
          const s = await stand(vessel, kind, 3);
          const ask = await s.firstAsk();
          await s.answer(s.b, ask);
          await s.answer(s.c, ask, "deny");
          expect(await codeOf(s.run())).toBe("ward-cosign-contested");
          expect(s.landed()).toBe(false);
        });
      });
    }
  });
}
