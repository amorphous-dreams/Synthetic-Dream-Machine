/**
 * browser-secret-census — a face's secrets rest nowhere in this vessel's IndexedDB as plaintext once a slot binds.
 *
 * The census walks EVERY object store and every row of the vessel's database and names each place a secret's bytes
 * stand: as typed bytes, as UTF-8 text, or as lowercase hex, inside any nested value. A sealed row holds ciphertext
 * alone, so any hit counts. The secrets come from the production doors (a walk leaf, a fleet-join request and its
 * landed answer, a walk record); a needle the test cannot learn from a return value reads off whichever home the
 * row stands in (the clear store or the custody row), so the census measures where the bytes rest, never assumes it.
 *
 *   CONTROL  on a clear keystore before any slot, the census FINDS the device seed's signing key: a census that
 *            cannot find this one proves nothing.
 *   RED      once a slot binds, the per-Nexus key, the face-scoped key, the address secret, the pending join's seal
 *            secret and a walk record's invite each rest in no store as plaintext, unlocked, locked, and after the
 *            connection reopens.
 */
import { describe, expect, test } from "vitest";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { generateOrLoadBrowserPersonaRoot, generateOrLoadBrowserVesselIdentity, openVesselIdb, idbGet } from "../src/browser-vessel-identity.js";
import { browserFleetJoinLand, browserFleetJoinRequest } from "../src/browser-fleet-join.js";
import { browserWalkLeaf, browserWalkStore } from "../src/browser-walk.js";
import { lockBrowserCustody, readBrowserCustody, readKeystoreRow, unlockBrowserCustody } from "../src/browser-custody.js";
import {
  admitCarriageCommit, custodyRootDoor, deriveGateBundle, encodeInvite, faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer,
  sealAddressSecret, sovereignGateRoot, sovereignRoute, type FleetJoinRequest, type VesselFaceKey,
} from "@lararium/mesh";
import { certificateImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, pair, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";

const PASS = { kind: "passphrase", passphrase: "browser fixture custody slot" } as const;
const GROUP = "0xb7f1c2a9d4e60381";
const NEXUS = "nexus-census.synthetic";
const SALT = "5a".repeat(32);
const ADDRESS_SECRET = new Uint8Array(32).fill(0x6d);

let serial = 0;
const name = () => `lares:test-secret-census:${Date.now()}:${serial++}`;
const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Walk every row and find exact bytes as typed bytes, UTF-8 text, or lowercase hex, recursively. */
async function census(idbName: string, needle: Uint8Array): Promise<string[]> {
  const db = await openVesselIdb(idbName);
  try {
    const places: string[] = [];
    const text = new TextDecoder().decode(needle);
    const hexNeedle = hex(needle);
    const visit = (value: unknown, path: string, seen = new Set<object>()): void => {
      if (value instanceof Uint8Array) {
        if (bytesEqual(value, needle)) places.push(path);
        return;
      }
      if (typeof value === "string") {
        if (value.includes(text) || value.includes(hexNeedle)) places.push(path);
        return;
      }
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}[${i}]`, seen));
      else for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`, seen);
      seen.delete(value);
    };
    for (const storeName of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const rows = await new Promise<Array<{ key: IDBValidKey; value: unknown }>>((resolve, reject) => {
        const out: Array<{ key: IDBValidKey; value: unknown }> = [];
        const cursor = store.openCursor();
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) { resolve(out); return; }
          out.push({ key: c.key, value: c.value }); c.continue();
        };
      });
      rows.forEach(({ key, value }) => visit(value, `${storeName}[${String(key)}]`));
    }
    return places;
  } finally { db.close(); }
}

