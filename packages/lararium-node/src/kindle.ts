/**
 * kindle — the cold path: pull a bulb by its CID and kindle a NEW SOVEREIGN hearth, headless.
 *
 * A library call, no CLI verb: PULL the all-public bulb by the CID the traveler already holds → VALIDATE the
 * genesis bytes → MATERIALIZE the oracle island → the DEVICE mints its OWN Ed25519 → build the cold-boot ceremony
 * tiddlers on THAT key → seed the fresh social docs. The kindled hearth stands SOVEREIGN from first breath: it
 * certifies itself with a key IT minted, never one the Herm supplied.
 *
 * SERVE FIRE, NEVER KEY (load-bearing, by PLACEMENT). The bulb carries genesis + engine + grammar — NEVER a signing
 * key. `generateOrLoadVesselIdentity` mints the device's OWN Ed25519 HERE, on the cold device; `buildCeremonyTiddlers`
 * runs on THAT verifying key. The Herm's process never mints, holds, or touches the kindled identity — placement
 * forbids it (no key rides the bulb to supply). So two devices kindling the SAME bulb become two DISTINCT sovereigns
 * (distinct did:keys), never one conscripted identity.
 *
 * TWO DOORS, ONE FIRE. `pullBulb` reads a herm by a bulb CID the traveler brings — a silent herm describes nothing,
 * so the CID arrives with the traveler (it re-derives from the published genesis). `pullArrival` reads a LARARIUM's
 * own Pronaos — the arrival descriptor at `/.well-known/lar`, then `genesis/seed.json` and every seed-named CAS member
 * off the same origin. The first arrival trusts the lararium's own origin (pronaos#/the-first-arrival), so
 * `pullArrival` reads only the origin it was handed: a mirror the descriptor lists never kindles, and this path never
 * dials one. Both doors yield the same bulb (seed + CAS), and `kindleFromBulb` mints the device's own key over either.
 *
 * OPEN PATH (bulb ⊥ stolon). Kindle births a STRANGER's own sovereign hearth (permissionless growth) — distinct from
 * the stolon, which invites a device into YOUR fleet (the closed path). Kindle joins no fleet: it seeds a FRESH
 * social plane (its own identities and circles docs), never the Herm's.
 *
 * SCOPE. `kindleFromBulb` runs the LIGHT cold-boot ceremony — oracle island + the device's own key + the identity/
 * circle tiddlers. It does not run `runFoundingCeremony` (the daemon doc + keyhive + sentinel seeding), write a
 * social bootstrap, or guard a device whose identity already stands; a hearth kindled here is not yet
 * `lares vessel stand --foreground`-able.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/kindle
 */

import type { Repo, DocHandle } from "@automerge/automerge-repo";
import { bulbBlobRoute } from "./bulb-routes.js";
import { ARRIVAL_FORMAT, ARRIVAL_WELL_KNOWN_ROUTE, type ArrivalDescriptor } from "./pronaos-adapter.js";
import {
  genesisCasManifestFromSeed, sha256HexBytesSync,
  materializeGenesisDoc, materializeGenesisIsland, validateGenesisBytes,
  buildCeremonyTiddlers, didKeyFromVerifyingKey,
  emptyLarDoc, IDENTITIES_NAMESPACE,
  type GenesisSeed, type LarDoc,
} from "@lararium/mesh";
import { assembleBulb, bulbSeedInventory, type BulbArtifact } from "./bulb.js";
import { generateOrLoadVesselIdentity } from "./node-vessel-identity.js";
import { writeCasEntriesFs, casDirForStorage } from "./node-cas.js";

/** The HTTP transport a pull rides — injected so a test drives it in-process (no real socket needed). */
export interface BulbPullTransport {
  /** GET a JSON body at a path under the base (e.g. `/.well-known/lar`). */
  getJson(path: string): Promise<unknown>;
  /** GET raw bytes at a path (e.g. `/bulb/<cid>.bin`). */
  getBytes(path: string): Promise<Uint8Array>;
}

