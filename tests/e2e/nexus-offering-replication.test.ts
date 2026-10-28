/**
 * nexus-offering-replication — the first real receiver crossing for an immutable plugin gift.
 *
 * A publishes one signed offering. B joins A's Nexus over Socket A and asks for the deterministic
 * Crossroads board. Both daemons materialize that board from the island alone, so B carries A's record
 * whichever document its dial names; the request narrows B's read, it does not open the crossing.
 * B then inspects only its own cleartext CAS. The test seeds the good byte locally as a custody
 * control; it does not claim that generic plugin bytes already have a carriage path.
 *
 * AN INSPECTION WRITES NOTHING, READ OVER A STORE AT REST. A live daemon keeps saving and compacting the
 * documents it syncs, the board among them, so two readings of its store differ with no inspection between
 * them. The witness therefore waits for the receiver daemon's own exit (its stop flushes and closes the store),
 * reads the WHOLE store, inspects through the direct holder, and reads the whole store again.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { growStagedQuorum, openStagedJoinee, vesselStorageDir, type CliResult, type LarInstance, type StagedJoinee } from "../harness/instance.js";
import { runNexusInspectOffering, NexusOfferingInspectError } from "../../packages/lararium-node/src/commands/nexus-offering-inspect.js";
import { ownedStore } from "../../packages/lararium-node/src/owned-store.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
// The PoC signed offering (R2c) — a LOCAL source dir this suite publishes from, never genesis (H3:
// genesis carries the boot set alone since the Streams retirement; it was never a registry of what an
// operator may offer).
const HIGHLIGHT_SOURCE = join(REPO_ROOT, "packages/lararium-tw5/offerings/highlight");

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every regular file under a store at rest, by path and bytes. Nothing gets carved out: no holder stands, so no
 * document, sync state or content byte moves on its own. The store's `.holder` claim is a socket, which carries
 * no bytes and reads ENXIO; an observation error on any regular file fails the witness.
 */
function snapshotStoreAtRest(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) out.push(`${path.slice(root.length)}:${readFileSync(path).toString("hex")}`);
    }
  };
  walk(root);
  return out.sort();
}

async function inspectUntil(
  vessel: LarInstance,
  offeringCid: string,
  byteStatus: "partial" | "complete" | "invalid",
  timeoutMs = 45_000,
): Promise<CliResult> {
  const started = Date.now();
  let last: CliResult | undefined;
  while (Date.now() - started < timeoutMs) {
    last = await vessel.cli(["nexus", "offering", "inspect", offeringCid, "--json"]);
    const data = last.json?.["data"] as { inspection?: { byteStatus?: string } } | undefined;
    if (last.json?.["ok"] === true && data?.inspection?.byteStatus === byteStatus) return last;
    await sleep(500);
  }
  throw new Error(`receiver did not observe ${byteStatus} within ${timeoutMs}ms: ${JSON.stringify(last?.json)}`);
}

let fleet: StagedJoinee;
let receiver: LarInstance;
let offeringCid = "";
let boardUrl = "";
let pluginCid = "";
let pluginBytes = Buffer.alloc(0);

beforeAll(async () => {
  fleet = await openStagedJoinee({
    tag: "offering-board",
    daemonEnv: { LAR_SAME_ORIGIN: "true" },
    // The persona-bound daemon requires a lease frontier. This is the existing staged-founder rite,
    // kept here as harness setup rather than production behavior.
    riteA: async (source, rootA) => {
      await growStagedQuorum(source, rootA, ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]);
      // Publishing signs in a held persona's name, and with several faces open the publish names its founding face.
      // The publish door opens the source's store directly, so it runs here, while NO daemon holds that
      // store (the single-owner law): a write beside a live holder lands on disk the holder never reads,
      // and the source's daemon would carry a board without the gift.
      const published = await source(["nexus", "publish", "plugins", "--source", HIGHLIGHT_SOURCE, "--apply", "--face", "0", "--json"]);
      if (published.code !== 0 || published.json?.["ok"] !== true) {
        throw new Error(`source offering publish failed: ${published.stdout}\n${published.stderr}`);
      }
      const data = published.json?.["data"] as { offeringCid?: string; boardUrl?: string; blobCount?: number } | undefined;
      offeringCid = data?.offeringCid ?? "";
      boardUrl = data?.boardUrl ?? "";
      if (!offeringCid || !boardUrl) throw new Error(`source publish returned no offering coordinates: ${published.stdout}`);
      if (!data?.blobCount || data.blobCount < 1) throw new Error(`source publish announced an EMPTY gift: ${published.stdout}`);
      // The signed record names the one plugin byte; the source's CAS materializes it only once its daemon boots.
      const inspect = await source(["nexus", "offering", "inspect", offeringCid, "--json"]);
      const inspection = inspect.json?.["data"] as { bytes?: { held?: string[]; missing?: string[] } } | undefined;
      pluginCid = inspection?.bytes?.held?.[0] ?? inspection?.bytes?.missing?.[0] ?? "";
      if (!pluginCid) throw new Error(`source offering did not name its plugin CID: ${inspect.stdout}`);
    },
    // The source's own CAS supplies the exact local byte used for the receiver custody control.
    beforeB: async (source) => {
      pluginBytes = readFileSync(join(vesselStorageDir(source), "cas", pluginCid));
    },
    joinDocUrl: () => boardUrl,
  });
  receiver = fleet.B ?? (() => { throw new Error(`receiver never stood: ${fleet.joinGate ?? "unknown"}`); })();
}, 300_000);

