/**
 * persona-ring-cross-operator-admit.test.ts — e2e: a REAL vessel boots, wears a face, and its gate SORTS every
 * proven foreign key before any verdict:
 *   · UNDER PRIVATE (the fail-closed default): a fresh foreign face, presenting at the vessel's real sealed gate,
 *     meets SILENCE — no verdict, no session — so no session verb (a hosted invite mint included) can be asked
 *     at all (the STRANGER probe);
 *   · UNDER OPEN: a face holding a live face-join grant record reaches the face's own persona-plane docs
 *     through the composed `assemblePersonaGroupRing`, while a STRANGER (same presentation, no grant) is seated at
 *     the shelf and refused the identical doc.
 *
 * THE GAP THIS CLOSES: `self-slot-persona-ring.test.ts` (unit) and
 * `open-node-vessel-composes-persona-ring.test.ts` (source weld) prove the ring's LOGIC and its WIRE,
 * but nothing before this test drove a live `openNodeVessel` boot, dialed a real WS peer through the
 * vessel's real SEALED GATE (a Noise IK flight, a sealed presentation, a signed verdict),
 * and watched the ring's `compose` actually widen `selfSlotFedGate` for that peer's sync.
 *
 * THE SHAPE (mirrors two-vessel-mesh.test.ts's founding + live-wire-node-crossing.test.ts's real WS
 * dial, composed together — no new rig invented):
 *   1. A FOUNDER vessel founds (`runInit`) and wears a face (`runFoundTheFace`) — a real PersonaGroup,
 *      a real self-signed device edge, a real persona-KEL inception. It then boots LIVE
 *      (`openNodeVessel`) with its sync gate behind a real HTTP face dispatcher.
 *   2. A grant-holder wears a face (a synthetic chain at the founder's Nexus) and the test hand-signs a
 *      REAL `face-join-grant/v1` record for its face key — mirroring `face-grant-record.test.ts`'s
 *      `founderEdge`/`signFaceGrantRecord` recipe and the production `face-join` verb's publish step
 *      (`operator-daemon-behavior.ts`) — and writes it onto the face's OWN PersonaGroup persona-plane
 *      bag, live, through the SAME `makeCatalogAccessor`/`storeOf` the ring itself reads.
 *   3. The grant-holder dials the founder's gate with `LarWSClientAdapter` at the founder's pinned sovereign
 *      key, is sorted a stranger under the OPEN posture, and — ONLY because the ring's `grants.verify` finds
 *      and verifies its published record — reaches the persona-plane doc.
 *   4. A STRANGER (a second face, same presentation, no grant record) dials the SAME founder and is refused
 *      the SAME doc — the matched-pair control.
 *
 * RED-FIRST: `npm run` this file with the ring-compose block in `open-node-vessel.ts`
 * (`selfSlotFedGate = (await assemblePersonaGroupRing(...)).compose(base)`) neutralized
 * (`if (false && …)`) and the grant-holder assertion FAILS identically to the stranger — the ring is
 * load-bearing, not an incidental pass. Restored, it GREENS. See the handback for the measured run.
 *
 * Excluded from default `pnpm test`; opt-in with:
 *   pnpm vitest run --config vitest.e2e.config.ts
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-ring-cross-operator-admit
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  personaScopedBagIds, ed25519SignerFromSeed, DAEMON_BAG_ID, LarWSClientAdapter, hearthPinIndex, nexusAidOf,
  type GateBundlePin, type LarDoc, type NexusDoc,
} from "@lararium/mesh";
import { strangerFace, type CrossingFace } from "../../probes/crossing-synthetic-world.js";
import { signFaceGrantRecord, faceGrantTitle } from "@lararium/keyhive";
import { makeCatalogAccessor } from "@lararium/tw5";
// THE WORKER-SPAWNING PATH IS DIST-ONLY. `open-daemon-vm.ts` resolves its worker script off its OWN
// `import.meta.url`; under vitest's src-aliased dev loop that resolves to a `.js` sibling that never
// exists beside the `.ts` source. Every OTHER e2e in this tree sidesteps a live daemon worker
// (two-vessel-mesh never boots one; blob-sovereignty/pool-mount-intensity point `workerScriptUrl`
// straight at `dist/src/*.js`). This is the first e2e to drive a full `openNodeVessel` boot, so it
// imports ITS OWN package from `dist/` — matching the harness note "e2e loads dist, not src" — so the
// worker path resolves inside dist/src/ end to end. `@lararium/mesh|keyhive|tw5` stay on the vitest
// alias (src); none of them spawn a worker off their own `import.meta.url`.
//
// ONE MODULE INSTANCE HOLDS THE CUSTODY SEAT. A founding seats the holder that keeps the vessel key in its own
// module's seat (`custody-seat.ts`), and every sealed row reads through that seat. `dist/` and `src/` each carry
// their own copy of the seat, so the founding runs from `dist/` too: a place founded through the `src/` `runInit`
// seats a key the `dist/` face founding, anchor read and boot below can never reach, and each refuses
// `CustodyLocked`.
import {
  runInit, runFoundTheFace, foundSeedCharter, loadIdentityAnchors, openNodeVessel,
  larSealHome, readNexusDoc, writeNexusDoc, seatFaceRoute,
} from "../../dist/src/index.js";
import { mountHttpFaceDispatcher } from "../../dist/src/http-face-dispatcher.js";
import { hearthSovereignPin } from "../../dist/src/hearth-sovereign-pin.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";
// The founder's own seed charter, as the Stable founding act wrote it: the posture rides beside its lineage, and
// turning the posture moves no seat and no AID (the face's edge binds that AID).
let seedCharter: NexusDoc | null = null;
const charterDocAt = (federationPosture: "open" | "private"): NexusDoc => ({ ...seedCharter!, federationPosture });
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT, openTestCustody } from "../found-route.js";
// The founding runs from dist/, so the face route seats on dist/'s copy of the seam.
seatFaceRoute(async () => [TEST_SLOT]);
import { loadFaceAtomOfGroup } from "../../src/face-atom-store.js";

// ---------------------------------------------------------------------------
// Test isolation
// ---------------------------------------------------------------------------

const TEST_ROOT = join(tmpdir(), `lar-persona-ring-e2e-${Date.now()}`);
const FOUNDER   = { root: TEST_ROOT, storage: join(TEST_ROOT, "data", "lares", "vessel"), genesis: join(TEST_ROOT, "genesis") };

const BUILT_GENESIS = join(new URL("../../", import.meta.url).pathname, "..", "..", "genesis");

function shipHearthEngine(genesisDir: string): void {
  mkdirSync(genesisDir, { recursive: true });
  cpSync(BUILT_GENESIS, genesisDir, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
}

mkdirSync(FOUNDER.storage, { recursive: true });
if (!existsSync(join(BUILT_GENESIS, "seed.json"))) {
  throw new Error(
    `[persona-ring-cross-operator-admit] no hearth engine at ${BUILT_GENESIS} — ` +
      "run `pnpm --filter @lararium/node build:genesis` first (CI's `pnpm -r build` covers it).",
  );
}
shipHearthEngine(FOUNDER.genesis);

// `withLarRoot` now lives at `tests/harness/with-lar-root.ts` — the ONE sanctioned in-process
// vessel-identity isolation pattern (Follow-on 3). Previously reinvented here and in
// `two-vessel-mesh.test.ts` near-identically; both now import the one copy.

/** A cross-operator peer: a face at the founder's Nexus, wearing its own session signer and presenting NO admit (a
 *  foreign face holds none at this Nexus). Its face key is the key a grant record names. */
