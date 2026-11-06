/** The node store holder's face-scoped intent door. */
import type { WardCredential } from "../ward-credential.js";
import { CustodyLocked } from "../custody-holder.js";
import { randomBytes } from "node:crypto";
import type { Repo } from "@automerge/automerge-repo";
import {
  buildAnswer, buildAsks, buildCancel, buildClaim, buildDelegation, buildDelegationRevoke, buildIntent, buildSupersede, buildTakeover,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceAtomKeyFromSeed, faceIntentVerbs,
  faceRecordsOf, intentEntryCid, intentEntryRecordsOfGroup, intentAdmissionRecordsOfGroup, intentId, intentPaneModel,
  readIntentEntry,
  deviceEdgeId, fleetEdgeAuthority, fleetEdgeBoardDocUrl, fleetRaiseCids, readFleetFrontier, readFrontierPins, FLEET_HAND,
  personaBagIdFor, personaSiblingBagIds, readIntentPlane, WARD_COSIGN_VERBS, intentPlaneCosignPort, faceRosterForIntents, type WardCosignPort, personaKelChainForPrefix, readFace, materializeSharedLarDoc, edgeLedgerDocUrl, replicaHeads, signIntentEntry, writeIntentEntry,
  WardRefused, type PersonaKelEvent, type DelegationCite, type DelegationPolicy, type IntentAudience, type IntentBound, type IntentSigner, type SignedIntentEntry,
} from "@lararium/mesh";
import { makeCatalogAccessor } from "@lararium/tw5";
import { listAnchoredPersonas, loadIdentityAnchors } from "../identity-anchors.js";
import { KeyhiveProvider, InMemoryEventStore, faceJoinNonce, ownSummonsOf, witnessed, watchHandles, type AuthorityAcquisition } from "@lararium/keyhive";
import { loadVeilArchive } from "../identity-anchors.js";
import { loadFaceAnchorOfGroup } from "../face-anchor-store.js";
import { loadFaceAtomOfGroup } from "../face-atom-store.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";
import { fleetFaceChainForVessel } from "../fleet-lineage.js";
import { FaceNotNamed } from "../face-selector.js";
import { unlockedFaceOrdinals, withWardKeyCustody } from "../custody-seat.js";
import { readVesselEdgeBoard } from "../edge-board.js";

export class IntentRefused extends Error { override name = "IntentRefused"; }
/** The named face, else the ONE face standing open; `held` (the open faces holding anchors) gates the choice and never makes it. */
export function resolveIntentFaceIndex(named: number | undefined, held: readonly number[], open: readonly number[]): number {
  if (named === undefined) {
    if (open.length !== 1) throw new FaceNotNamed(`FaceNotNamed: name --face N for ${open.map((n) => `h${n}`).join(", ") || "a face this vessel holds"}`);
    named = open[0]!;
  }
  if (!Number.isSafeInteger(named) || named < 0 || !held.includes(named)) throw new IntentRefused(`face-not-held: h${named}`);
  return named;
}
export function intentAudience(input: { to?: string; prefer?: string; class?: string; every?: boolean }): IntentAudience {
  const selected = [input.to !== undefined, input.prefer !== undefined, input.class !== undefined, input.every === true].filter(Boolean).length;
  if (selected !== 1) throw new IntentRefused("audience: name exactly one of --to, --prefer, --class, --every");
  if (input.to) return { mode: "pinned", atom: input.to };
  if (input.prefer) return { mode: "prefer", atoms: input.prefer.split(",").map((s) => s.trim()) };
  if (input.class) return { mode: "class", capability: input.class };
  return { mode: "every" };
}
export function intentDelegationCite(raw: string): DelegationCite {
  const match = /^(roster|frontier|control):([0-9a-f]{64})$/.exec(raw);
  if (!match) throw new IntentRefused("delegation-cite-malformed");
  return { [match[1]!]: match[2]! } as DelegationCite;
}

/** What an answerer reads before signing, the way the edge co-sign door reads a partial: the act an ask names, taken from the
 *  fold's own verified bytes. Null where no ask under that cid stands. */
