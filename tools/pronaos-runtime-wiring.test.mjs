import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPronaosRuntimeConfiguration, assertPronaosRuntimeInputs } from "./pronaos-runtime-wiring.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

test("binds the actual serve receipt and QA composition inputs", () => {
    assert.deepEqual(assertPronaosRuntimeConfiguration({
      dockerfile: readFileSync("Dockerfile", "utf8"),
      compose: readFileSync("docker-compose.yml", "utf8"),
    }), {
      webRoot: "/app/packages/lararium-web/dist",
      artifactRecord: "/app/pronaos-build/pronaos-artifact.json",
    });
});

test("consumes the receipt emitted by the Web build", () => {
    assert.ok(existsSync("packages/lararium-web/dist"), "run pnpm --filter @lararium/web build first");
    assert.ok(existsSync(".pronaos-build/pronaos-artifact.json"), "run pnpm --filter @lararium/web build first");
    const result = assertPronaosRuntimeInputs({ webRoot: "packages/lararium-web/dist", artifactRecord: ".pronaos-build/pronaos-artifact.json" });
    assert.ok(result.routes > 1);
});

test("accepts a finite receipt when the named Web root and receipt are present", () => {
    root = mkdtempSync(join(tmpdir(), "lararium-pronaos-runtime-"));
    const webRoot = join(root, "web"); const artifactRecord = join(root, "pronaos-artifact.json");
    mkdirSync(webRoot);
    writeFileSync(join(webRoot, "index.html"), "<html></html>");
    const sha256 = createHash("sha256").update("<html></html>").digest("hex");
    writeFileSync(artifactRecord, JSON.stringify({ schema: "lararium-pronaos-artifact/v1", routes: [{ path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256 }] }));
    assert.equal(assertPronaosRuntimeInputs({ webRoot, artifactRecord }).routes, 1);
    writeFileSync(join(webRoot, "index.html"), "<html>tampered</html>");
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot, artifactRecord }), /digest disagrees/);
});

test("refuses missing/relocated QA inputs and invalid actual-contract fields", () => {
    const validDockerfile = "COPY --from=build /app/.pronaos-build/pronaos-artifact.json ./pronaos-build/pronaos-artifact.json";
    const relocatedCompose = "\n  lararium-other:\n    environment:\n      LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist\n      LAR_PRONAOS_ARTIFACT_RECORD: /app/pronaos-build/pronaos-artifact.json\n\n  lararium-qa:\n    environment:\n      NODE_ENV: qa\n    ports:\n\n  lararium-prod:\n";
    assert.throws(() => assertPronaosRuntimeConfiguration({ dockerfile: validDockerfile, compose: relocatedCompose }), /QA environment does not name/);

    root = mkdtempSync(join(tmpdir(), "lararium-pronaos-runtime-"));
    const webRoot = join(root, "web"); const artifactRecord = join(root, "pronaos-artifact.json");
    mkdirSync(webRoot);
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot, artifactRecord }), /receipt is absent/);
    writeFileSync(artifactRecord, JSON.stringify({ schema: "lararium-pronaos-artifact/v1", routes: [{ path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "public", sha256: "a".repeat(64) }] }));
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot, artifactRecord }), /fails the mesh contract/);
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot: join(root, "missing"), artifactRecord }), /Web root is absent/);
});
