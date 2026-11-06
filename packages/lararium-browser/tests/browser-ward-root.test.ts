/**
 * browser-ward-root — row 7's S2b (seat-harness#/the-swarm-slices): the browser's face root rests under a per-face WARD tree, the
 * browser twin of the node's `ward-slots.bin`, and no door of unlocked custody reaches it. Every red pairs with a CONTROL.
 *
 *   r1  an unlocked custody reader, writer or remover refuses the root `ward-needs-fresh-unlock`; CONTROL: the rows that are not
 *       the root (the device seed, the roster) open as before.
 *   r2  a ward-bound act signs once per fresh route: the signer a route opens signs ONE act and refuses a second, and the ward key
 *       and the seed read zeroed once the act ends; CONTROL: the one signature verifies under the root.
 *   r3  a passkey route refuses `ward-passkey-refused`, at the act and at the mint, and the mint writes nothing; CONTROL: a
 *       passphrase route signs.
 *   r4  a mint, and the browser's own founding, land the root under the ward from the start: a ward tree per face and a
 *       `lares-ward-seal` row, never a row the keystore's tree key opens; CONTROL: the founding edge names the warded root.
 *   r5  the walk's possession check reads no seed: with the root warded, the walk presents the face unattended (no route, no
 *       prompt); CONTROL: a face this vessel holds no root for presents nowhere.
 */
import { describe, expect, test } from "vitest";
import { bindSlot, decodeSlotTree, encodeSlotTree, nobleKdf, verifyEd25519, type Credential, type DeviceDelegationTiddler } from "@lararium/mesh";
import {
  lockBrowserCustody, readKeystoreRow, sealBrowserKeystore, unlockBrowserCustody, withCustodyRows, writeKeystoreRow,
} from "../src/browser-custody.js";
import { generateOrLoadBrowserPersonaRoot, idbGet, idbPut, listBrowserPersonaRoots, openVesselIdb, wearFaceOfVessel } from "../src/browser-vessel-identity.js";
import { bindFirstFaceSlot } from "../src/browser-face-custody.js";
import { standFounderFace } from "../src/browser-boot-custody.js";
import { runWardAct } from "../src/ward-core.js";
import { browserWardSign, browserWardSigner, type WardWorkerSpawn } from "../src/browser-ward.js";
import { browserWalkLeaf } from "../src/browser-walk.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { BootHalted } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";

const CUSTODY = { kind: "passphrase", passphrase: "this browser's custody" } as const;
const WARD: Credential = { kind: "passphrase", passphrase: "this face's ward route" };
const PASSKEY = { kind: "passkey", credentialId: new Uint8Array([1, 2, 3]), prfOutput: new Uint8Array(32).fill(7) } as unknown as Credential;
const WARD_MAGIC = new TextEncoder().encode("lares-ward-seal");
const FACE = "g-ward-root";
const fresh = (tag: string) => `lares:ward-root-${tag}-${globalThis.crypto.randomUUID()}`;
const SLOW = 120_000;

async function rowOf(idbName: string, row: string): Promise<unknown> {
  const db = await openVesselIdb(idbName);
  try { return await idbGet<unknown>(db, "keystore", row); } finally { db.close(); }
}
async function keystoreKeys(idbName: string): Promise<string[]> {
  const db = await openVesselIdb(idbName);
  try {
    return await new Promise((resolve, reject) => {
      const q = db.transaction("keystore", "readonly").objectStore("keystore").getAllKeys();
      q.onsuccess = () => resolve((q.result as IDBValidKey[]).map(String).sort()); q.onerror = () => reject(q.error);
    });
  } finally { db.close(); }
}
const settle = (p: Promise<unknown>): Promise<unknown> => p.then(() => null, (e: unknown) => e);
const readingOf = (e: unknown): unknown => (e as { reading?: unknown } | null)?.reading;
const startsWard = (v: unknown): boolean => v instanceof Uint8Array && WARD_MAGIC.every((b, i) => v[i] === b);

/** A worker double: the pure core behind a MessagePort, watching each secret buffer the act opens. */
function spawnCore(watched: Uint8Array[]): WardWorkerSpawn {
  return () => ({
    postMessage(_msg, transfer) {
      const port = transfer[0] as MessagePort;
      port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data, nobleKdf, (secret) => { watched.push(secret); })); };
    },
    terminate() { /* the act is done */ },
  });
}

/** A sealed, unlocked keystore holding a root at h0, minted under the ward route. */
async function wardedVessel(tag: string) {
  const idbName = fresh(tag);
  await sealBrowserKeystore(idbName, CUSTODY);
  await bindSyntheticBrowserCustodySlot(idbName);   // the founder face, worn, its tree standing (the ward mint's face gate)
  const root = await generateOrLoadBrowserPersonaRoot(idbName, 0, WARD);
  return { idbName, rootKey: root.verifyingKey };
}