export function askShown(view: ReturnType<typeof readIntentPlane>, askCid: string): { readonly intent: string; readonly verb: string; readonly issuer: string; readonly askedBy: string; readonly detail: unknown; readonly cosign: boolean } | null {
  for (const state of view.intents) {
    const ask = state.asks.find((q) => q.cid === askCid);
    if (ask) return { intent: state.id, verb: state.verb, issuer: state.issuer, askedBy: ask.entry.signer, detail: ask.entry.body["detail"] ?? null, cosign: WARD_COSIGN_VERBS.includes(state.verb) };
  }
  return null;
}

/** The answer door's refusal, or null where it may sign: for a ward verb it signs only what the plane counts, an answer to an ask
 *  the issuer signed, from a device other than the issuer, an approve naming the issuer as executor. */
export function answerRefusal(asked: ReturnType<typeof askShown>, signer: string, executor: string, deny: boolean): string | null {
  if (!asked?.cosign) return null;
  if (asked.issuer === signer) return "self-answer: a ward act takes another device of the face";
  if (asked.askedBy !== asked.issuer) return "ask-signer: a ward act counts an answer only to its issuer's own ask";
  if (!deny && executor.toLowerCase() !== asked.issuer) return "executor-mismatch: a ward act's approve names its issuer as executor";
  return null;
}

/**
 * Sign one answer to an ask. The door signs no ward answer the plane would count as nothing: it refuses before it signs.
 *
 * THE CO-SIGNER OPENS ITS WARD (seat-harness#/the-swarm-slices): an approve of a ward act signs only inside a fresh unlock of this
 * device's OWN ward for the face, opened from its own human route for this one act and zeroed when the act settles; a passkey never
 * opens it. A joinee holds no face root, yet its ward stands: the join request founds the face's custody, and that founding binds
 * the ward beside it. A deny releases nothing and an answer to any other ask is no ward act, so neither asks a route.
 */
export async function signIntentAnswer(input: {
  readonly group: string; readonly signer: IntentSigner; readonly ask: string; readonly executor: string; readonly deny: boolean;
  readonly asked: ReturnType<typeof askShown>;
  /** The face's handle index on this vessel, and the act's ward route. */
  readonly face: number; readonly ward?: WardCredential;
}): Promise<SignedIntentEntry> {
  const refusal = answerRefusal(input.asked, input.signer.key, input.executor, input.deny);
  if (refusal) throw new IntentRefused(refusal);
  const sign = () => buildAnswer({ group: input.group, signer: input.signer, ask: input.ask, executor: input.executor, verdict: input.deny ? "deny" : "approve", refs: [input.ask] });
  if (!input.asked?.cosign || input.deny) return sign();
  return withWardKeyCustody({ ordinal: input.face }, input.ward, () => sign(), `the co-sign approve of ${input.asked.verb}`);
}

export interface IntentCommandOptions {
  /** The face's ward route for this act (seat-harness#/the-ward): the root signs only under a fresh ward unlock. */
  readonly ward?: WardCredential;
  readonly repo: Repo;
  readonly catalogUrl?: string;
  readonly face?: number;
  readonly action: "issue" | "show" | "ask" | "answer" | "claim" | "takeover" | "release" | "cancel" | "supersede" | "release-root" | "delegate" | "delegate-revoke" | "delegations";
  readonly target?: string;
  readonly verb?: string;
  readonly args?: unknown;
  readonly nonce?: string;
  readonly to?: string;
  readonly prefer?: string;
  readonly class?: string;
  readonly every?: boolean;
  readonly voidAt?: string;
  readonly through?: string;
  readonly executor?: string;
  /** `ask`: the digest of the act a co-sign ask names (act, face, wiki, head). */
  readonly detail?: string;
  readonly deny?: boolean;
  readonly agent?: string;
  readonly prefix?: string;
  readonly policy?: unknown;
  readonly asOf?: string;
  readonly until?: string;
}

/**
 * The face's signed admission fold and its live readers, without its intents plane: the anchors, the KEL-backed lineage, the persona
 * plane's projection, this vessel's face atom and the fleet's standing and frontier. A co-sign gate reads its device count here, so a
 * one-device face acts on its unlock alone even where its intents plane cannot load.
 */