/**
 * PULL a bulb by its CID over a transport: fetch and verify the seed under that CID, derive every required CAS CID
 * from it, then fetch each fire byte. `assembleBulb` verifies each byte again. Secret-free, content-address
 * integrity only. Returns the reconstructed bulb, ready to kindle.
 */
export async function pullBulb(transport: BulbPullTransport, cid: string): Promise<BulbArtifact> {
  const cache = new Map<string, Uint8Array>();
  cache.set(cid, await transport.getBytes(bulbBlobRoute(cid)));
  const { inventory } = bulbSeedInventory(cid, (c) => cache.get(c) ?? null);
  for (const blob of inventory.blobs) {
    if (!cache.has(blob.cid)) cache.set(blob.cid, await transport.getBytes(bulbBlobRoute(blob.cid)));
  }
  return assembleBulb(cid, (c) => cache.get(c) ?? null);
}

function arrivalRefusal(message: string): Error {
  return new Error(`[kindle] arrival ${message}`);
}

function contentAddressed(bytes: Uint8Array, cid: string, label: string): Uint8Array {
  if (sha256HexBytesSync(bytes) !== cid) throw arrivalRefusal(`${label} fails content-address (cid ${cid})`);
  return bytes;
}

/**
 * PULL the fire off a lararium's own Pronaos. Reads the arrival descriptor at its well-known name, fetches the seed
 * at the path the descriptor names and checks it against the descriptor's seed CID, derives the CAS inventory from
 * that verified seed, refuses unless the descriptor's members equal that inventory exactly, then fetches and
 * re-verifies each member. Nothing here reads the descriptor's mirrors.
 */
