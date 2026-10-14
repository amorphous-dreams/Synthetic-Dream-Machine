/**
 * The node daemon address wire: `openNodeVessel` names its daemon doc from the vessel's own bootstrap and from
 * no other record. The opener runs for real over a scratch root (marker, test custody, genesis seed) with a fake
 * `wss` (no listener binds). The oracle carries a daemon row in the genesis seed it materializes; the bootstrap
 * file carries the vessel's own row or none.
 *
 * Two seams stand beneath the opener. The store claim is wrapped so the file reads every claim a boot takes; a
 * boot that refuses frees its own claim, and the file's closing release of each finds nothing left to free. The
 * doc-load probe is a
 * fake that answers `ok` at once, so the daemon mount skips the probe child and its patience.
 *
 * Each address is an invalid Automerge url on purpose: with the probe answered, the mount reaches
 * `waitHandle`, whose `repo.findWithProgress` throws `Invalid AutomergeUrl: '<url>'` naming the url it
 * receives. The refusal text reads WHICH record the boot took its address from, and no daemon island stands.
 *
 * The file stands real boots (tool processes, a store claim, a Repo), so it sits in the serial `heavy` project.
 */
import { generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { DAEMON_BAG_ID, materializeGenesisIsland, tiddlerText, type GenesisSeed } from "@lararium/mesh";
const held = vi.hoisted(() => ({ claims: [] as Array<{ release: () => Promise<void> }> }));

vi.mock("../src/owned-store.js", async (orig) => {
  const real = await orig<typeof import("../src/owned-store.js")>();
  return {
    ...real,
    claimStore: async (...args: Parameters<typeof real.claimStore>) => {
      const claim = await real.claimStore(...args);
      held.claims.push(claim);
      return claim;
    },
  };
});
vi.mock("../src/doc-load-probe.js", async (orig) => ({
  ...(await orig<typeof import("../src/doc-load-probe.js")>()),
  makeChildProcessDocLoadProbe: () => ({ probe: async (documentId: string) => ({ documentId, status: "ok" as const }) }),
}));

import { openNodeVessel } from "../src/open-node-vessel.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { larBootstrapPath } from "../src/vessel-paths.js";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const BOOTSTRAP_ADDRESS = "automerge:wire-bootstrap-daemon";
const ORACLE_ADDRESS = "automerge:wire-oracle-daemon";

/** Ambient dial and relay switches that would change what a boot stands; scrubbed for the file's duration. */
const AMBIENT = ["LAR_JOIN_SYNC", "LAR_JOIN_GATE", "LAR_CARRIAGE_RELAY", "LAR_HERM_RELAY_PORT"] as const;
const TIMEOUT_MS = 180_000;

let root: string;
let priorRoot: string | undefined;
const priorAmbient = new Map<string, string | undefined>();
let boots = 0;
let seeds = 0;

beforeAll(async () => {
  priorRoot = process.env["LAR_ROOT"];
  for (const name of AMBIENT) { priorAmbient.set(name, process.env[name]); delete process.env[name]; }
  root = mkdtempSync(join(tmpdir(), "wire-daemon-bootstrap-"));
  for (const tool of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    execFileSync("node", [join(repoRoot, "tools", tool), root], { env: { ...process.env, LAR_ROOT: root }, stdio: "pipe" });
  }
  process.env["LAR_ROOT"] = root;
  // A boot loads its vessel key and never mints one, so the staged root gets its key here, inside the custody the
  // seeding founded (the suites' scratch custody opens it under the published test route).
  await generateOrLoadVesselIdentity();
}, TIMEOUT_MS);

afterAll(async () => {
  for (const claim of held.claims) await claim.release();
  for (const [name, value] of priorAmbient) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
}, TIMEOUT_MS);

/** A genesis dir whose oracle seed names `oracleDaemon` under the daemon bag title (none: the shipped seed). */
function genesisCarrying(oracleDaemon: string | null): string {
  const dir = join(root, `genesis-${seeds++}`);
  mkdirSync(dir, { recursive: true });
  symlinkSync(join(repoRoot, "genesis", "cas"), join(dir, "cas"));
  const seed = JSON.parse(readFileSync(join(repoRoot, "genesis", "seed.json"), "utf8")) as { tiddlers: Record<string, unknown> };
  if (oracleDaemon !== null) {
    seed.tiddlers[DAEMON_BAG_ID] = { tiddler: { title: DAEMON_BAG_ID, text: oracleDaemon }, meta: { authority: "genesis" } };
  }
  writeFileSync(join(dir, "seed.json"), JSON.stringify(seed));
  return dir;
}

/** Write the vessel's bootstrap with `bootstrapDaemon` (none: a bootstrap that names no daemon doc). */
function writeBootstrap(bootstrapDaemon: string | null): void {
  const path = larBootstrapPath();
  mkdirSync(dirname(path), { recursive: true });
  const tiddlers = bootstrapDaemon === null ? {} : { [DAEMON_BAG_ID]: { text: bootstrapDaemon } };
  writeFileSync(path, JSON.stringify({ text: JSON.stringify({ tiddlers }) }));
}

/** Open the node vessel and return the refusal it raises. */
async function bootRefusal(oracleDaemon: string | null, bootstrapDaemon: string | null): Promise<string> {
  boots += 1;
  writeBootstrap(bootstrapDaemon);
  const storageDir = join(root, `storage-${boots}`);
  mkdirSync(storageDir, { recursive: true });
  const refusal = await openNodeVessel({
    hostId: "wire", wikiId: "wire", storageDir, rootDir: root,
    wss: new EventEmitter() as never,
    genesisDir: genesisCarrying(oracleDaemon),
  } as never).then(() => null, (e: unknown) => e);
  expect(refusal, "the boot is refused before any daemon island stands").toBeInstanceOf(Error);
  return (refusal as Error).message;
}

describe("the node daemon address wire", () => {
  test("a bootstrap and an oracle row in conflict: the boot takes the bootstrap's address", async () => {
    const message = await bootRefusal(ORACLE_ADDRESS, BOOTSTRAP_ADDRESS);
    expect(message).toContain(BOOTSTRAP_ADDRESS);
    expect(message).not.toContain(ORACLE_ADDRESS);
  }, TIMEOUT_MS);

  test("a bootstrap naming no daemon doc refuses by name although the oracle carries a daemon row", async () => {
    const message = await bootRefusal(ORACLE_ADDRESS, null);
    expect(message).toMatch(/names no daemon doc/);
    expect(message).not.toContain(ORACLE_ADDRESS);
  }, TIMEOUT_MS);

  test("CONTROL: a bootstrap naming no daemon doc refuses by name when the oracle carries none either", async () => {
    const message = await bootRefusal(null, null);
    expect(message).toMatch(/names no daemon doc/);
  }, TIMEOUT_MS);

  test("the doctored genesis seed materializes an oracle that carries the daemon row", async () => {
    const seed = JSON.parse(readFileSync(join(genesisCarrying(ORACLE_ADDRESS), "seed.json"), "utf8")) as GenesisSeed;
    const oracle = await materializeGenesisIsland(new Repo(), seed, "wire-daemon-bootstrap");
    expect(tiddlerText(oracle.doc()?.tiddlers?.[DAEMON_BAG_ID])).toBe(ORACLE_ADDRESS);
  }, TIMEOUT_MS);

  test("a composition that stands down rests its store: the Repo's own shutdown closes its storage adapter, once, before the boot answers", async () => {
    const order: string[] = [];
    const shutdown = vi.spyOn(Repo.prototype, "shutdown").mockImplementation(async function (this: Repo, ...args: []) {
      shutdown.mockRestore();
      order.push("repo.shutdown begins");
      try { return await Repo.prototype.shutdown.apply(this, args); } finally { order.push("repo.shutdown ends"); }
    });
    const realClose = DurableNodeFSStorageAdapter.prototype.close;
    const close = vi.spyOn(DurableNodeFSStorageAdapter.prototype, "close").mockImplementation(async function (this: DurableNodeFSStorageAdapter) {
      order.push("storage.close");
      return realClose.apply(this);
    });
    const claimsBefore = held.claims.length;
    try {
      // The boot refuses after its Repo stood (the daemon mount fails), so the whole standing composition stands down.
      await bootRefusal(ORACLE_ADDRESS, BOOTSTRAP_ADDRESS);
    } finally { close.mockRestore(); shutdown.mockRestore(); }
    expect(held.claims.length, "CONTROL: this boot took a store claim, so a Repo stood over a store").toBeGreaterThan(claimsBefore);
    // The engine's shutdown closes the storage it holds. A save the Repo's debounce starts after that lands no byte
    // (`durable-storage-adapter` counts it late), so the store the claim gives up next holds no write in flight.
    expect(order).toEqual(["repo.shutdown begins", "storage.close", "repo.shutdown ends"]);
  }, TIMEOUT_MS);
});