describe("r1 · unlocked custody never reaches the face root", () => {
  test("RED: with custody unlocked, the ordinary row doors refuse the root `ward-needs-fresh-unlock` and change no byte; CONTROL: the device seed and the roster still open", async () => {
    const { idbName } = await wardedVessel("r1");
    const before = await keystoreKeys(idbName);
    expect(readingOf(await settle(readKeystoreRow(idbName, "persona-root-h0")))).toBe("ward-needs-fresh-unlock");
    expect(readingOf(await settle(writeKeystoreRow(idbName, "persona-root-h0", { verifyingKey: "a".repeat(64), signingKey: "b".repeat(64) })))).toBe("ward-needs-fresh-unlock");
    expect(readingOf(await settle(withCustodyRows(idbName, (rows) => rows.delete("persona-root-h0"))))).toBe("ward-needs-fresh-unlock");
    expect(readingOf(await settle(withCustodyRows(idbName, (rows) => rows.read("persona-root-h0"))))).toBe("ward-needs-fresh-unlock");
    expect(await keystoreKeys(idbName)).toEqual(before);
    // CONTROL: the rows that are not the root write, open and leave under the same unlock.
    const nexusKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
    await bindFirstFaceSlot(idbName, FACE, CUSTODY);
    await writeKeystoreRow(idbName, `nexus-key/${FACE}/nexus-a`, nexusKey);
    expect(await readKeystoreRow(idbName, `nexus-key/${FACE}/nexus-a`)).toEqual(nexusKey);
    await withCustodyRows(idbName, (rows) => rows.delete(`nexus-key/${FACE}/nexus-a`));
    expect(await readKeystoreRow(idbName, `nexus-key/${FACE}/nexus-a`)).toBeUndefined();
    expect(await listBrowserPersonaRoots(idbName)).toEqual([0]);
  }, SLOW);
});

describe("r2 · one fresh route, one ward act", () => {
  test("RED: the signer a route opens signs ONE act and refuses a second `ward-needs-fresh-unlock`, and every secret the act opened reads zeroed after; CONTROL: its signature verifies under the root", async () => {
    // The page's dialog hands the route as the typed string; here custody and ward share one passphrase, the founding's own.
    const idbName = fresh("r2"), SAME = "one passphrase for custody and ward";
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: SAME });
    await bindSyntheticBrowserCustodySlot(idbName);
    const rootKey = (await generateOrLoadBrowserPersonaRoot(idbName, 0, { kind: "passphrase", passphrase: SAME })).verifyingKey;
    lockBrowserCustody(idbName);
    expect((await unlockBrowserCustody(idbName, [{ kind: "passphrase", passphrase: SAME }])).reading).toBe("opens");
    const watched: Uint8Array[] = [];
    const signer = await browserWardSigner(idbName, 0, SAME, spawnCore(watched));
    expect(signer.key).toBe(rootKey);
    const bytes = new TextEncoder().encode("a commit in daemon");
    const signature = await signer.sign(bytes);
    expect(verifyEd25519(signature, bytes, rootKey)).toBe(true);
    expect(readingOf(await settle(signer.sign(bytes)))).toBe("ward-needs-fresh-unlock");
    // The ward key and the seed each passed the watch, and each reads all zero once the act answered.
    expect(watched.length).toBeGreaterThanOrEqual(2);
    for (const secret of watched) expect(secret.every((b) => b === 0), "a secret the act opened stands unzeroed").toBe(true);
  }, SLOW);
});

describe("r3 · a passkey never opens or binds the ward", () => {
  test("RED: a passkey route refuses `ward-passkey-refused` at the act and at the mint, and the mint writes nothing; CONTROL: the passphrase route signs", async () => {
    const { idbName, rootKey } = await wardedVessel("r3");
    const watched: Uint8Array[] = [];
    expect(readingOf(await settle(browserWardSign(idbName, 0, PASSKEY, new Uint8Array([1]), spawnCore(watched))))).toBe("ward-passkey-refused");
    // A browser founds one face (h0); a passkey mint there refuses and writes nothing.
    const bare = fresh("r3-bare");
    await sealBrowserKeystore(bare, CUSTODY);
    await bindSyntheticBrowserCustodySlot(bare);
    const before = await keystoreKeys(bare);
    expect(readingOf(await settle(generateOrLoadBrowserPersonaRoot(bare, 0, PASSKEY)))).toBe("ward-passkey-refused");
    expect(await keystoreKeys(bare)).toEqual(before);
    expect(await listBrowserPersonaRoots(idbName)).toEqual([0]);
    // A hand-edited ward tree that carries a passkey pin refuses before any derivation.
    const tree = await rowOf(idbName, "ward/h0/slots");
    expect(decodeSlotTree(tree instanceof Uint8Array ? tree : null).reading).toBe("readable");
    const passkeyPin = { kind: "passkey", credentialId: new Uint8Array([9]), prfSalt: new Uint8Array(32).fill(1), prfOutput: new Uint8Array(32).fill(2) } as const;
    const widened = await bindSlot(null, new Uint8Array(32).fill(3), { t: 1, pins: [{ kind: "passphrase", passphrase: (WARD as { passphrase: string }).passphrase }, passkeyPin] }, nobleKdf);
    const db = await openVesselIdb(idbName);
    try { await idbPut(db, "keystore", "ward/h0/slots", encodeSlotTree(widened)); } finally { db.close(); }
    expect(readingOf(await settle(browserWardSign(idbName, 0, WARD, new Uint8Array([1]), spawnCore(watched))))).toBe("ward-passkey-refused");
    const db2 = await openVesselIdb(idbName);
    try { await idbPut(db2, "keystore", "ward/h0/slots", tree); } finally { db2.close(); }
    // CONTROL: the human route signs.
    const signed = await browserWardSign(idbName, 0, WARD, new Uint8Array([1]), spawnCore(watched));
    expect(signed.key).toBe(rootKey);
  }, SLOW);
});

