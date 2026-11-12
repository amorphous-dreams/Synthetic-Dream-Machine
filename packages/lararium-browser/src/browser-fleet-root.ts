/**
 * browser-fleet-root — THE FLEET-JOIN DOOR's ROOT-HOLDER half on a browser vessel: a face this browser founded takes
 * another vessel of the same human, with no node in the walk.
 *
 * Two acts on this browser, with the joining vessel's two between them (`browser-fleet-join`, or a node's
 * `lares fleet join request` and `land`):
 *
 *   OFFER    name the face (its PersonaGroup and its root's public key), a fresh nonce and the scopes the face stands at.
 *            The root stays shut: an offer signs nothing.
 *   ANSWER   read ONE request against the offer rebuilt over the face as it stands now, seat the joinee (`browserSeatDevice`:
 *            the tag law, the admission in the face's log, the root's edge), and inside one opening of the root sign the
 *            grants, seal the face's address secret to the request, and sign the whole.
 *
 * Both compose through the composers the node's door calls (`composeFleetJoinOffer`, `composeFleetJoinAnswer`), and the
 * seat runs the one core the node's device-admit runs (`seatDeviceInFace`), so a browser and a node spell one offer, one
 * seat and one answer alike. ONE CAPABILITY SETS THEM APART: a browser cannot listen on a socket, so it stands no inbound
 * gate and its answer carries no hearth's dial (`FleetJoinHearthDial`): no gate pin, charter, admit or floor pin, and an
 * edge that binds no hearth true name. The joinee founds the face and derives its addresses from the secret the answer
 * sealed; where the two vessels meet (a herm that carries and never reads) rides the reach, named or null.
 *
 * WHAT OPENS WHAT. The root's seed rests under the face's ward (`browser-ward`). The caller hands ONE ward route, asked
 * once by the ceremony door for this act; the seat and the signature each open the ward under it, and each seed
 * zero-fills as its act settles. No credential rides a flag, a variable of the page or a pipe: the route reaches this
 * module from the vessel's own ward ask and nowhere else. The address secret reads from the face's own sealed row and
 * zero-fills in the composer.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/device-seats
 */
import * as ed25519 from "@noble/ed25519";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, FLEET_HAND, FleetJoinRootRefused, DeviceSeatRefused, buildDeviceDelegationRootHalf, composeFleetJoinAnswer,
  composeFleetJoinOffer, deviceEdgeId, faceAtomKeyFromSeed, fleetEdgeAuthority, fleetEdgeBoardDocUrl, fleetFrontierCarriage,
  fleetRaiseCids, hex, leaseEpochPrefix, materializeSharedLarDoc, personaActRecordsOfGroup, personaBagIdFor, personaKelBoardDocUrl,
  personaKelChainForPrefix, readControlHome, readFace, readFleetFrontier, readFrontierPins, readLedgeredEdgeBoard, seatDeviceInFace,
  tiddlerText, writePersonaAct,
  type FaceScope, type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest, type FleetJoinSeat, type LarDoc, type SignedAct,
} from "@lararium/mesh";
import { runDeviceAdmitEdge, type DeviceAdmitPayload } from "@lararium/keyhive";
import type { WardRoute } from "./ward-core.js";
import { browserPersonaRootHeld, generateOrLoadBrowserPersonaRoot, listBrowserPersonaRoots, loadBrowserPersonaRootSeed, FLEET_JOIN_STORE, idbGet, idbPut, openVesselIdb } from "./browser-vessel-identity.js";
import { loadBrowserFaceAnchor } from "./browser-face-anchor.js";
import { readBrowserFaceAddressSecret, requireBrowserFaceAtomSeed } from "./browser-face-atom.js";

/** A root holder's act this browser refused, by name: a composer's or a seat's refusal, or this door's own. */
export class BrowserFleetRootRefused extends Error {
  constructor(readonly refusal: string, detail: string) {
    super(`${refusal}: ${detail}`);
    this.name = "BrowserFleetRootRefused";
  }
}

/** The face a root holder's act serves: its PersonaGroup, and the persona index its root rests at in this browser. */
export interface BrowserRootFace {
  readonly personaGroup: string;
  readonly handleIndex:  number;
}

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

