import { Repo } from "@automerge/automerge-repo";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAgentIntent, deriveSelfRecoveryKey, hexToBytes, mintPersonaRotation, personaKelChainForPrefix, personaRotationSigningBytes, writePersonaKelEvent, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, faceRecordsOf, intentEntryCid, intentEntryRecordsOfGroup, personaBagIdFor, personaSiblingBagIds, PERSONA_GROUP_ID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { intentAdmissionCid, intentAdmissionRecordsOfGroup } from "../../lararium-mesh/src/intent-admission.js";
import { admitAgentEntry, makeFaceIntentDoor } from "../../lararium-keyhive/src/face-intent-door.js";
import { loadPersonaGroupRootSeed } from "../src/node-vessel-identity.js";
import { runFoundTheFace } from "../src/index.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { larBootstrapPath, larSealHome } from "../src/vessel-paths.js";
import { intentRelayPorts, resolveIntentRelayFace } from "../src/intent-relay-face.js";
import * as custodySeat from "../src/custody-seat.js";
import * as identityAnchors from "../src/identity-anchors.js";
import { loadIntentFace } from "../src/commands/intent.js";
import { intentRelayKeyOrMint } from "../src/intent-relay-key-store.js";
import { enableIntentRelayFace } from "../src/intent-relay-ring.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const source = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
const scan = (text: string, pattern: RegExp) => pattern.test(text);