afterAll(async () => { await fleet?.stop(); });

describe("source offering → receiver Crossroads evidence", () => {
  test("replicates the exact board and reports missing, held, and corrupt local CAS bytes", async () => {
    const receiverCas = join(vesselStorageDir(receiver), "cas");
    const receiverByte = join(receiverCas, pluginCid);
    // The highlight offering never rides the boot set (H3: genesis carries the boot set alone, never
    // an operator's own offerings) — a freshly joined receiver starts with no local bytes for it at all.
    expect(existsSync(receiverByte), "a fresh receiver starts with NO local bytes for an offered (never boot-set) plugin").toBe(false);

    const seedBefore = readFileSync(join(receiver.root, "genesis", "seed.json"));
    const missing = await inspectUntil(receiver, offeringCid, "partial");
    expect(missing.json?.["data"]).toMatchObject({
      transport: { status: "complete", source: "local-crossroads", remoteFetch: false },
      inspection: { status: "verified", byteStatus: "partial", adoption: "not-requested" },
      antigen: { status: "unavailable", reason: "not-configured" },
    });
    expect((missing.json?.["data"] as { bytes: { missing: string[] } }).bytes.missing).toEqual([pluginCid]);

    // A good byte is an explicit local custody control, never a hidden transport assertion.
    mkdirSync(receiverCas, { recursive: true });
    writeFileSync(receiverByte, pluginBytes);
    const complete = await inspectUntil(receiver, offeringCid, "complete");
    expect((complete.json?.["data"] as { bytes: { held: string[] } }).bytes.held).toEqual([pluginCid]);

    writeFileSync(receiverByte, Buffer.from("deliberately corrupt receiver bytes"));
    const corrupt = await inspectUntil(receiver, offeringCid, "invalid");
    expect((corrupt.json?.["data"] as { bytes: { invalid: string[] } }).bytes.invalid).toEqual([pluginCid]);

    expect(readFileSync(join(receiver.root, "genesis", "seed.json"))).toEqual(seedBefore);
  }, 120_000);

  test("refuses an unknown record", async () => {
    const wrongCid = `sha256:${"f".repeat(64)}`;
    const unknown = await receiver.cli(["nexus", "offering", "inspect", wrongCid, "--json"]);
    expect(unknown.code).not.toBe(0);
    expect(unknown.json?.["ok"]).toBe(false);
    expect(String((unknown.json?.["error"] as { message?: string } | undefined)?.message)).toMatch(/not present|offering/i);

  }, 60_000);

  // LAST IN THE FILE: this vector stops the receiver's daemon, and every reading below rides the store at rest.
  test("an inspection writes nothing: the receiver's store at rest reads byte-equal across a direct inspect", async () => {
    // THE HANDSHAKE: the daemon's own exit. Its stop flushes every save and closes its store before the process
    // leaves, so from here on no holder writes this directory.
    await receiver.stopDaemonOnly();
    const store = vesselStorageDir(receiver);
    const boardDocId = boardUrl.replace(/^automerge:/, "");
    const before = snapshotStoreAtRest(store);
    expect(before.some((row) => row.startsWith(`/${boardDocId.slice(0, 2)}/${boardDocId.slice(2)}/`)), "the board's chunks sit inside the witnessed store").toBe(true);

    // The inspect runs through the direct holder: it claims the store for its act, and its adapter closes before
    // the claim releases.
    const inspected = await receiver.cli(["nexus", "offering", "inspect", offeringCid, "--json"]);
    expect(inspected.json?.["ok"], inspected.stdout + inspected.stderr).toBe(true);
    expect((inspected.json?.["data"] as { via?: string } | undefined)?.via, "no daemon stands: the act held the store itself").toBe("direct");
    expect((inspected.json?.["data"] as { bytes?: { invalid?: string[] } }).bytes?.invalid, "the same reading the live inspect gave last").toEqual([pluginCid]);
    expect(snapshotStoreAtRest(store)).toEqual(before);

    // KNOWN POSITIVE for the instrument: one byte planted in the store moves the reading.
    const planted = join(store, "known-positive-probe");
    writeFileSync(planted, "x");
    expect(snapshotStoreAtRest(store)).not.toEqual(before);
    rmSync(planted);
    expect(snapshotStoreAtRest(store)).toEqual(before);

    // A board from the wrong Nexus island refuses. The read runs over a copy of the store, taken while it rests.
    const wrongRoot = mkdtempSync(join(tmpdir(), "lares-wrong-island-"));
    const priorRoot = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = wrongRoot;
    try {
      const copy = join(wrongRoot, "store");
      cpSync(store, copy, { recursive: true });
      await expect(ownedStore(copy, (repo) => runNexusInspectOffering({
        offeringCid,
        storageDir: copy,
        ownVesselKey: "f".repeat(64),
        repo,
      }))).rejects.toBeInstanceOf(NexusOfferingInspectError);
    } finally {
      if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
      rmSync(wrongRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
