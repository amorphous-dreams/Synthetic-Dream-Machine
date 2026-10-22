/**
 * store-door-verbs — the store's one door table: every command that touches the vessel's store, as one row.
 *
 * ONE STORE, ONE HOLDER. While a vessel stands, its process holds the store: the Repo its peers sync, the walk
 * records its walk client writes, the hosting state its sorter reads. A command that opened a second Repo beside
 * it changed bytes the running replica never saw — a ban sat on disk while the gate kept answering the banned
 * nym, a roll's act sat on disk while the walkers' next dial read the replica without it. So each command routes
 * its verb here over the local socket whenever the vessel stands, and its row runs against the live holder; with
 * no vessel standing, the command runs the same row itself through `storeDoorDirect`, which holds the store for
 * the moment of the act (`ownedStore`). One table, two holders, never both at once.
 *
 *   nexus-kapae · nexus-kapae-list               the antigen board (`commands/nexus-kapae`)
 *   nexus-contract · nexus-roll-anchor · nexus-members-list
 *                                                the carriage board's writer, its roll anchor and its reader
 *                                                (`commands/nexus-contract`)
 *   nexus-cabal-act · nexus-cabal-cosign · nexus-cabal-standing
 *                                                the seat quorum's admission into the Kahu cabal, on the
 *                                                carriage board under its own prefix (`commands/nexus-cabal`)
 *   nexus-release                                the steward's seal of a floor release, with the cabal's approval of the
 *                                                manifest's exact bytes, landed on the crossroads board (`commands/nexus-release`)
 *   nexus-posture                                the per-Nexus federation posture joint (`nexus-doc`)
 *   nexus-admit-take                             a carried admit bundle's offline take + live re-present
 *                                                (`admit-bundle`)
 *   nexus-carry-take                             a carried carry bundle onto this place's own board replica
 *                                                (`carry-bundle`: a herm's explicit join)
 *   edge-kapae                                   the edge shadow board (`commands/edge-kapae-cmd`)
 *   edge-seat-facts · edge-seat-marks            the key side's facts and marks (`commands/edge-seats`)
 *   edge-partial · edge-cosign                   a quorum edge act between seats on separate vessels (`commands/edge-cosign`)
 *   cabal-vouch · cabal-join                     the vouch board (`commands/cabal-vouch`, `commands/cabal-join`)
 *   cabal-face                                   the worn face's key in one realm (`commands/cabal-face`)
 *   fleet-join-offer · fleet-join-answer         the root holder's half of the fleet-join door (`commands/fleet-join`)
 *   handle-publish · handle-burn · handle-rotate · handle-attest
 *                                                the WHO board (`commands/handle`)
 *   persona-new                                  a face onto a standing place (`commands/init`)
 *   persona-kel-head                             a persona-KEL head off the local board (`local-persona-kel`)
 *   nexus-publish                                the Crossroads offering (`commands/nexus-publish`)
 *   nexus-offering-inspect                       one carried offering, read off the Crossroads board
 *                                                (`commands/nexus-offering-inspect`)
 *   raise-sign                                   a raise grant off the carriage board (`commands/raise-sign`)
 *
 * A REFUSAL is an answer, never a fault: it comes back as `{ refused, refusal }` (the door's words, and the name
 * the row refuses under), so the CLI names it exactly as the direct path does. A row hands back what its command prints; the command's own process prints it, so a row that ran
 * inside the standing vessel never speaks into the vessel's log, and no secret rides a row's answer.
 *
 * ONE AFTER-WRITE HOOK, not a refresh VERB. `onRolled` is this door's one hook for "something just landed on a
 * board a running vessel's live readings depend on". Every row that writes a board or a practice joint — a host
 * roll, a kapae, a carriage admit/revoke/carry/uncarry, a posture flip, a taken admit bundle — calls it after its
 * write counts. The standing vessel supplies the one closure that re-folds its live holders, re-verdicts its
 * Repo and re-presents its dial (`open-node-vessel.ts`); `storeDoorDirect` supplies none, because no live reading
 * stands to refold — the next boot's own cold read picks up what a direct act wrote.
 *
 * THE HOOK MAY RUN LONG, SO EVERY ROW AWAITS IT UNDER A BUDGET. `onRolled` now answers synchronously OR through
 * a promise — the refold itself still runs exactly once (`open-node-vessel.ts` serializes it), but a row that
 * fires it waits only up to `ON_ROLLED_BUDGET_MS` for a truthful answer. Past the budget the refold keeps
 * running in the background (never cancelled, never thrown into the row), and the row reports it `"pending"`
 * instead of guessing. A row that reads a boolean off this return, never off whether the hook merely EXISTS,
 * can never claim a live re-presentation it has no evidence for.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { Repo } from "@automerge/automerge-repo";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VerbReactor } from "@lararium/tw5";
import type { HandleClaim } from "@lararium/mesh";
import { federationPostureFromDoc, readNexusActPartial, type FederationPosture, type CarriageAction, type KahuQuorumSeats } from "@lararium/mesh";
import { runCabalAct, runCabalCosign, runCabalStanding, NexusCabalError } from "./commands/nexus-cabal.js";
import { runFloorRelease } from "./commands/nexus-release.js";
import { casDirForStorage } from "./node-cas.js";
import { runNexusKapae, runNexusKapaeList, runNexusKapaeOpen, runNexusKapaePartial, NexusKapaeError } from "./commands/nexus-kapae.js";
import { runNexusContract, runNexusContractOpen, runNexusContractPartial, runNexusRollAnchor, runNexusRollAnchorOpen, runNexusRollAnchorPartial, runEdgeRollAnchorOpen, runEdgeRollAnchorPartial, runEdgeRollAnchorStanding, runNexusRollPriorAnchorCheck, runNexusMembersList, NexusContractError } from "./commands/nexus-contract.js";
import { runEdgeKapae, EdgeKapaeError } from "./commands/edge-kapae-cmd.js";
import { runEdgeRollAnchors, EdgeRollAnchorError } from "./commands/edge-roll-anchor.js";
import { runEdgeSeatFacts, runEdgeSeatMarks, EdgeSeatError } from "./commands/edge-seats.js";
import { runEdgePartial, runEdgeCosign, EdgeCosignError } from "./commands/edge-cosign.js";
import { runCabalVouch, CabalVouchError } from "./commands/cabal-vouch.js";
import { runCabalFace, CabalFaceError } from "./commands/cabal-face.js";
import { runCabalJoin, CabalJoinError } from "./commands/cabal-join.js";
import { runFleetJoinAnswer, runFleetJoinOffer, FleetJoinRefused } from "./commands/fleet-join.js";
import { runHandlePublish, runHandleBurn, runHandleRotate, runHandleAttest } from "./commands/handle.js";
import { runFoundTheFace } from "./commands/init.js";
import { runNexusPublishPlugins, NexusPublishError } from "./commands/nexus-publish.js";
import { runNexusInspectOffering, NexusOfferingInspectError } from "./commands/nexus-offering-inspect.js";
import { runRaiseSign, RaiseSignError } from "./commands/raise-sign.js";
import { makeLocalPersonaKelHeadAndSeqResolver } from "./local-persona-kel.js";
import { ownedStore } from "./owned-store.js";
import { larDataDir } from "./vessel-paths.js";
import { readNexusDoc, writeNexusPractice } from "./nexus-doc.js";
import { takeAdmitBundle, AdmitBundleError } from "./admit-bundle.js";
import { takeCarryBundle, CarryBundleError } from "./carry-bundle.js";
import { listPersonaRoots, loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { listAnchoredPersonas } from "./identity-anchors.js";

/** A place that lit no face stands as a herm: it holds no persona root and anchors no face (a joinee anchors one). */
async function standsAsHerm(): Promise<boolean> {
  return (await listPersonaRoots()).length === 0 && (await listAnchoredPersonas()).length === 0;
}

