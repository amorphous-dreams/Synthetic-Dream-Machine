import { createServer } from "node:http";
import { WebSocket } from "ws";
import { dialIntentRelay } from "@lararium/mesh";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { faceGateServer } from "../src/face-gate-server.js";
import { custodyGateDoor } from "../src/custody-seat.js";
import { standIntentRelay } from "../src/intent-relay.js";
import { handDeadlines } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAgentIntent, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, personaBagIdFor, personaSiblingBagIds, PERSONA_GROUP_ID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { intentAdmissionCid, intentAdmissionRecordsOfGroup, readIntentAdmission } from "../../lararium-mesh/src/intent-admission.js";
import { runFoundTheFace } from "../src/index.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { larBootstrapPath, larSealHome } from "../src/vessel-paths.js";
import { resolveIntentRelayFace } from "../src/intent-relay-face.js";
import { loadIntentFace } from "../src/commands/intent.js";
import * as relayKeys from "../src/intent-relay-key-store.js";
import { intentRelayKeyOrMint } from "../src/intent-relay-key-store.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const ROOT = mkdtempSync(join(tmpdir(), "lar-relay-admission-"));
const storage = join(ROOT, "data", "lares", "vessel"), genesis = join(ROOT, "genesis");
const builtGenesis = join(new URL("../", import.meta.url).pathname, "..", "..", "genesis");
let group = "", catalogUrl = "";
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
const row = (verb: Parameters<typeof storeDoorDirect>[0], args: Record<string, unknown>) => withLarRoot(ROOT, async () => { await openTestCustody(); return storeDoorDirect(verb, args, { sealHome: larSealHome(), storageDir: storage }); });
beforeAll(async () => {
  mkdirSync(storage, { recursive: true }); mkdirSync(genesis, { recursive: true });
  cpSync(builtGenesis, genesis, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
  await withLarRoot(ROOT, () => foundDirect({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "relay-admission" }));
  await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, async () => {
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
    group = packed.tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text!;
    const bags = personaSiblingBagIds(personaBagIdFor(group))!;
    catalogUrl = await ownedStore(storage, async (repo) => {
      const catalog = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {
        [bags.persona]: { tiddler: { title: bags.persona, text: packed.tiddlers[bags.persona]!.text } },
        [bags.intents]: { tiddler: { title: bags.intents, text: packed.tiddlers[bags.intents]!.text } },
      } } as unknown as LarDoc);
      await repo.flush([catalog.documentId]); return catalog.url as string;
    });
    writeFileSync(join(storage, "catalog-url"), catalogUrl, "utf8");
  });
}, 240_000);

describe("relay admission over a founded face", () => {
  test("RED: argument substitution refuses on the face service path; CONTROL: unchanged entry lands durably and show lists its receipt", async () => {
    const seed = new Uint8Array(32).fill(37), agent = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
    const granted = await row("intent-root", { action: "delegate", agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, until: `roster:${"c".repeat(64)}` }) as { cid: string };
    const entry = await buildAgentIntent({ group, signer: agent, delegation: granted.cid, verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: faceIntentVerbs() });
    await withLarRoot(ROOT, async () => {
      await openTestCustody(); await intentRelayKeyOrMint();
      await ownedStore(storage, async (repo) => {
        const loaded = await loadIntentFace(repo, catalogUrl, { group });
        const face = await resolveIntentRelayFace(group, { repo, catalogUrl });
        expect(face).not.toBeNull();
        expect(await resolveIntentRelayFace("missing", { repo, catalogUrl })).toBeNull();
        const flush = vi.spyOn(repo, "flush");
        const gate = faceGateServer(), http = createServer();
        http.on("upgrade", (req, socket, head) => { if (!gate.handleUpgrade(req, socket, head)) socket.destroy(); });
        await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
        const service = await standIntentRelay({ gateServer: gate, rootDoor: custodyGateDoor(), deadlines: handDeadlines(), faces: async (g) => g === group ? face : null, log: () => {} });
        try {
          const pin = await service.enable(group), port = (http.address() as { port: number }).port;
          const submit = (raw: typeof entry) => dialIntentRelay({ pin, entry: raw, socket: wsDialSocket(`ws://127.0.0.1:${port}${pin.route}`, (url, protocols) => new WebSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike) });
          const changed = { ...entry, body: { ...entry.body, args: { x: 2 } } };
          expect(await submit(changed)).toEqual({ status: "refused", refusal: "entry-refused" });
          expect(intentEntryRecordsOfGroup(loaded.plane.doc(), group)).toHaveLength(1);
          const result = await submit(entry);
          expect(result.status).toBe("admitted");
          expect(flush).toHaveBeenCalled();
          if (result.status !== "admitted") throw Error("not admitted");
          expect(intentAdmissionRecordsOfGroup(loaded.plane.doc(), group).map(intentAdmissionCid)).toContain(intentAdmissionCid(result.receipt as Parameters<typeof intentAdmissionCid>[0]));
        } finally { service.close(); gate.close(); await new Promise<void>((resolve) => http.close(() => resolve())); flush.mockRestore(); }
      });
    });
    const shown = await row("intent-show", {}) as { delegations: unknown[]; rows: Array<{ admissions: Array<{ cid: string; relay: string }> }> };
    expect(shown.delegations).toHaveLength(1);
    expect(shown.rows[0]!.admissions).toEqual([expect.objectContaining({ cid: expect.any(String), relay: expect.any(String) })]);
  }, 240_000);
});


