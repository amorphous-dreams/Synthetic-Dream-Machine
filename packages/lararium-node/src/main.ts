/**
 * Lararium Node Vessel — local-first relay + TW5 engine entrypoint.
 *
 * Boots one LarVessel per configured wiki, wires a WebSocket relay for
 * browser vessels to sync through, and attaches a LarDiskProjector so
 * the bags/ tree stays in sync with the Automerge store.
 *
 * Three surfaces mount here, not one:
 *   ws://localhost:{port}/ws     → Automerge sync protocol (browser + remote mesh peers)
 *   /tmp/lares-<uid>/<digest>.sock → UDS verb channel (the rendezvous; co-located CLI fast path)
 *   http://localhost:{port}/…    → oracle read-face; federation pulls + verifies through it
 *
 * Usage:
 *   node dist/main.js [--port 8080] [--wiki lares] [--root /alt/root]
 *
 * Environment:
 *   LAR_PORT     — server port (default 8080; docker-compose.yml overrides to 4321)
 *   LAR_WIKI     — wiki id (default lares — the lares-as-wiki quine)
 *   LAR_CATALOG  — existing catalog automerge URL to join (optional)
 *   LAR_ROOT     — alternate repo root for all mirror paths (default: monorepo root).
 *                  Set to an isolated test dir so promote/sync writes never touch
 *                  canonical packages/ or wikis/ paths.
 *   LAR_PUBLIC_URL   — explicit relay reach face only; never promoted to Web/oracle.
 *   LAR_WEB_ORIGIN   — explicit Web-surface origin (or set origins.web in config.json); a lararium's alone.
 *   LAR_ORACLE_ORIGIN — explicit oracle/read-face origin (or set origins.oracle in config.json).
 *   LAR_SAME_ORIGIN  — true/false explicit declaration that every surface the standing has shares the
 *                      relay face's origin: relay = read for a herm, relay = read = Web for a lararium.
 *   LAR_LAN_DISCOVERY — `announce` answers mDNS questions for `_lararium._tcp` with a bare service and port
 *                      (candidates only; lar:///ha.ka.ba/lararium/mesh/harbor#/lan-discovery); unset or empty keeps it off.
 *
 * Bootstrap:
 *   The boot prints the catalog Automerge URL to stdout.
 *   Browser vessels read it from location.hash on first visit, cache to
 *   localStorage for offline return visits.
 */

import { createServer }  from "http";
import { networkInterfaces }             from "os";
import WebSocket                         from "isomorphic-ws";
import { resolve }                       from "path";
import { deriveReachFaces, wsUrlForOrigin, crossingBannerLines, originCompositionForFace, assertWaystoneCustody, OriginCustodyRefusal, type ExplicitOriginComposition, type InterfaceTable } from "./lan-address.js";
import { openNodeVessel, openNodeHerm, standNodeFloor, diskSovereignReaders, type AskedStanding, type NodeFloor, type SovereignReaders } from "./open-node-vessel.js";
import type { MountManifest } from "@lararium/mesh";
import { bootFaultReport }                 from "./boot-fault.js";
import { standAs, ORACLE_SOCKET_ROUTE } from "@lararium/mesh";
import { randomBytes } from "node:crypto";
import {
  standRaiseDoor, effectiveLeaseEpochOnBoard, verifyNymSignature, placeCarriedNexuses, unionReadings,
} from "./vessel-raise.js";
import { readCarriedNexuses, type BoardOpener } from "./nexus-carriage.js";
import { larSealHome } from "./vessel-paths.js";
import { materializeSharedLarDoc } from "@lararium/mesh";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { readArchiveOpening } from "./archive-passphrase.js";
import { faceStands } from "./commands/init.js";
import { ARCHIVE_PASSPHRASE_ENV } from "./archive-seal.js";
import { deriveMeshSelf } from "./node-caps.js";
import { parseMeshPeer, snapshotPublicOracle, type LarDoc } from "@lararium/mesh";
import { ratedReceiptRing } from "@lararium/mesh";
import { makeUdsSeat, serveUdsFront, type UdsFront } from "./uds-channel.js";
import type { Socket } from "node:net";
import { makeCustodyHolder } from "./custody-holder.js";
import { custodyFrameHandler } from "./custody-frames.js";
import { FsCustodyIo } from "./custody-io.js";
import { custodyTreeStands } from "./custody-session.js";
import { vesselCustodyHomes } from "./vault-carriers.js";
import { rendezvousDir, standingPath, markerIsOurs } from "@lararium/mesh/rendezvous-path";
import { mountOracleReadFace }          from "./oracle-read-face.js";
import { loadVesselSigningSeed, generateOrLoadVesselIdentity } from "./node-vessel-identity.js";
import { getMempalaceClient }           from "@lararium/mempalace";
import { larDataDir }                   from "./vessel-paths.js";
import type { AutomergeUrl }            from "@automerge/automerge-repo";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { REPO_ROOT }   from "./node-host.js";
import { loadLaresConfig, originDeclaration, hermWaymarkDeclared } from "./lares-config.js";
import { composePronaosFromEnv } from "./pronaos-composition.js";
import { houseOriginsOf } from "./pronaos-adapter.js";
import { mountHermWaymark } from "./bulb-read-face.js";
import { readBulbArtifact } from "./bulb.js";
import { genesisSeedCid, readGenesisSeedBytes, parseGenesisSeed } from "./genesis-artifact.js";
import { createReadinessState, mountReadinessFace, markReadyOnceStanding } from "./readiness-face.js";
import { mountHttpFaceDispatcher } from "./http-face-dispatcher.js";
import { createLanAnnouncement, createLanAnnouncer, dgramLanSocket, type LanDatagramSocket } from "./lan-discovery.js";


// ---------------------------------------------------------------------------
// CLI / env config
// ---------------------------------------------------------------------------

