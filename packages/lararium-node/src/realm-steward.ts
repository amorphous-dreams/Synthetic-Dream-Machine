/**
 * realm-steward — THE STEWARD DOOR: the one place a vessel picks the key that seals a realm record.
 *
 * THE RULING. A scoped face signs acts that belong to one person; a transparent quorum Handle signs acts the
 * collective owns; the root never appears publicly. A realm-bag registration names its stewards in `keptBy`,
 * and that record travels: the realm doc crosses to every member, and the `@crossroads` announce names
 * `keptBy` in public. So whatever key seals here gets published.
 *
 * THE ONE SIGNER. This door hands out the key the vessel's WORN face presents to the Nexus the realm stands
 * under (`mintWornNexusLeaf`), and nothing else. No option names a persona index, no roster order picks a face,
 * and no arm reaches a root: a vessel that wears no face refuses by name until its operator wears one.
 *
 * THE GUARD. Every signer passes `stewardGuard` before it seals, here and again inside the realm plane. The
 * guard reads the key against this vessel's own material (`signerClass`) and passes a per-Nexus face key
 * alone. A persona root, a vessel key and a key this vessel cannot class each refuse by name, and so does a
 * vault that will not read.
 *
 * WHAT THE DOOR CANNOT READ, AND THE ORDER THAT ANSWERS IT. A vessel cannot class a key that belongs to
 * somebody else, and no roster of face keys stands anywhere to ask (the carriage board records carriage, never
 * belonging). So a name enters a realm record BY ITS OWN HAND FIRST: a hand that would keep a bag another hand
 * keeps asks from its own vessel (`join`), sealing with its own worn face, and each standing steward consents
 * (`cosign`). A keeping hand may name a steward (`stewards`) only where that name already sealed a record of
 * this realm (else `steward-name-unproven`), and never by this vessel's own root or vessel key.
 *
 * THE VERBS. `runRealmBag` and `runRealmBags` hold the whole bodies of the vessel's `realm-bag` and
 * `realm-bags` verbs; the composing vessel registers them and hands in its plane.
 *
 * A collective Handle's seal stands specified in mesh (`steward-seal`). This door offers no Handle signer: no
 * vessel holds a collective Handle's key, and which acts such a Handle may seal belongs to the charter's
 * classes.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-steward-signer
 */

import {
  ed25519SignerFromSeed, signerClass, stewardClassOf, tiddlerText,
  CABAL_REALM_RE, realmStewardMap,
  type CapTier, type HeldKeys, type LarDoc, type RealmBagFoldOptions, type StewardSigner,
} from "@lararium/mesh";
import { heldNexusLeaves, mintWornNexusLeaf } from "./nexus-leaf.js";
import { loadNodeHandleBook } from "./node-circle-store.js";
import {
  listPersonaRoots, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey,
} from "./node-vessel-identity.js";
import { StewardRefused, type RealmPlanesHolder, type RealmPlaneHolder, type StewardGuard } from "./realm-plane.js";

export { StewardRefused, type StewardGuard, type StewardRefusal } from "./realm-plane.js";

/** The planes a door acts through: the charter-derived realm's own plane, and, where the holder stands many
 *  realms, the doors to them. A holder that stands one realm alone still answers every verb that names none. */
export type RealmDoorPlanes = RealmPlaneHolder & Partial<Pick<RealmPlanesHolder, "realms" | "plane" | "enter">>;

/** What the door reads of this vessel's own keys. A test hands a fake; the standing vessel reads its vault. */
export interface StewardVault {
  /** The key the WORN face presents to the Nexus `nexusAid`, with its signing seed, minted at random where none
   *  stands: a seal presents the face there. Null when this vessel wears no face, or holds no root for the worn
   *  index. */
  wornLeaf(nexusAid: string): Promise<{ readonly verifyingKey: string; readonly seed: Uint8Array } | null>;
  /** This vessel's own keys by class; `nexusScopedKeys` holds its held personas' keys AT `nexusAid`. */
  heldKeys(nexusAid: string): Promise<HeldKeys>;
}