/** The root's public key, read off the roster with the root shut; a browser that holds no root for the face refuses `root-absent`. */
async function heldRootKey(idbName: string, face: BrowserRootFace): Promise<string> {
  if (!(await browserPersonaRootHeld(idbName, face.handleIndex))) {
    throw new BrowserFleetRootRefused("root-absent", "this browser holds no root for that face; the vessel that founded the face answers its fleet joins.");
  }
  return bare((await generateOrLoadBrowserPersonaRoot(idbName, face.handleIndex, undefined, face.personaGroup)).verifyingKey);
}

/**
 * The scopes a face stands at in this browser. A browser holds no per-Nexus face key (it contracts with no Nexus by a
 * key of its own), so the face stands at none: its offer names no scope, and its joinee asks no certificate.
 */
export async function browserStandingFaceScopes(_idbName: string, _face: BrowserRootFace): Promise<readonly FaceScope[]> {
  return [];
}

/** The root holder's offer for one face this browser founded. The root stays shut: an offer signs nothing. */
export async function browserFleetJoinOffer(opts: { readonly face: BrowserRootFace; readonly idbName?: string }): Promise<FleetJoinOffer> {
  const idbName = opts.idbName ?? "lares:vessel";
  const rootKey = await heldRootKey(idbName, opts.face);
  return composeFleetJoinOffer({ personaGroup: opts.face.personaGroup, rootKey, scopes: await browserStandingFaceScopes(idbName, opts.face) });
}

/** The row a face's issued certificates rest at, beside the device each answer named: public, signed records. */
export const issuedRow = (personaGroup: string): string => `issued:${personaGroup}`;

/** The root holder's answer to ONE request. `seat` seats the joinee over the vessel's own Repo (`browserSeatDevice`). */
export async function browserFleetJoinAnswer(opts: {
  readonly face: BrowserRootFace;
  /** The request as the joinee wrote it. */
  readonly request: unknown;
  /** The face's ward route for this ONE act, asked once by the ceremony door. */
  readonly ward: WardRoute;
  /** Seat the joinee in the face. It receives the root's seed, open for the seat alone and zero-filled after. */
  readonly seat: (request: FleetJoinRequest, signerSeed: Uint8Array) => Promise<FleetJoinSeat>;
  readonly idbName?: string;
}): Promise<FleetJoinAnswer> {
  const idbName = opts.idbName ?? "lares:vessel";
  const { personaGroup, handleIndex } = opts.face;
  const rootKey = await heldRootKey(idbName, opts.face);
  const withSeed = async <T>(act: (seed: Uint8Array) => Promise<T>): Promise<T> => {
    const seed = await loadBrowserPersonaRootSeed(idbName, handleIndex, opts.ward);
    try { return await act(seed); } finally { seed.fill(0); }
  };
  try {
    return await composeFleetJoinAnswer({
      request: opts.request, personaGroup, rootKey, scopes: await browserStandingFaceScopes(idbName, opts.face),
      doors: {
        seat: (request) => withSeed((seed) => opts.seat(request, seed)),
        // A browser holds no per-Nexus face key, so no request it reads asks a certificate; one that somehow did refuses here.
        certify: async (q) => { throw new BrowserFleetRootRefused("face-key-absent", `this browser holds no face key at ${q.scope.nexus}.`); },
        noteIssued: async ({ device, certificates }) => {
          const db = await openVesselIdb(idbName);
          try {
            const kept = (await idbGet<{ readonly device: string; readonly certificates: readonly unknown[] }[]>(db, FLEET_JOIN_STORE, issuedRow(personaGroup))) ?? [];
            await idbPut(db, FLEET_JOIN_STORE, issuedRow(personaGroup), [...kept.filter((e) => e.device !== device), { device, certificates }]);
          } finally { db.close(); }
        },
        withRoot: (act) => withSeed((seed) => act(async (image) => hex(await ed25519.signAsync(image, seed)))),
        addressSecret: () => readBrowserFaceAddressSecret(idbName, personaGroup),
      },
    });
  } catch (error) {
    if (error instanceof FleetJoinRootRefused) throw new BrowserFleetRootRefused(error.refusal, ROOT_REFUSAL_DETAIL[error.refusal] ?? "the request does not read against this face's offer as it stands now.");
    if (error instanceof DeviceSeatRefused) throw new BrowserFleetRootRefused(error.refusal, error.detail);
    throw error;
  }
}