test("RED: flush failure after append reports fault and retry recovers its receipt; CONTROL: working flush admits", async () => {
  const seed = new Uint8Array(32).fill(71), agent = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const grant = await row("intent-root", { action: "delegate", agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, until: `roster:${"d".repeat(64)}` }) as { cid: string };
  const entry = await buildAgentIntent({ group, signer: agent, delegation: grant.cid, verb: "MOVE", args: { x: 1 }, nonce: "flush", audience: { mode: "every" }, verbs: faceIntentVerbs() });
  await withLarRoot(ROOT, async () => { await openTestCustody(); await intentRelayKeyOrMint(); await ownedStore(storage, async repo => {
    const loaded = await loadIntentFace(repo, catalogUrl, { group }), face = await resolveIntentRelayFace(group, { repo, catalogUrl });
    if (!face) throw Error("held face missing");
    const flush = vi.spyOn(repo, "flush").mockRejectedValueOnce(new Error("flush failed"));
    try {
      const failed = await face.admit(entry);
      const receipts = intentAdmissionRecordsOfGroup(loaded.plane.doc(), group).filter((r: any) => r.body.entry === intentEntryCid(entry));
      expect(receipts).toHaveLength(1);
      const retry = await face.admit(entry);
      expect(failed).toEqual({ status: "fault" });
      expect(retry.status).toBe("duplicate");
      if (retry.status === "duplicate") expect(retry.receipt).toEqual(receipts[0]);
      expect(intentEntryRecordsOfGroup(loaded.plane.doc(), group).filter((r: any) => r.body.entry === "intent" && r.body.nonce === "flush")).toHaveLength(1);
      expect(intentAdmissionRecordsOfGroup(loaded.plane.doc(), group).filter((r: any) => r.body.entry === intentEntryCid(entry))).toHaveLength(1);
      const control = await buildAgentIntent({ group, signer: agent, delegation: grant.cid, verb: "MOVE", args: { x: 1 }, nonce: "flush-control", audience: { mode: "every" }, verbs: faceIntentVerbs() });
      expect((await face.admit(control)).status).toBe("admitted");
    } finally { flush.mockRestore(); }
  }); });
}, 240_000);

test("RED: key rotation between public-key read and signing cannot produce an unverifiable receipt; CONTROL: stable key verifies", async () => {
  const seed = new Uint8Array(32).fill(72), agent = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const grant = await row("intent-root", { action: "delegate", agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, until: `roster:${"e".repeat(64)}` }) as { cid: string };
  const make = (nonce: string) => buildAgentIntent({ group, signer: agent, delegation: grant.cid, verb: "MOVE", args: { x: 1 }, nonce, audience: { mode: "every" }, verbs: faceIntentVerbs() });
  await withLarRoot(ROOT, async () => { await openTestCustody(); await intentRelayKeyOrMint(); await ownedStore(storage, async repo => {
    const loaded = await loadIntentFace(repo, catalogUrl, { group }), face = await resolveIntentRelayFace(group, { repo, catalogUrl });
    if (!face) throw Error("held face missing");
    const original = relayKeys.signAsIntentRelay;
    const sign = vi.spyOn(relayKeys, "signAsIntentRelay").mockImplementationOnce(async image => { await relayKeys.rotateIntentRelayKey(); return original(image); });
    try {
      const entry = await make("rotate"), result = await face.admit(entry);
      const stored = intentAdmissionRecordsOfGroup(loaded.plane.doc(), group).filter((r: any) => r.body.entry === intentEntryCid(entry));
      if (result.status === "admitted" || result.status === "duplicate") expect(readIntentAdmission(result.receipt, { group }).ok).toBe(true);
      for (const receipt of stored) expect(readIntentAdmission(receipt, { group }).ok).toBe(true);
      sign.mockRestore();
      const control = await face.admit(await make("rotate-control"));
      expect(control.status).toBe("admitted");
      if (control.status === "admitted") expect(readIntentAdmission(control.receipt, { group }).ok).toBe(true);
    } finally { sign.mockRestore(); }
  }); });
}, 240_000);