/** The node vault's reading: the worn face's key at the Nexus, and every key class this vessel can name. */
export const nodeStewardVault: StewardVault = {
  async wornLeaf(nexusAid) {
    const leaf = await mintWornNexusLeaf(nexusAid);
    return leaf ? { verifyingKey: leaf.verifyingKey.toLowerCase(), seed: leaf.seed } : null;
  },
  async heldKeys(nexusAid) {
    const personaGroupRoots: string[] = [];
    for (const index of await listPersonaRoots()) {
      const key = await loadPersonaGroupRootVerifyingKey(index);
      if (key) personaGroupRoots.push(key.replace(/^0x/i, "").toLowerCase());
    }
    const vesselKey = await loadVesselVerifyingKey().catch(() => "");
    return {
      personaGroupRoots,
      vesselKeys: vesselKey ? [vesselKey.slice(-64).toLowerCase()] : [],
      nexusScopedKeys: (await heldNexusLeaves(nexusAid)).map((leaf) => leaf.verifyingKey.toLowerCase()),
      veiledHandles: [],
    };
  },
};

/**
 * What this vessel knows of a Handle that sealed: the chain its own HANDLE BOOK holds for that one prefix (the
 * recogniser's private memory of the cards it verified). The realm plane reads every Handle steward's seal
 * against it, so a seal under a head this vessel saw retired stops counting here. A book that will not open
 * (custody at the floor) throws, and the seal's verifier then reads the seal as no seal.
 */
export function nodeHandleBookReading(): RealmBagFoldOptions {
  return {
    heldChain: async (prefix) => (await loadNodeHandleBook()).get(prefix)?.card?.chain ?? null,
  };
}

/** Read this vessel's own keys, or refuse by name: a vault that will not read (a locked custody seat, a torn
 *  roster) never lets a signer through on a guess, and never reads as a vessel that wears no face. */
async function readVault<T>(what: string, read: () => Promise<T>): Promise<T> {
  try { return await read(); } catch (err) {
    throw new StewardRefused("steward-key-unreadable", `this vessel's ${what} would not read: ${(err as Error)?.message ?? String(err)}`);
  }
}

/**
 * Build THE GUARD over a vault. A FACE name passes only when this vessel's own keys class it `nexus-scoped` at
 * `nexusAid`; a HANDLE name passes when its signer carries a chain that opens on that name (the seal's own
 * verifier judges the chain). Everything else throws `StewardRefused`.
 */
export function stewardGuard(vault: StewardVault = nodeStewardVault): StewardGuard {
  return async (signer, nexusAid) => {
    const name = signer.signer.trim().toLowerCase();
    const klass = stewardClassOf(name);
    if (!klass) throw new StewardRefused("steward-name-unreadable", `steward name "${signer.signer}" reads neither a face key nor a Handle`);
    if (klass === "face") {
      if (signer.chain !== undefined) throw new StewardRefused("handle-chain-mismatch", "a face signer carries a Handle chain");
      const reading = signerClass(name, await readVault("own keys", () => vault.heldKeys(nexusAid)));
      if (reading.klass !== "nexus-scoped") throw new StewardRefused("steward-key-class", `face key reads ${reading.klass}`);
      return;
    }
    if (!signer.chain?.length || signer.chain[0]?.prefix !== name) {
      throw new StewardRefused("handle-chain-mismatch", `Handle chain does not open on ${name}`);
    }
  };
}

/**
 * The signer the worn face presents in a realm under `nexusAid`. Refuses `no-face-worn` when the vessel wears
 * none. The signer passes the guard before it leaves this door.
 */
export async function wornStewardSigner(nexusAid: string, vault: StewardVault = nodeStewardVault): Promise<StewardSigner> {
  const leaf = await readVault("worn face", () => vault.wornLeaf(nexusAid));
  if (!leaf) throw new StewardRefused("no-face-worn", "wear a face with `lares persona wear N` before keeping a realm bag");
  const signer: StewardSigner = { signer: leaf.verifyingKey.toLowerCase(), sign: ed25519SignerFromSeed(leaf.seed) };
  await stewardGuard(vault)(signer, nexusAid);
  return signer;
}

