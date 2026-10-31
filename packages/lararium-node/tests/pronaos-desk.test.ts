/**
 * pronaos-desk -- a desk checkout names its prepared Web root and build receipt by one pure derivation, and the
 * one composition (`composePronaosFromEnv`) serves what it names.
 *
 * `lares vessel stand --page` is the shore that calls it. The derivation holds no trust: it names two paths
 * when BOTH stand, and the composition's projection checks every byte against the receipt.
 */
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { composePronaosFromEnv } from "../src/pronaos-composition.js";
import { derivePronaosDeskInputs } from "../src/pronaos-desk.js";

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) if (server.listening) await new Promise<void>((r) => server.close(() => r()));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function deskCheckout(opts: { web: boolean; record: boolean }): { repo: string; genesis: string } {
  const repo = mkdtempSync("/tmp/lararium-pronaos-desk-"); roots.push(repo);
  const web = join(repo, "packages", "lararium-web", "dist");
  const genesis = join(repo, "genesis");
  mkdirSync(join(genesis, "cas"), { recursive: true });
  const cas = Buffer.from("desk-cas");
  const cid = createHash("sha256").update(cas).digest("hex");
  writeFileSync(join(genesis, "seed.json"), JSON.stringify({
    format: "lararium-genesis-seed/v1", actorSeed: "desk-actor",
    blobs: { fixture: { id: "fixture", version: "1", sha256: cid, mimeType: "application/octet-stream" } },
    tiddlers: {
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "engine-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "grammar-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "plugins-region" } },
    },
  }));
  writeFileSync(join(genesis, "cas", cid), cas);
  if (opts.web) {
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, "index.html"), "<!doctype html><title>desk</title>");
  }
  if (opts.record) {
    mkdirSync(join(repo, ".pronaos-build"), { recursive: true });
    const sha256 = createHash("sha256").update("<!doctype html><title>desk</title>").digest("hex");
    writeFileSync(join(repo, ".pronaos-build", "pronaos-artifact.json"), JSON.stringify({
      schema: "lararium-pronaos-artifact/v1",
      routes: [{ path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256 }],
    }));
  }
  return { repo, genesis };
}

describe("the desk derivation names a prepared Web root and its receipt", () => {
  test("both stand: it names the built web root and the receipt, and the one composition serves GET / as 200 text/html", async () => {
    const { repo, genesis } = deskCheckout({ web: true, record: true });
    const desk = derivePronaosDeskInputs(repo);
    expect(desk).toEqual({
      webRoot: join(repo, "packages", "lararium-web", "dist"),
      artifactRecord: join(repo, ".pronaos-build", "pronaos-artifact.json"),
    });
    const server = createServer(); servers.push(server);
    const composition = composePronaosFromEnv({
      httpServer: server, genesisDir: genesis, standing: "lararium",
      env: { LAR_PRONAOS_WEB_ROOT: desk!.webRoot, LAR_PRONAOS_ARTIFACT_RECORD: desk!.artifactRecord },
    });
    expect(composition).not.toBeNull();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("desk test did not bind");
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/html/);
  });

  test("CONTROL: no built web names nothing, so the NO PRONAOS SHORE notice stands", () => {
    expect(derivePronaosDeskInputs(deskCheckout({ web: false, record: true }).repo)).toBeNull();
  });

  test("CONTROL: a built web with no receipt names nothing (half a pair never composes)", () => {
    expect(derivePronaosDeskInputs(deskCheckout({ web: true, record: false }).repo)).toBeNull();
  });
});
