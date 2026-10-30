/**
 * sealed-store-vessel — a private body seals on a REAL founded vessel, end to end: seal, restart, unlock, open.
 *
 * The real `operatorDaemonOptions` boot runs over a real founding (`stand-founded-island`), with the node's own
 * sealed-store shore over a scratch directory: real Keyhive identities, the real content-key holder, real files.
 * The daemon island's `sealed-*` verbs run as the dispatcher would run them, and the vessel registers the sealed
 * body by its address (`registerSealedCarrier`), as its `cad-seal` verb does.
 *
 * ONE PART STANDS COMPOSED HERE AND NOT YET IN PRODUCTION: the session proof (a session's signer and this
 * vessel's reading of who may write). No production path opens a session signer yet, so the suite hands one
 * in through the same option a session open will use, and a vector pins what production reads without it.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { announceSeatRoll, type SessionProof } from "@lararium/keyhive";
import { hex, isVerbRefusal, mintOutboxKey, openOutboxParcel, readKeyParcel, readsAsOutboxSeal, restDigest, sha256HexBytesSync, utf8Bytes, type OutboxKey, type RecordSigner, type SeatRoll } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";
import { cadSealDir, registerSealedCarrier } from "../src/seal-carrier-federation.js";
import { SealRefused } from "../src/ciphertext-cas-seal.js";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { casDirForStorage } from "../src/node-cas.js";
import { sealedStoreDir } from "../src/sealed-store-fs.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-garden-notes";
const BODY = "the household's private note: SEARCH-ME-plaintext";
const SCOPE = { nexusAid: "nexus-test-one", epochCid: "epoch-test-one" };
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

const verbCtx = (presenter: string) => ({ daemon: {} as never, invocation: { requestId: "r1" } as never, cap: async () => ({ ok: true }), presenter, local: true }) as never;
async function proof(): Promise<SessionProof> {
  const c = await chain("sealed-vessel", "nexus-test-one");
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  return { signer: () => signer, standing: { holdsWrite: () => true } };
}
/** Every file under `dir`, with its bytes. */
function tree(dir: string): { path: string; bytes: Uint8Array }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tree(path) : [{ path, bytes: new Uint8Array(readFileSync(path)) }];
  });
}
const holds = (files: { bytes: Uint8Array }[], needle: string): boolean => files.some((f) => hex(f.bytes).includes(hex(utf8Bytes(needle))));

/** Boot the real daemon options over one founded island and one scratch storage root; answer its verbs. */
async function stand(st: Awaited<ReturnType<typeof standFoundedIsland>>, root: string, over: { session?: SessionProof; archive?: Uint8Array; archiveOpens?: boolean; boot?: boolean; outboxKey?: OutboxKey } = {}) {
  const archives: Uint8Array[] = [];
  const daemonAuth = { ...st.daemonAuth, ...(over.archive ? { veilArchiveBytes: over.archive } : {}), ...(over.archiveOpens === false ? { archiveOpens: false } : {}), ...(over.outboxKey ? { outboxKey: over.outboxKey } : {}) };
  const opts = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: () => "clear",
    sealedStore: nodeSealedStoreShore(join(root, "daemon")),
    persistArchive: () => {},
    persistVeilArchive: (bytes) => { archives.push(Uint8Array.from(bytes)); },
    ...(over.session ? { sessionProof: over.session } : {}),
  });
  let kh: { dispose?: () => Promise<void> } | null = null;
  if (over.boot !== false) {
    kh = await opts.verifierFactory!(st.ctx) as never;
    teardown.push(() => { void kh?.dispose?.(); });
  }
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, st.ctx);
  const run = (verb: string, args: Record<string, unknown>) => registry.get(verb)!(args, verbCtx(`0x${st.daemonAuth.atom.key}`)) as Promise<Record<string, unknown>>;
  return { run, archives, dispose: async () => { await kh?.dispose?.(); } };
}
const scratch = (): string => { const dir = mkdtempSync(join(tmpdir(), "sealed-vessel-")); teardown.push(() => rmSync(dir, { recursive: true, force: true })); return dir; };