describe("browser secret census", () => {
  test("CONTROL: the clear keystore census finds the device signing seed", async () => {
    const idbName = name();
    await generateOrLoadBrowserVesselIdentity(idbName);
    const db = await openVesselIdb(idbName);
    let signingKey: string;
    try { signingKey = (await idbGet<{ signingKey: string }>(db, "keystore", "vessel-key"))!.signingKey; } finally { db.close(); }
    expect(await census(idbName, new TextEncoder().encode(signingKey))).toContain("keystore[vessel-key].signingKey");
  });

  test("RED: once a slot binds, a face's secrets rest as plaintext in no store — unlocked, locked, and after the connection reopens", async () => {
    const idbName = name();
    await generateOrLoadBrowserVesselIdentity(idbName);
    await bindSyntheticBrowserCustodySlot(idbName);
    await generateOrLoadBrowserPersonaRoot(idbName, 0);

    // The per-Nexus key: the walk leaf returns its seed.
    const leaf = await browserWalkLeaf(idbName, NEXUS, 0);
    // A walk record carrying a bearer invite.
    const gateKey = "ab".repeat(32);
    const inviteText = encodeInvite({ nexusAid: NEXUS, gatePubKey: gateKey, token: { purpose: "host-invite", n: "12".repeat(32), y: "34".repeat(64) } });
    await browserWalkStore(idbName).update(gateKey, () => ({ nexusAid: NEXUS, invite: inviteText }));
    // A fleet join: the request mints the face-scoped key and keeps the pending join; the answer lands the address secret.
    const root = await pair("census fleet root");
    const face = await chain("census fleet face", NEXUS);
    const offer = fleetJoinOffer({ personaGroup: GROUP, rootKey: root.key, nonce: "c3".repeat(32), scopes: [face.scope] });
    const request = await browserFleetJoinRequest({ offer, idbName });
    const faceKey = await secretAt(idbName, ["vessel-face-keys", `${face.scope.nexus}|${face.scope.faceKey.toLowerCase()}`], `vessel-face-key/${face.scope.nexus}|${face.scope.faceKey.toLowerCase()}`) as Uint8Array;
    const pending = await secretAt(idbName, ["fleet-join", "pending"], `fleet-join-pending/${GROUP}`) as { sealSecret: string };
    const sealSecret = fromHex(pending.sealSecret);
    await browserFleetJoinLand({ answer: await answerTo(root, face, request), idbName });

    const needles: Record<string, Uint8Array> = {
      "per-Nexus key": leaf.seed, "face-scoped key": faceKey, "address secret": ADDRESS_SECRET,
      "pending seal secret": sealSecret, "walk invite": new TextEncoder().encode(inviteText),
    };
    const readAll = async () => Object.fromEntries(await Promise.all(Object.entries(needles).map(async ([k, v]) => [k, await census(idbName, v)] as const)));
    const none = Object.fromEntries(Object.keys(needles).map((k) => [k, []]));
    expect(await readAll(), "unlocked").toEqual(none);
    lockBrowserCustody(idbName);
    expect((await readBrowserCustody(idbName)).reading).toBe("sealed");
    expect(await readAll(), "locked, the connection reopened by each census").toEqual(none);
    expect((await unlockBrowserCustody(idbName, [PASS])).reading).toBe("opens");
    expect(await readAll(), "unlocked again").toEqual(none);
  });
});

/** A secret's value from its clear store row, else from its custody row: the census then reads where it rests. */
async function secretAt(idbName: string, [store, key]: [string, string], custodyRow: string): Promise<unknown> {
  const db = await openVesselIdb(idbName);
  try {
    if (db.objectStoreNames.contains(store)) {
      const clear = await idbGet<unknown>(db, store, key);
      if (clear !== undefined) return clear;
    }
  } finally { db.close(); }
  const held = await readKeystoreRow(idbName, custodyRow);
  if (held === undefined) throw new Error(`no ${custodyRow} stands in either home`);
  return held;
}

function fromHex(text: string): Uint8Array {
  return new Uint8Array(text.match(/.{2}/g)!.map((p) => Number.parseInt(p, 16)));
}

/** The root's signed answer to `request`, sealing ADDRESS_SECRET, as the fleet-join suite builds one. */
async function answerTo(root: Awaited<ReturnType<typeof pair>>, face: Awaited<ReturnType<typeof chain>>, request: FleetJoinRequest) {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(5) })), new TextEncoder().encode(NEXUS), sovereignRoute("/ws"));
  const pin = bundle.pin; bundle.drop();
  const carriage = { gatePin: pin, canon: { "lar:///ha.ka.ba/bags/lares": "automerge:canon-lares" } };
  const body = {
    nonce: request.nonce, atomKey: request.atomKey, personaGroup: GROUP,
    edge: { kind: "device-admit/v1", personaGroupId: GROUP, deviceEdge: "synthetic", hearthTrueName: NEXUS },
    carriage,
    reach: { syncUrl: "ws://hearth.synthetic:7777/ws", islandKind: "anchor", islandScope: NEXUS },
    charter: "the hearth's charter",
    admit: { admit: { nym: face.scope.faceKey, action: "admit", parents: [], sealEpochCid: "epoch", carriageCommit: admitCarriageCommit({ carriage, salt: SALT }) }, lineage: [], salt: SALT },
    floorPins: [],
    secret: sealAddressSecret({ secret: ADDRESS_SECRET, request }),
  };
  const key = request.requests[0]!.vesselFaceKey as VesselFaceKey;
  const certificates = [{ scope: face.scope, vesselFaceKey: key, signature: await signHex(certificateImage(face.scope, key), face.face) }];
  const grants = [{ personaGroup: GROUP, scope: face.scope, signature: await signHex(faceKeyGrantImage(GROUP, face.scope), root) }];
  return { kind: "fleet-join-answer", ...body, certificates, grants, signature: await signHex(fleetJoinAnswerImage(body), root) };
}
