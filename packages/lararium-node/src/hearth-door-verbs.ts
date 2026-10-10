/**
 * hearth-door-verbs — the store's one door table: every command that touches the vessel's store, as one row.
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
 *   edge-kapae                                   the edge shadow board (`commands/edge-kapae-cmd`)
 *   cabal-vouch · cabal-join                     the vouch board (`commands/cabal-vouch`, `commands/cabal-join`)
 *   device-admit                                 a device edge off the persona-KEL board (`commands/device-admit`)
 *   handle-publish · handle-burn · handle-rotate · handle-attest
 *                                                the WHO board (`commands/handle`)
 *   persona-new                                  a face onto a standing place (`commands/init`)
 *   persona-kel-head                             a persona-KEL head off the local board (`persona-admit-flow`)
 *   nexus-publish                                the Crossroads offering (`commands/nexus-publish`)
 *   raise-sign                                   a raise grant off the carriage board (`commands/raise-sign`)
 *
 * A REFUSAL is an answer, never a fault: it comes back as `{ refused }`, so the CLI names it exactly as the direct
 * path does. A row hands back what its command prints; the command's own process prints it, so a row that ran
 * inside the standing vessel never speaks into the vessel's log, and no secret rides a row's answer.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { Repo } from "@automerge/automerge-repo";
import type { VerbReactor } from "@lararium/tw5";
import type { HandleClaim } from "@lararium/mesh";
import { runHostState, runHostRoll, runHostInvite, HostRefusal } from "./commands/host.js";
import { runWalkState, runWalkTake, runWalkInvite, WalkRefusal } from "./commands/walk.js";
import { runNexusKapae, runNexusKapaeList, NexusKapaeError } from "./commands/nexus-kapae.js";
import { runEdgeKapae, EdgeKapaeError } from "./commands/edge-kapae-cmd.js";
import { runCabalVouch, CabalVouchError } from "./commands/cabal-vouch.js";
import { runCabalJoin, CabalJoinError } from "./commands/cabal-join.js";
import { runDeviceAdmit } from "./commands/device-admit.js";
import { runHandlePublish, runHandleBurn, runHandleRotate, runHandleAttest } from "./commands/handle.js";
import { runFoundTheFace } from "./commands/init.js";
import { runNexusPublishPlugins, NexusPublishError } from "./commands/nexus-publish.js";
import { runRaiseSign, RaiseSignError } from "./commands/raise-sign.js";
import { makeLocalPersonaKelHeadResolver } from "./persona-admit-flow.js";
import { ownedStore } from "./owned-store.js";
import { larDataDir } from "./vessel-paths.js";

/** What the rows read off their holder. */
export interface HearthDoorDeps {
  readonly storageDir: string;
  readonly sealHome:   string;
  /** The store's one holder — the running vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
  /** The gate key the vessel's standing hearth dial pins, or null when it dials no hearth. */
  readonly dialGate:   () => string | null;
  /** A roll landed a new act on the hosting doc of `nexusAid`. */
  readonly onRolled?:  (nexusAid: string) => void;
}

/** The door's rows, by name — each command's routed call names exactly one of these. */
export const HEARTH_DOOR_VERBS = [
  "host-state", "host-roll", "host-invite", "walk-state", "walk-take", "walk-invite",
  "nexus-kapae", "nexus-kapae-list", "edge-kapae", "cabal-vouch", "cabal-join", "device-admit",
  "handle-publish", "handle-burn", "handle-rotate", "handle-attest", "persona-new", "persona-kel-head",
  "nexus-publish", "raise-sign",
] as const;
export type HearthDoorVerb = (typeof HEARTH_DOOR_VERBS)[number];

type Row = (args: Readonly<Record<string, unknown>>) => Promise<Record<string, unknown>>;

/** The refusals a row answers as `{ refused }` — every class a command names as a clean refusal. */
const REFUSALS = [
  HostRefusal, WalkRefusal, NexusKapaeError, EdgeKapaeError, CabalVouchError, CabalJoinError,
  NexusPublishError, RaiseSignError,
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
function storeDoorRows(deps: HearthDoorDeps): Record<HearthDoorVerb, Row> {
  const { storageDir, sealHome, repo } = deps;
  return {
    "host-state": () => answer("host-state", async () => ({ nexuses: await runHostState({ sealHome, storageDir }) })),
    "host-roll": (args) => answer("host-roll", async () => {
      const r = await runHostRoll({ sealHome, storageDir, repo, ...opt("nexusAid", str(args["nexusAid"])), ...opt("cap", int(args["cap"])) });
      deps.onRolled?.(r.nexusAid);
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
      return { ...(await runNexusKapae({ action, nym: need("nexus-kapae", args, "nym"), sealHome, repo, ...opt("reason", str(args["reason"])) })) };
    }),
    "nexus-kapae-list": () => answer("nexus-kapae-list", async () => ({ ...(await runNexusKapaeList({ sealHome, repo })) })),
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
    "persona-kel-head": (args) => answer("persona-kel-head", async () => ({
      head: await (await makeLocalPersonaKelHeadResolver(repo))(need("persona-kel-head", args, "prefix")),
    })),
    "nexus-publish": () => answer("nexus-publish", async () => ({ ...(await runNexusPublishPlugins({ repo })) })),
    "raise-sign": (args) => answer("raise-sign", async () => ({
      ...(await runRaiseSign({ challengeText: str(args["challengeText"]) ?? "", handleIndex: int(args["handleIndex"]) ?? 0, sealHome, repo })),
    })),
  };
}

/** The door's reactors over a running vessel, by verb. */
export function hearthDoorReactors(deps: HearthDoorDeps): Record<HearthDoorVerb, VerbReactor> {
  return storeDoorRows(deps);
}

/**
 * Run one row with no vessel standing: hold the store for the moment of the act (`ownedStore`) and run the row
 * against that holder. A standing vessel, or another command mid-act, refuses before anything opens.
 */
export async function storeDoorDirect(
  verb: HearthDoorVerb,
  args: Readonly<Record<string, unknown>>,
  opts: { readonly sealHome: string; readonly storageDir?: string },
): Promise<Record<string, unknown>> {
  const storageDir = opts.storageDir ?? larDataDir();
  return await ownedStore(storageDir, (repo) =>
    storeDoorRows({ storageDir, sealHome: opts.sealHome, repo, dialGate: () => null })[verb](args));
}
