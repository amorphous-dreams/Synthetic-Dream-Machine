/** Node daemon-island entry point.
 *
 * The node vessel contributes transport and custody only.  Session capture lives in the
 * Python source-stream service; this worker deliberately receives no capture sink, payload,
 * spool, or vector-store configuration.
 */

import { parentPort } from "worker_threads";
import { runSovereignWorker, vesselRestAsker, vesselCustodyWriter, vesselDyadAsker } from "./sovereign-island-model.js";
import { makeOperatorDaemonBehavior } from "@lararium/keyhive/operator-daemon-behavior";
import { mountDiskProjection } from "./island-behaviors.js";
import type { IslandContext } from "@lararium/tw5";
import { runVaultVerb } from "./archive-passphrase.js";
import { makeBagTierReader } from "./vessel-bag-tier.js";
import { HULLS_FULL } from "@lararium/mesh";
import { runReconcileCadence } from "./sensorium-lifecycle-verbs.js";

// The Boundary-1 inversion, in the worker: keyhive stays fs-blind, node supplies the writer that lands the
// keyhive Archive in the sovereign identity home. This island holds no vessel key, so the writer HANDS the bytes
// to the vessel through the custody write door, and the vessel's main thread seals them under the key it holds.
// The island names the carrier, never a path.
//
// `vault` — the SAME inversion for the at-rest seal LIFECYCLE (#60). It runs IN this worker (the one that
// owns the M3 re-seal), so seal/rotate re-persist the carriers AND update THIS process.env seal policy in
// one act — no un-rotate. keyhive stays fs-blind; node supplies the fs+crypto lifecycle handler.
// THE REST DOOR: this island's Repo keeps no store for the slot documents it mints, so each mint asks the vessel
// to rest the new document and records its binding only on the vessel's acknowledgment.
const restOnVessel = parentPort ? vesselRestAsker(parentPort) : null;
const sealOnVessel = parentPort ? vesselCustodyWriter(parentPort) : null;
// The vessel keeps the live fleet reading on its main thread and answers the daemon through this door.
const dyadOnVessel = parentPort ? vesselDyadAsker(parentPort) : null;

runSovereignWorker((manifest) => {
  // THE ISOMORPHIC SEED LIFT: a NODE vessel reaches py/R, so it passes HULLS_FULL — makeDaemonBehavior's
  // ONE cap-gated seedDaemonProtocol (onEa) then seeds this vessel's FULL enactable flow-set (all three)
  // plus the Ui/Persona/Circle seeds, from the single site. This entry no longer re-seeds (the two-site
  // wart is gone). The seeded flow-set IS this vessel's advertised enactable-list a personagroup peer reads.
  const base = makeOperatorDaemonBehavior(manifest, {
    // The daemon wiki projects to `<root>/wikis/daemon/` through the same projector a wiki island mounts
    // (its working layer's carriers reach disk; the control-plane bag beneath holds no mirror); the
    // option also lights the daemon's projection cap.
    onBoot:         (ctx: IslandContext) => mountDiskProjection(manifest, ctx),
    ...(restOnVessel ? { restDocuments: restOnVessel } : {}),
    ...(dyadOnVessel ? { dyadReading: dyadOnVessel } : {}),
    ...(sealOnVessel ? {
      persistArchive:     (bytes: Uint8Array) => sealOnVessel("archive", bytes),
      persistVeilArchive: (bytes: Uint8Array) => sealOnVessel("veil", bytes),
    } : {}),
    vault:          (verb, args) => runVaultVerb(verb, args),
    // The crossing gate reads each bag's declared cap-tier off this vessel's hearth manifests,
    // so an outward transfer (veil-ward -> public-ward) refuses without the kahu-cabal.
    bagTier:        makeBagTierReader(),
    runnableHulls:  HULLS_FULL,
  });
  return {
    onEa:     (ctx) => base.onEa(ctx),
    onSignal: (type, raw, ctx) => base.onSignal(type, raw, ctx),
    // The daemon-loop reconcile CADENCE at its real hook (F5), FEATURE-GATED OFF: runReconcileCadence()
    // reads LIFECYCLE_GATES_DEFAULT → daemonLoopReconcile:false → a no-op ({ran:false}). There and unused;
    // flipping the gate ON turns onHooAnu into the k8s-style continuous reconcile over every sensorium.
    onHooAnu: (ctx) => { runReconcileCadence(); return base.onHooAnu(ctx); },
  };
});