/** What the rows read off their holder. */
export interface StoreDoorDeps {
  readonly storageDir: string;
  readonly sealHome:   string;
  /** The store's one holder — the running vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
  /** The catalog named by the held store; absent when the store names none. */
  readonly catalogUrl?: string | undefined;
  /**
   * A write just counted. `nexusAid` names the Nexus whose reading a row moved (a carried charter's take); every other caller
   * passes nothing. Absent on `storeDoorDirect` — a direct act has no live reading to refold.
   *
   * A caller MAY resolve `true` to claim it re-presented this write live, synchronously or through a promise.
   * Any other settlement (`false`, plain `void`, or a promise that resolves either) claims NOTHING about the
   * outcome. Every row that fires this awaits it through `awaitOnRolled` (below), which bounds the wait by
   * `ON_ROLLED_BUDGET_MS` and never lets a slow or rejected refold throw through the row that triggered it.
   */
  readonly onRolled?:  (nexusAid?: string) => boolean | void | Promise<boolean | void>;
  /**
   * Ask the daemon island's `seat-duties` verb as the vessel, with the facts handed in: the standing vessel's main
   * thread signs the ask (`askSeatDuties`). Absent where no sovereign vessel stands: a direct act holds no
   * island, and a floor's island holds no veil.
   */
  readonly seatDuties?: (facts: { readonly fleetRoot: string; readonly acts: readonly unknown[]; readonly rolled: readonly string[] }) => Promise<Record<string, unknown>>;
}

