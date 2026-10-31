/**
 * sealed-store-vessel — a private body seals on a REAL founded vessel, end to end: seal, restart, unlock, open.
 *
 * The real `operatorDaemonOptions` boot runs over a real founding (`stand-founded-island`), with the node's own
 * sealed-store shore over a scratch directory: real Keyhive identities, the real content-key holder, real files.
 * The daemon island's `sealed-*` verbs run as the dispatcher would run them, and the vessel registers the sealed
 * body by its address (`registerSealedCarrier`), as its `cad-seal` verb does.
 *
 * THE SESSION SIGN DOOR STANDS IN FOR THE VESSEL'S MAIN THREAD: the island names the invocation a session placed and
 * reads that session's signer, its proof subject and the vessel's own chain (`island-session-proof.ts`). The suite
 * answers that port as the vessel's book would (`session-sign-door.ts`), and the vectors pin what the island refuses:
 * a place session, another face's session, and an ask no session placed.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { announceSeatRoll, type IslandSessionProof, type SessionReading } from "@lararium/keyhive";
import { hex, isVerbRefusal, mintOutboxKey, openOutboxParcel, readKeyParcel, readsAsOutboxSeal, restDigest, sha256HexBytesSync, utf8Bytes, type OutboxKey, type RecordSigner, type SeatRoll } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { faceProofSubjectRef, sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
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
// Each island leaves before the next test: a seat roll reaches every subscriber in turn and the first rejection ends
// the delivery, so a seat left standing from an earlier test would keep the roll from this test's own seat.
const teardown: Array<() => unknown> = [];
afterEach(async () => { while (teardown.length) { try { await teardown.pop()!(); } catch { /* best-effort */ } } });

const verbCtx = (presenter: string, local = true) => ({ daemon: {} as never, invocation: { requestId: "r1" } as never, cap: async () => ({ ok: true }), presenter, local }) as never;
type Proof = IslandSessionProof & { readonly asks: Array<{ requestId: string; verb: string } | null> };
/** The session sign door as the vessel's book answers it, over one face's chain: `reading` bends one answer. */
async function proof(bend: (own: Exclude<SessionReading, { refusal: string }>) => SessionReading = (own) => own): Promise<Proof> {
  const c = await chain("sealed-vessel", "nexus-test-one");
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  const own = { signer, subject: faceProofSubjectRef(c.scope), chain: { scope: c.scope, vesselFaceKey: c.sessionCertificate.vesselFaceKey } };
  const asks: Proof["asks"] = [];
  return { asks, signer: async (ask) => { asks.push(ask); return ask === null ? { refusal: "signer-unavailable" } : bend(own); } };
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
async function stand(st: Awaited<ReturnType<typeof standFoundedIsland>>, root: string, over: { session?: IslandSessionProof; archive?: Uint8Array; archiveOpens?: boolean; boot?: boolean; outboxKey?: OutboxKey; local?: boolean } = {}) {
  const archives: Uint8Array[] = [];
  // The face registers the bag it seals under: a writer stands only over a bag its own face registers.
  const daemonAuth = { ...st.daemonAuth, registerBags: [...st.daemonAuth.registerBags, BAG], ...(over.archive ? { veilArchiveBytes: over.archive } : {}), ...(over.archiveOpens === false ? { archiveOpens: false } : {}), ...(over.outboxKey ? { outboxKey: over.outboxKey } : {}) };
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
    teardown.push(() => kh?.dispose?.());
  }
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, st.ctx);
  const run = (verb: string, args: Record<string, unknown>) => registry.get(verb)!(args, verbCtx(`0x${st.daemonAuth.atom.key}`, over.local ?? true)) as Promise<Record<string, unknown>>;
  return { run, archives, dispose: async () => { await kh?.dispose?.(); } };
}
const scratch = (): string => { const dir = mkdtempSync(join(tmpdir(), "sealed-vessel-")); teardown.push(() => rmSync(dir, { recursive: true, force: true })); return dir; };