const ROOT_REFUSAL_DETAIL: Readonly<Record<string, string>> = {
  "request-malformed": "the request names no nonce.",
  "no-address-secret": "this face holds no address secret in this browser.",
  "answer-unsigned": "the answer this browser composed does not read back under the face's root key.",
};

// ── The seat, over the vessel's Repo ────────────────────────────────────────────────────────────

/** What the vessel knows of the face it founded: the ids its founding kept in its bootstrap. */
export interface BrowserSeatFace {
  readonly personaGroupId:    string;
  readonly meshCabalDocIdHex: string;
  readonly personaKelPrefix:  string;
  /** The face's shared persona plane: its signed log rests there. */
  readonly personaUrl:        string;
  /** This vessel's daemon document: it names the control document the lease slots rest in. */
  readonly daemonUrl:         string;
}

export interface BrowserSeatInput {
  readonly repo:    Repo;
  readonly idbName: string;
  readonly face:    BrowserSeatFace;
  /** The island this vessel's persona-KEL board keys on: its own key where it founded alone. */
  readonly kelIsland: string;
  readonly request:   FleetJoinRequest;
  /** The PersonaGroup root's seed, open for this one act; the caller zero-fills it. */
  readonly signerSeed: Uint8Array;
  /** Where the joinee dials to meet this fleet (a herm's relay), or null where the human carries none yet. */
  readonly syncUrl: string | null;
  /** Further documents that carry this face's signed records before its plane syncs (the vessel's secret home). */
  readonly extraDocs?: readonly (LarDoc | null | undefined)[];
}

/**
 * Seat one joining device in a face this browser founded, as the node's `runDeviceAdmit` seats one: the face reads
 * through the one door (`readFace`) over the KEL board and this device's sealed anchor, the fleet board says whether the
 * device stands set aside, and the one core (`seatDeviceInFace`) runs the tag law, the admission and the root's edge.
 * The acts it signed land on the face's plane once the enrolment answered.
 *
 * The edge binds NO hearth true name (""): this root holder stands no gate, so the seat carries no hearth's dial.
 */
