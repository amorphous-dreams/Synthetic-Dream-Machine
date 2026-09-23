#!/usr/bin/env node
/**
 * Process-attributed, daemon-free Pronaos delivery witness.
 *
 * The child mounts the compiled Node Pronaos composition on a reserved-host
 * listener. The parent owns the receipt ledger, reads every expected byte from
 * the declared roots, and proves that the replies came from the child PID.
 * This deliberately makes no Node Oracle/Bulb/health-face claim and does not
 * claim a Docker image, production proxy, or household run.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync, unlinkSync, mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";

const TOOL = fileURLToPath(import.meta.url);
const REPO = resolve(dirname(TOOL), "..");
const NODE_COMPOSITION = resolve(REPO, "packages/lararium-node/dist/src/pronaos-composition.js");
const NODE_DISPATCHER = resolve(REPO, "packages/lararium-node/dist/src/http-face-dispatcher.js");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function mustFile(pathname, label) {
  if (!existsSync(pathname)) throw new Error(`${label} is absent: ${pathname}`);
  return readFileSync(pathname);
}

function expectedInputs({ webRoot, artifactRecord, genesisRoot }) {
  const record = JSON.parse(mustFile(artifactRecord, "Pronaos artifact receipt"));
  const byPath = new Map(record.routes.map((entry) => [entry.path, entry]));
  const index = byPath.get("/");
  if (!index) throw new Error("Pronaos artifact receipt has no / route");
  const worker = record.routes.find((entry) => /(?:^|[.-])worker[.-]/i.test(entry.path));
  if (!worker) throw new Error("Pronaos artifact receipt has no worker route");
  const seedPath = resolve(genesisRoot, "seed.json");
  const seed = JSON.parse(mustFile(seedPath, "genesis seed"));
  const cids = Object.values(seed.blobs ?? {}).map((blob) => blob?.sha256).filter((cid) => /^[0-9a-f]{64}$/.test(cid));
  if (cids.length === 0) throw new Error("genesis seed names no CAS member");
  const cid = cids[0];
  const casPath = resolve(genesisRoot, "cas", cid);
  const files = new Map([
    ["/", resolve(webRoot, index.file)],
    [worker.path, resolve(webRoot, worker.file)],
    ["/genesis/seed.json", seedPath],
    [`/genesis/cas/${cid}`, casPath],
  ]);
  for (const [route, pathname] of files) {
    const bytes = mustFile(pathname, `Pronaos byte for ${route}`);
    const expected = route === "/" || route === worker.path ? byPath.get(route)?.sha256 : route === "/genesis/seed.json" ? null : cid;
    if (expected && sha256(bytes) !== expected) throw new Error(`declared bytes do not match receipt: ${route}`);
    if (route.startsWith("/genesis/cas/") && sha256(bytes) !== cid) throw new Error(`CAS bytes do not match CID: ${cid}`);
  }
  return { record, worker, cid, files };
}

function waitForChild(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`Pronaos child did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);
    const onData = (chunk) => {
      buffer += String(chunk);
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("PRONAOS_WITNESS_READY ")) {
          clearTimeout(timer);
          child.stdout.off("data", onData);
          settled = true;
          resolve(JSON.parse(line.slice("PRONAOS_WITNESS_READY ".length)));
          return;
        }
        if (line.startsWith("PRONAOS_WITNESS_ERROR ")) {
          clearTimeout(timer);
          child.stdout.off("data", onData);
          settled = true;
          reject(new Error(line.slice("PRONAOS_WITNESS_ERROR ".length)));
          return;
        }
      }
    };
    child.stdout.on("data", onData);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Pronaos child exited before ready (code=${code}, signal=${signal})`));
    });
  });
}

async function requestFromChild(child, ready, route, method = "GET") {
  if (ready.transport === "stdio") {
    return new Promise((resolveRequest, reject) => {
      let buffer = "";
      const onData = (chunk) => {
        buffer += String(chunk);
        for (;;) {
          const newline = buffer.indexOf("\n");
          if (newline < 0) return;
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("PRONAOS_WITNESS_RESPONSE ")) continue;
          child.stdout.off("data", onData);
          try {
            const response = JSON.parse(line.slice("PRONAOS_WITNESS_RESPONSE ".length));
            resolveRequest({
              status: response.status,
              headers: { get: (name) => response.headers?.[name.toLowerCase()] ?? response.headers?.[name] ?? null },
              body: Buffer.from(response.body ?? "", "base64"),
            });
          }
          catch (error) { reject(error); }
          return;
        }
      };
      child.stdout.on("data", onData);
      child.stdin.write(`${JSON.stringify({ route, method })}\n`);
    });
  }
  return new Promise((resolveRequest, reject) => {
    const request = httpRequest({
      ...(ready.socketPath ? { socketPath: ready.socketPath } : { hostname: "127.0.0.1", port: ready.port }),
      path: route,
      method,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolveRequest({
        status: response.statusCode ?? 0,
        headers: { get: (name) => response.headers[name.toLowerCase()]?.toString() ?? null },
        body: Buffer.concat(chunks),
      }));
    });
    request.once("error", reject);
    request.end();
  });
}

async function fetchChecked(child, ready, route, expected, checks = {}) {
  const response = await requestFromChild(child, ready, route, checks.request?.method ?? "GET");
  if (response.status !== (checks.status ?? 200)) {
    throw new Error(`${route}: expected HTTP ${checks.status ?? 200}, received ${response.status}`);
  }
  const body = response.body;
  if (expected !== undefined && !body.equals(expected)) throw new Error(`${route}: response bytes differ from the declared file`);
  if (checks.notHtml && /<!doctype html/i.test(body.toString("utf8"))) throw new Error(`${route}: refusal returned fallback HTML`);
  if (checks.contentType && !response.headers.get("content-type")?.includes(checks.contentType)) {
    throw new Error(`${route}: content type does not include ${checks.contentType}`);
  }
  return response;
}

/**
 * Execute the actual compiled composition/dispatcher without opening a
 * socket. This is the daemon-free contract control: it proves route ownership,
 * finite bytes, and refusal behavior, while deliberately making no process or
 * origin-reach claim.
 */
