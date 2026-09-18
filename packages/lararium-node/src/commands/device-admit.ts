/**
 * runDeviceAdmit — Node adapter: produce a device-admit/v1 payload for a new vessel.
 *
 * Node-specific shores (only these belong here):
 *   - readFileSync for the social bootstrap (<lares>/vessel — see larBootstrapPath)
 *   - NodeFSStorageAdapter + findWithProgress for daemon doc access
 *   - loadVesselSigningSeed (disk keypair)
 *   - writeFileSync / process.stdout.write for output
 *
 * All ceremony logic (Keyhive hydration, Gate B/C self-check, payload construction)
 * lives in @lararium/keyhive (runDeviceAdmitCore) and runs identically in any vessel.
 *
 * Same-operator path: covers the operator's own N vessels (desktop, browser, phone).
 * A second OPERATOR joins a Nexus by carriage contract (`lares nexus accept-carriage` + `lares nexus contract`) — a different axis (ceremony.ts stubs).
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, personaBagIdFor, PERSONA_KEL_PREFIX_TIDDLER,
  PERSONA_GROUP_DOC_ID_TIDDLER, PERSONA_GROUP_AGENT_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  personaKelBoardDocUrl, personaKelChainForPrefix, materializeSharedLarDoc,
  leaseEpochPrefix, effectiveLeaseEpoch,
} from "@lararium/mesh";
import { daemonGenesisDir } from "../lares-config.js";
import { larDataDir, larBootstrapPath } from "../vessel-paths.js";
import { runDeviceAdmitEdge, type DeviceAdmitPayload, type CarriedAdmitPayload } from "@lararium/keyhive";
import { loadPersonaGroupRootSeed, loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland, nodeNexusStanding } from "../nexus-standing.js";
import { GENESIS_ENGINE_CID } from "../genesis-artifact.js";

export type { DeviceAdmitPayload, CarriedAdmitPayload } from "@lararium/keyhive";

/**
 * THE ISLAND THIS DOOR READS A PER-NEXUS BOARD AT — the founder's own, resolved exactly as its BOOT
 * resolves it.
 *
 * ══ WHY IT IS NOT THE VESSEL KEY ═════════════════════════════════════════════════════════════════
 *
 * This read was spelled `personaKelBoardDocUrl(await loadVesselVerifyingKey(dir))`, under a comment
 * reading "its gate key IS its Nexus key." `91ce09afb` ruled that EVERY per-Nexus board keys on the
 * NEXUS, so that sentence holds at exactly ONE point on the gradient — the `own` island — and
 * nowhere above it. A founder that CLIMBED to a charter reads the PRIVATE board beneath its charter
 * island while its own boot reads the charter board.
 *
 * AND IT WORKED ONLY BECAUSE A CARRY COPIES. `carryPersonaKelUpTheGradient` writes the destination
 * and never unlinks the source, so the lower board kept its chain and the wrong-key read still found
 * one. The correctness sat on copy semantics in another package; when that goes, this door throws
 * "persona-KEL chain … absent from the local board — run `lares vessel found --force`", a message
 * pointing at a torn founding over a founding that is sound.
 *
 * ══ THE FLEET FRAMING IS KEPT, DELIBERATELY ══════════════════════════════════════════════════════
 *
 * `c6cfe5b8d` ruled that "device-admit … admits a DEVICE to a fleet rather than a VESSEL to a
 * Nexus", and that argument stands: this door takes NO nexus-key parameter and asks its caller for
 * none. The two rulings answer different questions. The fleet framing settles the PARAMETER (nobody
 * hands this door an island); `91ce09afb` settles the BOARD (a per-Nexus board keys on the Nexus,
 * whoever reads it). So the parameter stays absent and the READ composes the shared resolver — the
 * same disk and environment facts, in the same precedence, as `open-node-vessel`.
 *
 * ONE SEAM, SO THE DRIFT CANNOT COME BACK: the resolution lives in `nexus-standing`, which the boot
 * and the founding doors read too. This function exists as a named seam so a test can measure the
 * island the DOOR resolves rather than trusting that it restated the boot's object correctly.
 */