export async function browserSeatDevice(input: BrowserSeatInput): Promise<FleetJoinSeat> {
  const { repo, idbName, face, request, signerSeed } = input;
  const group = face.personaGroupId;
  const refuse = (refusal: string, detail: string): never => { throw new BrowserFleetRootRefused(refusal, detail); };

  const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(input.kelIsland), "board:persona-kel");
  const personaKelChain = personaKelChainForPrefix(kelBoard.doc(), face.personaKelPrefix);
  if (!personaKelChain || personaKelChain.length === 0) return refuse("face-proof", "this browser's KEL board carries no chain for the face; re-found the face.");
  const issuerAnchor = await loadBrowserFaceAnchor(idbName, group);
  if (!issuerAnchor) return refuse("face-proof", "this face holds no sealed anchor in this browser; re-found the face.");
  if (issuerAnchor.personaKelPrefix !== face.personaKelPrefix) return refuse("face-proof", "the face's sealed anchor names another KEL prefix than its bootstrap.");
  const reading = readFace(personaKelChain, issuerAnchor);
  if (!reading) return refuse("face-proof", "the face's KEL reads no lineage; re-found the face.");

  // THE LEASE READ, off the vessel's control document: fail closed, so an unread fence signs no edge at the genesis epoch.
  const daemonHandle = await repo.find<LarDoc>(face.daemonUrl as AutomergeUrl);
  const controlMap = await readControlHome(repo, daemonHandle).then(
    (control) => (control.doc() as LarDoc | undefined)?.tiddlers ?? {},
    (e: unknown) => refuse("lease-unread", `the lease fence reads unread: ${e instanceof Error ? e.message : String(e)}; unlock this browser and retry.`));
  const leasePrefix = leaseEpochPrefix(group);
  const leaseSlotValues: string[] = [];
  for (const [title, entry] of Object.entries(controlMap)) {
    if (!title.startsWith(leasePrefix)) continue;
    const text = tiddlerText(entry);
    if (typeof text === "string") leaseSlotValues.push(text);
  }

  const personaHandle: DocHandle<LarDoc> = await repo.find<LarDoc>(face.personaUrl as AutomergeUrl);
  const records = [personaHandle.doc(), ...(input.extraDocs ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, group));
  const atomSeed = await requireBrowserFaceAtomSeed(idbName, group);
  try {
    const fleetRoot = bare(hex(await ed25519.getPublicKeyAsync(signerSeed)));
    const deviceKey = request.atomKey.toLowerCase();
    // THE BINDING GATE READS THE DYAD'S SHADOW (kapae#/reach): the root binds no device its own fleet board shows set aside,
    // and binds only against a frontier this vessel can verify.
    const fleet = await readLedgeredEdgeBoard({
      repo, scope: fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
      vesselKey: faceAtomKeyFromSeed(atomSeed, group).key, authorityFor: fleetEdgeAuthority(fleetRoot),
    });
    const frontier = readFleetFrontier({
      fleetRoot, board: fleet.handle.doc(), lineage: reading.lineage, seenRaises: fleetRaiseCids(fleet.counted.acts),
      pinned: readFrontierPins(fleet.ledger.doc(), fleetRoot)[FLEET_HAND] ?? null,
    });
    if (frontier.status !== "known") return refuse("fleet-frontier-unknown", `this fleet's signed frontier reads unknown here (${frontier.missing.map((m) => `${m.hand}:${m.why}`).join(", ")}).`);
    const dyad = fleet.readings.get(deviceEdgeId(fleetRoot, deviceKey));
    if (dyad?.stands === true) return refuse("device-set-aside", `that device stands set aside from this fleet (its edge reads ${dyad.verdict}).`);

    const seat = await seatDeviceInFace<DeviceAdmitPayload>({
      personaGroupId: group, reading, issuerAnchor, records, leaseSlotValues, signerSeed, deviceKey,
      // NO HEARTH: this root holder stands no gate, and the joinee's edge binds no place.
      hearthTrueName: "",
      kelEpoch: personaKelChain[personaKelChain.length - 1]!.seq,
      vesselTag: { vesselTag: request.vesselTag, vesselSig: request.vesselSig, wardKey: request.wardKey, wardPop: request.wardPop },
      rootHalf: buildDeviceDelegationRootHalf,
      enrol: ({ boundEpoch, personaActs }) => runDeviceAdmitEdge({
        edgeFrontier: fleetFrontierCarriage(fleet.handle.doc(), fleetRoot),
        operation: { store: new AutomergeDocStore(personaHandle, personaBagIdFor(group)), atomSeed, signedInput: new TextEncoder().encode(JSON.stringify(request)) },
        signerSeed, joineeVerifyingKey: deviceKey,
        personaKelPrefix: face.personaKelPrefix, personaKelChain, personaActs,
        hearthTrueName: "", personaGroupId: group, meshCabalDocIdHex: face.meshCabalDocIdHex, boundEpoch,
        syncUrl: input.syncUrl, islandDocUrl: null,
        // NO DOOR TO KNOCK: a browser's daemon document never crosses, and no gate here would answer a summons.
        hearthDaemonUrl: null,
        personaUrl: face.personaUrl,
      }),
    });
    if (seat.appended.length) personaHandle.change((draft) => { for (const act of seat.appended) writePersonaAct(draft, act as SignedAct); });
    return { edge: seat.payload, reach: { syncUrl: input.syncUrl, islandKind: null, islandScope: null }, hearth: null };
  } finally { atomSeed.fill(0); }
}

// ── The door a vessel host stands over its live vessel ──────────────────────────────────────────

/** One face's overlay as the boot record keeps it (`open-browser-vessel` `BrowserBootstrap.faces`), read for the pins a seat needs. */
interface KeptOverlay { readonly personaGroupId?: string; readonly meshCabalDocIdHex?: string; readonly signerDid?: string; readonly personaKelPrefix?: string; readonly personaUrl?: string; readonly daemonUrl?: string }

/** Every face overlay this browser's boot record holds, by PersonaGroup: the map, and a record's own top-level face. */
async function keptOverlays(idbName: string): Promise<Record<string, KeptOverlay>> {
  const db = await openVesselIdb(idbName);
  try {
    const record = await idbGet<KeptOverlay & { readonly faces?: Readonly<Record<string, KeptOverlay>> }>(db, "bootstrap", "social-bootstrap");
    if (!record) return {};
    return { ...(record.personaGroupId && !record.faces?.[record.personaGroupId] ? { [record.personaGroupId]: record } : {}), ...(record.faces ?? {}) };
  } finally { db.close(); }
}