/** What the verb `realm-bag` answers. A type alias, so the verb registry reads it as a plain record. */
export type RealmBagVerbResult = {
  readonly verb: "realm-bag"; readonly realm: string; readonly bag: string; readonly doc: string;
  readonly keptBy: readonly string[]; readonly readTier: CapTier;
  /** The kept names whose seals verify on this vessel. */
  readonly signedBy: readonly string[];
  /** Every named steward sealed: the record counts. */
  readonly counts: boolean;
  /** The named stewards whose hands have yet to seal. */
  readonly awaiting: readonly string[];
};

const refusedNoRealm = (): StewardRefused => new StewardRefused("no-realm", "stand a realm with `lares nexus rite quorum` or `lares nexus seal import`");
const normalizedName = (name: string): string => name.trim().toLowerCase().replace(/^0x/i, "");

/**
 * THE VERB `realm-bag`: register a bag this vessel's steward keeps; or (`join: true`) ask to keep a bag
 * another hand keeps; or (`cosign: true`, with `with: <name>` where several proposals wait) consent to a
 * proposal that names this vessel's steward. The worn face's key seals, whatever the arguments say. `stewards` names the hands a registration PROPOSES: each must
 * read a steward class, must not read as this vessel's own root or vessel key, and must already have sealed
 * a record of this realm.
 */
export async function runRealmBag(opts: {
  readonly plane: RealmDoorPlanes | null;
  readonly args: Record<string, unknown>;
  /** The registry planes this vessel names a bag's doc on, in reading order. */
  readonly registryDocs: () => ReadonlyArray<LarDoc | undefined | null>;
  /** Fired after the record lands: the realm gate's standing set moved. */
  readonly reverdict?: () => void;
  readonly vault?: StewardVault;
}): Promise<RealmBagVerbResult> {
  const { plane, args, vault = nodeStewardVault } = opts;
  const requested = typeof args["realm"] === "string" ? (args["realm"] as string).trim().toLowerCase() : "";
  let target: RealmPlaneHolder | null = plane;
  if (requested && plane) {
    if (requested === plane.realmId()) target = plane;
    // A realm this vessel already stands a plane for (a carried charter's realm, a cabal realm it entered) answers.
    else if (plane.plane?.(requested)) target = plane.plane(requested);
    // AN ACT STANDS THE VESSEL IN A REALM: a cabal realm it never entered gets entered here, and noted.
    else if (CABAL_REALM_RE.test(requested)) target = (await plane.enter?.(requested)) ?? null;
    else throw new StewardRefused("realm-unreadable", `realm "${requested}" does not read as a stood realm or cabal realm id`);
  }
  if (!target || !target.realmId() || !target.nexusAid()) throw refusedNoRealm();
  const bagUri = typeof args["bag"] === "string" ? (args["bag"] as string).trim() : "";
  if (!bagUri) throw new Error("realm-bag: `bag` required (the bag's lar: URI, e.g. lar:///ha.ka.ba/bags/lares)");
  const cosign = args["cosign"] === true;
  const join = args["join"] === true;
  if (cosign && join) throw new Error("realm-bag: `join` asks to keep and `cosign` consents — one act per call");
  const docUrl = opts.registryDocs().map((doc) => tiddlerText(doc?.tiddlers?.[bagUri])).find((text): text is string => !!text) ?? "";
  if (!docUrl && !cosign && !join) throw new Error(`realm-bag: "${bagUri}" names no doc on this vessel's registry planes — nothing to register`);
  const aid = target.nexusAid()!;
  const held = await readVault("own keys", () => vault.heldKeys(aid));
  const propose = Array.isArray(args["stewards"]) ? (args["stewards"] as unknown[]).filter((item): item is string => typeof item === "string").map(normalizedName) : [];
  for (const name of propose) {
    const klass = stewardClassOf(name);
    if (!klass) throw new StewardRefused("steward-name-unreadable", `proposed steward name "${name}" reads neither a face key nor a Handle`);
    if (klass === "face") {
      const keyClass = signerClass(name, held).klass;
      if (keyClass === "persona-group-root" || keyClass === "vessel-key") {
        throw new StewardRefused("steward-key-class", `proposed face key reads ${keyClass}`);
      }
    }
    // A NAME ENTERS BY ITS OWN HAND FIRST: this vessel cannot class a key that belongs to another hand, so it
    // writes such a name only where that name's holder already sealed a record of this realm.
    if (!(await target.sealedHere(name))) {
      throw new StewardRefused("steward-name-unproven", `"${name}" sealed nothing in this realm, so no hand but its own may write it here — that hand asks to keep the bag from its own vessel (\`lares nexus realm-bag <bag> --join\`), and each standing steward consents (\`--cosign\`)`);
    }
  }
  const signer = await wornStewardSigner(aid, vault);
  const tier = typeof args["tier"] === "string" ? args["tier"] as CapTier : undefined;
  const expiry = Number.isFinite(args["expiry"]) ? Number(args["expiry"]) : undefined;
  const charters = typeof args["charters"] === "object" && args["charters"] !== null ? args["charters"] as Record<string, string> : undefined;
  const withName = typeof args["with"] === "string" && (args["with"] as string).trim().length > 0 ? normalizedName(args["with"] as string) : undefined;
  const rec = cosign
    ? await target.coSign({ bagUri, ...signer, ...(withName === undefined ? {} : { withName }) })
    : join ? await target.join({ bagUri, ...signer })
    : await target.register({ bagUri, docUrl, signers: [signer], propose, ...(tier ? { readTier: tier } : {}), ...(expiry === undefined ? {} : { expiry }), ...(charters ? { charters } : {}) });
  opts.reverdict?.();
  // THE REPORT READS VERIFIED SEALS: a name a record lists, and a seal that fails, each still read as awaited.
  const { counts, sealedBy } = await target.reading(rec);
  return { verb: "realm-bag", realm: rec.realmId, bag: rec.bagUri, doc: rec.docUrl, keptBy: rec.keptBy,
    readTier: rec.readTier, signedBy: sealedBy, counts, awaiting: rec.keptBy.filter((name) => !sealedBy.includes(name)) };
}