/** How long a row waits for `onRolled`'s own truthful answer before reporting the refold `"pending"`. The
 *  refold itself is NEVER cancelled past this — only the row's own answer stops waiting on it. */
export const ON_ROLLED_BUDGET_MS = Number(process.env["LAR_ON_ROLLED_BUDGET_MS"] ?? 3_000);

/**
 * Await `onRolled`'s return under `ON_ROLLED_BUDGET_MS`. A sync return (or no hook at all) settles at once;
 * a promise that resolves `true` within the budget reads `true`; anything else that resolves within the
 * budget (including a throw) reads `false`; a promise still unsettled past the budget reads `"pending"` — the
 * hook keeps running, this call simply stops waiting on it and never lets its eventual rejection surface here.
 */
export async function awaitOnRolled(call: boolean | void | Promise<boolean | void>): Promise<boolean | "pending"> {
  if (!(call instanceof Promise)) return call === true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Promise<"pending">((resolve) => { timer = setTimeout(() => resolve("pending"), ON_ROLLED_BUDGET_MS); });
  try {
    const settled = await Promise.race([call.then((v) => v === true).catch(() => false), pending]);
    return settled;
  } finally {
    clearTimeout(timer);
    // The refold keeps running even once we stop waiting on it; a late rejection must never become an
    // unhandled rejection just because this call lost interest in its answer.
    call.catch(() => { /* already reported, or never asked for — either way, swallowed here */ });
  }
}

/** The door's rows, by name — each command's routed call names exactly one of these. */
export const STORE_DOOR_VERBS = [
  "nexus-kapae", "nexus-kapae-list", "nexus-kapae-open", "nexus-kapae-partial", "nexus-contract", "nexus-contract-open", "nexus-contract-partial", "nexus-roll-anchor", "nexus-roll-anchor-open", "nexus-roll-anchor-partial", "nexus-roll-anchor-edge-open", "nexus-roll-prior-anchor", "nexus-members-list",
  "nexus-cabal-act", "nexus-cabal-cosign", "nexus-cabal-standing", "nexus-release",
  "nexus-posture", "nexus-admit-take", "nexus-carry-take", "seal-home-refold",
  "edge-kapae", "edge-seat-facts", "edge-seat-duties", "edge-seat-marks", "edge-partial", "edge-cosign", "cabal-vouch", "cabal-join", "cabal-face",
  "fleet-join-offer", "fleet-join-answer",
  "handle-publish", "handle-burn", "handle-rotate", "handle-attest", "persona-new", "persona-kel-head",
  "nexus-publish", "nexus-offering-inspect", "raise-sign",
] as const;
export type StoreDoorVerb = (typeof STORE_DOOR_VERBS)[number];

type Row = (args: Readonly<Record<string, unknown>>) => Promise<Record<string, unknown>>;

/** The refusals a row answers as `{ refused }` — every class a command names as a clean refusal. */
const REFUSALS = [
  NexusKapaeError, NexusContractError, EdgeKapaeError, EdgeRollAnchorError, EdgeSeatError, EdgeCosignError, CabalVouchError, CabalJoinError, CabalFaceError,
  NexusPublishError, NexusOfferingInspectError, RaiseSignError, AdmitBundleError, FleetJoinRefused, NexusCabalError,
  CarryBundleError,
] as const;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) ? v : undefined);
const strs = (v: unknown): readonly string[] | undefined =>
  (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);
const opt = <K extends string, V>(key: K, v: V | undefined): { [P in K]?: V } =>
  (v === undefined ? {} : { [key]: v }) as { [P in K]?: V };

