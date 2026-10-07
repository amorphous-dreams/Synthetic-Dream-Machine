/**
 * e2e/arrival-surfaces — the first arrival trusts the lararium's own origin (pronaos#/the-first-arrival).
 *
 * Two staged vessels stand under the same prepared Pronaos inputs (`LAR_PRONAOS_WEB_ROOT` +
 * `LAR_PRONAOS_ARTIFACT_RECORD`):
 *
 *   · a HEARTH — place and face founded, the default rite;
 *   · a WAKING FLOOR — the place founded and no face lit, so it stands at the floor with every sovereign act held.
 *
 * On both, the arrival descriptor answers at `/.well-known/lar`, names the house's own genesis seed by CID, and the
 * negotiated door onto `/` returns the identical bytes (waking-floor#/the-arrival-page: liveness ⊥ readiness).
 * A cold device then pulls the fire off the FLOOR's origin and kindles a sovereign key of its own.
 *
 * The web artifact here is a minimal prepared root and receipt written by the test: the descriptor and the kindle
 * read the receipt and the house's own genesis, never the Vite build, so a fixture stands in for it exactly.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { openStaged, type LarInstance, type CliResult } from "../harness/instance.js";
import { pullArrival, kindleFromBulb, httpBulbTransport } from "../../packages/lararium-node/src/kindle.js";
import { didKeyFromVerifyingKey } from "../../packages/lararium-mesh/src/index.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const WELL_KNOWN = "/.well-known/lar";
const MEDIA_TYPE = "application/vnd.lar.arrival+json";

const gaps = [
  ...(existsSync(CLI_BIN) ? [] : [`built CLI at ${CLI_BIN}`]),
  ...(existsSync(NODE_MAIN) ? [] : [`built node vessel at ${NODE_MAIN}`]),
  ...(process.env["LAR_TARGET"] === "live" ? ["a STAGED target — this witness stands its own vessels"] : []),
];
if (gaps.length > 0) console.error(`arrival-surfaces: SKIPPED — missing ${gaps.join("; ")}`);

let scratch = "";
let hearth: LarInstance | null = null;
let floor: LarInstance | null = null;

/** A prepared Web root and its receipt — the two explicit Pronaos inputs, nothing discovered. */
function preparedWeb(): Record<string, string> {
  const web = join(scratch, "web");
  mkdirSync(join(web, "assets"), { recursive: true });
  const files: [string, string, string, string][] = [
    ["/", "index.html", "text/html; charset=utf-8", "no-store"],
    ["/assets/wiki.worker-arrival.js", "assets/wiki.worker-arrival.js", "application/javascript", "immutable"],
  ];
  writeFileSync(join(web, "index.html"), '<!doctype html><title>arrival</title><script type="module" src="/assets/wiki.worker-arrival.js"></script>');
  writeFileSync(join(web, "assets/wiki.worker-arrival.js"), "self.postMessage('arrival')");
  const record = {
    schema: "lararium-pronaos-artifact/v1",
    routes: files.map(([path, file, contentType, cache]) => ({
      path, file, contentType, cache,
      sha256: createHash("sha256").update(readFileSync(join(web, file))).digest("hex"),
    })),
  };
  const recordPath = join(scratch, "pronaos-artifact.json");
  writeFileSync(recordPath, JSON.stringify(record));
  return { LAR_PRONAOS_WEB_ROOT: web, LAR_PRONAOS_ARTIFACT_RECORD: recordPath };
}

/** The place rite alone — no `persona new`, so the vessel stands at its waking floor. */
async function foundPlaceOnly(cli: (args: readonly string[]) => Promise<CliResult>, root: string): Promise<void> {
  const reset = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
  if (reset.code !== 0) throw new Error(`place founding failed (${reset.code}):\n${reset.stderr.slice(-800)}`);
}

const originOf = (lar: LarInstance): string => `http://127.0.0.1:${lar.port}`;

describe.skipIf(gaps.length > 0)("★ the arrival surfaces — the house's own origin serves the first arrival ★", () => {
  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), "lares-arrival-e2e-"));
    const daemonEnv = preparedWeb();
    hearth = await openStaged({ tag: "arrival-hearth", daemonEnv });
    floor  = await openStaged({ tag: "arrival-floor", daemonEnv, found: foundPlaceOnly });
  }, 360_000);

  afterAll(async () => {
    await hearth?.stop();
    await floor?.stop();
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  test("the floor vessel stands at its waking floor and the hearth does not (the control on the standing itself)", () => {
    expect(floor!.bootLog()).toMatch(/standing at the WAKING FLOOR/);
    expect(hearth!.bootLog()).not.toMatch(/standing at the WAKING FLOOR/);
  });

  for (const which of ["hearth", "floor"] as const) {
    test(`the descriptor answers at ${WELL_KNOWN} on the ${which}, naming the house's own seed`, async () => {
      const lar = which === "hearth" ? hearth! : floor!;
      const response = await fetch(`${originOf(lar)}${WELL_KNOWN}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(MEDIA_TYPE);
      const descriptor = await response.json() as { format: string; arrival: string; routes: { kind: string; seedCid?: string; cid?: string }[] };
      expect(descriptor.format).toBe("lar-arrival");
      expect(descriptor.arrival).toBe("/");
      const seedBytes = readFileSync(join(lar.root, "genesis", "seed.json"));
      expect(descriptor.routes.find((r) => r.kind === "genesis-seed")?.seedCid).toBe(createHash("sha256").update(seedBytes).digest("hex"));
      expect(descriptor.routes.some((r) => r.kind === "genesis-member")).toBe(true);
      // The arrival page itself answers beside it.
      const page = await fetch(`${originOf(lar)}/`, { headers: { accept: "text/html" } });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("<title>arrival</title>");
    });

    test(`CONTROL: the negotiated door on the ${which} returns the descriptor's identical bytes`, async () => {
      const lar = which === "hearth" ? hearth! : floor!;
      const wellKnown = Buffer.from(await (await fetch(`${originOf(lar)}${WELL_KNOWN}`)).arrayBuffer());
      const negotiated = await fetch(`${originOf(lar)}/`, { headers: { accept: MEDIA_TYPE } });
      expect(negotiated.headers.get("content-type")).toBe(MEDIA_TYPE);
      expect(Buffer.from(await negotiated.arrayBuffer()).equals(wellKnown)).toBe(true);
    });
  }

  test("CONTROL: a cold device kindles a sovereign key of its own off the floor's origin", async () => {
    const fire = await pullArrival(httpBulbTransport(originOf(floor!)));
    const prior = process.env["LAR_ROOT"];
    const device = mkdtempSync(join(scratch, "device-"));
    process.env["LAR_ROOT"] = device;
    const repo = new Repo({ sharePolicy: async () => true });
    try {
      const k = await kindleFromBulb({ bulb: fire, repo, storageDir: join(device, "store") });
      expect(k.did).toBe(didKeyFromVerifyingKey(k.deviceVerifyingKey));
      const houseKey = /gate key: ([0-9a-f]{64})/.exec(hearth!.bootLog())?.[1];
      expect(houseKey).toBeTruthy();
      expect(k.deviceVerifyingKey).not.toBe(houseKey);
    } finally {
      await repo.shutdown();
      if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    }
  }, 60_000);
});