export async function loadFaceFold(repo: Repo, catalogUrl: string | undefined, selector: { index?: number | undefined } | { group: string }) {
  const held = await listAnchoredPersonas();
  let named: number | undefined;
  if ("group" in selector) {
    for (const candidate of held) {
      try { if ((await loadIdentityAnchors(candidate))?.personaGroupId === selector.group) { named = candidate; break; } }
      catch (error) { if (error instanceof CustodyLocked) throw error; }
    }
    if (named === undefined) throw new IntentRefused("face-not-held");
  } else named = selector.index;
  const index = resolveIntentFaceIndex(named, held, await unlockedFaceOrdinals());
  const anchors = await loadIdentityAnchors(index);
  if (!anchors) throw new IntentRefused(`face-not-held: h${index}`);
  const group = anchors.personaGroupId;
  const anchor = await loadFaceAnchorOfGroup(group);
  if (!anchor) throw new IntentRefused("face-anchor-absent");
  if (!catalogUrl) throw new IntentRefused("catalog-absent");
  const catalog = makeCatalogAccessor(repo, catalogUrl);
  const faceSource = await fleetFaceChainForVessel(repo, groupRoot(anchors), anchor);
  if (!faceSource) throw new IntentRefused("face-lineage-unreadable");
  // THE LOADED FACE HANDS BACK LIVE READERS, never what stood when the load returned: the chain reads the KEL board's replica at
  // each call, and the fleet board's verified fold (standings and the held frontier) rests under a witness over every document it
  // reads, so a door deciding later reads a rotation, a raise or a frontier merged after this load.
  const { face, board: kelBoard, prefix: kelPrefix } = faceSource;
  const kelChain = (): readonly PersonaKelEvent[] | null => personaKelChainForPrefix(kelBoard.doc(), kelPrefix);
  const persona = await catalog.find(personaBagIdFor(group));
  const projection = face.project(faceRecordsOf([persona?.doc()], group), group);
  if (!projection.founded || projection.fork) throw new IntentRefused("face-log-unreadable");
  const atomSeed = await loadFaceAtomOfGroup(group);
  if (!atomSeed) throw new IntentRefused("face-atom-absent");
  const atom = faceAtomKeyFromSeed(atomSeed, group);
  const signer: IntentSigner = { key: atom.key, sign: atom.sign };
  const verbs = faceIntentVerbs();
  const fleetRoot = groupRoot(anchors);
  const fleetRead = async (): Promise<{ readonly standing: (key: string) => "stands" | "aside" | "unknown"; readonly heldFrontiers: ReadonlySet<string> } | null> => {
    const lineage = readFace(kelChain() ?? undefined, anchor)?.lineage;
    if (!lineage) return null;
    const board = await readVesselEdgeBoard({ repo, scope: fleetRoot, kind: "fleet",
      boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae", vesselKey: atom.key,
      authorityFor: fleetEdgeAuthority(fleetRoot) });
    const frontier = readFleetFrontier({ fleetRoot, board: board.handle.doc(), lineage,
      seenRaises: fleetRaiseCids(board.counted.acts), pinned: readFrontierPins(board.ledger.doc(), fleetRoot)[FLEET_HAND] ?? null });
    if (frontier.status !== "known") return null;
    return { heldFrontiers: new Set([frontier.asOf[FLEET_HAND]?.cid].filter((cid): cid is string => cid !== undefined)),
      standing: (key) => {
        const verdict = board.readings.get(deviceEdgeId(fleetRoot, key));
        return verdict?.stands === true ? "aside" : verdict && verdict.raiseCids.length > 0 ? "unknown" : "stands";
      } };
  };
  let fleet: { readonly now: () => Awaited<ReturnType<typeof fleetRead>> | null; readonly acquisition: AuthorityAcquisition } | null = null;
  try {
    const [edgeBoard, edgeLedger] = [await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae"), await materializeSharedLarDoc(repo, edgeLedgerDocUrl(atom.key), "ledger:edge")];
    fleet = witnessed(fleetRead, () => [edgeBoard, edgeLedger, kelBoard].map((h) => replicaHeads(h).join(",")).join("|"), { watch: watchHandles([edgeBoard, edgeLedger, kelBoard]) });
    await fleet.acquisition.acquire(new Set());
  } catch { fleet = null; /* A board that cannot verify leaves standing unknown and no frontier held. */ }
  const standing = (key: string): "stands" | "aside" | "unknown" => fleet?.now()?.standing(key) ?? "unknown";
  const heldFrontiers = (): ReadonlySet<string> => fleet?.now()?.heldFrontiers ?? new Set<string>();
  // The fleet's signed frontier as the witness reads it now: a board that cannot verify, or a frontier that does not read known.
  const frontier = (): "known" | "unknown" => (fleet?.now() ? "known" : "unknown");
  const acquisition = fleet?.acquisition;
  if ("group" in selector && group !== selector.group) throw new IntentRefused("face-not-held");
  return { group, index, anchors, anchor, face, kelChain, projection, catalog, personaPlane: persona, standing, heldFrontiers, frontier, acquisition, verbs, atom, atomSeed, signer };
}
export type FaceFold = Awaited<ReturnType<typeof loadFaceFold>>;

/** The face's intents plane, proved against the fold's signed plane act. */
export async function loadFacePlane(fold: FaceFold) {
  const bag = personaSiblingBagIds(personaBagIdFor(fold.group))?.intents;
  if (!bag) throw new IntentRefused("intent-plane-name-absent");
  const plane = await fold.catalog.find(bag);
  if (!plane) throw new IntentRefused("intent-plane-unregistered");
  const planeUrl = await fold.catalog.urlOf(bag);
  if (!planeUrl || fold.projection.planes["intents"] !== planeUrl) throw new IntentRefused("intent-plane-unproved: the catalog entry lacks the face's signed plane act");
  return plane;
}

export async function loadIntentFace(repo: Repo, catalogUrl: string | undefined, selector: { index?: number | undefined } | { group: string }) {
  const fold = await loadFaceFold(repo, catalogUrl, selector);
  return { ...fold, plane: await loadFacePlane(fold) };
}

/**
 * The face's intent plane as a ward act's co-sign gate reads it (seat-harness#/the-swarm-slices): the loaded face's own plane (or
 * none, where it did not load), roster, fleet standing and frontier, read fresh at each call, and its atom as the act's issuer.
 */
export function nodeWardCosignPort(repo: Repo, loaded: Pick<FaceFold, "group" | "projection" | "face" | "standing" | "heldFrontiers" | "frontier" | "verbs" | "signer"> & { readonly plane: Awaited<ReturnType<typeof loadFacePlane>> | null }): WardCosignPort {
  const { group, plane, projection, face, standing, heldFrontiers, frontier, verbs, signer } = loaded;
  return intentPlaneCosignPort({ group, requester: signer, verbs, plane, flush: () => repo.flush(),
    face: () => faceRosterForIntents(projection, face.lineage), standing, heldFrontiers, frontier });
}

/** The gate's port over a loaded fold: the intents plane loads at the act, and a plane that cannot load leaves the port planeless. */
export async function nodeWardCosignPortOf(repo: Repo, fold: FaceFold): Promise<WardCosignPort> {
  let plane: Awaited<ReturnType<typeof loadFacePlane>> | null = null;
  try { plane = await loadFacePlane(fold); }
  catch (e) { if (!(e instanceof IntentRefused)) throw e; }
  return nodeWardCosignPort(repo, { ...fold, plane });
}

/** The gate's port loaded at the act: a fold that cannot be read refuses `ward-cosign-fold-unread` by name. */
export async function loadNodeWardCosignPort(repo: Repo, catalogUrl: string | undefined, selector: { index?: number | undefined } | { group: string }): Promise<WardCosignPort> {
  let fold: FaceFold;
  try { fold = await loadFaceFold(repo, catalogUrl, selector); }
  catch (e) { if (e instanceof IntentRefused) throw new WardRefused("ward-cosign-fold-unread", e.message); throw e; }
  return nodeWardCosignPortOf(repo, fold);
}

export async function runIntentCommand(opts: IntentCommandOptions): Promise<Record<string, unknown>> {
  const { group, index, anchors, face, projection, plane, standing, heldFrontiers, verbs, atom, atomSeed, signer } = await loadIntentFace(opts.repo, opts.catalogUrl, { index: opts.face });
  const records = intentEntryRecordsOfGroup(plane.doc(), group);
  const view = () => readIntentPlane({
    group, records, verbs, heldFrontiers: heldFrontiers(), admissions: intentAdmissionRecordsOfGroup(plane.doc(), group),
    face: { devices: projection.devices, rosterCids: projection.cids,
      admittedAt: new Map(projection.admissions.map(({ deviceKey, cid }) => [deviceKey, cid])), lineage: face.lineage },
    standing,
  });
  if (opts.action === "show" || opts.action === "delegations") {
    const reading = view(), pane = intentPaneModel(reading);
    if (opts.action === "delegations") return { delegations: reading.delegations };
    return { rows: opts.target ? pane.rows.filter((r) => r.id === opts.target) : pane.rows,
      outcomes: reading.intents.flatMap((state) => state.slots.flatMap((slot) => [slot.winner, ...slot.duplicates].filter((r) => r !== null)
        .map((r) => ({ cause: state.id, signer: r!.entry.signer, winner: slot.winner === r, result: r!.entry.body["result"] })))),
      strayAnswers: reading.strayAnswers.map((r) => r.cid), refused: reading.refused,
      standing: standing(atom.key), delegations: reading.delegations };
  }
  const target = opts.target;
  const intentNamedBy = (name: string): string => {
    const states = view().intents;
    if (states.some((state) => state.id === name)) return name;
    const claimOwner = states.find((state) => state.claims.some((claim) => claim.cid === name));
    if (claimOwner) return claimOwner.id;
    for (const raw of records) {
      const read = readIntentEntry(raw, { group, authorize: () => true });
      if (!read.ok || read.cid !== name || read.entry.body.entry !== "intent") continue;
      const id = intentId(read.entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
      if (states.some((state) => state.id === id)) return id;
    }
    return name;
  };
  let entry: SignedIntentEntry;
  let shown: ReturnType<typeof askShown> = null;
  try {
    switch (opts.action) {
      case "issue": {
        if (!opts.verb) throw new IntentRefused("verb-absent");
        const bound: IntentBound = { ...(opts.voidAt ? { void: opts.voidAt } : {}), ...(opts.through ? { through: opts.through } : {}) };
        const named = opts.to !== undefined || opts.prefer !== undefined || opts.class !== undefined || opts.every === true;
        let args = opts.args, nonce = opts.nonce, audience: IntentAudience;
        if (opts.verb === "face-join") {
          // A joinee asks the face's founding hearth to seat it: the request carries this vessel's own ContactCard and complete
          // device edge, pins the hearth, and takes the face-join nonce (the atom and the pin) so a replay keeps one intent id.
          const hearth = projection.admissions[0]?.deviceKey;
          if (!named && !hearth) throw new IntentRefused("hearth-absent: the face's log names no founding hearth; name one with --to");
          audience = named ? intentAudience(opts) : { mode: "pinned", atom: hearth! };
          if (args === undefined) {
            // A ContactCard is not byte-stable across derivations, so a replay returns the request already standing.
            // The summons standing for THIS pin alone (`ownSummonsOf`, the leaf's own rule): one pinned elsewhere is no replay.
            const standing = ownSummonsOf(view(), atom.key, audience.mode === "pinned" ? audience.atom : undefined);
            if (standing) return { id: standing.id, replayed: true };
            const archive = await loadVeilArchive(group);
            if (!archive) throw new IntentRefused("veil-archive-absent: this vessel holds no ContactCard for the face; re-admit it");
            const khp = new KeyhiveProvider();
            await khp.init({ seed: atomSeed, eventStore: new InMemoryEventStore(), archiveBytes: archive });
            let contactCard: string;
            try { contactCard = new TextDecoder().decode(await khp.contactCard()); } finally { await khp.dispose(); }
            args = { summons: { contactCard, deviceEdge: anchors.deviceEdge } };
          }
          nonce ??= faceJoinNonce(atom.key, audience);
        } else audience = intentAudience(opts);
        entry = await buildIntent({ group, signer, verb: opts.verb, args: args ?? {}, nonce: nonce ?? randomBytes(16).toString("hex"), audience, bound, verbs });
        break;
      }
      case "ask":
        if (!target) throw new IntentRefused("intent-id-absent");
        entry = await buildAsks({ group, signer, intent: intentNamedBy(target), needs: "approval", ...(opts.detail !== undefined ? { detail: opts.detail } : {}) }); break;
      case "answer": {
        if (!target || !opts.executor) throw new IntentRefused("ask-or-executor-absent");
        const asked = askShown(view(), target);
        shown = asked;
        entry = await signIntentAnswer({ group, signer, ask: target, executor: opts.executor, deny: !!opts.deny, asked, face: index, ...(opts.ward ? { ward: opts.ward } : {}) }); break;
      }
      case "claim":
        if (!target) throw new IntentRefused("intent-id-absent");
        entry = await buildClaim({ group, signer, intent: intentNamedBy(target) }); break;
      case "takeover":
        if (!target) throw new IntentRefused("claim-cid-absent");
        entry = await buildTakeover({ group, signer, claim: target, refs: [target] }); break;
      case "release": {
        if (!target) throw new IntentRefused("intent-id-absent");
        const state = view().intents.find((s) => s.id === intentNamedBy(target));
        if (!state?.claim || state.claim.entry.signer !== atom.key) throw new IntentRefused("not-claimant");
        entry = await signIntentEntry({ group, entry: "release", intent: state.id, claim: state.claim.cid, refs: [state.claim.cid] }, signer);
        break;
      }
      case "cancel": case "supersede": case "release-root": case "delegate": case "delegate-revoke": {
        if (opts.action !== "delegate" && !target) throw new IntentRefused("intent-id-absent");
        let seed: Uint8Array;
        try { seed = await loadPersonaGroupRootSeed(index, opts.ward); }
        catch (err) {
          // A root act is a ward act: a missing or wrong route names itself, never as an absent root.
          if (err instanceof Error && /^ward-/.test(err.message)) throw new IntentRefused(err.message);
          throw new IntentRefused("root-absent: ask the root's hearth with `lares intent ask <intent-id>`");
        }
        // THE ROOT SEED LIVES FOR THIS ONE ACT: it zero-fills once the entry is signed, whatever happened (seat-harness#/the-ward).
        try {
        const key = await ed25519VerifyingKeyFromSeed(seed);
        if (!face.currentSigner(key)) throw new IntentRefused("root-rotated: ask the root's hearth with `lares intent ask <intent-id>`");
        const rootSigner = { key, sign: ed25519SignerFromSeed(seed) };
        const epoch = face.lineage[face.lineage.length - 1]!.epoch;
        if (opts.action === "delegate") {
          if (!opts.agent || !opts.prefix || opts.policy === undefined) throw new IntentRefused("delegation-shape");
          let policy: DelegationPolicy;
          try { policy = (typeof opts.policy === "string" ? JSON.parse(opts.policy) : opts.policy) as DelegationPolicy; }
          catch { throw new IntentRefused("delegation-shape"); }
          entry = await buildDelegation({ group, signer: rootSigner, epoch, agent: opts.agent, prefix: opts.prefix, policy,
            bound: { ...(opts.asOf ? { asOf: intentDelegationCite(opts.asOf) } : {}), ...(opts.until ? { until: intentDelegationCite(opts.until) } : {}) }, nonce: opts.nonce ?? randomBytes(16).toString("hex") });
        } else if (opts.action === "delegate-revoke") entry = await buildDelegationRevoke({ group, signer: rootSigner, epoch, delegation: target! });
        else {
          const intent = intentNamedBy(target!);
          entry = opts.action === "cancel" ? await buildCancel({ group, signer: rootSigner, intent, epoch })
            : opts.action === "supersede" ? await buildSupersede({ group, signer: rootSigner, intent, epoch })
            : await signIntentEntry({ group, entry: "release", intent, epoch, refs: [] }, rootSigner);
        }
        } finally { seed.fill(0); }
        break;
      }
    }
  } catch (err) {
    if (err instanceof IntentRefused || err instanceof FaceNotNamed) throw err;
    throw new IntentRefused((err as Error).message);
  }
  plane.change((draft) => writeIntentEntry(draft, entry));
  await opts.repo.flush();
  return { cid: intentEntryCid(entry), ...(opts.action === "answer" && shown ? { shown } : {}), ...(opts.action === "issue" ? { id: intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }) } : {}) };
}

function groupRoot(anchors: { readonly deviceEdge?: { readonly personaRootDid: string } | null }): string {
  if (!anchors.deviceEdge) throw new IntentRefused("fleet-root-absent");
  return anchors.deviceEdge.personaRootDid;
}