describe("r4 · the root rests under the ward from its first write", () => {
  test("RED: a mint lands a ward tree for the face and a `lares-ward-seal` root row, and no root row the keystore's tree key opens; CONTROL: the ward signs as that root", async () => {
    const { idbName, rootKey } = await wardedVessel("r4");
    expect(decodeSlotTree((await rowOf(idbName, "ward/h0/slots")) as Uint8Array).reading).toBe("readable");
    expect(startsWard(await rowOf(idbName, "ward/h0/persona-root"))).toBe(true);
    expect(await rowOf(idbName, "sealed/persona-root-h0")).toBeUndefined();
    expect(await rowOf(idbName, "persona-root-h0")).toBeUndefined();
    expect((await browserWardSign(idbName, 0, WARD, new Uint8Array([2]), spawnCore([]))).key).toBe(rootKey);
  }, SLOW);

  test("RED: the browser's own founding lands its root under the ward, bound over the route the founding asked for twice alike; CONTROL: the founding edge names that warded root", async () => {
    const idbName = fresh("r4-found");
    // The founder face stands first on this thread, so the founding asks no first bind and binds the ward over its own route.
    await standFounderFace({ idbName, ask: async () => CUSTODY });
    const asked: unknown[] = [];
    await expect(openBrowserVessel({ idbName, askWardRoute: async (_act: string, kind?: unknown) => { asked.push(kind); return (WARD as { passphrase: string }).passphrase; },
      onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); } } as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
    expect(asked, "a founding that binds the ward asks the route twice").toEqual(["bind", "retype"]);
    expect(startsWard(await rowOf(idbName, "ward/h0/persona-root"))).toBe(true);
    expect(await rowOf(idbName, "sealed/persona-root-h0")).toBeUndefined();
    const db = await openVesselIdb(idbName);
    const social = await idbGet<{ deviceEdge: DeviceDelegationTiddler }>(db, "bootstrap", "social-bootstrap");
    db.close();
    const signed = await browserWardSign(idbName, 0, WARD, new Uint8Array([3]), spawnCore([]));
    expect(social?.deviceEdge.personaRootDid.toLowerCase()).toContain(signed.key.toLowerCase());
  }, SLOW);
});

describe("r4b · a founding's ward binds only over a route retyped alike", () => {
  test("RED: a founding whose retype differs binds no ward and lands no root (`ward-route-mismatch`); CONTROL: the keystore stands as it stood", async () => {
    const idbName = fresh("r4b-typo");
    await standFounderFace({ idbName, ask: async () => CUSTODY });
    const asked: unknown[] = [];
    const typed = (WARD as { passphrase: string }).passphrase;
    const reading = await openBrowserVessel({ idbName, askWardRoute: async (_act: string, kind?: unknown) => { asked.push(kind); return asked.length === 1 ? typed : `${typed}!`; },
      onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); } } as BrowserVesselOptions)
      .then(() => "landed", (e: { reading?: string; message: string }) => e.reading ?? e.message);
    expect(reading).toBe("ward-route-mismatch");
    expect(await rowOf(idbName, "ward/h0/persona-root")).toBeUndefined();
    expect(await rowOf(idbName, "ward/h0/slots")).toBeUndefined();
  }, SLOW);
});

describe("r5 · the walk's possession check reads no seed", () => {
  test("RED: with the root warded, the walk presents the face with no route and no prompt, and the root never leaves the ward; CONTROL: a face held nowhere presents nowhere", async () => {
    // The face the walk presents owns the ward: its tree stands and it is worn when the root mints (the ward answers one face).
    const idbName = fresh("r5");
    await sealBrowserKeystore(idbName, CUSTODY);
    await bindFirstFaceSlot(idbName, FACE, CUSTODY);
    wearFaceOfVessel(idbName, FACE);
    await generateOrLoadBrowserPersonaRoot(idbName, 0, WARD);
    const AID = "nexus-" + "a".repeat(64);
    const leaf = await browserWalkLeaf(idbName, AID, FACE);
    expect(leaf.seed).toHaveLength(32);
    expect((await keystoreKeys(idbName)).filter((k) => /persona-root(?!-roster)/.test(k))).toEqual(["ward/h0/persona-root"]);
    await expect(browserWalkLeaf(idbName, AID, "g-held-nowhere")).rejects.toThrow();
  }, SLOW);
});