async function makePeerFace(nexusAid: string, label: string): Promise<{ face: CrossingFace; faceKey: string }> {
  const face = await strangerFace(nexusAid, label);
  return { face, faceKey: face.certificate.scope.faceKey };
}

/** Dial the founder's sealed sync gate as `face`. `anergy` resolves with the leaf's own word when the gate answered it nothing. */
function dialFounder(url: string, pin: GateBundlePin, face: CrossingFace): { client: LarWSClientAdapter; anergy: Promise<string> } {
  const pins = hearthPinIndex();
  pins.put("hearth-founder", pin);
  let onAnergy: (reason: string) => void = () => { /* set below */ };
  const anergy = new Promise<string>((resolve) => { onAnergy = resolve; });
  const client = new LarWSClientAdapter({
    url, pins, hearth: "hearth-founder", nexus: pin.nexus, audience: DAEMON_BAG_ID,
    deadlines: { draw(lapse) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } },
    presentation: { certificate: face.certificate, signer: face.signer, arm: face.arm, history: face.history },
    retryInterval: 250, onAnergy: (reason) => onAnergy(reason),
  });
  return { client, anergy };
}

/** Race a doc-find against a bound timeout — a denied peer never resolves, so "pending" reads as refused
 *  (mirrors live-wire-node-crossing.test.ts's denial race). */