// FIRST IN THE FILE: the seat-roll seam is one process-wide subscriber list, and the daemon options' verifier carries no
// dispose, so every island an earlier test stood stays subscribed; the first rejection ends a delivery.
describe("the daemon island's boot subscribes the content-key roll to its own seat rolls", () => {
  test("a seat roll the island announces stays owed until the next session act settles it with its own signer, which then seals under the successor; the same roll again owes nothing", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const vessel = await stand(st, root, { session });
    // The face's scope reaches the bags the daemon registered: seal into one of them.
    const bag = st.daemonAuth.registerBags[0]!;
    const sealed = await vessel.run("sealed-seal", { bag, text: BODY });
    const roll: SeatRoll = { kind: "seat-roll", scope: st.daemonAuth.deviceEdge.personaRootDid, edgeId: "edge-test", raiseCids: ["raise-test-1"], how: "gone" };
    // THE PRODUCTION SEAM: the executor's own announce. No session placed it, so no signer stands: it stays owed.
    await expect(announceSeatRoll(roll)).rejects.toThrow(/stays owed/);
    const owedNow = await vessel.run("sealed-reading", { bag });
    expect((owedNow["foundings"] as { held: string[] }[])[0]!.held.length).toBe(1);
    // The session's next seal settles the roll first, with that session's own signer, and seals under the successor.
    const after = await vessel.run("sealed-seal", { bag, text: "sealed after the roll" });
    const reading = await vessel.run("sealed-reading", { bag });
    const heads = (reading["foundings"] as { heads: string[]; held: string[] }[])[0]!;
    expect(heads.held.length).toBe(2);
    expect(heads.heads).not.toEqual([sealed["keyVersion"]]);
    expect(after["keyVersion"]).toBe(heads.heads[0]);
    await announceSeatRoll(roll);
    const again = await vessel.run("sealed-reading", { bag });
    expect((again["foundings"] as { held: string[] }[])[0]!.held.length).toBe(2);   // no second successor
    // CONTROL: a roll for another scope reaches no bag here.
    await announceSeatRoll({ ...roll, scope: "cd".repeat(32), raiseCids: ["raise-test-2"] });
    expect(((await vessel.run("sealed-reading", { bag }))["foundings"] as { held: string[] }[])[0]!.held.length).toBe(2);
  }, 120_000);
});

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

  test("THE ISLAND READS THE SESSION THAT PLACED THE ASK: it names the ask's request id and verb, and the session's own face seals", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const vessel = await stand(st, root, { session });
    const sealed = await vessel.run("sealed-seal", { bag: BAG, text: BODY });
    expect(sealed["founded"]).toBe(true);
    expect(session.asks).toEqual([{ requestId: "r1", verb: "sealed-seal" }]);
  }, 120_000);

  test("A PLACE SESSION REACHES NO SEALED STORE: the vessel answers `session-anchor-place`, and nothing seals or opens", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const own = await stand(st, root, { session: await proof() });
    const sealed = await own.run("sealed-seal", { bag: BAG, text: BODY });
    await own.dispose();
    const place = await stand(st, root, { session: await proof(() => ({ refusal: "session-anchor-place" })) });
    const before = tree(sealedStoreDir(root)).length;
    for (const [verb, args] of [["sealed-seal", { bag: BAG, text: "x" }], ["sealed-open", { bag: BAG, ref: sealed["ref"] }], ["sealed-reading", { bag: BAG }]] as const) {
      const err = await place.run(verb, args as never).catch((e: unknown) => e);
      expect(isVerbRefusal(err), verb).toBe(true);
      expect((err as { reason: string }).reason, verb).toBe("session-anchor-place");
    }
    expect(tree(sealedStoreDir(root)).length).toBe(before);
  }, 120_000);

  test("ANOTHER FACE'S SESSION OPENS NOTHING THIS FACE SEALED: `session-face-foreign` at the seal, the open and the reading", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const own = await stand(st, root, { session: await proof() });
    const sealed = await own.run("sealed-seal", { bag: BAG, text: BODY });
    // CONTROL: the face that sealed opens it.
    expect((await own.run("sealed-open", { bag: BAG, ref: sealed["ref"] }))["bytes"]).toBe(utf8Bytes(BODY).length);
    await own.dispose();
    const stranger = await chain("another-face", "nexus-test-one");
    const foreign = await stand(st, root, { session: await proof((o) => ({ ...o, subject: faceProofSubjectRef(stranger.scope) })) });
    const landed = tree(casDirForStorage(root)).length;
    for (const [verb, args] of [["sealed-open", { bag: BAG, ref: sealed["ref"] }], ["sealed-seal", { bag: BAG, text: "x" }], ["sealed-reading", { bag: BAG }]] as const) {
      const err = await foreign.run(verb, args as never).catch((e: unknown) => e);
      expect(isVerbRefusal(err), verb).toBe(true);
      expect((err as { reason: string }).reason, verb).toBe("session-face-foreign");
    }
    expect(tree(casDirForStorage(root)).length).toBe(landed);      // no cleartext landed
  }, 120_000);

  test("A WRITER STANDS ONLY UNDER THE VESSEL'S OWN CHAIN: a session certificate under another face-scoped key mints nothing", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const other = await chain("another-vessel", "nexus-test-one");
    const astray = await stand(st, root, { session: await proof((o) => ({ ...o, chain: { scope: o.chain.scope, vesselFaceKey: other.sessionCertificate.vesselFaceKey } })) });
    const err = await astray.run("sealed-seal", { bag: BAG, text: BODY }).catch((e: unknown) => e);
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).not.toBe("signer-unavailable");
    expect(tree(cadSealDir(root))).toEqual([]);
  }, 120_000);

  test("AN ASK NO SESSION PLACED BORROWS NO SIGNER: a summons (not the vessel's own channel) refuses, and the island asks the vessel nothing", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const session = await proof();
    const summons = await stand(st, root, { session, local: false });
    const err = await summons.run("sealed-seal", { bag: BAG, text: BODY }).catch((e: unknown) => e);
    // The content fence answers a summons before the sign door would (`content-mounted-only`); either way it refuses.
    expect(isVerbRefusal(err)).toBe(true);
    expect(session.asks).toEqual([]);                              // the island never asked the vessel
    expect(tree(cadSealDir(root))).toEqual([]);
  }, 120_000);

  test("WITH NO SESSION DOOR COMPOSED the seal refuses `signer-unavailable`, and nothing rests", async () => {
    const root = scratch();
    const st = await standFoundedIsland(teardown);
    const bareVessel = await stand(st, root);
    const err = await bareVessel.run("sealed-seal", { bag: BAG, text: BODY }).catch((e: unknown) => e);
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe("signer-unavailable");
    expect(tree(sealedStoreDir(root))).toEqual([]);
    expect(tree(cadSealDir(root))).toEqual([]);
    // A missing `bag` refuses before the holder gets asked; with no session the staged tier never reads.
    await expect(bareVessel.run("sealed-seal", { text: BODY })).rejects.toThrow(/`bag` required/);
    await expect(bareVessel.run("sealed-seal", { bag: BAG, cid: "ab".repeat(32) })).rejects.toThrow(/signer-unavailable/);
    // CONTROL: a session's ask reads the staged tier, and a body nobody staged refuses by name.
    const withSession = await stand(st, root, { session: await proof() });
    await expect(withSession.run("sealed-seal", { bag: BAG, cid: "ab".repeat(32) })).rejects.toThrow(/no staged body/);
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