test("RED: the vessel stands, refreshes and closes the intent relay; CONTROL: the census finds a planted call and the gate sweep's after-step", () => {
  expect(scan("const planted = intentRelayService({ gateServer });", /\bintentRelayService\s*\(/)).toBe(true);
  expect(scan(source, /\b(?:const|function)\s+afterGateSweep\b/)).toBe(true);
  const start = source.indexOf("const afterGateSweep =");
  const end = source.indexOf("stood.push({ what: \"the sync gates' knocks\"", start);
  expect(end).toBeGreaterThan(start);
  const sweep = source.slice(start, end);
  expect(source).toMatch(/import\s*\{[^}]*\bintentRelayService\b[^}]*\}\s*from\s*["'][^"']*intent-relay\.js["']/s);
  expect(source).toMatch(/import\s*\{[^}]*\bresolveIntentRelayFace\b[^}]*\}\s*from\s*["'][^"']*intent-relay-face\.js["']/s);
  expect(sweep).toMatch(/intentRelayService\s*\(\s*\{[^}]*\bgateServer\b[^}]*dispatcher\s*:\s*opts\.dispatcher/s);
  expect(sweep).toMatch(/resolveIntentRelayFace\s*\(\s*\w+\s*,\s*\{\s*repo\s*,\s*catalogUrl\s*:\s*catalogHandle\.url\s*\}/s);
  expect(sweep).toMatch(/intentRelay\.refresh\s*\(/);
  expect(source).toMatch(/stood\.push\s*\(\s*\{\s*what\s*:\s*["']the intent relay["']\s*,\s*down\s*:[\s\S]*?intentRelay\??\.close\s*\(/);
});

test("RED: a sibling's lock and light refresh the relay at once; CONTROL: the census finds a planted refresh and the dropFace body", () => {
  expect(scan("const dropFace = async () => { await intentRelay?.refresh(); };", /intentRelay\??\.refresh\s*\(/)).toBe(true);
  const dropStart = source.indexOf("const dropFace = async (ordinal: number) =>");
  expect(dropStart).toBeGreaterThan(-1);
  const dropBody = source.slice(dropStart, source.indexOf("\n  };", dropStart));
  expect(dropBody).toMatch(/daemonVm\.dropFace[\s\S]*intentRelay\??\.refresh\s*\(/);
  const lightStart = source.indexOf("lightFace = async (ordinal) =>");
  expect(lightStart).toBeGreaterThan(-1);
  const lightBody = source.slice(lightStart, source.indexOf("\n    };", lightStart));
  expect(lightBody).toMatch(/daemonVm\.lightFace[\s\S]*intentRelay\??\.refresh\s*\(/);
});

const ROOT = mkdtempSync(join(tmpdir(), "lar-relay-wired-"));
const storage = join(ROOT, "data", "lares", "vessel"), genesis = join(ROOT, "genesis");
const builtGenesis = join(new URL("../", import.meta.url).pathname, "..", "..", "genesis");
let group = "", catalogUrl = "";
const row = (verb: Parameters<typeof storeDoorDirect>[0], args: Record<string, unknown>) => withLarRoot(ROOT, async () => { await openTestCustody(); return storeDoorDirect(verb, args, { sealHome: larSealHome(), storageDir: storage }); });
beforeAll(async () => {
  mkdirSync(storage, { recursive: true }); mkdirSync(genesis, { recursive: true });
  cpSync(builtGenesis, genesis, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
  await withLarRoot(ROOT, () => foundDirect({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "relay-wired" }));
  await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, async () => {
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
    group = packed.tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text!;
    const bags = personaSiblingBagIds(personaBagIdFor(group))!;
    catalogUrl = await ownedStore(storage, async repo => {
      const catalog = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {
        [bags.persona]: { tiddler: { title: bags.persona, text: packed.tiddlers[bags.persona]!.text } },
        [bags.intents]: { tiddler: { title: bags.intents, text: packed.tiddlers[bags.intents]!.text } },
      } } as unknown as LarDoc);
      await repo.flush([catalog.documentId]); return catalog.url as string;
    });
    writeFileSync(join(storage, "catalog-url"), catalogUrl, "utf8");
  });
}, 240_000);
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

// Only the immediate caller decides whether Date.now belongs to the relay or its dependencies.
function clockless() {
  const real = Date.now.bind(Date);
  vi.spyOn(Date, 'now').mockImplementation(() => {
    const caller = String(new Error().stack).split('\n').slice(1).find(l => !/tinyspy|@vitest|spy\.|clockless|mockImplementation|Date\.(<anonymous>|now)/.test(l)) ?? '';
    if (/automerge|\/ws\/|node:internal|node:net|node:http|node:timers/.test(caller)) return real();
    throw Error('clock');
  });
}

test("RED: a killed relay reopens its flushed receipt and retries once; CONTROL: a failed flush leaves no receipt on reopen", async () => {
  const seed = new Uint8Array(32).fill(79), agent = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const grant = await row("intent-root", { action: "delegate", agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1, 2] } } }, until: `roster:${"d".repeat(64)}` }) as { cid: string };
  const make = (x: number) => buildAgentIntent({ group, signer: agent, delegation: grant.cid, verb: "MOVE", args: { x }, nonce: "", audience: { mode: "every" }, verbs: faceIntentVerbs() });
  const failedEntry = await make(1), entry = await make(2);
  await withLarRoot(ROOT, async () => {
    // The relay admits only a face its ring enables (`face-off` otherwise): the operator's switch stands first.
    await openTestCustody(); await intentRelayKeyOrMint(); await enableIntentRelayFace(group);
    const open = () => { const adapter = new DurableNodeFSStorageAdapter(storage); return { adapter, repo: new Repo({ storage: adapter, network: [] }) }; };
    clockless();
    try {
      const failed = open();
      const failedFace = await resolveIntentRelayFace(group, { repo: failed.repo, catalogUrl });
      if (!failedFace) throw Error("held face missing");
      vi.spyOn(failed.repo, "flush").mockRejectedValueOnce(Error("flush failed"));
      expect(await failedFace.admit(failedEntry)).toEqual({ status: "fault" });
      await failed.adapter.close();
      const first = open();
      const before = await loadIntentFace(first.repo, catalogUrl, { group });
      expect(intentAdmissionRecordsOfGroup(before.plane.doc(), group).filter((r: any) => r.body.entry === intentEntryCid(failedEntry))).toHaveLength(0);
      expect(intentEntryRecordsOfGroup(before.plane.doc(), group).filter((r: any) => r.body.entry === "intent")).toHaveLength(0);
      const face = await resolveIntentRelayFace(group, { repo: first.repo, catalogUrl });
      if (!face) throw Error("held face missing");
      const admitted = await face.admit(entry);
      expect(admitted.status).toBe("admitted");
      if (admitted.status !== "admitted") throw Error("entry not admitted");
      const receipt = intentAdmissionCid(admitted.receipt as Parameters<typeof intentAdmissionCid>[0]);
      await first.adapter.close();
      const reopened = open();
      try {
        const loaded = await loadIntentFace(reopened.repo, catalogUrl, { group });
        expect(intentEntryRecordsOfGroup(loaded.plane.doc(), group).filter((r: any) => r.body.entry === "intent")).toHaveLength(1);
        expect(intentAdmissionRecordsOfGroup(loaded.plane.doc(), group).map(intentAdmissionCid)).toEqual([receipt]);
        const fresh = await resolveIntentRelayFace(group, { repo: reopened.repo, catalogUrl });
        if (!fresh) throw Error("held face missing");
        const retry = await fresh.admit(entry);
        expect(retry.status).toBe("duplicate");
        if (retry.status !== "duplicate") throw Error("retry not duplicate");
        expect(intentAdmissionCid(retry.receipt as Parameters<typeof intentAdmissionCid>[0])).toBe(receipt);
        const effect = vi.fn(async () => ({ result: "done" }));
        const door = makeFaceIntentDoor({ ...intentRelayPorts(loaded), atom: loaded.signer, effects: new Map([["MOVE", effect]]), log: () => {} });
        await door.heed(); await door.heed();
        expect(effect).toHaveBeenCalledTimes(1);
      } finally { await reopened.repo.shutdown(); await reopened.adapter.close(); }
    } finally { vi.restoreAllMocks(); }
  });
}, 240_000);

test("RED: a locked face resolves no relay face; CONTROL: the same face resolves while unlocked", async () => {
  await withLarRoot(ROOT, async () => {
    await openTestCustody();
    const repo = new Repo({ network: [] });
    try {
      const open = await resolveIntentRelayFace(group, { repo, catalogUrl });
      expect(open?.group).toBe(group);
      const spy = vi.spyOn(custodySeat, "unlockedFaceOrdinals").mockResolvedValue([]);
      try { expect(await resolveIntentRelayFace(group, { repo, catalogUrl })).toBeNull(); } finally { spy.mockRestore(); }
    } finally { await repo.shutdown(); }
  });
}, 240_000);


test("RED: a broken sibling anchor does not hide a healthy relay face; CONTROL: healthy rows resolve and an unknown group does not", async () => {
  await withLarRoot(ROOT, async () => {
    await openTestCustody();
    const adapter = new DurableNodeFSStorageAdapter(storage), repo = new Repo({ storage: adapter, network: [] });
    try {
      const indexes = await identityAnchors.listAnchoredPersonas();
      const realLoad = identityAnchors.loadIdentityAnchors;
      const anchors = await realLoad(indexes[0]!);
      expect(anchors?.personaGroupId).toBe(group);
      vi.spyOn(identityAnchors, "listAnchoredPersonas").mockResolvedValue([0, 1]);
      const load = vi.spyOn(identityAnchors, "loadIdentityAnchors").mockImplementation(async () => anchors);
      expect((await resolveIntentRelayFace(group, { repo, catalogUrl }))?.group).toBe(group);
      expect(await resolveIntentRelayFace("no-such-group", { repo, catalogUrl })).toBeNull();
      load.mockImplementation(async (index) => { if (index === 0) throw new Error("broken sibling"); return anchors; });
      const face = await resolveIntentRelayFace(group, { repo, catalogUrl });
      expect(face?.group).toBe(group);
      // The admission handler loads the face again: a malformed sibling row must not turn every admission into a fault.
      expect(await face?.admit({})).not.toEqual({ status: "refused", refusal: "fault" });
    } finally { vi.restoreAllMocks(); await repo.shutdown(); await adapter.close(); }
  });
}, 240_000);

test("RED: enabling a relay registers a lit sibling's planes at the gate sweep; CONTROL: the census finds a planted call", () => {
  const registers = /registerRelayPlanes\s*\??\.?\(/;
  expect(registers.test("await registerRelayPlanes?.();")).toBe(true);
  const start = source.indexOf("const afterGateSweep =");
  const end = source.indexOf("stood.push({ what: \"the sync gates' knocks\"", start);
  const sweep = source.slice(start, end);
  const refresh = sweep.search(/intentRelay\.refresh\s*\(/);
  const register = sweep.search(registers);
  expect(refresh).toBeGreaterThan(-1);
  expect(register).toBeGreaterThan(-1);
  expect(register).toBeLessThan(refresh);
});

test("RED: relay-enabled siblings register planes when proven and lit; CONTROL: the census finds planted registration calls", () => {
  const call = /registerFacePlanesForRelay\s*\(\s*\{[\s\S]*?register\s*:\s*registerInCatalog[\s\S]*?\}\s*\)/;
  expect(scan("registerFacePlanesForRelay({ group, register: registerInCatalog })", call)).toBe(true);
  expect(source).toMatch(/import\s*\{[^}]*\bregisterFacePlanesForRelay\b[^}]*\}\s*from\s*["'][^"']*face-plane-registration\.js["']/s);
  const light = source.indexOf("lightFace = async (ordinal) =>");
  expect(light).toBeGreaterThan(-1);
  expect(source.slice(light, source.indexOf("\n    };", light))).toMatch(call);
  const loop = source.indexOf("for (const plane of bootstrap.personaPlanes)", source.indexOf("const registerInCatalog"));
  const proven = source.indexOf("provenPlanes.set", loop);
  const end = source.indexOf("\n    for (const plane of bootstrap.personaPlanes)", proven);
  expect(proven).toBeGreaterThan(loop);
  expect(end).toBeGreaterThan(proven);
  expect(source.slice(proven, end)).toMatch(call);
});

/**
 * THE PORT ADAPTER: the relay's admission ports as `intent-relay-face` composes them from a loaded face, in this head's shape.
 * The scenario and its assertions below stand as written; a fix that changes the loader's shape moves only this adapter.
 */
const relayPortsOf = (loaded: Awaited<ReturnType<typeof loadIntentFace>>): Parameters<typeof admitAgentEntry>[0] => intentRelayPorts(loaded);

test("RED: a valid rotation merged after the face loads reaches the admission's commit turn; CONTROL: no rotation admits", async () => {
  const seed = new Uint8Array(32).fill(83), agent = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const relaySeed = new Uint8Array(32).fill(84), relay = { key: await ed25519VerifyingKeyFromSeed(relaySeed), sign: ed25519SignerFromSeed(relaySeed) };
  const grant = await row("intent-root", { action: "delegate", agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [3] } } }, until: `roster:${"e".repeat(64)}` }) as { cid: string };
  const entry = await buildAgentIntent({ group, signer: agent, delegation: grant.cid, verb: "MOVE", args: { x: 3 }, nonce: "", audience: { mode: "every" }, verbs: faceIntentVerbs() });
  await withLarRoot(ROOT, async () => {
    await openTestCustody();
    const run = async (rotates: boolean) => {
      // A copy of the store per run, so the rotation never reaches the file's other tests.
      const copy = mkdtempSync(join(ROOT, "rotation-")); cpSync(storage, copy, { recursive: true });
      const adapter = new DurableNodeFSStorageAdapter(copy), repo = new Repo({ storage: adapter, network: [] });
      try {
        const loaded = await loadIntentFace(repo, catalogUrl, { group });
        if (rotates) {
          // The face's own recovery signer rotates its op-key on the KEL board the loader read, after the load returned.
          const prefix = loaded.anchors.personaKelPrefix!;
          const board = Object.values(repo.handles).find((h) => h.isReady() && personaKelChainForPrefix(h.doc() as LarDoc, prefix) !== null)!;
          const head = personaKelChainForPrefix(board.doc() as LarDoc, prefix)!.at(-1)!;
          const rootSeed = await loadPersonaGroupRootSeed(loaded.index);
          const recovery = await deriveSelfRecoveryKey(rootSeed);
          const fresh = `0x${await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(85))}`;
          const sig = await ed25519SignerFromSeed(hexToBytes(recovery.signingKey))(personaRotationSigningBytes(head, fresh));
          const rotated = await mintPersonaRotation({ head, freshOpKeyDid: fresh, recoveryRoster: [recovery.verifyingKey], recoveryThreshold: 1, rotationSigs: [{ signer: recovery.verifyingKey, sig }] });
          if (!rotated.ok) throw Error(rotated.reason);
          board.change((d) => writePersonaKelEvent(d as LarDoc, rotated.event));
          expect(personaKelChainForPrefix(board.doc() as LarDoc, prefix)).toHaveLength(2);
        }
        return await admitAgentEntry(relayPortsOf(loaded), entry, relay);
      } finally { await repo.shutdown(); await adapter.close(); }
    };
    expect(await run(true)).toEqual({ status: "refused", refusal: "entry-refused" });
    expect((await run(false)).status).toBe("admitted");
  });
}, 240_000);