/** The face a fleet-join row names: absent, or a whole number; anything else refuses `face-malformed`. */
function joinFace(args: Readonly<Record<string, unknown>>): { face?: number } {
  if (args["face"] === undefined) return {};
  const face = int(args["face"]);
  if (face === undefined || face < 0) throw new FleetJoinRefused("face-malformed", `the row's face names no persona index: ${JSON.stringify(args["face"])}.`);
  return { face };
}

/** The name a row's refusal answers under: the row's own verb, so no two doors share one word for "refused". */
export const storeRefusalName = (verb: string): string => `${verb}-refused`;

/** Run a row, answering a refusal as `{ refused, refusal }`: the door's words, and the name it refuses under. */
async function answer(verb: string, run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try { return { verb, ...(await run()) }; }
  catch (err) {
    if (REFUSALS.some((R) => err instanceof R)) return { verb, refused: (err as Error).message, refusal: storeRefusalName(verb) };
    throw err;
  }
}

/** A row's required string argument, refused by name when absent. */
function need(verb: string, args: Readonly<Record<string, unknown>>, key: string): string {
  const v = str(args[key]);
  if (v === undefined) throw new Error(`${verb}: the row needs "${key}"`);
  return v;
}

/** The rows over one holder, by verb. */
function storeDoorRows(deps: StoreDoorDeps): Record<StoreDoorVerb, Row> {
  const { storageDir, sealHome, repo } = deps;
  return {
    "nexus-kapae": (args) => answer("nexus-kapae", async () => {
      const action = args["action"] === "un_kapae" ? "un_kapae" : "kapae";
      const r = await runNexusKapae({ action, nym: need("nexus-kapae", args, "nym"), sealHome, repo, ...opt("reason", str(args["reason"])), ...opt("aid", str(args["aid"])) });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    "nexus-kapae-list": (args) => answer("nexus-kapae-list", async () => ({ ...(await runNexusKapaeList({ sealHome, repo, ...opt("aid", str(args["aid"])) })) })),
    // THE TWO-VAULT KAPAE DOOR (kapae#/edge-hands): an open signs with the seats this vessel holds and lands nothing;
    // a partial step judges before any signature and lands only an act that still reads complete at the write.
    "nexus-kapae-open": (args) => answer("nexus-kapae-open", async () => ({
      ...(await runNexusKapaeOpen({
        action: args["action"] === "un_kapae" ? "un_kapae" : "kapae", nym: need("nexus-kapae-open", args, "nym"), sealHome, repo,
        ...opt("aid", str(args["aid"])),
      })),
    })),
    "nexus-kapae-partial": (args) => answer("nexus-kapae-partial", async () => {
      const action = args["action"] === "kapae" ? "kapae" as const : args["action"] === "un_kapae" ? "un_kapae" as const : undefined;
      const r = await runNexusKapaePartial({ partial: args["partial"], sealHome, repo, ...opt("action", action) });
      if (r.landed) await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),

    "nexus-contract": (args) => answer("nexus-contract", async () => {
      const action = args["action"] as CarriageAction;
      const r = await runNexusContract({
        action, nym: need("nexus-contract", args, "nym"), sealHome, repo, catalogUrl: deps.catalogUrl,
        ...opt("contractSig", str(args["contractSig"])), ...opt("carrierSig", str(args["carrierSig"])), ...opt("aid", str(args["aid"])),
        ...opt("syncUrl", str(args["syncUrl"])), ...opt("floorPin", str(args["floorPin"])),
      });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    // THE TWO-VAULT DOOR (kapae#/edge-hands). An open signs with the seats this vessel holds and lands nothing; a
    // partial step judges before any signature and lands only an act that reads complete here.
    "nexus-contract-open": (args) => answer("nexus-contract-open", async () => ({
      ...(await runNexusContractOpen({
        action: args["action"] as CarriageAction, nym: need("nexus-contract-open", args, "nym"), sealHome, repo,
        ...opt("contractSig", str(args["contractSig"])), ...opt("aid", str(args["aid"])),
      })),
    })),
    "nexus-contract-partial": (args) => answer("nexus-contract-partial", async () => {
      const r = await runNexusContractPartial({ partial: args["partial"], sealHome, repo });
      if (r.landed) await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    "nexus-roll-anchor": (args) => answer("nexus-roll-anchor", async () => {
      const closing = args["closing"] as KahuQuorumSeats, opened = args["opened"] as KahuQuorumSeats;
      const r = await runNexusRollAnchor({ sealHome, repo, closing, opened });
      // The same roll anchors every realm edge board this vessel keeps quorum acts for (kapae#/rolls).
      const edgeAnchors = await runEdgeRollAnchors({ sealHome, repo, closing, opened });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r, edgeAnchors };
    }),
    // THE TWO-VAULT ROLL ANCHOR (kapae#/rolls): both vaults hold the rolled head; the anchor's partial crosses after it.
    "nexus-roll-anchor-open": (args) => answer("nexus-roll-anchor-open", async () => ({
      ...(await runNexusRollAnchorOpen({ sealHome, repo, ...opt("aid", str(args["aid"])) })),
    })),
    // THE REALM EDGE ANCHORS OF THE SAME ROLL: one partial for each realm board this vessel keeps a quorum act for.
    "nexus-roll-anchor-edge-open": (args) => answer("nexus-roll-anchor-edge-open", async () => ({
      partials: await runEdgeRollAnchorOpen({ sealHome, repo, ...opt("aid", str(args["aid"])) }),
    })),
    // One door takes either family of the roll's anchors: a partial routes by its own family, and the answer names
    // where each realm's edge anchor stands on this vessel.
    "nexus-roll-anchor-partial": (args) => answer("nexus-roll-anchor-partial", async () => {
      const read = readNexusActPartial(args["partial"]);
      const edge = read?.act.family === "edge-roll-anchor";
      const r = edge ? await runEdgeRollAnchorPartial({ partial: args["partial"], sealHome, repo }) : await runNexusRollAnchorPartial({ partial: args["partial"], sealHome, repo });
      if (r.landed) await awaitOnRolled(deps.onRolled?.());
      return { ...r, edgeAnchors: await runEdgeRollAnchorStanding({ sealHome, repo, ...(read ? { aid: read.aid } : {}) }) };
    }),
    // A ROLL WAITS ON ITS PRIOR ANCHOR (operator ruling 2026-10-15): the roll's open asks here before any card reads.
    "nexus-roll-prior-anchor": (args) => answer("nexus-roll-prior-anchor", async () => ({
      ...(await runNexusRollPriorAnchorCheck({ sealHome, repo, ...opt("aid", str(args["aid"])) })),
    })),
    "nexus-members-list": (args) => answer("nexus-members-list", async () => ({
      ...(await runNexusMembersList({ sealHome, repo, ...opt("aid", str(args["aid"])) })),
    })),
    // THE KAHU CABAL (kahu#/seed-and-nexus, ADMISSION TAKES THE SEAT QUORUM). An act signs with the seats held here
    // and lands once it counts; short of the threshold it answers a partial a person carries to the next vault.
    "nexus-cabal-act": (args) => answer("nexus-cabal-act", async () => ({
      ...(await runCabalAct({
        repo, sealHome, group: need("nexus-cabal-act", args, "group"),
        action: args["action"] === "remove" ? "remove" : "admit", ...opt("aid", str(args["aid"])),
      })),
    })),
    "nexus-cabal-cosign": (args) => answer("nexus-cabal-cosign", async () => ({
      ...(await runCabalCosign({
        repo, sealHome, partial: args["partial"], confirmActCid: need("nexus-cabal-cosign", args, "act"), ...opt("aid", str(args["aid"])),
      })),
    })),
    "nexus-cabal-standing": (args) => answer("nexus-cabal-standing", async () => ({
      ...(await runCabalStanding({ repo, sealHome, group: need("nexus-cabal-standing", args, "group"), ...opt("aid", str(args["aid"])) })),
    })),

    // THE FLOOR RELEASE (w26-floor-lane#/the-slices): one porch body per Nexus, sealed by a seat held here, the approval attached.
    "nexus-release": (args) => answer("nexus-release", async () => ({
      ...(await runFloorRelease({
        repo, sealHome, manifestFile: need("nexus-release", args, "manifestFile"), approval: args["approval"], casDir: casDirForStorage(storageDir), ...opt("aid", str(args["aid"])),
      })),
    })),

    "nexus-posture": (args) => answer("nexus-posture", async () => {
      const doc = readNexusDoc(sealHome);
      const want = args["want"];
      // A HERM ANSWERS THE KNOCK (operator ruling): OPEN by class at every gate it stands, so the charter's posture joint
      // governs nothing on a place that lit no face. A read says so; a flip refuses by name and writes nothing.
      if (await standsAsHerm()) {
        if (want !== "private" && want !== "open") return { posture: "open", present: doc !== null, wrote: false, herm: true };
        throw new Error("nexus-posture REFUSED: this place lit no face, so it stands as a herm, and a herm answers the knock by class (operator ruling) — a posture is a hearth's charter joint. Nothing was written.");
      }
      if (want !== "private" && want !== "open") {
        return { posture: federationPostureFromDoc(doc), present: doc !== null, wrote: false, herm: false };
      }
      if (!doc) {
        throw new Error("nexus-posture REFUSED: no charter doc — run `lares nexus seal seat` before setting a posture.");
      }
      const posture: FederationPosture = want;
      const path = writeNexusPractice(sealHome, { federationPosture: posture }, doc);
      // The posture joint feeds every carried reading's primary-posture closure — a flip counts at the very
      // next socket once the live gate re-reads it, so it rides the same hook a board write rides.
      await awaitOnRolled(deps.onRolled?.());
      return { posture, path, wrote: true };
    }),

    "nexus-admit-take": (args) => answer("nexus-admit-take", async () => {
      const raw = need("nexus-admit-take", args, "raw");
      const r = await takeAdmitBundle({ sealHome, raw });
      // RE-PRESENT through the live hook when a vessel stands over this row; `storeDoorDirect` supplies none,
      // so a bundle taken with no vessel standing simply waits for the next boot's dial to present it.
      // `represented` reads `awaitOnRolled`'s OWN bounded claim, never merely whether a vessel stands to call
      // it: a vessel standing proves this row COULD try to re-present, not that it DID. Past the budget the
      // refold keeps running unseen, and this reads `"pending"` rather than guessing either way.
      const represented = deps.onRolled === undefined ? false : await awaitOnRolled(deps.onRolled(r.aid));
      return { aid: r.aid, nym: r.nym, admitCid: r.admitCid, gatePubKey: r.gatePubKey, lineage: r.lineage, path: r.path, represented };
    }),

    // A HERM'S EXPLICIT JOIN (lar:///ha.ka.ba/lararium/node/carry-bundle): the quorum's counted carry over this vessel's own key, taken by
    // hand onto its own replica of that Nexus's carriage board; the refold the take fires stands its floor gate there at once.
    "nexus-carry-take": (args) => answer("nexus-carry-take", async () => {
      const raw = need("nexus-carry-take", args, "raw");
      const r = await takeCarryBundle({ sealHome, repo, raw, ownVesselKey: await loadVesselVerifyingKey() });
      const refolded = deps.onRolled === undefined ? false : await awaitOnRolled(deps.onRolled(r.aid));
      return { ...r, refolded };
    }),

    // A WRITE LANDED BESIDE THE SEAL HOME, NOT ON THE REPO. `accept-carriage`, `carry-for` and a carried
    // `seal import` sign or keep bytes under `sealHome` directly (a consent, a carrier seal, a grown carried
    // set) — none of them touch this vessel's Repo, so none of them belong on this table as a WRITE row of
    // their own. But a standing vessel's live readings (`readCarried`, the antigen/board folds its dial
    // presents against) refold only on this same hook, so a caller that just changed one of those files pokes
    // it here: no Repo read, no write of its own, just the SAME refold every other row already triggers.
    "seal-home-refold": () => answer("seal-home-refold", async () => {
      const attempted = deps.onRolled !== undefined;
      const refolded = deps.onRolled === undefined ? false : await awaitOnRolled(deps.onRolled());
      return { attempted, refolded };
    }),

    "edge-kapae": (args) => answer("edge-kapae", async () => ({
      ...(await runEdgeKapae({
        raised: args["raised"] !== false, sealHome, repo,
        ...opt("edgeId", str(args["edgeId"])), ...opt("member", str(args["member"])), ...opt("device", str(args["device"])),
        ...(args["hand"] === "quorum" ? { hand: "quorum" as const } : {}), ...opt("realm", str(args["realm"])),
        ...opt("handleIndex", int(args["handleIndex"])), ...opt("nexusAid", str(args["nexusAid"])), ...opt("parents", strs(args["parents"])),
      })),
    })),
    // THE KEY SIDE OF A REMOVAL, the vessel's two short acts around the island's `seat-duties` verb (kapae#/keys).
    "edge-seat-facts": (args) => answer("edge-seat-facts", async () => ({
      ...(await runEdgeSeatFacts({ repo, ...opt("fleetRoot", str(args["fleetRoot"])) })),
    })),
    // THE OPERATOR'S ROAD TO `seat-duties`. The island's verb answers the vessel's main thread alone, so
    // `lares edge settle` asks through this row. THE ROW TAKES NO FACTS FROM ITS CALLER: it names one fleet, and
    // the row reads that fleet's facts off this vessel's own ledger and board before the main thread signs the
    // ask. So whoever reaches this row, the vessel signs only what the vessel itself read, which the fold's own
    // settle would ask in the same words.
    "edge-seat-duties": (args) => answer("edge-seat-duties", async () => {
      const fleetRoot = str(args["fleetRoot"]);
      if (!fleetRoot || Object.keys(args).some((k) => k !== "fleetRoot")) throw new EdgeSeatError("edge-seat-duties names one fleet and nothing else: { fleetRoot }");
      if (!deps.seatDuties) throw new EdgeSeatError("no unlocked vessel stands here to answer on the key side: stand the vessel, unlock it, then settle");
      const facts = (await runEdgeSeatFacts({ repo, fleetRoot })).fleets[0];
      if (!facts) throw new EdgeSeatError("this vessel reads no facts for that fleet");
      return { ...(await deps.seatDuties({ fleetRoot: facts.fleetRoot, acts: facts.acts, rolled: facts.rolled })) };
    }),
    "edge-seat-marks": (args) => answer("edge-seat-marks", async () => ({
      ...(await runEdgeSeatMarks({ repo, fleetRoot: str(args["fleetRoot"]) ?? "", rolls: Array.isArray(args["rolls"]) ? args["rolls"] : [] })),
    })),
    // THE COSIGN DOOR: a quorum edge act between seats on separate vessels (`commands/edge-cosign`).
    "edge-partial": (args) => answer("edge-partial", async () => ({
      ...(await runEdgePartial({
        realm: str(args["realm"]) ?? "", raised: args["raised"] !== false, sealHome, repo,
        ...opt("member", str(args["member"])), ...opt("voucher", str(args["voucher"])), ...opt("joiner", str(args["joiner"])),
        ...opt("nexusAid", str(args["nexusAid"])),
      })),
    })),
    "edge-cosign": (args) => answer("edge-cosign", async () => ({
      ...(await runEdgeCosign({ partial: args["partial"], sealHome, repo, ...opt("confirmActCid", str(args["confirmActCid"])) })),
    })),
    "cabal-vouch": (args) => answer("cabal-vouch", async () => ({
      ...(await runCabalVouch({
        joiner: str(args["joiner"]) ?? "", realm: str(args["realm"]) ?? "", sealHome, repo,
        ...opt("nexusAid", str(args["nexusAid"])),
      })),
    })),
    // THE WORN FACE'S KEY IN A REALM: `present` stands the face there (mints its key, notes the realm under its
    // Nexus); a read mints nothing (`commands/cabal-face`).
    "cabal-face": (args) => answer("cabal-face", async () => ({
      ...(await runCabalFace({
        realm: str(args["realm"]) ?? "", present: args["present"] === true, sealHome, repo,
        ...opt("nexusAid", str(args["nexusAid"])),
      })),
    })),
    "cabal-join": (args) => answer("cabal-join", async () => ({
      ...(await runCabalJoin({
        realm: str(args["realm"]) ?? "", applicant: str(args["applicant"]) ?? "", sealHome, repo,
        ...opt("maxVouchesPerVoucher", int(args["maxVouchesPerVoucher"])),
      })),
    })),
    // The fleet-join door's root half: an offer, and the answer to one carried request. The answer carries the face's
    // address secret SEALED to the request's own key; no secret rides it in the clear.
    // `face` names the persona index the join serves; absent, the founding face. A face that reads as no index
    // refuses by name: an act that signs authority never falls back to the founding face.
    "fleet-join-offer": (args) => answer("fleet-join-offer", async () => ({ offer: await runFleetJoinOffer({ sealHome, ...joinFace(args) }) })),
    // The answer notes the certificates it issued beside the joining device; the refold it sets off resweeps a standing
    // vessel's gates, and each sweep reads that issued book again, so the gate binds the device's face-scoped key.
    "fleet-join-answer": (args) => answer("fleet-join-answer", async () => {
      const issued = await runFleetJoinAnswer({ repo, sealHome, catalogUrl: deps.catalogUrl, request: args["request"], ...opt("syncUrl", str(args["syncUrl"])), ...opt("docUrl", str(args["docUrl"])), ...joinFace(args) });
      await awaitOnRolled(deps.onRolled?.());
      return { answer: issued };
    }),
    "handle-publish": (args) => answer("handle-publish", async () => ({
      card: await runHandlePublish({ glamour: need("handle-publish", args, "glamour"), repo, ...opt("handleIndex", int(args["handleIndex"])) }),
    })),
    "handle-burn": (args) => answer("handle-burn", async () => ({
      card: await runHandleBurn({ repo, ...opt("handleIndex", int(args["handleIndex"])), ...(args["fromPersona"] === true ? { fromPersona: true } : {}) }),
    })),
    "handle-rotate": (args) => answer("handle-rotate", async () => ({
      card: await runHandleRotate({ repo, ...opt("handleIndex", int(args["handleIndex"])) }),
    })),
    "handle-attest": (args) => answer("handle-attest", async () => ({
      statement: await runHandleAttest({ claim: args["claim"] as HandleClaim, repo, ...opt("handleIndex", int(args["handleIndex"])) }),
    })),
    "persona-new": (args) => answer("persona-new", async () => ({
      ...(await runFoundTheFace({ repo, ...opt("handleIndex", int(args["handleIndex"])) })),
    })),
    // M12′/L11: the SAME board resolves BOTH the head op-key and that head's KEL seq, off ONE materialize
    // (`makeLocalPersonaKelHeadAndSeqResolver`), so head and seq never straddle a sync landing between two
    // reads. `seq` reads ADVISORY-ONLY end to end: omitted when the resolver found none, a hint and never a verdict.
    "persona-kel-head": (args) => answer("persona-kel-head", async () => {
      const prefix = need("persona-kel-head", args, "prefix");
      const { head, seq } = await (await makeLocalPersonaKelHeadAndSeqResolver(repo))(prefix);
      return { head, ...(seq !== null ? { seq } : {}) };
    }),
    "nexus-publish": (args) => answer("nexus-publish", async () => ({
      ...(await runNexusPublishPlugins({ repo, storageDir, source: need("nexus-publish", args, "source") })),
    })),
    "nexus-offering-inspect": (args) => answer("nexus-offering-inspect", async () => ({
      ...(await runNexusInspectOffering({ offeringCid: need("nexus-offering-inspect", args, "offeringCid"), storageDir, repo })),
    })),
    "raise-sign": (args) => answer("raise-sign", async () => ({
      ...(await runRaiseSign({ challengeText: str(args["challengeText"]) ?? "", handleIndex: int(args["handleIndex"]) ?? 0, sealHome, repo })),
    })),
  };
}

/** The door's reactors over a running vessel, by verb. */
export function storeDoorReactors(deps: StoreDoorDeps): Record<StoreDoorVerb, VerbReactor> {
  return storeDoorRows(deps);
}

/**
 * Run one row with no vessel standing: hold the store for the moment of the act (`ownedStore`) and run the row
 * against that holder. A standing vessel, or another command mid-act, refuses before anything opens.
 */
export async function storeDoorDirect(
  verb: StoreDoorVerb,
  args: Readonly<Record<string, unknown>>,
  opts: { readonly sealHome: string; readonly storageDir?: string },
): Promise<Record<string, unknown>> {
  const storageDir = opts.storageDir ?? larDataDir();
  return await ownedStore(storageDir, (repo) => {
    // The direct holder reads the catalog named beside the store it owns. An unnamed store carries no canon.
    let catalogUrl: string | undefined;
    try { catalogUrl = readFileSync(join(storageDir, "catalog-url"), "utf8").trim() || undefined; } catch { /* No catalog stands. */ }
    return storeDoorRows({ storageDir, sealHome: opts.sealHome, repo, catalogUrl })[verb](args);
  });
}
