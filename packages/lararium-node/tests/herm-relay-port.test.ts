/**
 * herm-relay-port.test.ts — the herm's relay port: its drop door stands, and every upgrade meets silence.
 *
 * Proven over a real socket:
 *   · a WebSocket upgrade at the port, on any path, the stood knock's shape included, is destroyed before any 101;
 *   · THE DROP DOOR, live (the floor voice on a plain HTTP request, apart from every proven socket): junk under a real
 *     name or an invented one files nothing (F1, F2), a quarter-megabyte deposit meets silence (F3), one connection
 *     spends a bounded budget, a journal hands a restarted herm back what it verified, and a herm that never answers
 *     costs a pull or a deposit its deadline and no more (H).
 */
import { afterEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import WS from "ws";
import * as net from "node:net";
import { request as httpRequest, Agent } from "node:http";
import {
  provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard, attestAndRotate, enrolmentDigestOf,
  personaEventCidOf, personaKelDropName, httpPersonaKelDropHerm, pullPersonaKelSuccessors, depositPersonaKelChain,
  sha256HexSync, hex, knockSegment, type PersonaKelEvent,
} from "@lararium/mesh";
import { startHermRelayPort, DROP_CONNECTION_BUDGET, type HermRelayPort } from "../src/herm-relay-port.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

describe("herm-relay-port — every upgrade meets silence", () => {
  let relay: HermRelayPort | undefined;
  afterEach(async () => { await relay?.close(); relay = undefined; });

  test("an upgrade on a key-derived knock and on a bare path is destroyed before any 101", async () => {
    relay = await startHermRelayPort(new Uint8Array(32).fill(9), 0);
    const url = `ws://127.0.0.1:${relay.port}`;
    for (const target of [`${url}/ws/${knockSegment(relay.gatePubKey, "/ws")}`, `${url}/`, `${url}/ws`]) {
      const outcome = await new Promise<string>((resolve) => {
        const ws = new WS(target);
        ws.on("open", () => { ws.terminate(); resolve("opened"); });
        ws.on("error", () => resolve("refused"));
        ws.on("unexpected-response", () => resolve("refused"));
      });
      expect(outcome, target).toBe("refused");
    }
  });
});

// ── THE DROP DOOR, LIVE: a herm keeps only what verifies, spends its budget on nothing else, and never hangs a leaf ──

describe("the drop door over a live herm", () => {
  const relays: HermRelayPort[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const r of relays.splice(0)) await r.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const seed = (b: number) => new Uint8Array(32).fill(b);
  const stand = async (b: number, opts: Parameters<typeof startHermRelayPort>[3] = {}) => {
    const r = await startHermRelayPort(seed(b), 0, undefined, opts);
    relays.push(r);
    return r;
  };
  const addressOf = (r: HermRelayPort) => `ws://127.0.0.1:${r.port}#${r.gatePubKey}`;

  /** A founded KEL rotated once by its guardian quorum. */
  async function rotated(): Promise<[PersonaKelEvent, PersonaKelEvent]> {
    const guardianSeeds = [seed(61), seed(62), seed(63)];
    const guardianRecoveryKeys = await Promise.all(guardianSeeds.map(pubOf));
    const slots = ["mine", "guardian-a", "guardian-b"] as const;
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pubOf(seed(51))}`,
      guardians: guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
      recoveryThreshold: 2,
    });
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: `0x${await pubOf(seed(52))}`, guardianRecoveryKeys, recoveryThreshold: 2,
      guardianSigners: await Promise.all(guardianSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    });
    if (!rot.ok) throw new Error(rot.reason);
    return [prov.inception, rot.event];
  }
  const junkRotationOf = (prev: PersonaKelEvent, n: number): PersonaKelEvent => {
    const core = {
      seq: prev.seq + 1, prefix: prev.prefix, opKeyDid: `0x${sha256HexSync(`junk-${n}`)}`, recoverySetHash: prev.recoverySetHash,
      nextRecoverySetHash: prev.nextRecoverySetHash, prevEventCid: prev.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: enrolmentDigestOf([]),
    };
    return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
  };
  /** POST one body and read its status, or "silence" when the herm cut the socket. */
  const post = (r: HermRelayPort, name: string, body: string) =>
    fetch(`http://127.0.0.1:${r.port}/drop/${name}`, { method: "POST", headers: { "content-type": "text/plain" }, body })
      .then((res) => res.status, () => "silence" as const);

  test("RED (F1, live): sixteen junk rotations POSTed under a real name file nothing at either herm, and the lawful deposit still lands", async () => {
    const [inception, rot] = await rotated();
    const herms = [await stand(80), await stand(81)];
    for (const r of herms) {
      for (let i = 0; i < 16; i++) expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: junkRotationOf(inception, i) }))).toBe("silence");
    }
    const leaves = herms.map((r) => httpPersonaKelDropHerm(addressOf(r)));
    expect((await depositPersonaKelChain([inception, rot], leaves)).unanswered).toEqual([]);
    const pulled = await pullPersonaKelSuccessors([inception], leaves);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
    // A re-deposit of the verified event stays idempotent: it answers, and the drop still holds one value.
    expect(await post(herms[0]!, personaKelDropName(inception.eventCid, herms[0]!.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
    expect(await leaves[0]!.pull(personaKelDropName(inception.eventCid, herms[0]!.gatePubKey))).toHaveLength(1);
  }, 20_000);

  test("RED (F2, live): junk under invented predecessors files nothing, and the herm takes the lawful deposit after", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(82);
    for (let i = 0; i < 64; i++) {
      const fakePrev = { ...inception, eventCid: `pkel0-fake-${i}` };
      expect(await post(r, personaKelDropName(fakePrev.eventCid, r.gatePubKey), JSON.stringify({ prev: fakePrev, event: junkRotationOf(fakePrev, i) }))).toBe("silence");
    }
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
  }, 20_000);

  test("RED (F3, live): a quarter-megabyte deposit meets silence before the store reads it; CONTROL: the lawful deposit lands", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(83);
    const boxes = Array.from({ length: 520 }, (_, i) => ({ kind: "sealed-enrolment", e: "ab".repeat(32), n: "cd".repeat(12), c: "ef".repeat(100) + i.toString(16).padStart(4, "0"), sig: "00".repeat(64) }));
    const core = { ...junkRotationOf(inception, 0), enrolmentDigest: enrolmentDigestOf(boxes as never) };
    const big = JSON.stringify({ prev: inception, event: { ...core, eventCid: personaEventCidOf(core), enrolments: boxes } });
    expect(big.length).toBeGreaterThan(240_000);
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), big)).toBe("silence");
    // The cap reads bytes before it reads trust: a LAWFUL deposit padded past the cap meets the same silence.
    const padded = JSON.stringify({ prev: inception, event: rot, pad: "x".repeat(250_000) });
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), padded)).toBe("silence");
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
  }, 20_000);

  test("RED: one connection spends at most its budget of deposits; a fresh connection deposits again", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(84);
    const body = JSON.stringify({ prev: inception, event: rot });
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const once = (a: Agent) => new Promise<number | "silence">((resolve) => {
      const req = httpRequest({ host: "127.0.0.1", port: r.port, path: `/drop/${personaKelDropName(inception.eventCid, r.gatePubKey)}`, method: "POST", agent: a, headers: { "content-type": "text/plain", "content-length": Buffer.byteLength(body) } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode ?? 0)); });
      req.on("error", () => resolve("silence"));
      req.end(body);
    });
    const statuses: Array<number | "silence"> = [];
    for (let i = 0; i <= DROP_CONNECTION_BUDGET.deposits; i++) statuses.push(await once(agent));
    agent.destroy();
    expect(statuses.slice(0, DROP_CONNECTION_BUDGET.deposits).every((s) => s === 204)).toBe(true);
    expect(statuses.at(-1)).toBe("silence");
    const fresh = new Agent({ keepAlive: false });
    expect(await once(fresh)).toBe(204);
    fresh.destroy();
  }, 30_000);

  test("a herm journals what it verified: restarted on the same journal, it serves the drop again; a planted line files nothing", async () => {
    const [inception, rot] = await rotated();
    const dir = mkdtempSync(join(tmpdir(), "lar-drop-journal-"));
    dirs.push(dir);
    const journal = join(dir, "persona-kel-drops.jsonl");
    const first = await stand(85, { dropJournalPath: journal });
    expect(await post(first, personaKelDropName(inception.eventCid, first.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
    await first.close(); relays.splice(relays.indexOf(first), 1);
    const { appendFileSync } = await import("node:fs");
    appendFileSync(journal, `${JSON.stringify({ name: personaKelDropName(rot.eventCid, first.gatePubKey), deposit: { prev: rot, event: junkRotationOf(rot, 1) } })}\n`);
    const again = await stand(85, { dropJournalPath: journal });
    const leaf = httpPersonaKelDropHerm(addressOf(again));
    expect((await leaf.pull(personaKelDropName(inception.eventCid, again.gatePubKey))).map((e) => (e as PersonaKelEvent).eventCid)).toEqual([rot.eventCid]);
    expect(await leaf.pull(personaKelDropName(rot.eventCid, again.gatePubKey))).toEqual([]);
  }, 20_000);

  test("RED (H, live): a herm that accepts and never answers, first or last, costs a pull and a deposit its deadline and no more", async () => {
    const [inception, rot] = await rotated();
    const honest = await stand(86);
    const sockets: net.Socket[] = [];
    const hung = net.createServer((s) => { sockets.push(s); });
    await new Promise<void>((resolve) => hung.listen(0, "127.0.0.1", resolve));
    try {
      const silent = httpPersonaKelDropHerm(`ws://127.0.0.1:${(hung.address() as net.AddressInfo).port}#${"c3".repeat(32)}`, { deadlineMs: 400 });
      const live = httpPersonaKelDropHerm(addressOf(honest), { deadlineMs: 400 });
      for (const herms of [[silent, live], [live, silent]]) {
        const startedAt = performance.now();
        const deposited = await depositPersonaKelChain([inception, rot], herms);
        const pulled = await pullPersonaKelSuccessors([inception], herms);
        const spent = performance.now() - startedAt;
        expect(deposited.unanswered).toEqual(["c3".repeat(32)]);
        expect(pulled.unanswered).toEqual(["c3".repeat(32)]);
        expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
        expect(spent, "two deadlines, never a hang").toBeLessThan(3000);
      }
    } finally {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => hung.close(() => resolve()));
    }
  }, 20_000);
});