describe("a private body seals on a real founded vessel, end to end", () => {
  test("seal → the vessel registers it → restart from the kept Archive → open; nothing private rests in the sealed tiers", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const first = await stand(st, root, { session });

    // SEAL, in the island, beside the key seat.
    const sealed = await first.run("sealed-seal", { bag: BAG, text: BODY });
    expect(sealed["founded"]).toBe(true);
    expect(sealed["ref"]).toBe(sha256HexBytesSync(utf8Bytes(BODY)));
    expect(String(sealed["cid"])).toMatch(/^blake3:[0-9a-f]{64}$/);
    // The outcome rests in the daemon wiki: it holds addresses and opaque ids alone.
    expect(JSON.stringify(sealed).includes("SEARCH-ME")).toBe(false);

    // THE VESSEL REGISTERS the sealed body by its address: the sealed set and its scope sidecar.
    const registry = makeSealedPlaneRegistry();
    const registered = registerSealedCarrier({ registry, cadDir: cadSealDir(root), cid: String(sealed["cid"]), scope: SCOPE });
    expect(registry.seal.isSealedPlane(registered.docId)).toBe(true);
    expect(registry.epochFor(registered.docId)).toEqual(SCOPE);

    // AT REST: the sealed store's own tier and the sealed values' tier hold no plaintext and no bag name.
    const sealedTier = [...tree(sealedStoreDir(root)), ...tree(cadSealDir(root))];
    expect(sealedTier.map((f) => f.path.split("/").at(-2)).sort()).toEqual(["cad", "index", "key-version", "lockbox", "manifest", "own", "own"]);
    expect(holds(sealedTier, "SEARCH-ME")).toBe(false);
    expect(sealedTier.some((f) => f.path.includes("SEARCH-ME"))).toBe(false);
    // CONTROL: the same hunt finds the text in a buffer that does hold it.
    expect(holds([{ bytes: utf8Bytes(BODY) }], "SEARCH-ME")).toBe(true);
    // The wrap rested the wrapping identity's Archive through the vessel's own door.
    expect(first.archives.length).toBeGreaterThan(1);

    // RESTART: the island leaves; a new one boots from the Archive the vessel kept, over the same files.
    await first.dispose();
    const second = await stand(st, root, { session, archive: first.archives.at(-1)! });
    const opened = await second.run("sealed-open", { bag: BAG, ref: sealed["ref"] });
    expect(opened["bytes"]).toBe(utf8Bytes(BODY).length);
    expect(opened["keyVersion"]).toBe(sealed["keyVersion"]);
    expect(JSON.stringify(opened).includes("SEARCH-ME")).toBe(false);
    // The body landed in the cleartext-local tier, under its own digest, and reads back whole.
    expect(new TextDecoder().decode(readFileSync(join(casDirForStorage(root), String(opened["cid"]))))).toBe(BODY);
    expect(opened["cid"]).toBe(sealed["ref"]);
    // It writes on under the same version: the restart minted nothing.
    const again = await second.run("sealed-seal", { bag: BAG, text: "a second note" });
    expect(again["keyVersion"]).toBe(sealed["keyVersion"]);
    expect(again["founded"]).toBeUndefined();
    const reading = await second.run("sealed-reading", { bag: BAG });
    expect((reading["foundings"] as { heads: string[] }[]).map((f) => f.heads)).toEqual([[sealed["keyVersion"]]]);
  }, 120_000);

  test("A LOCKED VESSEL REFUSES BY NAME AND READS NOTHING: an island with no face provider answers waking-floor, and no body lands", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const first = await stand(st, root, { session });
    const sealed = await first.run("sealed-seal", { bag: BAG, text: BODY });
    await first.dispose();
    const before = tree(casDirForStorage(root)).length;
    const locked = await stand(st, root, { session, boot: false });   // the floor: nothing unlocked, no identity stands
    for (const [verb, args] of [["sealed-open", { bag: BAG, ref: sealed["ref"] }], ["sealed-seal", { bag: BAG, text: "x" }], ["sealed-reading", { bag: BAG }], ["sealed-hand-over", { bag: BAG, reader: "ab".repeat(32) }], ["sealed-serve", {}], ["sealed-rolls", { rolls: [] }]] as const) {
      const err = await locked.run(verb, args as never).catch((e: unknown) => e);
      expect(isVerbRefusal(err), verb).toBe(true);
      expect((err as { reason: string }).reason, verb).toBe("waking-floor");
    }
    expect(tree(casDirForStorage(root)).length).toBe(before);       // it read nothing
  }, 120_000);

  test("a vessel whose archive holds shut wraps nothing: the seal refuses `wrap-failed` and no key version rests", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const shut = await stand(st, root, { session: await proof(), archiveOpens: false });
    const err = await shut.run("sealed-seal", { bag: BAG, text: BODY }).catch((e: unknown) => e);
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe("wrap-failed");
    expect(String((err as Error).message)).toMatch(/archive holds shut/);
    expect(tree(sealedStoreDir(root)).filter((f) => f.path.includes("/key-version/") || f.path.includes("/lockbox/"))).toEqual([]);
    expect(tree(cadSealDir(root))).toEqual([]);
  }, 120_000);

  test("PRODUCTION TODAY, STATED: with no session proof composed the seal refuses `signer-unavailable`, and nothing rests", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const bareVessel = await stand(st, root);
    const err = await bareVessel.run("sealed-seal", { bag: BAG, text: BODY }).catch((e: unknown) => e);
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe("signer-unavailable");
    expect(tree(sealedStoreDir(root))).toEqual([]);
    expect(tree(cadSealDir(root))).toEqual([]);
    // A missing `bag`, and a body nobody staged, refuse before the holder gets asked.
    await expect(bareVessel.run("sealed-seal", { text: BODY })).rejects.toThrow(/`bag` required/);
    await expect(bareVessel.run("sealed-seal", { bag: BAG, cid: "ab".repeat(32) })).rejects.toThrow(/no staged body/);
  }, 120_000);
});

