/**
 * persona-ring-cross-operator-admit.test.ts — e2e: a REAL vessel boots, wears a face, and a
 * CROSS-OPERATOR peer holding a live face-join grant record reaches the face's own persona-plane
 * docs through the composed `makeSelfSlotPersonaGroupRing` — while a STRANGER (same proof, no grant)
 * is refused the identical doc.
 *
 * THE GAP THIS CLOSES: `self-slot-persona-ring.test.ts` (unit) and
 * `open-node-vessel-composes-persona-ring.test.ts` (source weld) prove the ring's LOGIC and its WIRE,
 * but nothing before this test drove a live `openNodeVessel` boot, dialed a real WS peer through the
 * real `DaemonAuthGate` (real V3 Ed25519 proof-of-possession + the real in-worker keyhive `verifyPeer`),
 * and watched the ring's `compose` actually widen `selfSlotFedGate` for that peer's sync.
 *
 * THE SHAPE (mirrors two-vessel-mesh.test.ts's founding + live-wire-node-crossing.test.ts's real WS
 * dial, composed together — no new rig invented):
 *   1. A FOUNDER vessel founds (`runInit`) and wears a face (`runFoundTheFace`) — a real PersonaGroup,
 *      a real self-signed device edge, a real persona-KEL inception. It then boots LIVE
 *      (`openNodeVessel`) with a real `DaemonAuthGate` behind a real `ws` server.
 *   2. A grant-holder mints its own real Keyhive identity (`KeyhiveProvider`) and the test hand-signs a
 *      REAL `face-join-grant/v1` record for it — mirroring `face-grant-record.test.ts`'s
 *      `founderEdge`/`signFaceGrantRecord` recipe and the production `face-join` verb's publish step
 *      (`operator-daemon-behavior.ts`) — and writes it onto the face's OWN PersonaGroup persona-plane
 *      bag, live, through the SAME `makeCatalogAccessor`/`storeOf` the ring itself reads.
 *   3. The grant-holder dials the founder's `/ws` with `LarWSClientAdapter`, proves possession of its
 *      own key at the real `DaemonAuthGate` (V3), lands `peerClass: "cross-operator"` at the worker's
 *      `verifyPeer` (operator-daemon-behavior.ts), and — ONLY because the ring's `grants.verify` finds
 *      and verifies its published record — reaches the persona-plane doc.
 *   4. A STRANGER (a second real Keyhive identity, same proof machinery, no grant record) dials the
 *      SAME founder and is refused the SAME doc — the matched-pair control.
 *
 * RED-FIRST: `npm run` this file with the ring-compose block in `open-node-vessel.ts`
 * (`selfSlotFedGate = (await makeSelfSlotPersonaGroupRing(...)).compose(base)`) neutralized
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
  personaScopedBagIds, ed25519SignerFromSeed, LarWSClientAdapter, DAEMON_BAG_ID, NEXUS_DOC_DOMAIN,
  type LarDoc, type LeafIdentity, type NexusDoc,
} from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, signFaceGrantRecord, faceGrantTitle } from "@lararium/keyhive";
import { makeCatalogAccessor } from "@lararium/tw5";
// THE WORKER-SPAWNING PATH IS DIST-ONLY. `open-daemon-vm.ts` resolves its worker script off its OWN
// `import.meta.url`; under vitest's src-aliased dev loop that resolves to a `.js` sibling that never
// exists beside the `.ts` source. Every OTHER e2e in this tree sidesteps a live daemon worker
// (two-vessel-mesh never boots one; blob-sovereignty/pool-mount-intensity point `workerScriptUrl`
// straight at `dist/src/*.js`). This is the first e2e to drive a full `openNodeVessel` boot, so it
// imports ITS OWN package from `dist/` — matching the harness note "e2e loads dist, not src" — so the
// worker path resolves inside dist/src/ end to end. `@lararium/mesh|keyhive|tw5` stay on the vitest
// alias (src); none of them spawn a worker off their own `import.meta.url`.
import {
  runInit, runFoundTheFace, loadIdentityAnchors, openNodeVessel, loadVesselSigningSeed,
  larSealHome, writeNexusDoc,
} from "../../dist/src/index.js";
import { generateOrLoadVesselIdentity } from "../../dist/src/node-vessel-identity.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";

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

/** A cross-operator peer's real Keyhive identity — the SAME machinery `face-join-pair.test.ts` uses,
 *  wired here to a `LeafIdentity` for the real WS/V3 proof exchange. */