function parseArgs(): { port: number; storageDir: string; genesisDir: string; wikiId: string; rootDir: string; catalogUrl: string | null; askedStanding: AskedStanding; origins: ExplicitOriginComposition } {
  const args = process.argv.slice(2);
  const named = new Set<string>();
  const get  = (flag: string, env: string, fallback: string) => {
    named.add(flag);
    const joined = args.find((a) => a.startsWith(`${flag}=`));          // `--k=v` reads as `--k v`
    const i = args.indexOf(flag);
    const spaced = i !== -1 && !(args[i + 1] ?? "--").startsWith("--") ? args[i + 1] : undefined;
    return (joined !== undefined ? joined.slice(flag.length + 1) : spaced) ?? process.env[env] ?? fallback;
  };
  const cfg        = loadLaresConfig();   // per-daemon resource overrides (~/.lares/config.json)
  const rootDir    = resolve(get("--root", "LAR_ROOT", REPO_ROOT));   // corpus root (genesis)
  // ONE SUBSTRATE DIR, DERIVED THE SAME WAY ON BOTH SIDES. An override here moved the daemon's dir and
  // not its client's — and since the rendezvous derives FROM this dir, a caller who used it stranded the
  // daemon at a socket the CLI could not compute. `LAR_ROOT` remains the way to move a whole vessel,
  // because it moves BOTH sides at once.
  const storageDir = larDataDir();   // the vessel substrate → <lares>/vessel
  // The composable genesis cap: --genesis flag → LAR_GENESIS env → ~/.lares/config.json → repo-relative
  // <rootDir>/genesis. Genesis stays checked-in by default, so a no-config boot lands on the repo's
  // tracked seed exactly as before; an operator sites it under ~ via config.resources.genesis.
  const genesisDir = resolve(get("--genesis", "LAR_GENESIS", cfg.resources?.genesis ?? join(rootDir, "genesis")));
  // `--recipe` names the operator-facing flag; what it carries is a STANDING this vessel asks to
  // stand as, never a kind it is. "Recipe" belongs to the pinned wiki's composition alone.
  const askedStanding = (get("--recipe", "LAR_RECIPE", "lararium") === "herm" ? "herm" : "lararium") as AskedStanding;
  const port   = Number(get("--port", "LAR_PORT", "8080"));
  const wikiId = get("--wiki", "LAR_WIKI", "lares");
  // A flag nothing above names is refused by name: it used to vanish, and a vessel booted on the wrong root.
  const stray = args.find((a) => a.startsWith("--") && !named.has(a.split("=", 1)[0] as string));
  if (stray !== undefined) {
    console.error(`lararium-node: unknown flag ${stray.split("=", 1)[0]} (reads ${[...named].sort().join(" ")})`);
    process.exit(2);
  }
  return {
    port,
    storageDir,
    genesisDir,
    wikiId,
    rootDir,
    catalogUrl: process.env["LAR_CATALOG"] ?? null,
    askedStanding,
    origins: originDeclaration(cfg),
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Publish this vessel's standing beside its socket, and clear it when the vessel goes.
 *
 * The file carries the standing, whether a face was lit at boot, and the pid that wrote it — so a
 * reader can tell a live marker from one a killed process left behind. Best-effort throughout: a
 * vessel that cannot write this still serves, and a caller that finds nothing simply learns nothing.
 */
/** The marker a test harness writes at a root it staged (`tools/test-scratch-marker.mjs`). */
const TEST_SCRATCH_MARKER = ".lar-test-scratch";

const standingDropArmed = new Set<string>();
function publishStanding(storageDir: string, standing: string, faceLit: boolean): void {
  const uid = process.getuid?.() ?? 0;
  const at = standingPath({ root: storageDir, uid });
  try {
    mkdirSync(rendezvousDir(uid), { recursive: true, mode: 0o700 });
    writeFileSync(at, JSON.stringify({ standing, faceLit, pid: process.pid }) + "\n", "utf8");
    // DROP ONLY WHAT IS STILL OURS. The path derives from the ROOT, so a successor standing at the
    // same root writes this very file — and an unconditional delete on the way out removes the
    // standing of a vessel that has already replaced us. Measured on the founding rehearsal: the
    // outgoing daemon's exit landed after the incoming one had published, the next lift read an
    // absent standing, correctly declined to disturb an unknown state, and left the vessel at the
    // waking floor with every sovereign act refusing beneath a step that reported success.
    const drop = (): void => {
      try {
        if (markerIsOurs(readFileSync(at, "utf8"), process.pid)) rmSync(at, { force: true });
      } catch { /* absent or unreadable — nothing of ours to drop */ }
    };
    // One vessel publishes many standings over its life (each composition publishes its own); the drop arms once.
    if (!standingDropArmed.has(at)) {
      standingDropArmed.add(at);
      process.once("exit", drop);
      process.once("SIGTERM", drop);
      process.once("SIGINT", drop);
    }
  } catch { /* a vessel that cannot publish still stands */ }
}

/**
 * M15: name every PENDING social plane — one the probe (or its clean-tail recovery) answered with NO
 * verdict at all, mounted read-only blank with no bytes moved. Before this, the fix that gave `pending`
 * its own status (H2) carried the data all the way into `MountManifest`, but nothing ever printed it: a
 * `degraded` plane logs its own line live (`quarantineDoc`, open-node-vessel.ts), while a `pending` one
 * sat silent — a boot log reader had no way to tell "this plane is fine, just unresolved" from "nothing
 * noticed it at all". Remounting stays out of path: a restart or `lares vessel doctor` re-probes.
 */
function logPendingPlanes(prefix: string, manifest: MountManifest): void {
  for (const e of manifest.entries) {
    if (e.status !== "pending") continue;
    console.log(
      `${prefix} PENDING plane — ${e.documentId} (unresolved: ${e.reason ?? "?"}); ` +
      `mounted read-only, no bytes moved; re-probe with \`lares vessel doctor\` or restart`,
    );
  }
}

/** The `receipts.ring {ratePerMin, horizonDays, burst}` shape an operator may override in
 *  `~/.lares/config.json` (D1, P2.5 iter 4) — read loosely here rather than widening
 *  `LaresConfig`'s own interface, since this lane touches only `uds-channel.ts` and this one
 *  pass-through site in `main.ts`. Absent entirely → `startUdsChannel`'s own default
 *  (`RECEIPT_RING_DEFAULT`). */
interface ReceiptsRingConfig { readonly receipts?: { readonly ring?: { readonly ratePerMin?: number; readonly horizonDays?: number; readonly burst?: number } } }

async function main(): Promise<void> {
  const { port, storageDir, genesisDir, wikiId, rootDir, catalogUrl, askedStanding, origins } = parseArgs();
  // LAN discovery stays OFF unless the operator turns it. An empty value reads as unset, so a compose file may
  // pass the variable through; any other word refuses by name before a face listens.
  const lanDiscoveryMode = process.env["LAR_LAN_DISCOVERY"] || undefined;
  if (lanDiscoveryMode !== undefined && lanDiscoveryMode !== "announce") {
    throw new Error(`[lararium] LAR_LAN_DISCOVERY refuses value ${JSON.stringify(lanDiscoveryMode)}; supported value: announce`);
  }
  const receiptsCfg = loadLaresConfig() as unknown as ReceiptsRingConfig;
  const receiptRing = receiptsCfg.receipts?.ring !== undefined ? ratedReceiptRing(receiptsCfg.receipts.ring) : undefined;
  // ORIGIN CUSTODY STAYS WITH A PRESENT KEEPER. A herm is a waystone: it carries for peers, informs
  // readers, and serves no arrival page, so a Web origin or a Pronaos input handed to it refuses here,
  // before any face listens.
  assertWaystoneCustody(askedStanding, origins, process.env);

  // Mesh standing — derived ONCE for either cap-stack, shared by the herm + lararium
  // branches. Every vessel stands a node on the routing chart: LAR_PUBLIC_URL = its REACHABLE http
  // read-face (the self-peering key, advertised in its dial), LAR_PEERS = bootstrap peers (`<url>#<gate key>`),
  // LAR_SEED = its dial label (else hash-derived); LAR_RADIUS = its carriage standing r.
  const publicUrl = process.env["LAR_PUBLIC_URL"] ?? `http://localhost:${port}`;
  // Each bootstrap peer names its gate key — `<http read-face>#<gate key hex>` — the pin a pull knocks with and
  // proves to. An entry with no key names no gate: refused here, said aloud, and never dialed.
  const peerEntries = (process.env["LAR_PEERS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const peers = peerEntries.flatMap((entry) => {
    const peer = parseMeshPeer(entry);
    if (!peer) console.log(`[lararium] LAR_PEERS entry refused — no gate key to pin (write <url>#<gate key hex>): ${entry}`);
    return peer ? [peer] : [];
  });
  const seedLabel = process.env["LAR_SEED"];
  // The radius reads from the host HERE, where a host environment exists. Passing it inward keeps the
  // mesh module isomorphic — it can hold no opinion about which platform it woke on.
  const radius = Number(process.env["LAR_RADIUS"] ?? 1);
  const meshSelf = deriveMeshSelf(publicUrl, peers, { radius, ...(seedLabel ? { label: seedLabel } : {}) });

  // The reach-faces this vessel answers on. The listen below binds 0.0.0.0, so the vessel answers on
  // every interface the host holds; the banner names them all. A phone on the house network reads a
  // LAN line and types it; `localhost` on that phone names the phone. Web/oracle reach are explicit
  // composition inputs; the relay declaration never promotes itself to either surface.
  const reachFaces = deriveReachFaces({
    port,
    declaredUrl: process.env["LAR_PUBLIC_URL"] ?? null,
    interfaces:  networkInterfaces() as unknown as InterfaceTable,
  });
  // The composition reads the asked standing, so it runs only where its origins are read. A lararium
  // composes relay + read + Web per face before listen, because its crossing banner speaks all three.
  // A herm's boot reads no composed origin (it serves no Web surface and prints no crossing), so it
  // composes none here and an undeclared read origin cannot hold a waystone off its listen.
  const originCompositions = askedStanding !== "lararium" ? null : reachFaces.map((face) => {
    try {
      return originCompositionForFace(face, origins, askedStanding);
    } catch (err) {
      throw new Error(`[lararium] origin composition refused for ${face.origin}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // WS server — path-scoped to /ws. The dispatcher routes each upgrade to the one socket face that claims
  // its path and destroys the rest. Catalog URL advertised via stdout.
  const httpServer = createServer();
  let lanSocket: LanDatagramSocket | null = null;
  const dispatcher = mountHttpFaceDispatcher(httpServer);
  const wss = new WebSocket.Server({ noServer: true });
  // Health names only the local boot posture. It carries no peer, document,
  // Oracle, Pronaos, or causal truth and begins unavailable until setup stands.
  // It binds on a lararium alone; a herm describes nothing to a stranger.
  const readinessState = createReadinessState();
  const readinessFace = mountReadinessFace({ httpServer, state: readinessState, standing: askedStanding, dispatcher });
  // The Pronaos lights only from two explicit operator inputs, and only on a lararium. No build-dir
  // discovery occurs; absent inputs leave the existing Node faces unchanged.
  //
  // THE FIRST ARRIVAL ANSWERS BEFORE THE ARCHIVE IS READ (pronaos#/the-first-arrival, waking-floor#/the-arrival-page).
  // The composition runs here, before `readArchiveOpening` and `standAs` below, and reads only the public genesis
  // dir and the prepared Web artifact — no key, no archive, no face. So a lararium at its waking floor serves its
  // arrival page, worker, seed, seed-named CAS members and the `/.well-known/lar` descriptor exactly as a raised
  // hearth does: liveness ⊥ readiness. Every origin this house answers on is handed in — each reach face on every
  // standing — so the descriptor refuses a mirror that would share an origin with the house.
  const houseOrigins = houseOriginsOf(reachFaces, originCompositions);
  const pronaos = composePronaosFromEnv({ httpServer, genesisDir, dispatcher, standing: askedStanding, houseOrigins });
  // THE RUNG LADDER (pronaos#/the-rung-ladder). A herm stands SILENT by default: it hands over its bulb by CID and
  // describes nothing. `herm.waymark` in the node config lifts it to the WAYMARK rung — one unsigned descriptor at
  // `/.well-known/lar` naming its bulb CID. The temple's descriptor is the lararium's own Pronaos, so a lararium
  // handed the waymark refuses here, before any face listens.
  if (hermWaymarkDeclared(loadLaresConfig())) {
    if (askedStanding !== "herm") throw new Error("[lararium] herm.waymark names a herm's rung — a lararium's arrival rides its own Pronaos");
    const bulb = readBulbArtifact(genesisDir);
    if (!bulb) throw new Error(`[lararium] herm.waymark declared and no genesis bulb at ${genesisDir} — a waymark names a bulb this herm serves`);
    mountHermWaymark({ httpServer, dispatcher, bulbCid: genesisSeedCid(bulb.seedBytes) });
  }

  // The relay socket rides the dispatcher's one upgrade listener on the KNOCK its gate key derives — the vessel
  // registers that path when its gate arms. An upgrade no socket face claims is destroyed before any HTTP 101.

  // Fail-fast on a busy port — the supervised vessel never manages its siblings
  // (12-factor / island sovereignty). A clean message, not an unhandled 'error'
  // crash; `lares vessel stand --restart` stops the incumbent.
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[lararium] port ${port} is already in use — a vessel is already running. Use \`lares vessel stand --restart\` to restart it, or free the port.`);
      process.exit(1);
    }
    throw err;
  });
  httpServer.listen(port, () => {
    console.log(`[lararium] WS relay on :${port} — every interface answers:`);
    for (const f of reachFaces) console.log(`[lararium]   ${wsUrlForOrigin(f.origin)}   (${f.kind})`);
    if (lanDiscoveryMode === "announce") {
      try {
        lanSocket = dgramLanSocket();
        lanSocket.onError((error) => console.log(`[lararium] LAN discovery socket error: ${error.message}`));
        const announcer = createLanAnnouncer({ socket: lanSocket, announcement: createLanAnnouncement(port) });
        announcer.announce();
        console.log(`[lararium] LAN discovery: announcing _lararium._tcp on :${port} (candidates only; a pinned admission alone grants authority)`);
      } catch (error) {
        lanSocket?.close();
        lanSocket = null;
        console.log(`[lararium] LAN discovery socket error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  // ── THE FLOOR: the store's claim, the verb socket's front, and the custody door ahead of every verb ──────────
  // The holder starts empty: a boot holds no vessel key. The custody door stands on the front from the first
  // caller on, so an unlock frame never reaches a verb seat (its credential would ride a receipt digest there).
  const floor = await standNodeFloor(storageDir);
  const custodyHomes = vesselCustodyHomes();
  const holder = makeCustodyHolder({ io: new FsCustodyIo(custodyHomes), homes: custodyHomes });
  const testScratch = existsSync(join(rootDir, TEST_SCRATCH_MARKER));
  if (testScratch) {
    console.log(`[lararium] TEST SCRATCH ROOT — ${rootDir} carries ${TEST_SCRATCH_MARKER}: a harness staged this vessel and its custody opens under the PUBLISHED test route. Never a vessel anyone keeps.`);
  }
  // Late-bound: the door's acts recompose, and the recomposition closes over what `main` builds below.
  let custodyDoor: ((parsed: unknown, sock: Socket) => boolean) | null = null;
  const front = serveUdsFront({ claim: floor.storeClaim, onFrame: (parsed, sock) => custodyDoor?.(parsed, sock) ?? false });

  // ── THE BASE COURSE — every vessel stands as a Herm, and the hearth is what it LIFTS to ──────────────
  // The Herm cap-stack (daemon immune core + a served meshpalace FLOW-map, no wiki, no pool) is the FLOOR
  // of this stack rather than a sibling of it. A lararium is a herm with its hearth fire lit, so the lift
  // reads off what actually stands here, and every vessel reaches `live` through the floor first.
  //
  // TWO FACTS LIFT IT, and they answer different questions. A FACE lit — `lares persona new 0` landed a
  // PersonaGroup onto this place — names what the vessel HOLDS; a place founded and no face yet holds a
  // crossroads, and composing a hearth over it reaches for a face during boot and takes its own standing
  // with it. The ARCHIVE opening names what the vessel can OPEN right now; a hearth whose archive holds
  // shut carries, serves the public shelf, and holds every sovereign act closed until a key arrives.
  //
  // `--recipe herm` DECLINES the lift — a public crossroads an operator means to keep faceless — rather
  // than selecting a different kind of thing. Nothing is ever lowered here: a vessel that cannot open
  // simply never rose (canon: lar:///ha.ka.ba/lares/api/pono/waking-floor).
  //
  // The class stays orthogonal to the CEILING. `personaSlotCeiling("herm") === 0` bars a SEATED persona
  // root on a crossroads; standing at the floor for want of a face bars nothing — `lares persona new`
  // reads its own ceiling and lights the face that lifts the next boot. MAY-HOLD-A-FACE ⊥ HOLDS-ONE-NOW.
  // THE READING CARRIES ITS REASON, AND THE FLOOR MUST SPEAK IT. `readArchiveOpening` answers five
  // kinds — `key-absent`, `key-wrong`, `unreadable`, `nothing-sealed`, `no-seal-expected` — and a boot
  // that folds them to a boolean prints ONE cure for all of them. An operator whose carrier TORE reads
  // "set the passphrase" and re-types a credential that was never the fault. The reading rides whole.
  const opening  = readArchiveOpening();
  const sealShut = !opening.opens;
  const faceLit  = faceStands();
  const standing = standAs(askedStanding !== "herm" && faceLit ? "hearth" : "herm", !sealShut);
  if (standing === "herm" && !sealShut && askedStanding !== "herm" && !faceLit) {
    console.log("[lararium] the PLACE stands and no face is lit — standing at the WAKING FLOOR.");
    console.log("[lararium]   carrying and serving the public shelf; every sovereign act waits.");
    console.log("[lararium]   light the hearth fire:  lares persona new 0 --name '<label>'   (then stand again)");
  }
  if (sealShut) {
    console.log(`[lararium] the archive holds shut (${opening.kind}) — standing at the WAKING FLOOR, faceless by class.`);
    console.log(`[lararium]   ${opening.why}.`);
    console.log("[lararium]   carrying and serving the public shelf; every sovereign act waits.");
    console.log(opening.kind === "vk-sealed"
      ? "[lararium]   open the vessel key: lares vault unlock"
      : opening.kind === "unreadable"
      ? "[lararium]   no passphrase opens a torn carrier — recover it from a backup, then boot again."
      : `[lararium]   light the hearth fire: set ${ARCHIVE_PASSPHRASE_ENV} and boot again.`);
    // NAME NO VERB THAT DOES NOT STAND. The raise DOOR stands (vessel-raise, wired below on the Herm
    // branch); the CLI ceremony that carries a challenge out and a grant back does not. A line naming
    // `lares raise` here would spend the reader's trust the first time they typed it — the same law
    // `holdings-witness` already carries for its own corrections.
    console.log("[lararium]   a recognised operator may also raise it for a visit; the door answers, the CLI verb waits.");
  }


  // ── THE COMPOSITION STANDS ON THE FLOOR ─────────────────────────────────────────────────────────
  // The floor (the store's claim and the verb socket's front) outlives a composition; everything else a boot
  // builds stands as ONE composition that tears down whole. What a composition stands AS reads off what holds
  // at the moment it composes: the face lit then, and whether it was handed the sovereign rows.
  const ctx: BootContext = {
    askedStanding, wikiId, storageDir, genesisDir, rootDir, catalogUrl, wss, httpServer, dispatcher, meshSelf,
    reachFaces, originCompositions, receiptRing, readinessState, readinessFace, pronaos, floor, front,
    lanSocket: () => lanSocket,
  };
  const composeStanding = (sovereign: SovereignReaders | null): Promise<StandingComposition> => {
    const lit = faceStands();
    const as  = standAs(askedStanding !== "herm" && lit ? "hearth" : "herm", sovereign !== null);
    return as === "herm"
      ? composeHermStanding({ ...ctx, standing: as, faceLit: lit }, sovereign)
      : composeHearthStanding({ ...ctx, standing: as, faceLit: lit }, sovereign);
  };
  // A REFUSED BOOT FREES ITS STORE: the front stops answering and the floor releases the name before the fault
  // prints, so the next boot never waits on a composition that never stood.
  //
  // A REFUSAL ABOVE THE FLOOR LEAVES THE FLOOR STANDING. A composition handed the sovereign rows that refuses
  // (a face it cannot prove, a row it cannot read) tears itself down whole; the vessel then composes at the floor
  // and names the fault ONCE, so a supervisor that restarts on exit never loops on a fault no restart cures. Only
  // a floor that itself refuses ends the process.
  let composition: StandingComposition | null = null;
  /** A floor that itself refuses ends the process: nothing lower stands to fall back to. */
  const floorRefused = async (err: unknown): Promise<never> => {
    front.close();
    await floor.release();
    throw err;
  };
  /** Compose with the sovereign rows; a refusal there names itself once and the floor stands instead. */
  const composeOrFloor = async (readers: SovereignReaders | null): Promise<{ stood: StandingComposition; refused?: string }> => {
    if (readers === null) return { stood: await composeStanding(null).catch(floorRefused) };
    try {
      return { stood: await composeStanding(readers) };
    } catch (err) {
      const refused = err instanceof Error ? err.message : String(err);
      console.error(`[lararium] the sovereign composition refused: ${refused}`);
      console.error("[lararium]   standing at the WAKING FLOOR instead — carrying and serving the public shelf; every sovereign act waits.");
      console.error("[lararium]   cure the fault named above, then stand again; a restart alone changes nothing.");
      return { stood: await composeStanding(null).catch(floorRefused), refused };
    }
  };

  // ── THE CUSTODY DOOR'S RECOMPOSITION ────────────────────────────────────────────────────────────
  // An unlock stands a FRESH sovereign composition: the standing one tears down whole, the front holds every
  // caller meanwhile, and the next composition reads the private rows the vessel can open. A lock tears it down
  // and composes at the floor. A signal that lands between two compositions waits for the next one to stand.
  let firstStood: () => void = () => {};
  const first = new Promise<void>((resolve) => { firstStood = resolve; });
  let signalHeld: string | null = null;
  const recompose = async (sovereign: boolean): Promise<{ standing: string; refused?: string }> => {
    await first;
    const prior = composition;
    composition = null;
    await prior?.teardown();
    const reading = sovereign ? readArchiveOpening() : null;
    const out = await composeOrFloor(reading?.opens ? diskSovereignReaders() : null);
    composition = out.stood;
    if (signalHeld !== null) composition.onSignal(signalHeld);
    const shut = reading && !reading.opens ? `the archive holds shut (${reading.kind}): ${reading.why}` : undefined;
    const refused = out.refused ?? shut;
    return { standing: out.stood.standing, ...(refused !== undefined ? { refused } : {}) };
  };
  custodyDoor = custodyFrameHandler({
    holder, recompose, testScratch,
    standing: () => composition?.standing ?? "recomposing",
    onLog: (line) => console.log(`[custody] ${line}`),
  });

  composition = (await composeOrFloor(sealShut ? null : diskSovereignReaders())).stood;
  firstStood();
  // A vessel stands holding no vessel key, whatever it composed over: say so once, with the one verb that opens it.
  if (await custodyTreeStands(new FsCustodyIo(custodyHomes), custodyHomes)) {
    console.log("[custody] this vessel stands holding no vessel key — open it on a terminal: lares vault unlock");
  }
  // ONE pair of handlers for the process: a signal reaches whichever composition stands when it lands.
  const onSignal = (sig: string): void => { if (composition) composition.onSignal(sig); else signalHeld = sig; };
  process.on("SIGINT",  () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}


/** What `main` holds for the process's life and hands to every composition it stands. */
interface BootContext {
  readonly askedStanding: AskedStanding;
  readonly wikiId: string;
  readonly storageDir: string;
  readonly genesisDir: string;
  readonly rootDir: string;
  readonly catalogUrl: string | null;
  readonly wss: WebSocket.Server;
  readonly httpServer: ReturnType<typeof createServer>;
  readonly dispatcher: ReturnType<typeof mountHttpFaceDispatcher>;
  readonly meshSelf: ReturnType<typeof deriveMeshSelf>;
  readonly reachFaces: ReturnType<typeof deriveReachFaces>;
  readonly originCompositions: ReturnType<typeof originCompositionForFace>[] | null;
  readonly receiptRing: number | undefined;
  readonly readinessState: ReturnType<typeof createReadinessState>;
  readonly readinessFace: ReturnType<typeof mountReadinessFace>;
  readonly pronaos: ReturnType<typeof composePronaosFromEnv>;
  /** The store's claim, held for the process's life. */
  readonly floor: NodeFloor;
  /** The verb socket's front: it holds callers while no composition sits. */
  readonly front: UdsFront;
  readonly lanSocket: () => LanDatagramSocket | null;
}

/** One composition's own reading of what it stands as, taken when it composes. */
interface ComposedAs { readonly standing: ReturnType<typeof standAs>; readonly faceLit: boolean; }

/** A composition standing on the floor: everything a boot builds past the store's claim and the listening faces. */
interface StandingComposition {
  readonly standing: "herm" | "hearth";
  /** Stop the PROCESS gracefully: flush, tear down, exit. */
  readonly onSignal: (sig: string) => void;
  /** Tear this composition down and leave the process and its floor standing. */
  readonly teardown: () => Promise<void>;
}

/** The floor every vessel stands on: the daemon immune core and a served FLOW-map, no wiki, no pool. */
async function composeHermStanding(ctx: BootContext & ComposedAs, sovereign: SovereignReaders | null): Promise<StandingComposition> {
  const { askedStanding, wikiId, storageDir, genesisDir, rootDir, catalogUrl, wss, httpServer, dispatcher, meshSelf,
          reachFaces, receiptRing, readinessState, readinessFace, pronaos, floor, front, lanSocket, standing, faceLit } = ctx;

  const pullMs = process.env["LAR_PULL_MS"];   // carriage cadence — tuning, kept separate from membership
  const herm = await openNodeHerm({
    // The name follows what STANDS, never which branch reached here. A vessel the operator asked to keep
    // faceless IS Lares Viales, gods of the crossroads; a hearth waiting on its face stands on the same
    // floor under its own name, and calling it a wayfarer would tell its operator they built the wrong thing.
    hostId:     askedStanding === "herm" ? "lares-viales" : "lararium-node",
    floor,
    sovereign,
    wikiId,
    storageDir,
    genesisDir,
    rootDir,
    wss,
    catalogUrl,
    httpServer,
    dispatcher,
    meshSelf,
    ...(pullMs ? { pullIntervalMs: Number.parseInt(pullMs, 10) } : {}),
    onPhase:    (phase) => console.log(`[herm] phase → ${phase}`),
  });
  console.log(`[herm] live — wiki-less wayfarer | storage: ${storageDir}`);
  console.log(`[herm] catalog:   ${herm.catalogHandleUrl}`);
  console.log(`[herm] oracle:    ${herm.oracleDocUrl}`);
  console.log(`[herm] daemon:    ${herm.daemon.daemonHandle.url}`);
  console.log(`[herm] FLOW-map read-face: proven peers only, over the gated ${ORACLE_SOCKET_ROUTE} socket`);
  logPendingPlanes("[herm]", herm.mountManifest);

  // ── THE RAISE DOOR — the third path onto caps, beside the archive and the asked standing ────────
  // `standAs` above answers what this vessel stands as ALONE. A recognised operator may raise it for the
  // length of their visit, and those caps ride THEIR key: nothing seats a persona root here, and
  // `personaSlotCeiling("herm") === 0` keeps that true whatever stands.
  //
  // It stands HERE rather than beside `standAs` because the fence lives on a board, and the board opens
  // with the vessel. The door reads the lease epoch off the live daemon doc every time it is asked —
  // a remembered epoch would hold a vessel raised past the roll that should have dropped it.
  //
  // Nothing here touches disk. A reboot drops this vessel back to its floor with nothing to resume,
  // which is what keeps SEATED ⊥ RAISED true at rest (waking-floor#the-raise-is-a-vessel-layer-act).
  // RECOGNITION IS THE VERIFIER'S (O9). A grant carries its recogniser's presented admit, signed by that
  // admit's LEAF; every answer re-reads the Nexuses this vessel carries off its OWN replica and raises only
  // on a `held` admit for the Nexus the challenge names. Carried here means either way a vessel carries:
  // a persona's consent or seated chair (`readCarriedNexuses`, empty on a persona-less herm by class), or
  // this PLACE's own counted carrier seal on a held charter's board (`placeCarriedNexuses`).
  //
  // THE CHALLENGE NAMES A NEXUS BY ITS AID — the first carried at boot, primary charter first. The vessel's
  // own key names only the vessel a grant must answer for. A vessel that carries no Nexus emits no challenge:
  // no admit could count, so there is nothing to invite.
  //
  // THE RAISE FENCE'S LEASE RESOURCE IS THE CHALLENGE NEXUS'S AID. `leaseEpoch` reads
  // `effectiveLeaseEpochOnBoard(daemonHandle, raiseNexus)`, so the epoch a raise must match is the one leased under
  // that AID on this vessel's own daemon board — never the vessel's key, never a wiki, never a second Nexus it also
  // carries. A `nexus-rekey` that advances the lease for that AID drops every raise standing against the old epoch;
  // a rekey under any other Nexus leaves this door's fence where it stood.
  const selfKey  = await loadVesselVerifyingKey();
  const sealHome = larSealHome();
  const openRaiseBoard: BoardOpener = async (url, label) =>
    (await materializeSharedLarDoc(herm.repo, url, label).catch(() => null))?.doc();
  const raiseReadings = async () => unionReadings(
    await readCarriedNexuses({ sealHome, ownVesselKey: selfKey, open: openRaiseBoard }),
    await placeCarriedNexuses({ sealHome, ownVesselKey: selfKey, open: openRaiseBoard }),
  );
  const raiseNexus = (await raiseReadings())[0]?.aid ?? null;
  const raiseDoor = standRaiseDoor({
    vesselId:   selfKey,
    nexus:      raiseNexus ?? "",
    floor:      standing,
    leaseEpoch: () => (raiseNexus ? effectiveLeaseEpochOnBoard(herm.daemon.daemonHandle, raiseNexus) : 0),
    readings:   raiseReadings,
    verify:     verifyNymSignature,
    nonce:      () => randomBytes(32).toString("hex"),
  });
  console.log(`[herm] standing:  ${await raiseDoor.standing()} — the raise door answers at the crossroads`);

  // THE VESSEL EMITS ITS OWN CHALLENGE, and emitting it costs nothing. It names what is being raised —
  // vessel, Nexus, epoch, nonce — and carries nothing of what this vessel holds. A forged challenge buys
  // an attacker nothing either: a grant answers only the exact nonce the asking vessel still holds, and
  // an attacker holds no such vessel. One boot, one nonce, until the ask/answer verbs stand.
  if (raiseNexus) {
    const invitation = await raiseDoor.ask();
    console.log(`[herm] raise challenge (hand to a recognised operator; they run \`lares raise sign\`):`);
    console.log(`[herm]   ${JSON.stringify(invitation)}`);
  } else {
    console.log(`[herm] raise door: this vessel carries no Nexus — no admit could count, so no challenge stands`);
  }
  for (const f of reachFaces) console.log(`[herm] ws:        ${wsUrlForOrigin(f.origin)}   (${f.kind})`);

  // The CARRIAGE CROSSROADS (Socket B) — announced when a relay port rode the config (LAR_HERM_RELAY_PORT).
  // The operator hands a family hearth the `ws://` URL + the gate key to dial this crossroads. Absent → no line.
  // The relay binds its OWN port (SEPARATE from the /ws read-face port) on the same host every face names.
  if (herm.carriageRelayPort !== null) {
    const relayPort = herm.carriageRelayPort;
    console.log(`[herm] carriage crossroads (Socket B) — hearths dial this to carry sealed cad bodies:`);
    console.log(`[herm]   gate key: ${herm.carriageRelayGatePubKey}`);
    for (const f of reachFaces) {
      const scheme = f.origin.startsWith("https") ? "wss" : "ws";
      const bareHost = f.host.replace(/:\d+$/, "");
      console.log(`[herm]   dial → ${scheme}://${bareHost}:${relayPort}   (${f.kind})`);
    }
  }

  // Co-located UDS verb-channel for the local `lares` CLI (the daemon answers).
  // THE RENDEZVOUS SITS APART FROM THE DATA. A socket answers "where do two processes meet" under a
  // ~104-byte cap the data home has never heard of; siting it beside the substrate made it inherit the
  // substrate's depth, and a deep root then refused to bind while everything else stood. Both sides
  // derive from the SAME resolved dir, so the client finds what this bound.
  // The socket is the vessel's own claim on its store, bound before its Repo opened; the channel serves it.
  // THE DISPATCHER STANDS BEFORE THE CHANNEL SERVES. The herm branch mounts no wiki, so nothing else
  // awaits the daemon island's `ea`; a verb placed ahead of it commits and no dispatcher runs it.
  await herm.daemon.workerEa;
  await herm.daemon.mountHostWorkingLayer();
  publishStanding(storageDir, standing, faceLit);
  front.attach(makeUdsSeat({
    daemonHandle: herm.daemon.daemonHandle,
    composite:    herm.daemon.composite,
    placeVerb:    (o) => herm.daemon.placeVerb(o),
    claim:        floor.storeClaim,
    repo:         herm.repo,
    ...(receiptRing !== undefined && { ring: receiptRing }),
    onLog: (line) => console.log(`[herm] ${line}`),
  }));
  console.log(`[herm] uds verb-channel on ${floor.storeClaim.socketPath} (perms 0600)`);
  await markReadyOnceStanding(readinessState, herm.daemon.workerEa);

  let hermShuttingDown = false;
  const hermShutdown = async (sig: string): Promise<void> => {
    if (hermShuttingDown) return;
    hermShuttingDown = true;
    console.log(`[herm] ${sig} — graceful shutdown`);
    try {
      readinessFace.dispose();
      pronaos?.dispose();
      front.close();
      lanSocket()?.close();
      httpServer.close();
      dispatcher.dispose();
      await herm.dispose();          // read-face + daemon island flush, then the composed vessel
      await herm.repo.flush();
      console.log("[herm] shutdown complete — state flushed durably");
    } catch (e) {
      console.error("[herm] shutdown error:", e instanceof Error ? e.message : String(e));
    } finally {
      process.exit(0);
    }
  };
  return {
    standing: "herm",
    onSignal: (sig) => void hermShutdown(sig),
    teardown: async () => { await front.detach(); await herm.teardown(); },
  };
}

/** The hearth: the floor's caps with the wiki, the pool and the oracle read-face lit over them. */
async function composeHearthStanding(ctx: BootContext & ComposedAs, sovereign: SovereignReaders | null): Promise<StandingComposition> {
  const { wikiId, storageDir, genesisDir, rootDir, catalogUrl, wss, httpServer, dispatcher, meshSelf,
          reachFaces, originCompositions, receiptRing, readinessState, readinessFace, pronaos, floor, front, lanSocket,
          standing, faceLit } = ctx;

  // Only an asked lararium lifts to the hearth, and an asked lararium composed its origins before listen.
  if (originCompositions === null) throw new Error("[lararium] a hearth stood without its composed origins");

  // A Lararium also stands a first-class mesh-node: it carries the FLOW-map (meshpalace+carriage) from the SAME
  // derived meshSelf — a hearth that navigates the mesh, not a destination beside the roads.
  const result = await openNodeVessel({
    hostId:     "lararium-node",
    floor,
    sovereign,
    wikiId,
    storageDir,
    genesisDir,
    rootDir,
    wss,
    dispatcher,
    catalogUrl,
    meshSelf,
    onPhase: (phase) => {
      console.log(`[lararium] phase → ${phase}`);
    },
  });
  if (result.activeWikiSource === "daemon-marker" && result.activeWikiId !== wikiId) {
    console.log(`[lararium] active wiki marker: ${wikiId} → ${result.activeWikiId}`);
  }
  console.log(`[lararium] live — wiki: ${result.activeWikiId} | storage: ${storageDir} | root: ${rootDir}`);
  console.log(`[lararium] catalog:  ${result.catalogHandleUrl ?? "(none)"}`);
  console.log(`[lararium] oracle:   ${result.oracleDocUrl ?? "(none)"}`);
  console.log(`[lararium] lararium: ${result.larariumDocUrl ?? "(none)"}`);
  console.log(`[lararium] daemon:   ${result.daemon.daemonHandle.url}`);
  logPendingPlanes("[lararium]", result.mountManifest);
  const bootDocFragment = result.oracleDocUrl ?? result.catalogHandleUrl ?? "";
  for (const [i, f] of reachFaces.entries()) console.log(`[lararium] ws:       ${wsUrlForOrigin(originCompositions[i]!.relayOrigin)}#${bootDocFragment}   (${f.kind})`);

  // THE CROSSING, spoken aloud. A leaf's V3 proof commits to the GATE'S key, and the leaf must hold that
  // key OUT-OF-BAND — the challenge names no key, and the relay answers only on the knock that key derives, so
  // a leaf that never received the key reaches no gate at all. That reads correct, and it looks exactly like
  // a dead socket.
  //
  // The gate arms with this vessel's operator verifying key, so this vessel already HOLDS the one thing a
  // crossing leaf cannot obtain for itself. Printing it turns an unperformable ritual into an instruction.
  // The load runs idempotent — the same identity the gate armed with, read back, never a second one.
  const gateIdentity = await generateOrLoadVesselIdentity();
  console.log(`[lararium] gate key: ${gateIdentity.verifyingKey}`);
  console.log("[lararium] browser crossing — open one of these on the device that crosses:");
  const crossings = reachFaces.map((face, i) => ({ face, composition: originCompositions[i]! }));
  for (const line of crossingBannerLines("lararium", crossings, gateIdentity.verifyingKey)) console.log(`[lararium]   ${line}`);
  console.log("[lararium]   (a leaf still needs an ADMIT — the leaf's page shows its own key + the `lares device-admit` line to run here)");

  // The CLIENT dial-out (Socket A) — announced when a peer sync URL rides the config (the same-operator device
  // breath: this vessel DIALS a peer node's /ws carrying the operator's own identity). Read inside the vessel;
  // announced here so the operator sees it. Absent → no dial, no line.
  const joinSync = process.env["LAR_JOIN_SYNC"];
  if (joinSync) {
    const joinGate = process.env["LAR_JOIN_GATE"];
    console.log(`[lararium] nexus dial-out → ${joinSync}${joinGate ? "" : "   (no LAR_JOIN_GATE — fail-closed to inert; a gate-less dial cannot bind the anti-relay proof)"}`);
  }

  // The oracle doc's read-only substrate (the Two-Faced Substrate's content-addressed floor) — served to
  // PROVEN PEERS over THIS http server's gated oracle socket; an HTTP request for it meets the closed door.
  // Write-refusing by construction (send-only, hash-named, no sync). Best-effort: a
  // read-face failure logs and never crashes boot. lar:///…/lararium-identity#/the-oracle-plane.
  // The face serves the genesis-named FLOOR alone (`snapshotPublicOracle`): the allow-set derives from the
  // seed this vessel holds, so a vessel holding NO seed mounts no oracle read-face and never falls to the raw doc.
  let oracleReadFace: { dispose: () => void } | null = null;
  const floorSeedBytes = readGenesisSeedBytes(genesisDir);
  const floorSeed      = floorSeedBytes ? parseGenesisSeed(floorSeedBytes) : null;
  if (result.oracleDocUrl && (!floorSeedBytes || !floorSeed)) {
    console.log(`[lararium] oracle read-face skipped: no genesis seed at ${genesisDir} — the floor derives from the seed, so none is served`);
  } else if (result.oracleDocUrl && floorSeedBytes && floorSeed) {
    try {
      const oracleHandle = await result.repo.find(result.oracleDocUrl as AutomergeUrl);
      const signerSeed   = await loadVesselSigningSeed();
      const floorSeedCid = genesisSeedCid(floorSeedBytes);
      oracleReadFace = await mountOracleReadFace({
        httpServer, oracleHandle, signerSeed, storageDir,
        authShore: result.daemon.authShore,
        sort:      result.socketSorter,
        dispatcher,
        onLog: (line) => console.log(`[lararium] ${line}`),
        exportSnapshot: (doc) => snapshotPublicOracle(doc as LarDoc, floorSeed, floorSeedCid),
      });
      console.log(`[lararium] oracle read-face: proven peers only, over the gated ${ORACLE_SOCKET_ROUTE} socket`);
    } catch (e) {
      console.log(`[lararium] oracle read-face skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Co-located fast path: a Unix-domain verb-channel for the local `lares` CLI —
  // no per-command leaf replica / WS handshake. The WS relay above stays the path
  // for remote mesh peers. (lar:///…/api/lares-lararium-binding)
  // Same rendezvous law as the herm branch above: derived from the resolved substrate dir, sited where a
  // logout cannot reach it (operator ruling — a lararium serves as civic infrastructure).
  // The socket is the vessel's own claim on its store (`claimStore`), bound before its Repo opened; the channel serves it.
  // The daemon island's working layer stands before the channel serves: receipts land in it.
  await result.daemon.workerEa;
  await result.daemon.mountHostWorkingLayer();
  // WHAT THIS VESSEL STANDS AS, published beside the socket that serves it. A standing is decided at
  // boot from the face found then, so a caller holding a face lit AFTERWARD has no way to see the
  // mismatch — and `stand` attaches to a floor and a hearth alike. Written here, once the channel
  // answers: a marker that outlives what it names repeats the fault this vessel already met.
  publishStanding(storageDir, standing, faceLit);
  front.attach(makeUdsSeat({
    daemonHandle: result.daemon.daemonHandle,
    composite:    result.daemon.composite,
    placeVerb:    (o) => result.daemon.placeVerb(o),
    claim:        floor.storeClaim,
    repo:         result.repo,
    ...(receiptRing !== undefined && { ring: receiptRing }),
    onLog: (line) => console.log(`[lararium] ${line}`),
  }));
  console.log(`[lararium] uds verb-channel on ${floor.storeClaim.socketPath} (perms 0600)`);
  await markReadyOnceStanding(readinessState, result.daemon.workerEa);

  // Pre-warm the mempalace read holder so the FIRST recall / recall-into-wake skips
  // the ~8s cold chromadb start (the pool then stays warm for the daemon's life).
  // Background + best-effort: never blocks boot, never fails it when mempalace stands absent.
  void getMempalaceClient().then(
    () => console.log("[lararium] mempalace holder pre-warmed"),
    (e) => console.log(`[lararium] mempalace pre-warm skipped: ${e instanceof Error ? e.message : String(e)}`),
  );

  // ── Graceful, DURABLE shutdown (flush-then-force) ────────────────────────────
  // A bare process.exit() (or a SIGKILL escalation when the handler runs too slow)
  // while an island writes DESYNCS the actively-written doc — the recurring
  // "working never arrived over syncPort" gap. The reliable path:
  //   1. stop new inbound work (uds + http + read-face),
  //   2. flush the MAIN replica — the durable floor for every record that has reached it,
  //   3. tear down the wiki islands (disposeAll → each island flushes its OWN
  //      partition, incl. working, before it acks), and BESIDE them
  //   4. the daemon island gracefully (it flushes its docs + capture WAL),
  //   5. flush MAIN again to land anything that synced during teardown.
  //
  // THE FORCE NEVER CUTS A MAIN FLUSH ON ITS OWN. The budget's REPORT arms before step 2, so a
  // hung main-flush itself gets named too (H3/M4 — a prior shape armed the notice only AFTER
  // main-flush, so a main flush that never returns pinned the process silently forever with no
  // notice ever printed). What a force never does on its own timer is cut a step — only the
  // OPERATOR'S OWN SECOND SIGNAL does that (below), as an event, never a clock.
  //
  // THE "EVERY RECEIPT LANDED" CLAIM MUST BE TRUE. The island pool and the daemon VM BOTH still
  // terminate their own worker past their own handshake timeout ("teardown handshake failed —
  // … terminating anyway") — that claim is THEIRS to make honestly, not main.ts's to overwrite:
  // `disposeAll()`/`daemon.shutdown()` now report which acked and which got cut, and the final
  // line names both rather than asserting every receipt landed when CI's own log showed a
  // handshake timeout landing moments before that exact claim (H3).
  //
  // THE BUDGET'S BOUND, MEASURED. A stand that just LOADed a corpus keeps its wiki island busy with the load's
  // after-waves for tens of seconds; that island cannot read its teardown before the waves drain, and answers
  // nothing for the pool's 10 s handshake window. So a stop right after a LOAD is bounded by the budget, not by
  // the islands (measured on the whole lares corpus: main flush ~4 s, islands silent to 10 s; the same stop after
  // the waves drained: 271 ms whole). A whole stop therefore runs the main flush plus at most the budget plus the
  // re-flush. `port-control.stopIncumbent` NEVER escalates to SIGKILL past its own grace window (M3): past
  // `graceMs` it keeps waiting on this same SIGTERM's own effect and only NAMES the still-live holder
  // (`onPastGrace`) — UNLESS the caller asked `--cut`, which delivers exactly one further signal, read below.
  //
  // THE WAY OUT OF A HUNG TEARDOWN (M4): the operator's OWN SECOND SIGINT/SIGTERM while a
  // shutdown already runs. An EVENT, never a timer — nothing here measures how long to wait
  // before treating it as a cut; the operator's second signal simply IS the cut. It logs the
  // step still outstanding, reflushes main ONE more time if main itself is not the hung step
  // (a hung main-flush gets no further flush attempt — it is already the thing that is stuck),
  // and exits a DISTINCT nonzero code (75, "cut by operator") so a supervisor can tell a cut
  // shutdown apart from a clean one or a flush error. `lares vessel stop --cut` reaches this by
  // delivering that second signal itself, past the grace it already reported (port-control.ts).
  // Only an EXTERNAL SIGKILL (outside this process entirely) cuts anything harder than this: the
  // writes tear nothing (every save lands by rename, and a stranded temp never reads as a
  // chunk), and records still in memory are lost as in any crash.
  const SHUTDOWN_BUDGET_MS  = Number(process.env["LAR_SHUTDOWN_BUDGET_MS"] ?? 6_000);
  const DAEMON_SHUTDOWN_MS  = Math.max(1_000, Math.floor(SHUTDOWN_BUDGET_MS / 2));
  let shuttingDown  = false;
  let cutRequested  = false;
  let currentStep   = "start";
  const spans: string[] = [];
  const running = new Set<string>();
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) {
      if (cutRequested) {
        console.log(`[lararium] ${sig} — a cut is already underway; not re-entered`);
        return;
      }
      cutRequested = true;
      console.error(`[lararium] ${sig} — operator's SECOND signal: cutting the hung step "${currentStep}" now (done so far: ${spans.join(" · ") || "(none)"})`);
      if (currentStep !== "main-flush") {
        try {
          await result.repo.flush();
          console.error("[lararium] cut: main replica reflushed before exit");
        } catch (e) {
          console.error(`[lararium] cut: main reflush failed — ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        console.error("[lararium] cut: main-flush itself is the hung step — exiting with no further flush attempt");
      }
      console.error(`[lararium] cut by operator — exiting 75 (never a clean shutdown's 0, never a flush error's 1)`);
      process.exit(75);
    }
    shuttingDown = true;
    console.log(`[lararium] ${sig} — graceful shutdown (durable flush, budget ${SHUTDOWN_BUDGET_MS}ms; a second ${sig} cuts it — exit 75)`);
    const step = async <T>(name: string, run: () => Promise<T>, onDone?: (ms: number) => void): Promise<T> => {
      const t0 = performance.now();
      currentStep = name;
      running.add(name);
      try { return await run(); } finally {
        running.delete(name);
        const ms = Math.round(performance.now() - t0);
        spans.push(`${name} ${ms}ms`);
        onDone?.(ms);
      }
    };
    // THE REPORT ARMS BEFORE THE FIRST STEP (M4c) — a hung main-flush now gets named too, never
    // left silent until islands/daemon even get a turn. It only ever REPORTS; the operator's own
    // second signal above is the sole cut.
    const pastBudget = setTimeout(() => {
      console.error(`[lararium] shutdown past its ${SHUTDOWN_BUDGET_MS}ms report budget — pending shutdown, still awaiting receipts from: ${[...running].join(", ") || "(none named)"}; done so far: ${spans.join(" · ") || "(none)"}; a second SIGINT/SIGTERM (or \`lares vessel stop --cut\`) cuts it now`);
    }, SHUTDOWN_BUDGET_MS);
    try {
      readinessFace.dispose();
      pronaos?.dispose();
      oracleReadFace?.dispose();
      dispatcher.dispose();
      front.close();
      lanSocket()?.close();
      httpServer.close();
      // M17: print the INSTANT this step resolves, never waiting for the final line below. The
      // final "shutdown complete" line only prints once islands AND daemon have also acked (or
      // been named cut), which the harness's own SIGKILL grace can outrun on a busy island — a
      // local witness-all run measured exactly that (main-flush landed in 4.6s; the islands'
      // handshake went ack-silent past it, and the test's own 15s grace SIGKILLed before the final
      // line ever printed). This line carries the durable-floor claim ALONE, the instant it is true.
      await step("main-flush", () => result.repo.flush(), (ms) =>
        console.log(`[lararium] main replica flushed durably (main-flush ${ms}ms)`));
      // The two teardowns run side by side: a wiki island busy past the budget never holds the daemon island's own
      // flush (its outcomes and markers — a `wiki open` the next boot reads) behind it. Both are AWAITED to their
      // own receipt — nothing here races them against a clock.
      const [islandsResult, daemonResult] = await Promise.all([
        step("islands", () => result.pool.disposeAll()),                            // wiki islands flush their partitions + ack
        step("daemon", () => result.daemon.shutdown(DAEMON_SHUTDOWN_MS)),           // daemon island flushes docs + capture, then acks
      ]);
      clearTimeout(pastBudget);
      await step("main-reflush", () => result.repo.flush());                        // land what synced during teardown
      // THE HONEST LINE (H3): never "every teardown receipt landed" when a handshake timed out
      // and this door terminated the worker anyway. Names exactly what acked and what got cut.
      const daemonLine  = daemonResult.acked ? "daemon ok" : "daemon cut (ack silent)";
      const islandsLine = islandsResult.cut.length === 0
        ? "islands ok"
        : `islands cut (${islandsResult.cut.join(", ")}${islandsResult.acked.length > 0 ? `; ok: ${islandsResult.acked.join(", ")}` : ""})`;
      console.log(`[lararium] shutdown complete — main replica flushed durably; teardown receipts: ${daemonLine} · ${islandsLine} (${spans.join(" · ")})`);
      // L6: a handshake that timed out and got terminated by THIS DOOR'S OWN PATIENCE (never the
      // operator's cut, which already exits 75 above) is a true line that still cannot read as
      // clean to a supervisor watching the exit code alone. Exit 0 only when every receipt
      // genuinely acked; otherwise 76 ("teardown cut by this door's own patience"), distinct from
      // both a clean stop (0) and a flush error (1).
      const everyReceiptAcked = daemonResult.acked && islandsResult.cut.length === 0;
      process.exit(everyReceiptAcked ? 0 : 76);
    } catch (e) {
      clearTimeout(pastBudget);
      console.error("[lararium] shutdown flush error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  };
  return {
    standing: "hearth",
    onSignal: (sig) => void shutdown(sig),
    teardown: async () => { await front.detach(); oracleReadFace?.dispose(); await result.teardown(); },
  };
}

main().catch((err) => {
  if (err instanceof OriginCustodyRefusal) {
    // The refusal still carries the `fatal:` marker: a supervisor reading the boot log (`lares herm`) attests a
    // fault on it, and a refusal without it reads as a stall.
    console.error(`[lararium] fatal: ${err.message}`);
    process.exit(1);
  }
  // Every other fault leads with ONE `fatal:` line naming it (a serde skew names its cure there); detail and the
  // stack ride below.
  const report = bootFaultReport(err);
  for (const line of report.lines) console.error(line);
  process.exit(report.code);
});
