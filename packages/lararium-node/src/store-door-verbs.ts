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
 *   host-state · host-roll · host-invite         the hearth's hosting (`commands/host`)
 *   walk-state · walk-take · walk-invite         this vessel's walking (`commands/walk`)
 *   nexus-kapae · nexus-kapae-list               the antigen board (`commands/nexus-kapae`)
 *   nexus-contract · nexus-roll-anchor · nexus-members-list
 *                                                the carriage board's writer, its roll anchor and its reader
 *                                                (`commands/nexus-contract`)
 *   nexus-posture                                the per-Nexus federation posture joint (`nexus-doc`)
 *   nexus-admit-take                             a carried admit bundle's offline take + live re-present
 *                                                (`admit-bundle`)
 *   edge-kapae                                   the edge shadow board (`commands/edge-kapae-cmd`)
 *   cabal-vouch · cabal-join                     the vouch board (`commands/cabal-vouch`, `commands/cabal-join`)
 *   device-admit                                 a device edge off the persona-KEL board (`commands/device-admit`)
 *   handle-publish · handle-burn · handle-rotate · handle-attest
 *                                                the WHO board (`commands/handle`)
 *   persona-new                                  a face onto a standing place (`commands/init`)
 *   persona-kel-head                             a persona-KEL head off the local board (`persona-admit-flow`)
 *   nexus-publish                                the Crossroads offering (`commands/nexus-publish`)
 *   nexus-offering-inspect                       one carried offering, read off the Crossroads board
 *                                                (`commands/nexus-offering-inspect`)
 *   raise-sign                                   a raise grant off the carriage board (`commands/raise-sign`)
 *
 * A REFUSAL is an answer, never a fault: it comes back as `{ refused }`, so the CLI names it exactly as the direct
 * path does. A row hands back what its command prints; the command's own process prints it, so a row that ran
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
import type { VerbReactor } from "@lararium/tw5";
import type { HandleClaim } from "@lararium/mesh";
import { federationPostureFromDoc, type FederationPosture, type CarriageAction, type KahuQuorumSeats } from "@lararium/mesh";
import { runHostState, runHostRoll, runHostInvite, HostRefusal } from "./commands/host.js";
import { runWalkState, runWalkTake, runWalkInvite, WalkRefusal } from "./commands/walk.js";
import { runNexusKapae, runNexusKapaeList, NexusKapaeError } from "./commands/nexus-kapae.js";
import { runNexusContract, runNexusRollAnchor, runNexusMembersList, NexusContractError } from "./commands/nexus-contract.js";
import { runEdgeKapae, EdgeKapaeError } from "./commands/edge-kapae-cmd.js";
import { runCabalVouch, CabalVouchError } from "./commands/cabal-vouch.js";
import { runCabalJoin, CabalJoinError } from "./commands/cabal-join.js";
import { runDeviceAdmit } from "./commands/device-admit.js";
import { runHandlePublish, runHandleBurn, runHandleRotate, runHandleAttest } from "./commands/handle.js";
import { runFoundTheFace } from "./commands/init.js";
import { runNexusPublishPlugins, NexusPublishError } from "./commands/nexus-publish.js";
import { runNexusInspectOffering, NexusOfferingInspectError } from "./commands/nexus-offering-inspect.js";
import { runRaiseSign, RaiseSignError } from "./commands/raise-sign.js";
import { makeLocalPersonaKelHeadAndSeqResolver } from "./persona-admit-flow.js";
import { ownedStore } from "./owned-store.js";
import { larDataDir } from "./vessel-paths.js";
import { readNexusDoc, writeNexusPractice } from "./nexus-doc.js";
import { takeAdmitBundle, AdmitBundleError } from "./admit-bundle.js";

/** What the rows read off their holder. */
export interface StoreDoorDeps {
  readonly storageDir: string;
  readonly sealHome:   string;
  /** The store's one holder — the running vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
  /** The gate key the vessel's standing hearth dial pins, or null when it dials no hearth. */
  readonly dialGate:   () => string | null;
  /**
   * A write just counted. `nexusAid` names the hosting doc a roll opened (host-roll only); every other caller
   * passes nothing. Absent on `storeDoorDirect` — a direct act has no live reading to refold.
   *
   * A caller MAY resolve `true` to claim it re-presented this write live, synchronously or through a promise.
   * Any other settlement (`false`, plain `void`, or a promise that resolves either) claims NOTHING about the
   * outcome. Every row that fires this awaits it through `awaitOnRolled` (below), which bounds the wait by
   * `ON_ROLLED_BUDGET_MS` and never lets a slow or rejected refold throw through the row that triggered it.
   */
  readonly onRolled?:  (nexusAid?: string) => boolean | void | Promise<boolean | void>;
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
async function awaitOnRolled(call: boolean | void | Promise<boolean | void>): Promise<boolean | "pending"> {
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
  "host-state", "host-roll", "host-invite", "walk-state", "walk-take", "walk-invite",
  "nexus-kapae", "nexus-kapae-list", "nexus-contract", "nexus-roll-anchor", "nexus-members-list",
  "nexus-posture", "nexus-admit-take", "seal-home-refold",
  "edge-kapae", "cabal-vouch", "cabal-join", "device-admit",
  "handle-publish", "handle-burn", "handle-rotate", "handle-attest", "persona-new", "persona-kel-head",
  "nexus-publish", "nexus-offering-inspect", "raise-sign",
] as const;
export type StoreDoorVerb = (typeof STORE_DOOR_VERBS)[number];

type Row = (args: Readonly<Record<string, unknown>>) => Promise<Record<string, unknown>>;

/** The refusals a row answers as `{ refused }` — every class a command names as a clean refusal. */
const REFUSALS = [
  HostRefusal, WalkRefusal, NexusKapaeError, NexusContractError, EdgeKapaeError, CabalVouchError, CabalJoinError,
  NexusPublishError, NexusOfferingInspectError, RaiseSignError, AdmitBundleError,
] as const;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) ? v : undefined);
const strs = (v: unknown): readonly string[] | undefined =>
  (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);
