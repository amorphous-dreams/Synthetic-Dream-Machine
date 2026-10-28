/** The node store holder's face-scoped intent door. */
import { randomBytes } from "node:crypto";
import type { Repo } from "@automerge/automerge-repo";
import {
  buildAnswer, buildAsks, buildCancel, buildClaim, buildIntent, buildSupersede, buildTakeover,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceAtomKeyFromSeed, faceIntentVerbs,
  faceRecordsOf, intentEntryCid, intentEntryRecordsOfGroup, intentId, intentPaneModel,
  readIntentEntry,
  deviceEdgeId, fleetEdgeAuthority, fleetEdgeBoardDocUrl, fleetRaiseCids, readFleetFrontier, readFrontierPins, FLEET_HAND,
  personaBagIdFor, personaSiblingBagIds, readIntentPlane, signIntentEntry, writeIntentEntry,
  type IntentAudience, type IntentBound, type IntentSigner, type SignedIntentEntry,
} from "@lararium/mesh";
import { makeCatalogAccessor } from "@lararium/tw5";
import { listAnchoredPersonas, loadIdentityAnchors } from "../identity-anchors.js";
import { KeyhiveProvider, InMemoryEventStore } from "@lararium/keyhive";
import { loadVeilArchive } from "../identity-anchors.js";
import { loadFaceAnchorOfGroup } from "../face-anchor-store.js";
import { loadFaceAtomOfGroup } from "../face-atom-store.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";
import { fleetFaceForVessel } from "../fleet-lineage.js";
import { FaceNotNamed } from "../face-selector.js";
import { unlockedFaceOrdinals } from "../custody-seat.js";
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

export interface IntentCommandOptions {
  readonly repo: Repo;
  readonly catalogUrl?: string;
  readonly face?: number;
  readonly action: "issue" | "show" | "ask" | "answer" | "claim" | "takeover" | "release" | "cancel" | "supersede" | "release-root";
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
  readonly deny?: boolean;
}