export async function runPronaosInProcessWitness({
  webRoot = resolve(REPO, "packages/lararium-web/dist"),
  artifactRecord = resolve(REPO, ".pronaos-build/pronaos-artifact.json"),
  genesisRoot = resolve(REPO, "genesis"),
} = {}) {
  if (!existsSync(NODE_COMPOSITION) || !existsSync(NODE_DISPATCHER)) {
    throw new Error("compiled Node composition is absent; run pnpm --filter @lararium/node build first");
  }
  const [{ composePronaosFromEnv }, { mountHttpFaceDispatcher }] = await Promise.all([
    import(pathToFileURL(NODE_COMPOSITION).href),
    import(pathToFileURL(NODE_DISPATCHER).href),
  ]);
  const expected = expectedInputs({ webRoot: resolve(webRoot), artifactRecord: resolve(artifactRecord), genesisRoot: resolve(genesisRoot) });
  const { createServer } = await import("node:http");
  const server = createServer();
  const dispatcher = mountHttpFaceDispatcher(server);
  const composition = composePronaosFromEnv({
    httpServer: server,
    genesisDir: resolve(genesisRoot),
    dispatcher,
    env: {
      LAR_PRONAOS_WEB_ROOT: resolve(webRoot),
      LAR_PRONAOS_ARTIFACT_RECORD: resolve(artifactRecord),
    },
  });
  if (!composition) throw new Error("explicit Pronaos inputs did not mount a composition");

  const request = async (route, method = "GET") => new Promise((resolveRequest, reject) => {
    let status = 200;
    let headers = {};
    const chunks = [];
    const req = { url: route, method };
    const res = {
      writableEnded: false,
      headersSent: false,
      writeHead: (code, values = {}) => { status = code; headers = values; res.headersSent = true; },
      end: (body = "") => {
        res.writableEnded = true;
        chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
        resolveRequest({ status, headers: { get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null }, body: Buffer.concat(chunks) });
      },
    };
    server.emit("request", req, res);
    setImmediate(() => { if (!res.writableEnded) reject(new Error(`${route}: dispatcher left request unanswered`)); });
  });
  const assert = async (route, expectedBytes, checks = {}) => {
    const response = await request(route, checks.method ?? "GET");
    const status = checks.status ?? 200;
    if (response.status !== status) throw new Error(`${route}: expected HTTP ${status}, received ${response.status}`);
    if (expectedBytes !== undefined && !response.body.equals(expectedBytes)) throw new Error(`${route}: response bytes differ from declared file`);
    if (checks.contentType && !response.headers.get("content-type")?.includes(checks.contentType)) throw new Error(`${route}: content type does not include ${checks.contentType}`);
    if (checks.notHtml && /<!doctype html/i.test(response.body.toString("utf8"))) throw new Error(`${route}: refusal returned fallback HTML`);
    return response;
  };
  try {
    const indexEntry = expected.record.routes.find((entry) => entry.path === "/");
    const index = await assert("/", mustFile(resolve(webRoot, indexEntry.file), "index"), { contentType: "text/html" });
    if (index.headers.get("cache-control") !== "no-store") throw new Error("/: expected no-store cache policy");
    await assert(expected.worker.path, mustFile(resolve(webRoot, expected.worker.file), "worker"), { contentType: "javascript" });
    await assert("/genesis/seed.json", mustFile(expected.files.get("/genesis/seed.json"), "seed"), { contentType: "application/json" });
    await assert(`/genesis/cas/${expected.cid}`, mustFile(expected.files.get(`/genesis/cas/${expected.cid}`), "CAS"), { contentType: "application/octet-stream" });
    for (const route of ["/assets/missing-worker.js", `/genesis/cas/${"0".repeat(64)}`, "/private/document.json", "/assets/%252e%252e/private.json"]) {
      await assert(route, undefined, { status: 404, notHtml: true });
    }
    await assert("/", undefined, { status: 405, method: "POST", notHtml: true });

    // Deliberate weakenings against the same compiled composition: wrong root,
    // tampered named bytes, and a private/widened route in the finite receipt.
    const scratch = mkdtempSync(join(tmpdir(), "lararium-pronaos-contract-"));
    try {
      const copiedWeb = join(scratch, "web");
      cpSync(resolve(webRoot), copiedWeb, { recursive: true });
      writeFileSync(resolve(copiedWeb, expected.worker.file), "tampered-worker");
      await Promise.resolve().then(() => composePronaosFromEnv({
        httpServer: createServer(), genesisDir: resolve(genesisRoot), dispatcher: undefined,
        env: { LAR_PRONAOS_WEB_ROOT: copiedWeb, LAR_PRONAOS_ARTIFACT_RECORD: resolve(artifactRecord) },
      })).then(() => { throw new Error("tampered Web bytes were accepted"); }, (error) => {
        if (!/receipt|artifact|worker|match/i.test(String(error?.message))) throw error;
      });
      await Promise.resolve().then(() => composePronaosFromEnv({
        httpServer: createServer(), genesisDir: resolve(genesisRoot),
        env: { LAR_PRONAOS_WEB_ROOT: join(scratch, "missing-root"), LAR_PRONAOS_ARTIFACT_RECORD: resolve(artifactRecord) },
      })).then(() => { throw new Error("missing Web root was accepted"); }, (error) => {
        if (!/directory|absent|root/i.test(String(error?.message))) throw error;
      });
      const widenedRecord = join(scratch, "widened-record.json");
      writeFileSync(widenedRecord, JSON.stringify({ ...expected.record, routes: [...expected.record.routes, { path: "/private/document.json", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store", sha256: expected.record.routes[0].sha256 }] }));
      await Promise.resolve().then(() => composePronaosFromEnv({
        httpServer: createServer(), genesisDir: resolve(genesisRoot),
        env: { LAR_PRONAOS_WEB_ROOT: resolve(webRoot), LAR_PRONAOS_ARTIFACT_RECORD: widenedRecord },
      })).then(() => { throw new Error("private receipt route was accepted"); }, (error) => {
        if (!/pronaos|route|path|artifact/i.test(String(error?.message))) throw error;
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    return { transport: "in-process", routes: ["/", expected.worker.path, "/genesis/seed.json", `/genesis/cas/${expected.cid}`], refusals: 4, liveDocker: false, originReach: false };
  } finally {
    composition.dispose();
    dispatcher.dispose();
  }
}

export async function runPronaosLiveWitness({
  webRoot = resolve(REPO, "packages/lararium-web/dist"),
  artifactRecord = resolve(REPO, ".pronaos-build/pronaos-artifact.json"),
  genesisRoot = resolve(REPO, "genesis"),
  timeoutMs = 10_000,
} = {}) {
  if (!existsSync(NODE_COMPOSITION) || !existsSync(NODE_DISPATCHER)) {
    throw new Error("compiled Node composition is absent; run pnpm --filter @lararium/node build first");
  }
  const expected = expectedInputs({ webRoot: resolve(webRoot), artifactRecord: resolve(artifactRecord), genesisRoot: resolve(genesisRoot) });
  const child = spawn(process.execPath, [TOOL, "--child"], {
    cwd: REPO,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PRONAOS_WITNESS_WEB_ROOT: resolve(webRoot),
      PRONAOS_WITNESS_ARTIFACT_RECORD: resolve(artifactRecord),
      PRONAOS_WITNESS_GENESIS_ROOT: resolve(genesisRoot),
    },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let ready;
  try {
    ready = await waitForChild(child, timeoutMs);
    if (ready.pid !== child.pid || !Number.isInteger(ready.pid)) throw new Error("child readiness receipt has no matching process PID");
    if (!ready.faces || ready.faces.pronaos !== "Pronaos") {
      throw new Error("child did not publish Pronaos face ownership");
    }
    try { process.kill(ready.pid, 0); } catch { throw new Error(`process attribution PID is not live: ${ready.pid}`); }
    const cmdline = readFileSync(`/proc/${ready.pid}/cmdline`, "utf8").replaceAll("\0", " ");
    if (!cmdline.includes("pronaos-live-witness.mjs") || !cmdline.includes("--child")) {
      throw new Error(`process attribution does not resolve to the Pronaos child: ${cmdline}`);
    }

    const expectedPid = String(ready.pid);
    const indexResponse = await fetchChecked(child, ready, "/", mustFile(resolve(webRoot, expected.record.routes.find((entry) => entry.path === "/").file), "index"), { contentType: "text/html" });
    if (indexResponse.headers.get("cache-control") !== "no-store") throw new Error("/ must be no-store");
    await fetchChecked(child, ready, expected.worker.path, mustFile(resolve(webRoot, expected.worker.file), "worker"), { contentType: "javascript" });
    await fetchChecked(child, ready, "/genesis/seed.json", mustFile(expected.files.get("/genesis/seed.json"), "seed"), { contentType: "application/json" });
    await fetchChecked(child, ready, `/genesis/cas/${expected.cid}`, mustFile(expected.files.get(`/genesis/cas/${expected.cid}`), "CAS"), { contentType: "application/octet-stream" });

    for (const route of ["/assets/missing-worker.js", `/genesis/cas/${"0".repeat(64)}`, "/private/document.json", "/assets/%252e%252e/private.json", "/api/health/extra"]) {
      await fetchChecked(child, ready, route, undefined, { status: 404, notHtml: true });
    }
    await fetchChecked(child, ready, "/", undefined, { status: 405, notHtml: true, request: { method: "POST" } });
    return { pid: ready.pid, port: ready.port, socketPath: ready.socketPath, transport: ready.transport, routes: ["/", expected.worker.path, "/genesis/seed.json", `/genesis/cas/${expected.cid}`], liveDocker: false, originReach: ready.transport === "tcp" };
  } catch (error) {
    const suffix = stderr.trim() ? `; child stderr: ${stderr.trim()}` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}${suffix}`);
  } finally {
    if (!child.killed) child.kill("SIGTERM");
    if (!child.exitCode && child.signalCode === null) await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function childMain() {
  const [{ composePronaosFromEnv }, { mountHttpFaceDispatcher }] = await Promise.all([
    import(pathToFileURL(NODE_COMPOSITION).href),
    import(pathToFileURL(NODE_DISPATCHER).href),
  ]);
  const { createServer } = await import("node:http");
  const server = createServer();
  const dispatcher = mountHttpFaceDispatcher(server);
  let composition;
  let socketPath;
  let transport = "tcp";
  try {
    composition = composePronaosFromEnv({
      httpServer: server,
      genesisDir: process.env.PRONAOS_WITNESS_GENESIS_ROOT,
      dispatcher,
      env: {
        LAR_PRONAOS_WEB_ROOT: process.env.PRONAOS_WITNESS_WEB_ROOT,
        LAR_PRONAOS_ARTIFACT_RECORD: process.env.PRONAOS_WITNESS_ARTIFACT_RECORD,
      },
    });
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
    } catch (error) {
      // Some hermetic runners deny TCP bind while permitting local process
      // sockets. Keep the process witness useful without claiming LAN reach;
      // a reserved Docker run remains the origin-reach receipt.
      if (!error || !["EPERM", "EACCES"].includes(error.code)) throw error;
      socketPath = `/tmp/lararium-pronaos-${process.pid}.sock`;
      try {
        try { unlinkSync(socketPath); } catch { /* absent */ }
        await new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(socketPath, resolve);
        });
      } catch (error) {
        if (!error || !["EPERM", "EACCES"].includes(error.code)) throw error;
        // A fully hermetic runner may deny both TCP and filesystem sockets. The
        // same dispatcher still runs in a child process through a line protocol;
        // this keeps byte/refusal/process controls executable while explicitly
        // omitting origin reach.
        transport = "stdio";
      }
    }
    const address = server.address();
    if (transport !== "stdio" && !socketPath && (!address || typeof address === "string")) throw new Error("child did not bind a TCP port");
    process.stdout.write(`PRONAOS_WITNESS_READY ${JSON.stringify({ pid: process.pid, port: socketPath ? null : address?.port ?? null, socketPath, transport, faces: { pronaos: composition ? "Pronaos" : "absent" } })}\n`);
    if (transport === "stdio") {
      const { createInterface } = await import("node:readline");
      const input = createInterface({ input: process.stdin });
      const stop = () => input.close();
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
      for await (const line of input) {
        let request;
        try { request = JSON.parse(line); } catch { continue; }
        const chunks = [];
        let status = 200;
        let headers = {};
        const req = { url: request.route, method: request.method };
        const res = {
          writableEnded: false,
          headersSent: false,
          writeHead: (code, values = {}) => { status = code; headers = values; res.headersSent = true; },
          end: (body = "") => { res.writableEnded = true; chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body))); },
        };
        server.emit("request", req, res);
        await new Promise((resolve) => setImmediate(resolve));
        process.stdout.write(`PRONAOS_WITNESS_RESPONSE ${JSON.stringify({ status, headers, body: Buffer.concat(chunks).toString("base64") })}\n`);
      }
    } else {
      await new Promise((resolve) => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
    }
  } catch (error) {
    process.stdout.write(`PRONAOS_WITNESS_ERROR ${JSON.stringify(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 1;
  } finally {
    composition?.dispose();
    dispatcher.dispose();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    if (socketPath) try { unlinkSync(socketPath); } catch { /* already removed */ }
  }
}

if (process.argv[2] === "--child") await childMain();
else if (process.argv[1] && resolve(process.argv[1]) === TOOL) {
  try {
    const result = await runPronaosLiveWitness();
    console.log(`[pronaos-live] green: pid=${result.pid} transport=${result.transport} port=${result.port ?? "n/a"} routes=${result.routes.length}`);
    console.log(`[pronaos-live] Docker daemon/image/live-container reservation: not run (daemon-free witness; origin reach=${result.transport === "tcp" ? "loopback only" : "blocked by runner"})`);
  } catch (error) {
    console.error(`[pronaos-live] RED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
