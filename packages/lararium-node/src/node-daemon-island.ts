/** Node daemon-island entry point.
 *
 * The node vessel contributes transport and custody only.  Session capture lives in the
 * Python source-stream service; this worker deliberately receives no capture sink, payload,
 * spool, or vector-store configuration.
 */

import { parentPort } from "worker_threads";
import { runSovereignWorker, vesselRestAsker, vesselCustodyWriter, vesselDyadAsker, vesselSessionDoor } from "./sovereign-island-model.js";
import { makeOperatorDaemonBehavior } from "@lararium/keyhive/operator-daemon-behavior";
import { mountDiskProjection, mountedDiskProjector } from "./island-behaviors.js";
import { answerShore } from "./shore-verb.js";
import type { IslandContext } from "@lararium/tw5";
import { makeBagTierReader } from "./vessel-bag-tier.js";
import { HULLS_FULL, type JournalCursor, type JournalEntry, type JournalKind } from "@lararium/mesh";
import { runReconcileCadence } from "./sensorium-lifecycle-verbs.js";
import { islandStorageDirOf, nodeSealedStoreShore } from "./sealed-store-island.js";
import { fileJournal } from "./vessel-journal-file.js";
import { admitJournalAppend } from "./journal-append-gate.js";
import { larDataDir, larSealHome } from "./vessel-paths.js";
import { readKahuCabalBoard } from "./commands/nexus-cabal.js";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// The Boundary-1 inversion, in the worker: keyhive stays fs-blind, node supplies the writer that lands the
// keyhive Archive in the sovereign identity home. This island holds no vessel key, so the writer HANDS the bytes
// to the vessel through the custody write door, and the vessel's main thread seals them under the key it holds.
// The island names the carrier, never a path.
// THE REST DOOR: this island's Repo keeps no store for the slot documents it mints, so each mint asks the vessel
// to rest the new document and records its binding only on the vessel's acknowledgment.
const restOnVessel = parentPort ? vesselRestAsker(parentPort) : null;
const sealOnVessel = parentPort ? vesselCustodyWriter(parentPort) : null;
// The vessel keeps the live fleet reading on its main thread and answers the daemon through this door.
const dyadOnVessel = parentPort ? vesselDyadAsker(parentPort) : null;
// THE SESSION SIGN DOOR: this island holds no session key. It names the invocation a session placed, and the vessel's
// main thread answers from that session: its certificate, its proof subject, the vessel's own chain, each signature.
const sessionsOnVessel = parentPort ? vesselSessionDoor(parentPort) : null;

const JOURNAL_KINDS: ReadonlySet<JournalKind> = new Set(["bag-projected"]);

function asCursor(raw: unknown): JournalCursor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const epoch = row["epoch"];
  const writer = row["writer"];
  const seq = row["seq"];
  if (typeof epoch !== "string" || epoch.length === 0) return undefined;
  if (typeof writer !== "string" || writer.length === 0) return undefined;
  if (!Number.isInteger(seq) || (seq as number) < 1) return undefined;
  return { epoch, writer, seq: seq as number };
}

function byKind(kind: JournalKind | undefined): (entry: JournalEntry) => boolean {
  if (!kind) return () => true;
  return (entry) => entry.kind === kind;
}

runSovereignWorker((manifest) => {
  const journalEpoch = `boot-${randomUUID()}`;
  const journal = fileJournal(join(larDataDir(), "journal.jsonl"), journalEpoch, "node-daemon");
  const projectedBags = new Set<string>();
  for (const entry of journal.since()) {
    if (entry.kind !== "bag-projected") continue;
    projectedBags.add((entry.data as { bagId: string }).bagId);
  }
  const islandStorageDir = islandStorageDirOf(manifest);
  // THE ISOMORPHIC SEED LIFT: a NODE vessel reaches py/R, so it passes HULLS_FULL — makeDaemonBehavior's
  // ONE cap-gated seedDaemonProtocol (onEa) then seeds this vessel's FULL enactable flow-set (all three)
  // plus the Ui/Persona/Circle seeds, from the single site. This entry seeds nothing of its own. The seeded flow-set IS this vessel's advertised enactable-list a personagroup peer reads.
  const base = makeOperatorDaemonBehavior(manifest, {
    // The daemon wiki projects to `<root>/wikis/daemon/` through the same projector a wiki island mounts
    // (its working layer's carriers reach disk; the control-plane bag beneath holds no mirror); the
    // option also lights the daemon's projection cap.
    onBoot:         (ctx: IslandContext) => mountDiskProjection(manifest, ctx, { journal }),
    ...(restOnVessel ? { restDocuments: restOnVessel } : {}),
    ...(dyadOnVessel ? { dyadReading: dyadOnVessel } : {}),
    // THE KAHU PREDICATE'S BOARD: this vessel's charter and the admission acts its carriage board carries, read at
    // ACCESS through the island's own repo. Every write door into system canon asks it (kahu-canon-reach).
    kahuCabal:      (ctx: IslandContext) => () => readKahuCabalBoard(ctx.repo, larSealHome(), manifest.daemonAuth?.placeVerifyingKey),
    // THE SEALED STORE'S SHORE: the content-key holder stands in this island, beside its Keyhive identities, over
    // the vessel's own `sealed/`, `cad/` and cleartext-local tiers. An island with no directory of its own gets
    // none, and its `sealed-*` verbs refuse by name.
    ...(islandStorageDir !== null ? { sealedStore: nodeSealedStoreShore(islandStorageDir) } : {}),
    ...(sessionsOnVessel ? { sessionProof: sessionsOnVessel } : {}),
    ...(sealOnVessel ? {
      persistVeilArchive: (bytes: Uint8Array) => sealOnVessel("veil", bytes),
    } : {}),
    // A person's answers at this island's disk shore: the same door a wiki island stands (`claimShoreVerb`),
    // answered from the projector this island mounts. `lares shore` reaches it by this verb, beside the
    // `wiki-act` line into the active wiki's island (`shore-core.ts`).
    shore:          async (args) => {
      const projector = mountedDiskProjector();
      return projector === null
        ? { ok: false, refusal: "no-disk-shore", why: "the daemon island mounts no disk projection" }
        : answerShore(projector, args);
    },
    events:         async (args, signal) => {
      const kindRaw = args["kind"];
      const wait = args["wait"] === true;
      const kind = typeof kindRaw === "string" && JOURNAL_KINDS.has(kindRaw as JournalKind)
        ? kindRaw as JournalKind
        : undefined;
      const cursor = asCursor(args["since"]);
      const match = byKind(kind);
      if (wait) {
        const waitOptions = {
          ...(cursor ? { cursor } : {}),
          ...(signal ? { signal } : {}),
        };
        const entry = await journal.waitFor(match, waitOptions);
        return { entries: [entry] };
      }
      return { entries: journal.since(cursor).filter(match) };
    },
    journalAppend:  async (args, invocation) => {
      const verdict = admitJournalAppend(invocation, args);
      if (!verdict.ok) {
        console.warn(`[journal-append] refused ${verdict.refusal}: ${verdict.why}`);
        return { ok: false, refusal: verdict.refusal, why: verdict.why };
      }
      if (projectedBags.has(verdict.append.data.bagId)) return { ok: true, deduped: true };
      const entry = journal.append(verdict.append.kind, verdict.append.data);
      projectedBags.add(verdict.append.data.bagId);
      return { ok: true, entry };
    },
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