export async function runIntentCommand(opts: IntentCommandOptions): Promise<Record<string, unknown>> {
  const index = resolveIntentFaceIndex(opts.face, await listAnchoredPersonas(), await unlockedFaceOrdinals());
  const anchors = await loadIdentityAnchors(index);
  if (!anchors) throw new IntentRefused(`face-not-held: h${index}`);
  const group = anchors.personaGroupId;
  const anchor = await loadFaceAnchorOfGroup(group);
  if (!anchor) throw new IntentRefused("face-anchor-absent");
  if (!opts.catalogUrl) throw new IntentRefused("catalog-absent");
  const bag = personaSiblingBagIds(personaBagIdFor(group))?.intents;
  if (!bag) throw new IntentRefused("intent-plane-name-absent");
  const catalog = makeCatalogAccessor(opts.repo, opts.catalogUrl);
  const plane = await catalog.find(bag);
  if (!plane) throw new IntentRefused("intent-plane-unregistered");
  const face = await fleetFaceForVessel(opts.repo, groupRoot(anchors), anchor);
  if (!face) throw new IntentRefused("face-lineage-unreadable");
  const persona = await catalog.find(personaBagIdFor(group));
  const projection = face.project(faceRecordsOf([persona?.doc()], group), group);
  if (!projection.founded || projection.fork) throw new IntentRefused("face-log-unreadable");
  const planeUrl = await catalog.urlOf(bag);
  if (!planeUrl || projection.planes["intents"] !== planeUrl) throw new IntentRefused("intent-plane-unproved: the catalog entry lacks the face's signed plane act");
  const atomSeed = await loadFaceAtomOfGroup(group);
  if (!atomSeed) throw new IntentRefused("face-atom-absent");
  const atom = faceAtomKeyFromSeed(atomSeed, group);
  const signer: IntentSigner = { key: atom.key, sign: atom.sign };
  const records = intentEntryRecordsOfGroup(plane.doc(), group);
  const verbs = faceIntentVerbs();
  let standing: (key: string) => "stands" | "aside" | "unknown" = () => "unknown";
  try {
    const fleetRoot = groupRoot(anchors);
    const board = await readVesselEdgeBoard({ repo: opts.repo, scope: fleetRoot, kind: "fleet",
      boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae", vesselKey: atom.key,
      authorityFor: fleetEdgeAuthority(fleetRoot) });
    const frontier = readFleetFrontier({ fleetRoot, board: board.handle.doc(), lineage: face.lineage,
      seenRaises: fleetRaiseCids(board.counted.acts), pinned: readFrontierPins(board.ledger.doc(), fleetRoot)[FLEET_HAND] ?? null });
    if (frontier.status === "known") standing = (key) => {
      const verdict = board.readings.get(deviceEdgeId(fleetRoot, key));
      return verdict?.stands === true ? "aside" : verdict && verdict.raiseCids.length > 0 ? "unknown" : "stands";
    };
  } catch { /* A board that cannot verify leaves standing unknown. */ }
  const view = () => readIntentPlane({
    group, records, verbs,
    face: { devices: projection.devices, rosterCids: projection.cids,
      admittedAt: new Map(projection.admissions.map(({ deviceKey, cid }) => [deviceKey, cid])), lineage: face.lineage },
    standing,
  });
  if (opts.action === "show") {
    const reading = view(), pane = intentPaneModel(reading);
    return { rows: opts.target ? pane.rows.filter((r) => r.id === opts.target) : pane.rows,
      outcomes: reading.intents.flatMap((state) => state.slots.flatMap((slot) => [slot.winner, ...slot.duplicates].filter((r) => r !== null)
        .map((r) => ({ cause: state.id, signer: r!.entry.signer, winner: slot.winner === r, result: r!.entry.body["result"] })))),
      strayAnswers: reading.strayAnswers.map((r) => r.cid), refused: reading.refused,
      standing: standing(atom.key) };
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
  try {
    switch (opts.action) {
      case "issue": {
        if (!opts.verb) throw new IntentRefused("verb-absent");
        const bound: IntentBound = { ...(opts.voidAt ? { void: opts.voidAt } : {}), ...(opts.through ? { through: opts.through } : {}) };
        const named = opts.to !== undefined || opts.prefer !== undefined || opts.class !== undefined || opts.every === true;
        let args = opts.args, nonce = opts.nonce, audience: IntentAudience;
        if (opts.verb === "face-join") {
          // A joinee asks the face's founding hearth to seat it: the request carries this vessel's own ContactCard and complete
          // device edge, pins the hearth, and takes the joinee's atom key as nonce so a replay keeps one intent id.
          const hearth = projection.admissions[0]?.deviceKey;
          if (!named && !hearth) throw new IntentRefused("hearth-absent: the face's log names no founding hearth; name one with --to");
          audience = named ? intentAudience(opts) : { mode: "pinned", atom: hearth! };
          if (args === undefined) {
            // A ContactCard is not byte-stable across derivations, so a replay returns the request already standing.
            const standing = view().intents.find((state) => state.verb === "face-join" && state.issuer === atom.key && state.status !== "void"
              && !state.slots.some((slot) => (slot.winner?.entry.body["result"] as { admitted?: unknown } | undefined)?.admitted === false));
            if (standing) return { id: standing.id, replayed: true };
            const archive = await loadVeilArchive(group);
            if (!archive) throw new IntentRefused("veil-archive-absent: this vessel holds no ContactCard for the face; re-admit it");
            const khp = new KeyhiveProvider();
            await khp.init({ seed: atomSeed, eventStore: new InMemoryEventStore(), archiveBytes: archive });
            let contactCard: string;
            try { contactCard = new TextDecoder().decode(await khp.contactCard()); } finally { await khp.dispose(); }
            args = { summons: { contactCard, deviceEdge: anchors.deviceEdge } };
          }
          nonce ??= atom.key;
        } else audience = intentAudience(opts);
        entry = await buildIntent({ group, signer, verb: opts.verb, args: args ?? {}, nonce: nonce ?? randomBytes(16).toString("hex"), audience, bound, verbs });
        break;
      }
      case "ask":
        if (!target) throw new IntentRefused("intent-id-absent");
        entry = await buildAsks({ group, signer, intent: intentNamedBy(target), needs: "approval" }); break;
      case "answer":
        if (!target || !opts.executor) throw new IntentRefused("ask-or-executor-absent");
        entry = await buildAnswer({ group, signer, ask: target, executor: opts.executor, verdict: opts.deny ? "deny" : "approve", refs: [target] }); break;
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
      case "cancel": case "supersede": case "release-root": {
        if (!target) throw new IntentRefused("intent-id-absent");
        let seed: Uint8Array;
        try { seed = await loadPersonaGroupRootSeed(index); }
        catch { throw new IntentRefused("root-absent: ask the root's hearth with `lares intent ask <intent-id>`"); }
        const key = await ed25519VerifyingKeyFromSeed(seed);
        if (!face.currentSigner(key)) throw new IntentRefused("root-rotated: ask the root's hearth with `lares intent ask <intent-id>`");
        const rootSigner = { key, sign: ed25519SignerFromSeed(seed) };
        const epoch = face.lineage[face.lineage.length - 1]!.epoch;
        const intent = intentNamedBy(target);
        entry = opts.action === "cancel" ? await buildCancel({ group, signer: rootSigner, intent, epoch })
          : opts.action === "supersede" ? await buildSupersede({ group, signer: rootSigner, intent, epoch })
          : await signIntentEntry({ group, entry: "release", intent, epoch, refs: [] }, rootSigner);
        break;
      }
    }
  } catch (err) {
    if (err instanceof IntentRefused || err instanceof FaceNotNamed) throw err;
    throw new IntentRefused((err as Error).message);
  }
  plane.change((draft) => writeIntentEntry(draft, entry));
  await opts.repo.flush();
  return { cid: intentEntryCid(entry), ...(opts.action === "issue" ? { id: intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }) } : {}) };
}

function groupRoot(anchors: { readonly deviceEdge?: { readonly personaRootDid: string } | null }): string {
  if (!anchors.deviceEdge) throw new IntentRefused("fleet-root-absent");
  return anchors.deviceEdge.personaRootDid;
}