describe("the outbox at rest names no reader, on a real founded vessel (custody#/the-table, the outbox)", () => {
  const READER = "ab".repeat(32);
  test("the island seals each parcel whole under the outbox key its unlock handed it, under a random name, its reader inside — CONTROL: the key opens it and names the reader", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const outboxKey = mintOutboxKey();
    const vessel = await stand(st, root, { session: await proof(), outboxKey });
    await vessel.run("sealed-seal", { bag: BAG, text: BODY });
    const handed = await vessel.run("sealed-parcels", { bag: BAG, reader: READER });
    const names = handed["outbox"] as string[];
    expect(names.length).toBeGreaterThan(0);
    const files = tree(join(sealedStoreDir(root), "outbox"));
    expect(files.map((f) => f.path.split("/").at(-1)).sort()).toEqual([...names].sort());
    for (const f of files) {
      const name = f.path.split("/").at(-1)!;
      expect(name.startsWith(restDigest(utf8Bytes(READER)))).toBe(false);   // the name carries no reader digest
      expect(readsAsOutboxSeal(f.bytes)).toBe(true);
      expect(readKeyParcel(f.bytes)).toBeNull();                              // no clear parcel rests
      expect(holds([f], READER)).toBe(false);
      const opened = openOutboxParcel(outboxKey, f.bytes);
      expect(opened?.reader).toBe(READER);                                     // CONTROL: the routing rides inside the seal
      expect(readKeyParcel(opened!.parcel)).not.toBeNull();
      expect(openOutboxParcel(mintOutboxKey(), f.bytes)).toBeNull();
    }
  }, 120_000);

  test("A SHUT OUTBOX REFUSES BY NAME: an island no unlock handed an outbox key answers `outbox-shut` before any parcel, and nothing rests in the outbox", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const vessel = await stand(st, root, { session: await proof() });
    await vessel.run("sealed-seal", { bag: BAG, text: BODY });
    for (const [verb, args] of [["sealed-parcels", { bag: BAG, reader: READER }], ["sealed-hand-over", { bag: BAG, reader: READER }], ["sealed-serve", {}]] as const) {
      const err = await vessel.run(verb, args as never).catch((e: unknown) => e);
      expect(isVerbRefusal(err), verb).toBe(true);
      expect((err as { reason: string }).reason, verb).toBe("outbox-shut");
    }
    expect(tree(join(sealedStoreDir(root), "outbox"))).toEqual([]);
    expect(tree(sealedStoreDir(root)).some((f) => f.path.includes("/hand-over/"))).toBe(false);   // the hand-over wrote no record ahead of a parcel it could not rest
  }, 120_000);
});