const opt = <K extends string, V>(key: K, v: V | undefined): { [P in K]?: V } =>
  (v === undefined ? {} : { [key]: v }) as { [P in K]?: V };

/** Run a row, answering a refusal as `{ refused }`. */
async function answer(verb: string, run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try { return { verb, ...(await run()) }; }
  catch (err) {
    if (REFUSALS.some((R) => err instanceof R)) return { verb, refused: (err as Error).message };
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
    "host-state": () => answer("host-state", async () => ({ nexuses: await runHostState({ sealHome, storageDir }) })),
    "host-roll": (args) => answer("host-roll", async () => {
      const r = await runHostRoll({ sealHome, storageDir, repo, ...opt("nexusAid", str(args["nexusAid"])), ...opt("cap", int(args["cap"])) });
      await awaitOnRolled(deps.onRolled?.(r.nexusAid));
      return { ...r };
    }),
    "host-invite": (args) => answer("host-invite", async () => ({
      ...(await runHostInvite({ sealHome, storageDir, ...opt("nexusAid", str(args["nexusAid"])), ...opt("relay", str(args["relay"])) })),
    })),
    "walk-state": () => answer("walk-state", async () => ({ walks: runWalkState({ storageDir }) })),
    "walk-take": (args) => answer("walk-take", async () => {
      const carried = str(args["invite"]);
      if (!carried) throw new WalkRefusal("walk-take needs the carried invite");
      return { ...(await runWalkTake({ carried, storageDir, dialGate: deps.dialGate() })) };
    }),
    "walk-invite": () => answer("walk-invite", async () => ({ ...(await runWalkInvite({ storageDir })) })),

    "nexus-kapae": (args) => answer("nexus-kapae", async () => {
      const action = args["action"] === "un_kapae" ? "un_kapae" : "kapae";
      const r = await runNexusKapae({ action, nym: need("nexus-kapae", args, "nym"), sealHome, repo, ...opt("reason", str(args["reason"])) });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    "nexus-kapae-list": () => answer("nexus-kapae-list", async () => ({ ...(await runNexusKapaeList({ sealHome, repo })) })),

    "nexus-contract": (args) => answer("nexus-contract", async () => {
      const action = args["action"] as CarriageAction;
      const r = await runNexusContract({
        action, nym: need("nexus-contract", args, "nym"), sealHome, repo,
        ...opt("contractSig", str(args["contractSig"])), ...opt("carrierSig", str(args["carrierSig"])),
      });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    "nexus-roll-anchor": (args) => answer("nexus-roll-anchor", async () => {
      const r = await runNexusRollAnchor({
        sealHome, repo,
        closing: args["closing"] as KahuQuorumSeats, opened: args["opened"] as KahuQuorumSeats,
      });
      await awaitOnRolled(deps.onRolled?.());
      return { ...r };
    }),
    "nexus-members-list": (args) => answer("nexus-members-list", async () => ({
      ...(await runNexusMembersList({ sealHome, repo, ...opt("aid", str(args["aid"])) })),
    })),

    "nexus-posture": (args) => answer("nexus-posture", async () => {
      const doc = readNexusDoc(sealHome);
      const want = args["want"];
      if (want !== "private" && want !== "open") {
        return { posture: federationPostureFromDoc(doc), present: doc !== null, wrote: false };
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
        edgeId: str(args["edgeId"]) ?? "", raised: args["raised"] !== false, epochCid: str(args["epochCid"]) ?? "", repo,
        ...opt("handleIndex", int(args["handleIndex"])), ...opt("parents", strs(args["parents"])),
      })),
    })),
    "cabal-vouch": (args) => answer("cabal-vouch", async () => ({
      ...(await runCabalVouch({
        joiner: str(args["joiner"]) ?? "", realm: str(args["realm"]) ?? "", repo,
        ...opt("expiresAt", str(args["expiresAt"])), ...opt("handleIndex", int(args["handleIndex"])),
      })),
    })),
    "cabal-join": (args) => answer("cabal-join", async () => ({
      ...(await runCabalJoin({
        realm: str(args["realm"]) ?? "", applicant: str(args["applicant"]) ?? "", repo,
        ...opt("maxVouchesPerVoucher", int(args["maxVouchesPerVoucher"])),
      })),
    })),
    "device-admit": (args) => answer("device-admit", async () => ({
      ...(await runDeviceAdmit({ joineeVerifyingKey: str(args["joineeVerifyingKey"]) ?? "", repo, ...opt("syncUrl", str(args["syncUrl"])) })),
    })),
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
    // (`makeLocalPersonaKelHeadAndSeqResolver`) — a caller that needs the seq (`persona-admit-cmd.ts` `open`,
    // feeding `JoinRecord.granterSeq` for the per-vessel view's causal supersede order) never stands up a
    // second board read, and head/seq can never straddle a sync landing between two separate materializes
    // (the gap the prior two-builder shape left open despite its comment claiming one read). `seq` is
    // ADVISORY-ONLY end to end — omitted when the resolver found none; the caller folds it in only as a hint,
    // never a verdict.
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
  return await ownedStore(storageDir, (repo) =>
    storeDoorRows({ storageDir, sealHome: opts.sealHome, repo, dialGate: () => null })[verb](args));
}