export function admitBoardIsland(ownVesselKey: string): string {
  return nodeNexusIsland({ ownVesselKey });
}

export interface DeviceAdmitOptions {
  readonly storageDir?:    string;
  readonly genesisDir?:    string;
  readonly outPath?:       string;
  readonly syncUrl?:       string;
  /** The joining vessel's PUBLIC Ed25519 verifying-key hex — the delegate the founder's root signs. */
  readonly joineeVerifyingKey: string;
  /** Automerge URL of this vessel's genesis island — included in payload for peer-sync delivery. */
  readonly islandDocUrl?:  string | null;
  /** This hearth's own daemon doc — the door the joinee knocks on for its seat. */
  readonly hearthDaemonUrl?: string | null;
}

function defaultDirs(): { storageDir: string; genesisDir: string } {
  return {
    storageDir: larDataDir(),        // the vessel substrate → <lares>/vessel
    // Baked seed rides the composable genesis cap (LAR_GENESIS → ~/.lares/config.json →
    // repo-relative <corpus>/genesis). Checked-in by default; a no-config boot lands on the repo seed.
    genesisDir: daemonGenesisDir(),
  };
}

export async function runDeviceAdmit(opts: DeviceAdmitOptions): Promise<DeviceAdmitPayload> {
  const defaults   = defaultDirs();
  const storageDir = opts.storageDir ?? defaults.storageDir;
  const genesisDir = opts.genesisDir ?? defaults.genesisDir;
  const bootstrap  = larBootstrapPath();

  if (!existsSync(bootstrap)) {
    throw new Error(
      `[lares device-admit] ${bootstrap} not found — run \`lares vessel found\` first.\n` +
      `  expected: ${bootstrap}`,
    );
  }

  // Read sentinel oracle IDs from social-bootstrap.json.
  const bootstrapPlugin = JSON.parse(readFileSync(bootstrap, "utf8")) as { text?: string };
  const tiddlers = (JSON.parse(bootstrapPlugin.text ?? "{}") as {
    tiddlers?: Record<string, { text?: string }>;
  }).tiddlers ?? {};

  const personaGroupDocIdHex = tiddlers[PERSONA_GROUP_DOC_ID_TIDDLER]?.text ?? null;
  const meshCabalDocIdHex   = tiddlers[MESH_CABAL_DOC_ID_TIDDLER]?.text   ?? null;
  const daemonUrl            = tiddlers[DAEMON_BAG_ID]?.text                 ?? null;
  // The founder's PersonaGroup plane — carried into the payload so the joinee SYNCS the shared veiled
  // identity (membership-sync foundation); the daemon bag stays sovereign (the joinee seeds its own). The entry
  // is keyed by the name the group's own doc id derives, which both devices compute alike.
  const personaUrl           = personaGroupDocIdHex
    ? tiddlers[personaBagIdFor(personaGroupDocIdHex)]?.text ?? null
    : null;

  if (!personaGroupDocIdHex || !meshCabalDocIdHex) {
    throw new Error(
      `[lares device-admit] sentinel oracle IDs missing from social-bootstrap.json.\n` +
      `  Run \`lares vessel found --force\` to re-establish the founding ceremony.`,
    );
  }
  if (!daemonUrl) {
    throw new Error(`[lares device-admit] daemon doc URL missing from social-bootstrap.json.`);
  }

  // Open daemon doc to read cap events + personaGroupAgentIdHex.
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const progress    = repo.findWithProgress(daemonUrl as AutomergeUrl);
  // automerge-repo 2.6: whenReady() resolves the handle when ready, rejects on
  // unavailable; race it against a 5s timeout.
  const daemonHandle = await Promise.race([
    progress.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[lares device-admit] daemon doc not ready after 5s")), 5000),
    ),
  ]);
  const daemonDoc    = daemonHandle.doc();
  const tiddlerMap  = ((daemonDoc as Record<string,unknown>)?.["tiddlers"] ?? {}) as Record<string, unknown>;

  const agentEntry         = tiddlerMap[PERSONA_GROUP_AGENT_ID_TIDDLER] as Record<string,unknown> | undefined;
  const personaGroupAgentIdHex = (agentEntry?.["tiddler"] as Record<string,unknown> | undefined)?.["text"] as string | null ?? null;
  if (!personaGroupAgentIdHex) {
    throw new Error(`[lares device-admit] PersonaGroup agent ID missing from daemon doc — run \`lares vessel found --force\`.`);
  }

  // The founder's persona-KEL PREFIX (the identifier the joinee will pin) + the chain SNAPSHOT off the
  // founder's own per-Nexus KEL board, AT THE ISLAND THE FOUNDER'S BOOT RESOLVED (`admitBoardIsland` —
  // read its docblock for why the vessel key is not that island above the `own` notch). The joinee seeds
  // the snapshot into its local board so it boots to a head with no sync wait (no-global-now). Fail-closed:
  // a founding always seats an inception, so a prefix + a chain always stand — their absence names a torn
  // founding, refuse to admit.
  const kelPrefixEntry = tiddlerMap[PERSONA_KEL_PREFIX_TIDDLER] as Record<string,unknown> | undefined;
  const personaKelPrefix = (kelPrefixEntry?.["tiddler"] as Record<string,unknown> | undefined)?.["text"] as string | null ?? null;
  if (!personaKelPrefix) {
    throw new Error(`[lares device-admit] persona-KEL prefix missing from daemon doc — run \`lares vessel found --force\`.`);
  }
  const founderVesselKey = await loadVesselVerifyingKey(storageDir);
  const boardIsland      = admitBoardIsland(founderVesselKey);
  const kelBoard   = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
  const personaKelChain = personaKelChainForPrefix(kelBoard.doc(), personaKelPrefix);
  if (!personaKelChain || personaKelChain.length === 0) {
    throw new Error(`[lares device-admit] persona-KEL chain for ${personaKelPrefix.slice(0, 20)}… absent from the local board — run \`lares vessel found --force\`.`);
  }

  await repo.flush();

  // The founder's PersonaGroup ROOT signs the joinee's edge (the upgrade event). The root seed is
  // founder-only, held in the spirits' house at `<lares>/identity`; the joinee supplies ONLY its
  // PUBLIC verifying key.
  if (!opts.joineeVerifyingKey) {
    throw new Error("[lares device-admit] --joinee-key <hex> required — the joining vessel's public verifying key.");
  }
  const signerSeed     = await loadPersonaGroupRootSeed(storageDir);
  const hearthTrueName = GENESIS_ENGINE_CID(genesisDir);
  if (!hearthTrueName) {
    throw new Error("[lares device-admit] hearth true-name (engine CID) absent — run `lares vessel found` first.");
  }

  // THE LEASE READ — off the SAME daemon doc already open above, the same fold `gateFaceJoin` runs
  // (leaseEpochPrefix → per-writer slot values → effectiveLeaseEpoch = max). The minted edge binds to
  // THIS PersonaGroup's current epoch, so a device admitted here reads fresh at the door until a later
  // roll leases it stale (re-admits via face-join regrant, never a silent renewal).
  const leasePrefix = leaseEpochPrefix(personaGroupDocIdHex);
  const leaseSlotValues: string[] = [];
  for (const [title, entry] of Object.entries(tiddlerMap)) {
    if (!title.startsWith(leasePrefix)) continue;
    const text = ((entry as Record<string, unknown> | undefined)?.["tiddler"] as Record<string, unknown> | undefined)?.["text"];
    if (typeof text === "string") leaseSlotValues.push(text);
  }
  const boundEpoch = effectiveLeaseEpoch(leaseSlotValues);

  const payload = await runDeviceAdmitEdge({
    signerSeed,
    joineeVerifyingKey: opts.joineeVerifyingKey.toLowerCase(),
    personaKelPrefix,
    personaKelChain,
    hearthTrueName,
    personaGroupDocIdHex,
    personaGroupAgentIdHex,
    meshCabalDocIdHex,
    boundEpoch,
    syncUrl:      opts.syncUrl      ?? null,
    islandDocUrl: opts.islandDocUrl ?? null,
    // THE DOOR. Defaults to this hearth's OWN daemon doc, read from the same bootstrap the sentinel ids come
    // from — a joinee seeds its own plane at admission, so only this url tells it where to knock.
    hearthDaemonUrl: opts.hearthDaemonUrl ?? daemonUrl,
    personaUrl,
  });

  // THE PIN NAMES THE DIAL (hearth-dial-pin.ts). The founder's gate key IS its vessel key — the anti-relay
  // binding the joinee's V3 proof commits to. It rides the payload beside `syncUrl` so the joinee's bootstrap
  // can carry both and its boot can dial with no `LAR_JOIN_*` set by hand.
  // ⚠ THE PIN CARRIES THE VESSEL KEY ON PURPOSE — UNCHANGED. The gate key is the anti-relay binding the
  // joinee's V3 proof COMMITS TO, so it must stay the founder's own vessel key; the charter island would
  // break that commitment and is not a substitute for it.
  //
  // THE LOOP THIS CLOSES (Option A — split the payload): the gate key alone used to be the ONLY thing the
  // joinee read to resolve its board (`init.ts` forced `anchorGateKey := hearthGatePubKey`), so it always
  // resolved `kind: "anchor"` — never `charter` — even when the founder itself stands on a charter island.
  // `founderIdentity` below is the SAME resolution `boardIsland` above already composed (`admitBoardIsland`
  // → `nodeNexusIsland` → `nodeNexusStanding`, the one canonical read); it names WHICH board the founder
  // actually stands on, and rides beside the dial key rather than being inferred from it. `init.ts` feeds
  // `kind`/`scope` into `nexusIdentity` directly (the charter branch when `kind === "charter"`), so a
  // climbed founder's device now seats on the board the founder itself stands on.
  //
  // SNAPSHOT, DELIBERATELY: this freezes the founder's resolved board AT ADMIT TIME. A founder that climbs
  // AFTER admitting does not retroactively move an already-admitted device — that device re-admits by a
  // new act. Live re-resolution here would reintroduce a reachability/global-now dependency this design
  // sheds; `admitBoardIsland` already refuses (throws) on a torn founder before this point is ever reached,
  // so `founderIdentity.kind` is never `"torn"` here — the guard below is a defensive type-narrow, not a
  // path this admit can actually take.
  const founderIdentity = nodeNexusStanding({ ownVesselKey: founderVesselKey });
  const carried: CarriedAdmitPayload = {
    ...payload,
    hearthGatePubKey: founderVesselKey.toLowerCase(),
    ...(founderIdentity.kind !== "torn" ? {
      hearthIslandKind:  founderIdentity.kind,
      hearthIslandScope: founderIdentity.scope,
    } : {}),
  };
  const json = JSON.stringify(carried, null, 2);
  if (opts.outPath) {
    writeFileSync(opts.outPath, json, "utf8");
    console.log(`[lares device-admit] payload written to ${opts.outPath}`);
  } else {
    process.stdout.write(json + "\n");
  }

  // The CARRIED form. The payload is a signed capability, so it needs no trusted channel and no
  // reachable issuer: a hostile carrier may WITHHOLD it, never forge it. It rides in the URL FRAGMENT,
  // which browsers do not transmit — so the bytes reach the vessel by whatever the human used (a paste,
  // a QR held up to a screen, a file on a stick) and touch no network on the way.
  //
  // The alternative — a `GET /admit/<key>` the vessel calls — makes the vessel a client PETITIONING an
  // authority for its own admission, and it demands that authority be REACHABLE at the moment of asking.
  // That is a global now, and this house does not have one.
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  console.log("");
  console.log("[lares device-admit] carry this to the joining vessel — the fragment never leaves the browser:");
  console.log(`  #admit=${b64}`);

  return payload;
}
