import { defineConfig } from "vitest/config";
import { alias } from "./vitest.alias";

/**
 * THE THRASHER CLASSES — the one place they are named, and the reader's only source.
 *
 * A suite standing any of these holds a live resource that starves the box under 12-way file
 * parallelism: a `repo.find()` races its sync to "unavailable", a nested-worker ESM import of an
 * EXISTING dist file reds ERR_MODULE_NOT_FOUND under FD pressure, a python holder times out. Each such
 * suite passes green alone, and a DIFFERENT set reds every run — the signature of contention, never
 * logic. The cure runs them in ONE serial project (`fileParallelism: false`) while the light files keep
 * their full-parallel project.
 *
 * `tests/heavy-roster-is-complete.test.ts` IMPORTS this array and applies it to every suite under
 * `tests/`, so a class named here is a class the reader checks. An earlier shape stated the classes in
 * prose here and re-encoded them as regexes there; the prose named three and the regexes covered two,
 * and four suites standing a python holder sat in the parallel project under a green reader. Two
 * hand-written lists of one fact drift, and the one that carries authority drifts silently. Add a class
 * HERE and the reader picks it up; there is no second list to forget.
 */
export const THRASHERS = [
  { why: "binds a listener", rx: /new WebSocketServer|createServer\s*\(|\.listen\s*\(/ },
  { why: "stands a nested island", rx: /new Worker\s*\(|worker_threads/ },
  { why: "stands a python holder", rx: /composePalace|makeContentPalace|make\w*Palace|composeEncoder|\bspawn\(\s*python/ },
] as const;

/** The suites the serial project takes. Kept complete by the reader that imports {@link THRASHERS}. */
export const heavy = [
  // real WebSocketServer + Repo + sealed-gate crossings
  "tests/browser-crossing.test.ts",
  // real face gates + FLOW-map read-faces on four listeners: the gate-native herm relay
  "tests/herm-carriage-relay.test.ts",
  "tests/nexus-client-dial.test.ts",
  "tests/live-wire-node-crossing.test.ts",
  "tests/crossing-matrix.test.ts",
  "tests/sibling-channel-stand.test.ts",
  "tests/bulb-kindle.test.ts",
  "tests/bulb-serves-boot-cas-alone.test.ts",
  "tests/herm-reshares-public-blob.test.ts",
  "tests/herm-cas-transit.test.ts",
  "tests/herm-rungs.test.ts",
  "tests/one-seed-one-cid.test.ts",
  // nested worker_threads islands booting the full TW5 kernel off dist
  "tests/blob-sovereignty.test.ts",
  "tests/event-routing.test.ts",
  "tests/federation-shore.test.ts",
  "tests/m3-breathing.test.ts",
  "tests/repo-in-island.test.ts",
  "tests/vessel-island-pool.test.ts",
  "tests/pool-mount-intensity.test.ts",
  "tests/surface-mount-vessel-path.test.ts",
  "tests/surface-mount-real-island.test.ts",
  "tests/verb-tiddler-dispatch.test.ts",
  // Surfaced by `tests/heavy-roster-is-complete.test.ts`, which applies the criteria above to every
  // suite in the directory. These four stood a live listener or a nested island while running in the
  // parallel project — the exact condition the split exists to prevent.
  "tests/carriage-cap.test.ts",
  "tests/flow-map-read-face.test.ts",
  "tests/ea-breath-watchdog.test.ts",
  "tests/island-protocol.test.ts",
  // The python-holder class, surfaced when the reader began importing the config's OWN class list
  // instead of re-encoding two of its three. Each spawns a real python+chroma holder from within a
  // vitest worker — the third thrasher the config always named and the reader never checked.
  "tests/content-palace.test.ts",
  "tests/persistence-palace.test.ts",
  "tests/formpalace.test.ts",
  "tests/palace-caps.test.ts",
  "tests/lares-query.test.ts",
  "tests/guest-import.test.ts",
  "tests/embed-cap.test.ts",
  "tests/graph-cap.test.ts",
  "tests/search-cap.test.ts",
  // Listener-binding suites surfaced by `tests/heavy-roster-is-complete.test.ts`: each stands a real
  // HTTP/VM listener and was running in the parallel project — the exact condition the split exists
  // to prevent.
  "tests/daemon-vm-dvr-document-boundary.test.ts",
  "tests/daemon-vm-replica-restart.test.ts",
  "tests/daemon-vm-storage-accounting.test.ts",
  "tests/http-face-dispatcher.test.ts",
  "tests/face-gate-server.test.ts",
  "tests/flow-floor-gate.test.ts",
  "tests/own-fleet-sync.test.ts",
  "tests/same-operator-refold.test.ts",
  "tests/flow-floor-resweep.test.ts",
  "tests/face-gate-server-bounds.test.ts",
  "tests/intent-relay.test.ts",
  "tests/intent-relay-door.test.ts",
  "tests/intent-relay-admission.test.ts",
  "tests/intent-relay-storm.test.ts",
  "tests/intent-relay-wired.test.ts",
  "tests/http-face-integration.test.ts",
  "tests/pronaos-adapter.test.ts",
  "tests/pronaos-composition.test.ts",
  "tests/reach-face-watch.test.ts",
  "tests/pronaos-kindle.test.ts",
  "tests/pronaos-public-artifact.test.ts",
  "tests/readiness-face.test.ts",
  "tests/flow-closed-door.test.ts",
  "tests/herm-answers-the-knock.test.ts",
  "tests/flow-read-face-shore.test.ts",
  "tests/floor-porch.test.ts",
  "tests/wire-daemon-bootstrap.test.ts",
  // A real HTTP listener and a sealed-gate crossing (the joinee dials its hearth through the production mount).
  "tests/dial-presentation-joinee.test.ts",
  // A raw HTTP listener that answers the upgrade as a gate stand-in, so the node dial socket meets real frames.
  "tests/node-dial-socket.test.ts",
  // The herm's relay port on a real HTTP listener: persona-KEL drops over HTTP, silence for every upgrade.
  "tests/herm-relay-port.test.ts",
];

/**
 * What the parallel project leaves out. Exported because the reader checks that every suite is reachable
 * by SOME project, and a reader that re-states this list is a second copy of one fact — the drift this
 * file already paid for once.
 */
export const mainExclude = ["tests/e2e/**", ...heavy];

/**
 * The suites' custody: a when-needed seat that founds or opens a scratch custody at the first sealed row a suite
 * touches under its own temp root (`tests/support/scratch-custody-setup.ts`). Both projects load it.
 */
const setupFiles = ["tests/support/scratch-custody-setup.ts"];
/**
 * Room for a founding. A vector that reaches a sealed row under a fresh root founds that root's custody first, and
 * the founding derives a key from a passphrase (about half a second alone, several under a loaded run). The default
 * five seconds then measures the box, never the vector, so every vector here gets this much.
 */
const testTimeout = 30_000;

export default defineConfig({
  resolve: { alias },
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // The host oversubscribes under default per-core parallelism: dozens of these files each spawn their OWN
    // heavy child — a WebSocketServer, a nested worker_threads TW5 island, or a live Python+chroma holder — ON
    // TOP of vitest's worker-per-core pool, so peak concurrency runs far past the core count and starves. A
    // starved find() races to "unavailable", a nested import reds ERR_MODULE_NOT_FOUND, a python holder times
    // out — a DIFFERENT set each run. Capping the pool holds total concurrency (workers + their children) near
    // the core budget; paired with the serial `heavy` project below, no resource storm ever stands.
    maxWorkers: 4,
    minWorkers: 1,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "heavy",
          environment: "node",
          include: heavy,
          setupFiles,
          testTimeout,
          // Serial: one live WS server / nested island at a time — no cross-file resource storm.
          fileParallelism: false,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "main",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          setupFiles,
          testTimeout,
          exclude: mainExclude,
        },
      },
    ],
  },
});
