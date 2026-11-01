import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPronaosRuntimeConfiguration, assertPronaosRuntimeInputs, assertSurfacePronaosConfiguration } from "./pronaos-runtime-wiring.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

test("binds the actual serve receipt and QA composition inputs", () => {
    assert.deepEqual(assertPronaosRuntimeConfiguration({
      dockerfile: readFileSync("Dockerfile", "utf8"),
      compose: readFileSync("docker-compose.yml", "utf8"),
    }), {
      webRoot: "/app/packages/lararium-web/dist",
      artifactRecord: "/app/pronaos-build/pronaos-artifact.json",
      profiles: ["qa", "prod"],
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
    const validDockerfile = "COPY packages/lares-cli/package.json\nRUN pnpm --filter @lares/cli build\nCOPY --from=build /app/.pronaos-build/pronaos-artifact.json ./pronaos-build/pronaos-artifact.json";
    const relocatedCompose = "\n  lararium-other:\n    environment:\n      LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist\n      LAR_PRONAOS_ARTIFACT_RECORD: /app/pronaos-build/pronaos-artifact.json\n\n  lararium-qa:\n    environment:\n      NODE_ENV: qa\n    ports:\n\n  lararium-prod:\n    environment:\n      NODE_ENV: production\n      LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist\n      LAR_PRONAOS_ARTIFACT_RECORD: /app/pronaos-build/pronaos-artifact.json\n      LAR_SAME_ORIGIN: \"true\"\n    ports:\n";
    assert.throws(() => assertPronaosRuntimeConfiguration({ dockerfile: validDockerfile, compose: relocatedCompose }), /founder|QA environment does not name/);

    const qaOnlyCompose = "\n  lararium-qa:\n    environment:\n      NODE_ENV: qa\n      LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist\n      LAR_PRONAOS_ARTIFACT_RECORD: /app/pronaos-build/pronaos-artifact.json\n      LAR_SAME_ORIGIN: \"true\"\n    ports:\n\n  lararium-prod:\n    environment:\n      NODE_ENV: production\n      LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist\n      LAR_PRONAOS_ARTIFACT_RECORD: /app/pronaos-build/pronaos-artifact.json\n    ports:\n";
    assert.throws(() => assertPronaosRuntimeConfiguration({ dockerfile: validDockerfile, compose: qaOnlyCompose }), /founder|PROD environment does not/);

    root = mkdtempSync(join(tmpdir(), "lararium-pronaos-runtime-"));
    const webRoot = join(root, "web"); const artifactRecord = join(root, "pronaos-artifact.json");
    mkdirSync(webRoot);
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot, artifactRecord }), /receipt is absent/);
    writeFileSync(artifactRecord, JSON.stringify({ schema: "lararium-pronaos-artifact/v1", routes: [{ path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "public", sha256: "a".repeat(64) }] }));
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot, artifactRecord }), /fails the mesh contract/);
    assert.throws(() => assertPronaosRuntimeInputs({ webRoot: join(root, "missing"), artifactRecord }), /Web root is absent/);
});

test("binds the SURFACE compose: the preferred container path names the page, the receipt and the same origin", () => {
    const compose = readFileSync("docker-compose.surface.yml", "utf8");
    assert.deepEqual(assertSurfacePronaosConfiguration({ compose }), {
      webRoot: "/app/packages/lararium-web/dist",
      artifactRecord: "/app/pronaos-build/pronaos-artifact.json",
      service: "lares",
    });
});

test("the SURFACE witness bites: a copy missing one line, or carrying it only on the herm, reads red", () => {
    const compose = readFileSync("docker-compose.surface.yml", "utf8");
    for (const line of ["LAR_PRONAOS_WEB_ROOT", "LAR_PRONAOS_ARTIFACT_RECORD", "LAR_SAME_ORIGIN"]) {
        const mutated = compose.split("\n").filter((l, i, all) => !(l.trim().startsWith(line + ":") && all.slice(0, i).join("\n").lastIndexOf("\n  lares:") > all.slice(0, i).join("\n").lastIndexOf("\n  herm:"))).join("\n");
        assert.notEqual(mutated, compose, `${line} is on the lares service`);
        assert.throws(() => assertSurfacePronaosConfiguration({ compose: mutated }), new RegExp(line));
    }
    const wrongPath = compose.replace("LAR_PRONAOS_WEB_ROOT: /app/packages/lararium-web/dist", "LAR_PRONAOS_WEB_ROOT: /srv/web");
    assert.throws(() => assertSurfacePronaosConfiguration({ compose: wrongPath }), /LAR_PRONAOS_WEB_ROOT/);
});

test("CONTROL: the herm service carries no page by law, and the witness asks none of it", () => {
    const compose = readFileSync("docker-compose.surface.yml", "utf8");
    const herm = compose.slice(compose.indexOf("\n  herm:"), compose.indexOf("\n  terminator:"));
    assert.ok(!herm.includes("LAR_PRONAOS_WEB_ROOT"));
    assert.doesNotThrow(() => assertSurfacePronaosConfiguration({ compose }));
});