/**
 * The faces this browser holds a ROOT for, each mapped from its overlay record onto the persona index its root rests at:
 * a face it founded names its own root as the overlay's signer, and a face it joined names another vessel's. The read
 * opens no ward. A face whose root this thread cannot read now (another face worn) stays off the list.
 */
export async function browserRootFaces(idbName = "lares:vessel"): Promise<readonly (BrowserRootFace & { readonly seat: BrowserSeatFace })[]> {
  const out: (BrowserRootFace & { readonly seat: BrowserSeatFace })[] = [];
  const roots = await listBrowserPersonaRoots(idbName).catch(() => [] as number[]);
  for (const [personaGroup, overlay] of Object.entries(await keptOverlays(idbName))) {
    const { meshCabalDocIdHex, signerDid, personaKelPrefix, personaUrl, daemonUrl } = overlay;
    if (!signerDid || !personaKelPrefix || !personaUrl || !daemonUrl || meshCabalDocIdHex === undefined) continue;
    for (const handleIndex of roots) {
      const key = await generateOrLoadBrowserPersonaRoot(idbName, handleIndex, undefined, personaGroup).then((r) => bare(r.verifyingKey), () => null);
      if (key === null || key !== bare(signerDid)) continue;
      out.push({ personaGroup, handleIndex, seat: { personaGroupId: personaGroup, meshCabalDocIdHex, personaKelPrefix, personaUrl, daemonUrl } });
      break;
    }
  }
  return out;
}

/**
 * The root holder's door over a live vessel: what the vessel host answers the page's three verbs with. `askWard` asks the
 * face's unlock by the ceremony door, ONCE per answer; the route it hands back opens the seat and the signature and
 * rests nowhere.
 */
export function browserFleetRootDoor(vessel: {
  readonly idbName: string; readonly repo: Repo;
  /** The island this vessel's persona-KEL board keys on. */
  readonly kelIsland: string;
  readonly askWard: (act: string) => Promise<WardRoute>;
  /** Where a joinee dials to meet this fleet, where the person configured a relay; null otherwise. */
  readonly syncUrl?: string | null;
  /** Further documents carrying the face's signed records (the vessel's secret home), read at each answer. */
  readonly extraDocs?: () => Promise<readonly (LarDoc | null | undefined)[]>;
}): {
  faces(): Promise<readonly { readonly personaGroup: string; readonly label: string }[]>;
  offer(personaGroup: string): Promise<FleetJoinOffer>;
  answer(personaGroup: string, request: unknown): Promise<FleetJoinAnswer>;
} {
  const { idbName } = vessel;
  const held = async (personaGroup: string) => {
    const face = (await browserRootFaces(idbName)).find((f) => f.personaGroup === personaGroup);
    if (!face) throw new BrowserFleetRootRefused("root-absent", "this browser holds no root for that face; the vessel that founded the face answers its fleet joins.");
    return face;
  };
  return {
    faces: async () => (await browserRootFaces(idbName)).map((f) => ({ personaGroup: f.personaGroup, label: `${f.personaGroup.slice(0, 10)}…` })),
    offer: async (personaGroup) => browserFleetJoinOffer({ face: await held(personaGroup), idbName }),
    answer: async (personaGroup, request) => {
      const face = await held(personaGroup);
      // The request reads its nonce before the person is asked anything: a paste that names none never opens the ceremony.
      if (typeof (request as { nonce?: unknown } | null)?.nonce !== "string") throw new BrowserFleetRootRefused("request-malformed", "the request names no nonce.");
      const ward = await vessel.askWard(`answer a fleet join for face ${personaGroup.slice(0, 10)}…`);
      const extraDocs = vessel.extraDocs ? await vessel.extraDocs() : [];
      return browserFleetJoinAnswer({
        face, request, ward, idbName,
        seat: (read, signerSeed) => browserSeatDevice({ repo: vessel.repo, idbName, face: face.seat, kelIsland: vessel.kelIsland, request: read, signerSeed, syncUrl: vessel.syncUrl ?? null, extraDocs }),
      });
    },
  };
}