describe("the daemon island's boot subscribes the content-key roll to its own seat rolls", () => {
  test("a seat roll the island announces mints a successor for each bag its face reaches, and the same roll again owes nothing", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const vessel = await stand(st, root, { session });
    // The face's scope reaches the bags the daemon registered: seal into one of them.
    const bag = st.daemonAuth.registerBags[0]!;
    const sealed = await vessel.run("sealed-seal", { bag, text: BODY });
    const roll: SeatRoll = { kind: "seat-roll", scope: st.daemonAuth.deviceEdge.personaRootDid, edgeId: "edge-test", raiseCids: ["raise-test-1"], how: "gone" };
    await announceSeatRoll(roll);                                   // THE PRODUCTION SEAM: the executor's own announce
    const reading = await vessel.run("sealed-reading", { bag });
    const heads = (reading["foundings"] as { heads: string[]; held: string[] }[])[0]!;
    expect(heads.held.length).toBe(2);
    expect(heads.heads).not.toEqual([sealed["keyVersion"]]);
    const after = await vessel.run("sealed-seal", { bag, text: "sealed after the roll" });
    expect(after["keyVersion"]).toBe(heads.heads[0]);
    await announceSeatRoll(roll);
    const again = await vessel.run("sealed-reading", { bag });
    expect((again["foundings"] as { held: string[] }[])[0]!.held.length).toBe(2);   // no second successor
    // CONTROL: a roll for another scope reaches no bag here.
    await announceSeatRoll({ ...roll, scope: "cd".repeat(32), raiseCids: ["raise-test-2"] });
    expect(((await vessel.run("sealed-reading", { bag }))["foundings"] as { held: string[] }[])[0]!.held.length).toBe(2);
    // THE HOLDER LEAVES WITH ITS IDENTITY: once the island's identity disposes, no subscriber stands, so a roll
    // announced afterwards asks nobody and settles (a seat left standing would try to mint through a dead identity).
    await vessel.dispose();
    await expect(announceSeatRoll({ ...roll, raiseCids: ["raise-test-3"] })).resolves.toBeUndefined();
  }, 120_000);
});

describe("the vessel registers only what rests sealed in the cad tier", () => {
  test("a missing value, an altered value, a cleartext body and a malformed address each refuse and register nothing", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const vessel = await stand(st, root, { session: await proof() });
    const sealed = await vessel.run("sealed-seal", { bag: BAG, text: BODY });
    const cid = String(sealed["cid"]);
    const registry = makeSealedPlaneRegistry();
    const refusal = (c: string): string => { try { registerSealedCarrier({ registry, cadDir: cadSealDir(root), cid: c, scope: SCOPE }); return "REGISTERED"; } catch (e) { return e instanceof SealRefused ? e.refusal : String(e); } };
    expect(refusal("blake3:" + "ab".repeat(32))).toBe("value-absent");
    expect(refusal("not-an-address")).toBe("address-malformed");
    expect(refusal(sha256HexBytesSync(utf8Bytes(BODY)))).toBe("address-malformed");
    // A cleartext body under a true blake3 address of its own bytes: it rests, it recomputes, and it reads as no sealed value.
    const { writeCasEntriesFs } = await import("../src/node-cas.js");
    const { sealedAddressOf } = await import("@lararium/mesh");
    const clear = utf8Bytes(BODY.repeat(8));
    const clearCid = sealedAddressOf(clear);
    writeCasEntriesFs([{ cid: clearCid, bytes: clear }], cadSealDir(root));
    expect(refusal(clearCid)).toBe("format-unknown");
    // An altered value no longer recomputes to its address.
    const path = join(cadSealDir(root), cid);
    const kept = new Uint8Array(readFileSync(path));
    const altered = Uint8Array.from(kept);
    altered[altered.length - 1] = altered[altered.length - 1]! ^ 1;
    expect(hex(altered)).not.toBe(hex(kept));
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, altered);
    expect(refusal(cid)).toBe("value-absent");
    expect(registry.size).toBe(0);
    // CONTROL: the untouched value registers.
    writeFileSync(path, kept);
    expect(refusal(cid)).toBe("REGISTERED");
    expect(registry.size).toBe(1);
    await vessel.dispose();
  }, 120_000);
});
