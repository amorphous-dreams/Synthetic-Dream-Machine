/**
 * browser-ward-key — THE FACE'S WARD KEY RESTS UNDER A WARD OF ITS OWN (row 7, S3b; seat-harness#/the-swarm-slices), in chromium.
 *
 * A browser's per-face ward key (the co-sign signer, whose public half the browser's admission into the face carries) signs an approve
 * and the admission's pop only inside the per-act ward worker, opened fresh from the route typed for that act and zeroed after. Its
 * seed rests under a ward key of its own (the face's `ward/sign/<group>` rows, the browser twin of S2b's per-face root ward), so no
 * slot of the keystore's tree wraps it: a page holding the keystore unlocked reads no byte of it, and the logical row name
 * `ward-sign/<group>` refuses at every ordinary custody door by name. Its public half rests beside the ward in plain bytes, so the
 * tag door names the key without opening any seed.
 *
 * Reds: an unlocked page reads the ward seed through the custody doors and signs a valid `wardAnswerImage` and `wardKeyPopImage`;
 * a tag door with no route mints and signs the pop on the page; a re-read opens the seed on the page beside the worker's act.
 * Controls: the ward worker signs a valid pop and approve under a fresh route; a passkey refuses; S2b's root rows stay as they stood.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { bindFirstFaceSlot } from "../src/browser-face-custody.js";
import { afterEach, expect, test } from "vitest";
import { seatWardWorkerSpawn } from "../src/testing.js";
import { ed25519SignerFromSeed, signingSeedFromHex, verifyEd25519, wardAnswerImage, wardKeyPopHolds, wardKeyPopImage, wardPublicKeyOf } from "@lararium/mesh";
import { browserKeystoreCustodyIo, isCustodyRow, readKeystoreRow, sealBrowserKeystore, withCustodyRows } from "../src/browser-custody.js";
import { browserVesselFaceTagDoor } from "../src/browser-face-atom.js";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { runWardAct } from "../src/ward-core.js";
import { keyed } from "../../lararium-mesh/tests/ward-cosign-table.js";

const G = "g-browser-ward-key", PASS = "the route typed for this act", F = "f".repeat(64);
const acts = { n: 0 };
const spawn = () => ({
  postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { acts.n++; port.postMessage(await runWardAct(m.data)); }; },
  terminate() {},
});
seatWardWorkerSpawn(spawn);
const WARD = { route: async () => PASS };

const codeOf = (p: Promise<unknown>): Promise<string | undefined> =>
  p.then(() => undefined, (e: { reading?: string; message: string }) => e.reading ?? /^[a-z-]+/.exec(e.message)?.[0] ?? e.message);

async function stand() {
  const idbName = `lares:ward-key-${globalThis.crypto.randomUUID()}`;
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  // The face's own tree binds before its first row (its tag secret rests there).
  await bindFirstFaceSlot(idbName, G, { kind: "passphrase", passphrase: PASS });
  const me = await keyed(81);
  const fields = await browserVesselFaceTagDoor(idbName, WARD)(G, me.key);
  return { idbName, me, fields };
}

/** Every signing seed the page's own unlocked custody doors hand it, read row by row: what a page-thread script holds with no ward act. */
async function pageHeldSeeds(idbName: string): Promise<Uint8Array[]> {
  // The place rows, and the face's own rows its unlocked tree opens (its tag secret rests there).
  const names = [...(await browserKeystoreCustodyIo(idbName).list()).map((k) => k.replace(/^sealed\//, "")).filter((k) => isCustodyRow(k)), `vessel-face-tag/${G}`];
  const seeds: Uint8Array[] = [];
  for (const name of new Set(names)) {
    const held = await readKeystoreRow(idbName, name).catch(() => undefined);
    const text = held instanceof Uint8Array ? (() => { try { return new TextDecoder("utf-8", { fatal: true }).decode(held); } catch { return ""; } })() : "";
    const hex = /"signingKey":"([0-9a-f]{64})"/.exec(text)?.[1];
    if (hex) seeds.push(signingSeedFromHex(hex));
    if (held instanceof Uint8Array && held.length === 32) seeds.push(Uint8Array.from(held));
  }
  return seeds;
}

const realGet = IDBObjectStore.prototype.get;
afterEach(() => { IDBObjectStore.prototype.get = realGet; });

test("RED: an unlocked page reads the face's ward seed through the custody doors and signs a valid approve and pop with no ward act; CONTROL: the row name refuses `ward-needs-fresh-unlock` at every door, and the admitted ward key stands", async () => {
  const s = await stand();
  expect(s.fields.wardKey).toMatch(/^[0-9a-f]{64}$/);
  expect(await codeOf(readKeystoreRow(s.idbName, `ward-sign/${G}`))).toBe("ward-needs-fresh-unlock");
  expect(await codeOf(withCustodyRows(s.idbName, (rows) => rows.read(`ward-sign/${G}`)))).toBe("ward-needs-fresh-unlock");
  expect(await codeOf(withCustodyRows(s.idbName, (rows) => rows.write(`ward-sign/${G}`, new Uint8Array(1))))).toBe("ward-needs-fresh-unlock");
  // the census: no seed any ordinary door hands the page signs what the face's ward key verifies
  const answerImage = wardAnswerImage({ group: G, ask: "a".repeat(64), detail: "d".repeat(64), verdict: "approve", executor: s.me.key, frontier: F });
  const popImage = wardKeyPopImage(G, s.me.key, s.fields.wardKey);
  const seeds = await pageHeldSeeds(s.idbName);
  expect(seeds.length, "the census read the face's other secret rows").toBeGreaterThan(0);
  for (const seed of seeds) {
    expect(await wardPublicKeyOf(seed)).not.toBe(s.fields.wardKey);
    expect(verifyEd25519(await ed25519SignerFromSeed(seed)(answerImage), answerImage, s.fields.wardKey)).toBe(false);
    expect(verifyEd25519(await ed25519SignerFromSeed(seed)(popImage), popImage, s.fields.wardKey)).toBe(false);
  }
});

test("RED: a tag door with no route mints the face's ward key and signs its pop on the page; CONTROL: under a typed route the mint's pop holds and a passkey refuses `ward-passkey-refused`", async () => {
  const idbName = `lares:ward-key-${globalThis.crypto.randomUUID()}`;
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  // The face's own tree binds before its first row (its tag secret rests there).
  await bindFirstFaceSlot(idbName, G, { kind: "passphrase", passphrase: PASS });
  const me = await keyed(82);
  expect(await codeOf(browserVesselFaceTagDoor(idbName)(G, me.key))).toBe("ward-needs-fresh-unlock");
  expect(await codeOf(browserVesselFaceTagDoor(idbName, { route: async () => ({ kind: "passkey", credentialId: "c" }) } as never)(G, me.key))).toBe("ward-passkey-refused");
  acts.n = 0;
  const minted = await browserVesselFaceTagDoor(idbName, WARD)(G, me.key);
  expect(acts.n, "the mint and its pop ran inside one ward act").toBe(1);
  expect(wardKeyPopHolds(G, me.key, minted)).toBe(true);
  // the nonsense control: the pop vouches for this atom alone
  expect(wardKeyPopHolds(G, (await keyed(83)).key, minted)).toBe(false);
});

test("RED: a re-read opens the face's ward seed on the page to name its key; CONTROL: the key half reads off plain bytes, the one seed read hands the worker a ward-sealed frame, and the re-read's pop holds under the same key", async () => {
  const s = await stand();
  const reads: { key: string; frame: string }[] = [];
  IDBObjectStore.prototype.get = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
    const req = realGet.call(this, key);
    req.addEventListener("success", () => {
      const v = req.result;
      reads.push({ key: String(key), frame: v instanceof Uint8Array ? new TextDecoder().decode(v.subarray(0, 15)) : typeof v });
    });
    return req;
  } as typeof realGet;
  acts.n = 0;
  const reread = await browserVesselFaceTagDoor(s.idbName, WARD)(G, s.me.key);
  IDBObjectStore.prototype.get = realGet;
  expect(reread.wardKey).toBe(s.fields.wardKey);
  expect(wardKeyPopHolds(G, s.me.key, reread)).toBe(true);
  expect(acts.n, "one ward act signs the re-read's pop").toBe(1);
  // no read the page made reaches a seed row its own unlock opens
  expect(reads.filter((r) => /^sealed\/ward-sign\//.test(r.key))).toEqual([]);
  const seedReads = reads.filter((r) => /^ward\/sign\/.+\/seed$/.test(r.key));
  expect(seedReads).toHaveLength(1);
  expect(seedReads[0]!.frame).toBe("lares-ward-seal");
});

test("CONTROL: the face root's S2b ward rows stand byte for byte across the ward key's mint and its re-read, apart from the ward key's own rows", async () => {
  const idbName = `lares:ward-key-${globalThis.crypto.randomUUID()}`;
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  // The face's own tree binds before its first row (its tag secret rests there).
  await bindFirstFaceSlot(idbName, G, { kind: "passphrase", passphrase: PASS });
  await generateOrLoadBrowserPersonaRoot(idbName, 0, PASS);
  const io = browserKeystoreCustodyIo(idbName);
  const rootRows = ["ward/h0/slots", "ward/h0/persona-root", "ward/h0/public-key"];
  const before = await Promise.all(rootRows.map((r) => io.read(r)));
  expect(before.every((b) => b instanceof Uint8Array)).toBe(true);
  const me = await keyed(84);
  const door = browserVesselFaceTagDoor(idbName, WARD);
  const minted = await door(G, me.key);
  await door(G, me.key);
  expect(await Promise.all(rootRows.map((r) => io.read(r)))).toEqual(before);
  const keyRow = await io.read(`ward/sign/${G}/public-key`);
  expect(keyRow && new TextDecoder().decode(keyRow)).toBe(minted.wardKey);
  expect(await io.read(`ward/sign/${G}/slots`)).not.toEqual(before[0]);
});
