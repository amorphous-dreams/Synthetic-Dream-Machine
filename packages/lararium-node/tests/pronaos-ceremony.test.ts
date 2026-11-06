/**
 * pronaos-ceremony — THE HEARTH SERVES THE UNLOCK CEREMONY AT THE FLOOR (browser-vessel-lift#/the-slices, slice 1b).
 *
 * A browser vessel served by a hearth opens its unlock ceremony from that hearth: the ceremony document and its port broker
 * (a service worker, at a stable URL) ride the Pronaos as two fixed routes, each held to the build's receipt, each `no-store`.
 *
 *   PC1 RED      the projection carries both routes; the document answers with its policy as a header (`frame-ancestors
 *                'none'`, no inline script) and the broker as JavaScript, with no secret held anywhere.
 *   PC2 CONTROL  a receipt naming the document under another file, or bytes that drift from the receipt, refuse by name; a
 *                build that carries no ceremony leaves both routes unowned.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildPronaosProjection } from "../src/pronaos-projection.js";
import { CEREMONY_POLICY, pronaosRequestHandler } from "../src/pronaos-adapter.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const CEREMONY = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><script type="module" src="/assets/ceremony-abc.js"></script>';
const BROKER = "self.addEventListener('message', () => {});";

function fixture(withCeremony = true) {
  const root = mkdtempSync("/tmp/lararium-pronaos-ceremony-"); roots.push(root);
  const web = join(root, "web"); const genesis = join(root, "genesis");
  mkdirSync(join(web, "assets"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
  writeFileSync(join(web, "index.html"), '<script type="module" src="/assets/index-abc.js"></script>');
  writeFileSync(join(web, "assets/index-abc.js"), "index");
  writeFileSync(join(web, "assets/wiki.worker-def.js"), "worker");
  writeFileSync(join(web, "assets/ceremony-abc.js"), "ceremony");
  if (withCeremony) { writeFileSync(join(web, "ceremony.html"), CEREMONY); writeFileSync(join(web, "ceremony-broker.js"), BROKER); }
  const cas = Buffer.from("public-cas"); const cid = createHash("sha256").update(cas).digest("hex");
  writeFileSync(join(genesis, "seed.json"), JSON.stringify({
    format: "lararium-genesis-seed/v1", actorSeed: "fixture-actor", blobs: { fixture: { id: "fixture", version: "1", sha256: cid, mimeType: "application/octet-stream" } },
    tiddlers: {
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "engine-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "grammar-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "plugins-region" } },
    },
  }));
  writeFileSync(join(genesis, "cas", cid), cas);
  const sha = (file: string) => createHash("sha256").update(readFileSync(join(web, file))).digest("hex");
  const routes = [
    { path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256: sha("index.html") },
    ...["assets/index-abc.js", "assets/wiki.worker-def.js", "assets/ceremony-abc.js"].map((file) => ({ path: `/${file}`, file, contentType: "application/javascript", cache: "immutable", sha256: sha(file) })),
    ...(withCeremony ? [
      { path: "/ceremony.html", file: "ceremony.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256: sha("ceremony.html") },
      { path: "/ceremony-broker.js", file: "ceremony-broker.js", contentType: "application/javascript", cache: "no-store", sha256: sha("ceremony-broker.js") },
    ] : []),
  ];
  return { web, genesis, record: { schema: "lararium-pronaos-artifact/v1" as const, routes } };
}

function get(handler: ReturnType<typeof pronaosRequestHandler>, url: string) {
  let status = 0; let headers: Record<string, string> = {}; let body = "";
  const res = {
    writeHead(code: number, h: Record<string, string>) { status = code; headers = h; return res; },
    end(b?: Buffer | string) { body = b === undefined ? "" : String(b); },
  } as unknown as ServerResponse;
  const owned = handler({ url, method: "GET", headers: {} } as IncomingMessage, res);
  return { owned, status, headers, body };
}

describe("the hearth serves the unlock ceremony", () => {
  test("PC1 RED — the document answers with its policy header, the broker as JavaScript, both no-store", () => {
    const f = fixture();
    const projection = buildPronaosProjection({ webArtifactRoot: f.web, genesisBundleRoot: f.genesis, artifactRecord: f.record });
    expect(projection.routeInventory.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "web-artifact", path: "/ceremony.html", cache: "no-store" }),
      expect.objectContaining({ kind: "web-artifact", path: "/ceremony-broker.js", cache: "no-store" }),
    ]));
    const handler = pronaosRequestHandler(projection);
    const doc = get(handler, "/ceremony.html#ask=x");
    expect(doc).toMatchObject({ owned: true, status: 200, body: CEREMONY });
    expect(doc.headers["content-security-policy"]).toBe(CEREMONY_POLICY);
    expect(CEREMONY_POLICY).toMatch(/frame-ancestors 'none'$/);
    expect(CEREMONY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(doc.headers["cache-control"]).toBe("no-store");
    const broker = get(handler, "/ceremony-broker.js");
    expect(broker).toMatchObject({ owned: true, status: 200, body: BROKER });
    expect(broker.headers["content-type"]).toBe("application/javascript");
    // CONTROL: the surface page carries no ceremony policy of its own.
    expect(get(handler, "/").headers["content-security-policy"]).toBeUndefined();
  });

  test("PC2 CONTROL — a misnamed file or drifted bytes refuse; a build with no ceremony leaves both routes unowned", () => {
    const f = fixture();
    const base = { webArtifactRoot: f.web, genesisBundleRoot: f.genesis };
    const renamed = { ...f.record, routes: f.record.routes.map((r) => r.path === "/ceremony.html" ? { ...r, file: "index.html" } : r) };
    expect(() => buildPronaosProjection({ ...base, artifactRecord: renamed })).toThrow(/\/ceremony\.html route must be ceremony\.html/);
    writeFileSync(join(f.web, "ceremony.html"), CEREMONY + "<script>steal()</script>");
    expect(() => buildPronaosProjection({ ...base, artifactRecord: f.record })).toThrow(/ceremony\.html does not match artifact receipt/);
    const bare = fixture(false);
    const handler = pronaosRequestHandler(buildPronaosProjection({ webArtifactRoot: bare.web, genesisBundleRoot: bare.genesis, artifactRecord: bare.record }));
    expect(get(handler, "/ceremony.html")).toMatchObject({ owned: true, status: 404 });
  });
});