export async function pullArrival(transport: BulbPullTransport): Promise<BulbArtifact> {
  const descriptor = await transport.getJson(ARRIVAL_WELL_KNOWN_ROUTE) as ArrivalDescriptor;
  if (!descriptor || descriptor.format !== ARRIVAL_FORMAT || !Array.isArray(descriptor.routes)) {
    throw arrivalRefusal(`descriptor format unknown — refusing`);
  }
  const seedRoutes = descriptor.routes.filter((route) => route.kind === "genesis-seed");
  const seedRoute = seedRoutes[0];
  if (seedRoutes.length !== 1 || !seedRoute || seedRoute.kind !== "genesis-seed") throw arrivalRefusal("descriptor names no single genesis seed");
  const seedBytes = contentAddressed(await transport.getBytes(seedRoute.path), seedRoute.seedCid, "seed");
  let seed: GenesisSeed;
  try { seed = JSON.parse(new TextDecoder().decode(seedBytes)) as GenesisSeed; }
  catch (error) { throw arrivalRefusal(`seed is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const inventory = genesisCasManifestFromSeed(seed).blobs.map((blob) => blob.cid);
  const members = descriptor.routes.flatMap((route) => route.kind === "genesis-member" ? [route] : []);
  const named = new Set(members.map((route) => route.cid));
  if (named.size !== members.length || named.size !== inventory.length || inventory.some((cid) => !named.has(cid))) {
    throw arrivalRefusal("members differ from the seed-derived inventory");
  }
  const casEntries: { cid: string; bytes: Uint8Array }[] = [];
  for (const cid of inventory) {
    const route = members.find((member) => member.cid === cid)!;
    casEntries.push({ cid, bytes: contentAddressed(await transport.getBytes(route.path), cid, "member") });
  }
  return { seed, casEntries };
}

/** A real-HTTP transport over a base url (`http://host:port`). Uses the runtime `fetch`. */
export function httpBulbTransport(baseUrl: string): BulbPullTransport {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    async getJson(path: string): Promise<unknown> {
      const res = await fetch(base + path);
      if (!res.ok) throw new Error(`[kindle] GET ${path} → ${res.status}`);
      return res.json();
    },
    async getBytes(path: string): Promise<Uint8Array> {
      const res = await fetch(base + path);
      if (!res.ok) throw new Error(`[kindle] GET ${path} → ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/** What a kindle produces — the sovereign hearth's OWN identity + the materialized island/social handles. */
export interface KindleResult {
  /** The kindled hearth's did:key — derived from the DEVICE's OWN verifying key (never the Herm's). */
  readonly did:                string;
  /** The device's own Ed25519 verifying key hex — minted on THIS device, never supplied by the Herm. */
  readonly deviceVerifyingKey: string;
  /** The materialized oracle island url (the engine + genesis the bulb carried). */
  readonly oracleUrl:          string;
  /** The fresh @identities doc url the ceremony seeded (a SOVEREIGN social plane, not the Herm's). */
  readonly identitiesUrl:      string;
  /** The fresh circles doc url the ceremony seeded. */
  readonly circlesUrl:         string;
}

/**
 * Kindle a sovereign hearth from a pulled bulb, headless. Validates the genesis, mirrors the FIRE bytes into the
 * device's runtime CAS, materializes the oracle island, MINTS the device's OWN Ed25519 (never the Herm's), builds
 * the cold-boot ceremony on that key, and seeds fresh social docs. Returns the sovereign's own identity + handles.
 *
 * @param repo             the cold device's OWN repo (its OWN storage — the Herm's repo never touches this).
 * @param storageDir       the device's storage root (the runtime CAS + the identity home both site under it).
 */
export async function kindleFromBulb(args: {
  readonly bulb:        BulbArtifact;
  readonly repo:        Repo;
  readonly storageDir:  string;
  readonly displayName?: string;
}): Promise<KindleResult> {
  const { bulb, repo, storageDir } = args;

  // 1. VALIDATE the genesis the bulb carries (Automerge-loadable, TW5 core + packed Lares plugin present).
  const bytes = materializeGenesisDoc(bulb.seed);
  validateGenesisBytes(bytes, "kindle");

  // Mirror the FIRE bytes (engine + plugins) into the device's runtime CAS so its island boots on them.
  writeCasEntriesFs(bulb.casEntries, casDirForStorage(storageDir));

  // 2. MATERIALIZE the oracle island fresh from the seed, under its deterministic id (the engine + genesis).
  const island = await materializeGenesisIsland(repo, bulb.seed, "kindle");

  // 3. the DEVICE mints its OWN Ed25519 — HERE, on the cold device. The Herm never sees this key (serve fire, never
  //    key). A fresh storageDir → a fresh keypair → a NEW sovereign; the bulb supplies NO key to source it from.
  const identity = await generateOrLoadVesselIdentity();

  // 4. build the cold-boot ceremony ON the device's own verifying key — the identity did:key derives from IT.
  const ceremony = buildCeremonyTiddlers(identity.verifyingKey, args.displayName);

  // 5. seed FRESH social docs (a SOVEREIGN plane — not the Herm's fleet) and write the ceremony tiddlers in.
  const identitiesHandle: DocHandle<LarDoc> = repo.create<LarDoc>(emptyLarDoc());
  const circlesHandle:    DocHandle<LarDoc> = repo.create<LarDoc>(emptyLarDoc());
  for (const t of ceremony) {
    const handle = t.bag === IDENTITIES_NAMESPACE ? identitiesHandle : circlesHandle;
    handle.change((doc) => {
      if (!doc.tiddlers[t.title]) {
        doc.tiddlers[t.title] = { tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } };
      }
    });
  }

  return {
    did:                didKeyFromVerifyingKey(identity.verifyingKey),
    deviceVerifyingKey: identity.verifyingKey,
    oracleUrl:          island.url,
    identitiesUrl:      identitiesHandle.url,
    circlesUrl:         circlesHandle.url,
  };
}