/** THE VERB `realm-bags`: the standing registrations this vessel's realm carries, counted and folded, and the
 *  steward map those registrations fill (`realmStewardMap`: co-signed `keptBy` names only, each with its bags). */
export async function runRealmBags(opts: { readonly plane: RealmDoorPlanes | null; readonly args?: Record<string, unknown> }): Promise<{
  readonly verb: "realm-bags"; readonly realm: string | null; readonly realmDoc: string | null;
  readonly realms: readonly string[];
  readonly bags: ReadonlyArray<{ readonly realm: string; readonly bag: string; readonly doc: string; readonly keptBy: readonly string[]; readonly readTier: CapTier }>;
  readonly stewards: ReadonlyArray<{ readonly name: string; readonly bags: readonly string[] }>;
}> {
  const { plane } = opts;
  const requested = typeof opts.args?.["realm"] === "string" ? (opts.args["realm"] as string).trim().toLowerCase() : "";
  // A READ NEVER ENTERS A REALM: a realm this vessel stands no plane for lists nothing.
  const realms = plane?.realms?.() ?? (plane?.realmId() ? [plane.realmId()!] : []);
  const primary = plane?.realmId() ? plane : (realms[0] ? plane?.plane?.(realms[0]) ?? null : null);
  const selected = requested ? (requested === plane?.realmId() ? plane : plane?.plane?.(requested) ?? null) : primary;
  const realmId = selected?.realmId() ?? (requested || null);
  const ids = requested ? (selected ? [requested] : []) : realms;
  const bags: Array<{ realm: string; bag: string; doc: string; keptBy: readonly string[]; readTier: CapTier }> = [];
  const stewards: Array<{ name: string; bags: readonly string[] }> = [];
  for (const id of ids) {
    const holder = id === plane?.realmId() ? plane : plane?.plane?.(id) ?? null;
    if (!holder) continue;
    const standing = await holder.standing();
    bags.push(...[...standing.values()].map((rec) => ({ realm: id, bag: rec.bagUri, doc: rec.docUrl, keptBy: rec.keptBy, readTier: rec.readTier })));
    stewards.push(...[...realmStewardMap(id, standing).stewards]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([name, held]) => ({ name, bags: held })));
  }
  return { verb: "realm-bags", realm: realmId, realmDoc: selected?.realmUrl() ?? null,
    realms, bags, stewards };
}