async function findWithin(repo: Repo, url: string, ms: number): Promise<"found" | "unavailable" | "pending"> {
  return Promise.race([
    repo.find<LarDoc>(url as AutomergeUrl).then(() => "found" as const, () => "unavailable" as const),
    new Promise<"pending">((r) => setTimeout(() => r("pending"), ms)),
  ]);
}

/** Resolve once the doc carries `title`, or "timeout" — proves content actually crossed, not just a
 *  handle resolving to an empty shell. */
async function awaitTitle(repo: Repo, url: string, title: string, ms: number): Promise<"synced" | "timeout" | "unavailable"> {
  let handle;
  try {
    handle = await Promise.race([
      repo.find<LarDoc>(url as AutomergeUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("unavailable")), ms)),
    ]);
  } catch {
    return "unavailable";
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    const check = (): void => {
      if (handle.doc()?.tiddlers?.[title]) { clearTimeout(timer); resolve("synced"); }
    };
    handle.on("change", check);
    check();
  });
}

describe("PersonaGroup identity-slot ring — a real boot, a real grant, a real refusal", () => {
  let http: Server;
  let wss: WebSocketServer;
  let vessel: NodeVesselResult;
  let port: number;
  let gatePin: GateBundlePin;
  let nexusAid: string;
  let syncUrl: string;
  let personaGroupId: string;
  let personaBagUrl: string;

  const grantHolderLabel = "ring grant holder";
  const strangerLabel    = "ring stranger";
  let grantHolderFaceKey: string;

  beforeAll(async () => {
    // ── Found + wear a face ──────────────────────────────────────────────────────────────────
    await withLarRoot(FOUNDER.root, () => direct(runInit)({ storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    // The seed charter seats before the face, as the Stable founding act seats it: the face binds its AID.
    await withLarRoot(FOUNDER.root, () => foundSeedCharter({ name: "founder", readBack: async () => {} }));
    seedCharter = await withLarRoot(FOUNDER.root, async () => readNexusDoc(larSealHome()));
    await withLarRoot(FOUNDER.root, () => direct(runFoundTheFace)({ storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis }));

    const anchors = await withLarRoot(FOUNDER.root, async () => loadIdentityAnchors(0));
    if (!anchors?.deviceEdge || !anchors.personaGroupId) {
      throw new Error("[persona-ring-cross-operator-admit] founding face carries no anchors — runFoundTheFace did not land a face");
    }
    personaGroupId = anchors.personaGroupId;
    // `identityDir()` (node-vessel-identity.ts) takes NO `dataDir` and resolves purely off `LAR_ROOT`
    // (`larIdentityDir()`) — honoring a caller-supplied `dataDir` would need a second address-derivation
    // scheme this file's storage law forbids. So EVERY vessel-identity read/write MUST still run inside
    // `withLarRoot` (`tests/harness/with-lar-root.ts`), or it silently reaches the real, non-isolated
    // `~/.local/share/lares/identity` home instead of this test's isolated vessel.
    // The grant record signs under the key the founder's device edge licenses: the face's atom, not the place.
    const founderSeed = await withLarRoot(FOUNDER.root, async () => { await openTestCustody(); return loadFaceAtomOfGroup(personaGroupId); });
    if (!founderSeed) throw new Error("[persona-ring-cross-operator-admit] the founding face holds no atom");
    const aid = nexusAidOf(seedCharter);
    if (!aid) throw new Error("[persona-ring-cross-operator-admit] the seed charter names no Nexus identifier");
    nexusAid = aid;

    // ── The grant-holder's face + a REAL, live-published face-join-grant/v1 record naming its face key ───
    const holder = await makePeerFace(nexusAid, grantHolderLabel);
    grantHolderFaceKey = holder.faceKey;
    const joineeAgentIdHex = `0x${holder.faceKey}`;
    const rec = await signFaceGrantRecord({
      kind: "face-join-grant/v1",
      groupId: personaGroupId,
      joineeAgentIdHex,
      founderCard: "test-founder-card",
      capEvents: [],
      reKeyed: false,
      serial: 1,
      reSealed: [],
      founderEdge: anchors.deviceEdge,
    }, ed25519SignerFromSeed(founderSeed));
    const grantTitle = faceGrantTitle(personaGroupId, joineeAgentIdHex);

    // ── Open the federation POSTURE ─────────────────────────────────────────────────────────────
    // The gate's sorter answers a proven foreign key only when some Nexus the vessel stands in reads OPEN — and a
    // hearth's seed charter rests PRIVATE from its founding (fail-closed). Under PRIVATE every such key is SILENCE
    // before the ring is ever reached — an outer relation (this Nexus's stance toward strangers) gates an inner one
    // (this face's own PersonaGroup grant). So proving the ring turns the seed charter's posture OPEN through
    // `writeNexusDoc`, the founding act's own writer: the lineage, the seat and the AID stay as the founding wrote them.
    const nexusSeed: NexusDoc = charterDocAt("open");
    await withLarRoot(FOUNDER.root, async () => { writeNexusDoc(larSealHome(), nexusSeed); });

    // ── Boot the FOUNDER live — its sync gate stands behind a real HTTP face dispatcher ─────────
    http = createServer();
    const dispatcher = mountHttpFaceDispatcher(http);
    wss  = new WebSocketServer({ noServer: true });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    port = (http.address() as AddressInfo).port;

    vessel = await withLarRoot(FOUNDER.root, () => openNodeVessel({
      hostId: "lararium-node", wikiId: "lares",
      storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis, wss, dispatcher,
    }));
    // The pin a dialer holds for the founder's gate: the public half of the sovereign bundle its custody root derives.
    gatePin = await withLarRoot(FOUNDER.root, async () => hearthSovereignPin(nexusAid));
    syncUrl = `ws://127.0.0.1:${port}${gatePin.route}`;

    // Write the grant record onto the LIVE face's own persona-plane bag — the same catalog +
    // store path the ring's `grants.records()` reads, and the same shape the production
    // face-join verb's publish step writes (operator-daemon-behavior.ts).
    const catalog = makeCatalogAccessor(vessel.repo, vessel.catalogHandleUrl);
    const personaBagUri = personaScopedBagIds(personaGroupId).persona;
    const store = await catalog.storeOf(personaBagUri);
    if (!store) throw new Error("[persona-ring-cross-operator-admit] the face's persona-plane bag is unresolved");
    await store.put(
      { tiddler: { title: grantTitle, text: JSON.stringify(rec), kind: "face-join-grant" }, meta: { authority: "test-mint" } },
      { kind: "lares-verb", requestId: "persona-ring-e2e-grant" },
    );
    const resolvedUrl = await catalog.urlOf(personaBagUri);
    if (!resolvedUrl) throw new Error("[persona-ring-cross-operator-admit] the persona-plane bag never registered on the catalog");
    personaBagUrl = resolvedUrl;
  }, 120_000);

  afterAll(async () => {
    try {
      await vessel?.repo.flush();
      await vessel?.pool.disposeAll();
      await vessel?.daemon.shutdown(3_000);
      await vessel?.repo.flush();
    } catch { /* best-effort */ }
    try { vessel?.stopTick(); } catch { /* already stopped */ }
    await new Promise<void>((res) => wss?.close(() => http?.close(() => res())));
    await new Promise((r) => setTimeout(r, 200));
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch { /* best-effort */ }
  }, 30_000);

  test("★ a cross-operator peer holding a VALID face-join grant record reaches the face's persona-plane doc ★", async () => {
    const holder = await makePeerFace(nexusAid, grantHolderLabel);
    expect(holder.faceKey).toBe(grantHolderFaceKey);
    const { client } = dialFounder(syncUrl, gatePin, holder.face);
    const joineeRepo = new Repo({ network: [client] });
    try {
      const grantTitle = faceGrantTitle(personaGroupId, `0x${holder.faceKey}`);
      const outcome = await awaitTitle(joineeRepo, personaBagUrl, grantTitle, 8_000);
      expect(outcome, "the grant-holder never synced the persona-plane doc — the ring did not admit it").toBe("synced");
    } finally {
      client.disconnect();
      await joineeRepo.shutdown();
    }
  }, 20_000);

  test("CONTROL: a stranger (real proof, no grant record) is REFUSED the same persona-plane doc", async () => {
    const stranger = await makePeerFace(nexusAid, strangerLabel);
    const { client } = dialFounder(syncUrl, gatePin, stranger.face);
    const strangerRepo = new Repo({ network: [client] });
    try {
      const outcome = await findWithin(strangerRepo, personaBagUrl, 4_000);
      expect(outcome, "a stranger with no grant record synced the persona-plane doc — the gate did not hold").not.toBe("found");
    } finally {
      client.disconnect();
      await strangerRepo.shutdown();
    }
  }, 15_000);

  test("★ STRANGER under PRIVATE: a fresh foreign key proven at the real gate meets silence — no verdict, no session, no mint ★", async () => {
    // The operator closes the Nexus; the gate's sorter reads the posture fresh for the very next socket.
    const nexusPrivate: NexusDoc = charterDocAt("private");
    await withLarRoot(FOUNDER.root, async () => { writeNexusDoc(larSealHome(), nexusPrivate); });
    try {
      const stranger = await makePeerFace(nexusAid, "ring private stranger");
      const { client } = dialFounder(syncUrl, gatePin, stranger.face);
      const strangerRepo = new Repo({ network: [client] });
      // The gate's own word: it logs each dial it let fall silent. Read it off the vessel's warnings.
      const silences: string[] = [];
      const realWarn = console.warn;
      console.warn = (...args: unknown[]): void => { silences.push(args.map(String).join(" ")); realWarn(...args); };
      try {
        for (let i = 0; i < 100 && !silences.some((l) => l.includes("fell silent: sorted-silent")); i++) await new Promise((r) => setTimeout(r, 100));
        // The gate answers a PRIVATE stranger nothing: no verdict, no session, so no session verb can be asked.
        expect(silences.some((l) => l.includes("fell silent: sorted-silent")), "the gate never fell silent on a PRIVATE stranger").toBe(true);
        expect(await findWithin(strangerRepo, personaBagUrl, 2_000)).not.toBe("found");
      } finally {
        console.warn = realWarn;
        client.disconnect();
        await strangerRepo.shutdown();
      }
    } finally {
      // CONTROL rides the other tests: the OPEN posture admits the grant-holder at the same gate.
      const nexusOpen: NexusDoc = charterDocAt("open");
      await withLarRoot(FOUNDER.root, async () => { writeNexusDoc(larSealHome(), nexusOpen); });
    }
  }, 30_000);
});