async function makePeerIdentity(fill: number): Promise<{ identity: LeafIdentity; rawKey: string }> {
  const seed = new Uint8Array(32).fill(fill);
  const provider = new KeyhiveProvider();
  await provider.init({ seed, eventStore: new InMemoryEventStore() });
  const rawKey = (await provider.whoami()).replace(/^0x/i, "").toLowerCase();
  const identity: LeafIdentity = {
    contactCard: new TextDecoder().decode(await provider.contactCard()),
    peerPubKey: rawKey,
    sign: ed25519SignerFromSeed(seed),
  };
  return { identity, rawKey };
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
  let gatePubKey: string;
  let personaGroupDocIdHex: string;
  let personaBagUrl: string;

  const grantHolderFill = 201;
  const strangerFill    = 202;
  let grantHolderRawKey: string;

  beforeAll(async () => {
    // ── Found + wear a face ──────────────────────────────────────────────────────────────────
    await withLarRoot(FOUNDER.root, () => runInit({ storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis }));
    await withLarRoot(FOUNDER.root, () => runFoundTheFace({ storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis }));

    const anchors = await withLarRoot(FOUNDER.root, async () => loadIdentityAnchors(0));
    if (!anchors?.deviceEdge || !anchors.personaGroupDocIdHex) {
      throw new Error("[persona-ring-cross-operator-admit] founding face carries no anchors — runFoundTheFace did not land a face");
    }
    personaGroupDocIdHex = anchors.personaGroupDocIdHex;
    // `identityDir()` (node-vessel-identity.ts) takes NO `dataDir` and resolves purely off `LAR_ROOT`
    // (`larIdentityDir()`) — honoring a caller-supplied `dataDir` would need a second address-derivation
    // scheme this file's storage law forbids. So EVERY vessel-identity read/write MUST still run inside
    // `withLarRoot` (`tests/harness/with-lar-root.ts`), or it silently reaches the real, non-isolated
    // `~/.local/share/lares/identity` home instead of this test's isolated vessel.
    const founderSeed = await withLarRoot(FOUNDER.root, () => loadVesselSigningSeed());
    const founderIdentity = await withLarRoot(FOUNDER.root, () => generateOrLoadVesselIdentity());
    gatePubKey = founderIdentity.verifyingKey;

    // ── Mint the grant-holder's identity + a REAL, live-published face-join-grant/v1 record ───
    const holder = await makePeerIdentity(grantHolderFill);
    grantHolderRawKey = holder.rawKey;
    const joineeAgentIdHex = `0x${holder.rawKey}`;
    const rec = await signFaceGrantRecord({
      kind: "face-join-grant/v1",
      groupDocIdHex: personaGroupDocIdHex,
      joineeAgentIdHex,
      founderCard: "test-founder-card",
      capEvents: [],
      reKeyed: false,
      regranted: 0,
      reSealed: [],
      founderEdge: anchors.deviceEdge,
      issuedAt: new Date().toISOString(),
    }, ed25519SignerFromSeed(founderSeed));
    const grantTitle = faceGrantTitle(personaGroupDocIdHex, joineeAgentIdHex);

    // ── Open the federation POSTURE ─────────────────────────────────────────────────────────────
    // `selfSlotShareDecision` (self-slot-share.ts) consults the identity-slot ring's widened
    // `selfSlotFedGate` ONLY after `postureGatesCrossOperator(posture, isNexusMember)` passes — and a
    // freshly-founded, charter-less vessel's nexus doc is ABSENT, which `federationPostureFromDoc` folds
    // to PRIVATE (fail-closed). Under PRIVATE, every non-member cross-operator is denied BEFORE the ring
    // is ever reached — an outer relation (this Nexus's stance toward foreign operators) gates an inner
    // one (this face's own PersonaGroup grant). So proving the ring needs this vessel's Nexus posture
    // OPEN, seeded here through `writeNexusDoc` — the founding act's own writer, and the sanctioned way
    // to mint a minimal charter for a vessel that never ran a real seal-seat ceremony.
    // `nexusIdentity` reads a null `sealEpochCid` beside a STANDING charter file as TORN (a half-written
    // seat) rather than "no charter at all" — so the seed needs a well-formed (if synthetic) genesis
    // epoch id, `GENESIS_RE = /^epoch0-[0-9a-f]{64}$/` (nexus-identity.ts), to read as a coherent charter.
    // `composeDoc` (nexus-doc.ts) also refuses `threshold < 1` outright (the whole doc reads torn) — 1
    // with an empty kahu roster is the minimal well-formed shape.
    const nexusSeed: NexusDoc = {
      kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: `epoch0-${"a".repeat(64)}`, kahu: [], federationPosture: "open",
    };
    await withLarRoot(FOUNDER.root, async () => { writeNexusDoc(larSealHome(), nexusSeed); });

    // ── Boot the FOUNDER live — a real ws server behind a real DaemonAuthGate ──────────────────
    http = createServer();
    wss  = new WebSocketServer({ server: http });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    port = (http.address() as AddressInfo).port;

    vessel = await withLarRoot(FOUNDER.root, () => openNodeVessel({
      hostId: "lararium-node", wikiId: "lares",
      storageDir: FOUNDER.storage, genesisDir: FOUNDER.genesis, wss,
    }));

    // Write the grant record onto the LIVE face's own persona-plane bag — the same catalog +
    // store path the ring's `grants.records()` reads, and the same shape the production
    // face-join verb's publish step writes (operator-daemon-behavior.ts).
    const catalog = makeCatalogAccessor(vessel.repo, vessel.catalogHandleUrl);
    const personaBagUri = personaScopedBagIds(personaGroupDocIdHex).persona;
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
    const holder = await makePeerIdentity(grantHolderFill);
    expect(holder.rawKey).toBe(grantHolderRawKey);
    const client = new LarWSClientAdapter({ url: `ws://127.0.0.1:${port}`, identity: holder.identity, aud: DAEMON_BAG_ID, gatePubKey });
    const joineeRepo = new Repo({ network: [client] });
    try {
      const grantTitle = faceGrantTitle(personaGroupDocIdHex, `0x${holder.rawKey}`);
      const outcome = await awaitTitle(joineeRepo, personaBagUrl, grantTitle, 8_000);
      expect(outcome, "the grant-holder never synced the persona-plane doc — the ring did not admit it").toBe("synced");
    } finally {
      await joineeRepo.shutdown();
      client.disconnect();
    }
  }, 20_000);

  test("CONTROL: a stranger (real proof, no grant record) is REFUSED the same persona-plane doc", async () => {
    const stranger = await makePeerIdentity(strangerFill);
    const client = new LarWSClientAdapter({ url: `ws://127.0.0.1:${port}`, identity: stranger.identity, aud: DAEMON_BAG_ID, gatePubKey });
    const strangerRepo = new Repo({ network: [client] });
    try {
      const outcome = await findWithin(strangerRepo, personaBagUrl, 4_000);
      expect(outcome, "a stranger with no grant record synced the persona-plane doc — the gate did not hold").not.toBe("found");
    } finally {
      await strangerRepo.shutdown();
      client.disconnect();
    }
  }, 15_000);
});
