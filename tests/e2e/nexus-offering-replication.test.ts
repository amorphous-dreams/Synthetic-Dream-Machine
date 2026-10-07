/**
 * nexus-offering-replication — the first real receiver crossing for an immutable plugin gift.
 *
 * A publishes one signed offering. B joins A's Nexus over Socket A and asks for the deterministic
 * Crossroads board. Both daemons materialize that board from the island alone, so B carries A's record
 * whichever document its dial names; the request narrows B's read, it does not open the crossing.
 * B then inspects only its own cleartext CAS. The test seeds the good byte locally as a custody
 * control; it does not claim that generic plugin bytes already have a carriage path.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStagedJoinee, vesselStorageDir, type CliResult, type LarInstance, type StagedJoinee } from "../harness/instance.js";
import { runNexusInspectOffering, NexusOfferingInspectError } from "../../packages/lararium-node/src/commands/nexus-offering-inspect.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** An Automerge NodeFS document lives under `<first two base58 chars>/<rest>/`. */
const DOC_SHARD = /^[1-9A-HJ-NP-Za-km-z]{2}$/;

/**
 * Snapshot the receiver's authority state plus the exact Crossroads board's own chunks.
 *
 * The receiver's daemon stays live and owns every other document it holds, so those documents and every
 * peer `sync-state` advance on their own; a witness over them would read the holder's churn as an
 * inspection write. What the inspection must leave untouched — the vessel's pointer and identity files and
 * the board record it reads — stays inside the snapshot. The plugin CAS path is deliberately mutated.
 */
function snapshotInspectionSurface(root: string, boardDocId: string): string[] {
  const out: string[] = [];
  const boardShard = join(root, boardDocId.slice(0, 2), boardDocId.slice(2));
  const walk = (dir: string, inBoard: boolean): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === "cas" || name === "sync-state") continue;
      // An observation error is itself a failed witness: silently dropping a file could hide a write.
      const stat = statSync(path);
      if (stat.isDirectory()) {
        if (inBoard) walk(path, true);
        else if (DOC_SHARD.test(name)) walkShard(path);
        else walk(path, false);
      } else out.push(`${path.slice(root.length)}:${readFileSync(path).toString("hex")}`);
    }
  };
  // A shard directory holds documents; only the board's own document descends.
  const walkShard = (shard: string): void => {
    for (const rest of readdirSync(shard)) {
      const doc = join(shard, rest);
      if (doc === boardShard) walk(doc, true);
    }
  };
  walk(root, false);
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
    riteA: async (source) => {
      let i = 1;
      for (const handle of ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]) {
        const kahu = await source(["persona", "new", String(i), "--name", `kahu-${i}`, "--handle", handle, "--seat"]);
        if (kahu.code !== 0) throw new Error(`source: kahu ${i} failed (${kahu.code})\n${kahu.stderr.slice(-800)}`);
        i += 1;
      }
      const rite = await source(["nexus", "rite", "cabal"]);
      if (rite.code !== 0) throw new Error(`source: rite cabal failed (${rite.code})\n${rite.stderr.slice(-800)}`);
      // Publishing signs in a held persona's name, and an unset selector refuses rather than choosing h0:
      // the source wears its founding face explicitly before its daemon reads it.
      const wear = await source(["persona", "wear", "0"]);
      if (wear.code !== 0) throw new Error(`source: persona wear 0 failed (${wear.code})\n${wear.stderr.slice(-800)}`);
      // The publish door opens the source's store directly, so it runs here, while NO daemon holds that
      // store (the single-owner law): a write beside a live holder lands on disk the holder never reads,
      // and the source's daemon would carry a board without the gift.
      const published = await source(["nexus", "publish", "plugins", "--apply", "--json"]);
      if (published.code !== 0 || published.json?.["ok"] !== true) {
        throw new Error(`source offering publish failed: ${published.stdout}\n${published.stderr}`);
      }
      const data = published.json?.["data"] as { offeringCid?: string; boardUrl?: string } | undefined;
      offeringCid = data?.offeringCid ?? "";
      boardUrl = data?.boardUrl ?? "";
      if (!offeringCid || !boardUrl) throw new Error(`source publish returned no offering coordinates: ${published.stdout}`);
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
    expect(existsSync(receiverByte), "the staged receiver starts with the shipped Genesis byte").toBe(true);

    // Make the first result a true local miss without touching the source, board, or Genesis seed.
    const seedBefore = readFileSync(join(receiver.root, "genesis", "seed.json"));
    const boardDocId = boardUrl.replace(/^automerge:/, "");
    const surfaceBefore = snapshotInspectionSurface(vesselStorageDir(receiver), boardDocId);
    expect(surfaceBefore.some((row) => row.startsWith(`/${boardDocId.slice(0, 2)}/${boardDocId.slice(2)}/`)), "the board's chunks sit inside the witnessed surface").toBe(true);
    // The receiver's shipped fixture carries the same byte, so remove it to expose the pending gradient.
    rmSync(receiverByte);
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
    expect(snapshotInspectionSurface(vesselStorageDir(receiver), boardDocId)).toEqual(surfaceBefore);
  }, 120_000);

  test("refuses an unknown record and a board from the wrong Nexus island", async () => {
    const wrongCid = `sha256:${"f".repeat(64)}`;
    const unknown = await receiver.cli(["nexus", "offering", "inspect", wrongCid, "--json"]);
    expect(unknown.code).not.toBe(0);
    expect(unknown.json?.["ok"]).toBe(false);
    expect(String((unknown.json?.["error"] as { message?: string } | undefined)?.message)).toMatch(/not present|offering/i);

    const wrongRoot = mkdtempSync(join(tmpdir(), "lares-wrong-island-"));
    const priorRoot = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = wrongRoot;
    try {
      await expect(runNexusInspectOffering({
        offeringCid,
        storageDir: vesselStorageDir(receiver),
        ownVesselKey: "f".repeat(64),
      })).rejects.toBeInstanceOf(NexusOfferingInspectError);
    } finally {
      if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
      rmSync(wrongRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
